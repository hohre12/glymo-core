// ── Hologram Gesture Processor ────────────────────────────────────────────────
//
// Pure math class that processes hand landmark positions and outputs
// rotation/spread/grab commands for the hologram renderer.
// No Three.js dependency — just geometry and smoothing.

import type { HologramGestureState, HitTestResult } from '../hologram/types.js';
import { HandStateImpl } from './HandStateImpl.js';

/** Landmark point with x, y, z in normalized [0,1] coordinates */
export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

/** Baseline snapshot recorded when two-hand control starts */
interface TwoHandBaseline {
  dist: number;
  angle: number;
  spread: number;
  rotZ: number;
}

/**
 * Stateful gesture processor for hologram manipulation.
 *
 * Feed it hand landmarks each frame via `update()`, and it produces
 * a `HologramGestureState` describing the desired hologram transforms.
 *
 * Two-hand mode: spread/rotation via relative hand distance, midpoint, and wrist angle.
 * Single-hand mode: pinch-to-grab individual characters.
 */
export class HologramGesture {
  // ── Accumulated rotation state ──────────────────────
  private rotX = 0;
  private rotY = 0;
  private rotZ = 0;
  private spread = 1;

  // ── Two-hand tracking ───────────────────────────────
  private baseline: TwoHandBaseline | null = null;
  private smoothMidX = 0.5;
  private smoothMidY = 0.5;
  private twoHandEntryTime = 0;
  private bothFistsPrev = false;

  // ── Single-hand grab tracking ───────────────────────
  private grabbedCharId: string | null = null;

  // ── Configuration ───────────────────────────────────
  /** Smoothing factor for midpoint (lower = heavier smoothing) */
  readonly midpointSmoothing: number;
  /** Dead zone radius for rotation joystick (0-0.5, normalized coords) */
  readonly deadZone: number;
  /** Rotation speed multiplier */
  readonly rotSpeed: number;
  /** Assumed FPS for per-frame rotation increment */
  readonly fps: number;
  /** Pinch threshold in normalized hand coords */
  readonly pinchThreshold: number;
  /** Spread smoothing factor */
  readonly spreadSmoothing: number;
  /** Z-rotation smoothing factor */
  readonly rotZSmoothing: number;
  /** Maximum Z angle delta per frame (prevents hand-swap spikes) */
  readonly maxZDelta: number;
  /** Delay before two-hand manipulation kicks in (ms) */
  readonly twoHandStableDelay: number;

  /** Callback for hit-testing characters (provided by the consumer) */
  private hitTestFn: ((x: number, y: number, maxDist: number) => HitTestResult | null) | null = null;

  constructor(options?: {
    midpointSmoothing?: number;
    deadZone?: number;
    rotSpeed?: number;
    fps?: number;
    pinchThreshold?: number;
    spreadSmoothing?: number;
    rotZSmoothing?: number;
    maxZDelta?: number;
    twoHandStableDelay?: number;
  }) {
    this.midpointSmoothing = options?.midpointSmoothing ?? 0.08;
    this.deadZone = options?.deadZone ?? 0.08;
    this.rotSpeed = options?.rotSpeed ?? 8.0;
    this.fps = options?.fps ?? 30;
    this.pinchThreshold = options?.pinchThreshold ?? 0.06;
    this.spreadSmoothing = options?.spreadSmoothing ?? 0.4;
    this.rotZSmoothing = options?.rotZSmoothing ?? 0.12;
    this.maxZDelta = options?.maxZDelta ?? 0.5;
    this.twoHandStableDelay = options?.twoHandStableDelay ?? 200;
  }

  /** Set the hit-test function used for single-hand grab */
  setHitTestFn(fn: (x: number, y: number, maxDist: number) => HitTestResult | null): void {
    this.hitTestFn = fn;
  }

  /** Reset all state to defaults */
  reset(): void {
    this.rotX = 0;
    this.rotY = 0;
    this.rotZ = 0;
    this.spread = 1;
    this.baseline = null;
    this.smoothMidX = 0.5;
    this.smoothMidY = 0.5;
    this.twoHandEntryTime = 0;
    this.bothFistsPrev = false;
    this.grabbedCharId = null;
  }

  /**
   * Process one frame of hand landmarks and return the desired hologram state.
   *
   * @param landmarks - Primary hand landmarks (21 points, normalized [0,1])
   * @param secondHand - Optional secondary hand landmarks
   * @param canvasWidth - Canvas width in CSS pixels (for pinch coordinate conversion)
   * @param canvasHeight - Canvas height in CSS pixels
   * @param mirrorX - Whether to mirror the X axis (selfie camera). Default true.
   * @returns The updated hologram gesture state
   */
  update(
    landmarks: ReadonlyArray<LandmarkPoint>,
    secondHand: ReadonlyArray<LandmarkPoint> | null,
    canvasWidth: number,
    canvasHeight: number,
    mirrorX = true,
  ): HologramGestureState {
    const hand1 = new HandStateImpl(landmarks as LandmarkPoint[]);
    const isFist = hand1.folded('index', 'middle', 'ring', 'pinky');
    const hasTwoHands = secondHand !== null && secondHand.length >= 21;
    const now = performance.now();
    let didReset = false;

    if (hasTwoHands) {
      // Release any grabbed char when switching to two-hand mode
      if (this.grabbedCharId !== null) {
        this.grabbedCharId = null;
      }

      const wrist1 = landmarks[0]!;
      const wrist2 = secondHand![0]!;
      const hand2 = new HandStateImpl(secondHand as LandmarkPoint[]);
      const isFist2 = hand2.folded('index', 'middle', 'ring', 'pinky');
      const bothFists = isFist && isFist2;

      // ── Both fists → reset signal (edge-detected) ──
      if (bothFists && !this.bothFistsPrev) {
        didReset = true;
      }
      this.bothFistsPrev = bothFists;

      if (!bothFists) {
        // Use palm center (landmark 9 = middle finger MCP)
        const palm1 = landmarks[9]!;
        const palm2 = secondHand![9]!;
        const midX = (palm1.x + palm2.x) / 2;
        const midY = (palm1.y + palm2.y) / 2;
        const horizDist = Math.abs(wrist1.x - wrist2.x);
        const angle = Math.atan2(wrist2.y - wrist1.y, wrist2.x - wrist1.x);

        // Record baselines on first two-hand frame
        if (this.baseline === null) {
          this.baseline = {
            dist: horizDist,
            angle,
            spread: this.spread,
            rotZ: this.rotZ,
          };
          this.smoothMidX = midX;
          this.smoothMidY = midY;
          this.twoHandEntryTime = now;
        }

        const stableTime = now - this.twoHandEntryTime;
        if (stableTime > this.twoHandStableDelay) {
          const bl = this.baseline;

          // ── SPREAD: horizontal distance ratio x baseline spread ──
          const targetSpread = (horizDist / bl.dist) * bl.spread;
          const clampedSpread = Math.max(0.1, Math.min(5.0, targetSpread));
          this.spread += (clampedSpread - this.spread) * this.spreadSmoothing;

          // ── X/Y ROTATION: virtual joystick (center=stop, edge=fast spin) ──
          this.smoothMidX += (midX - this.smoothMidX) * this.midpointSmoothing;
          this.smoothMidY += (midY - this.smoothMidY) * this.midpointSmoothing;

          const offsetX = this.smoothMidX - 0.5;
          const offsetY = this.smoothMidY - 0.5;

          if (Math.abs(offsetX) > this.deadZone) {
            const input = offsetX > 0 ? offsetX - this.deadZone : offsetX + this.deadZone;
            this.rotY += input * this.rotSpeed / this.fps;
          }
          if (Math.abs(offsetY) > this.deadZone) {
            const input = offsetY > 0 ? offsetY - this.deadZone : offsetY + this.deadZone;
            this.rotX += input * this.rotSpeed / this.fps;
          }

          // ── Z ROTATION: wrist angle delta -> roll ──
          let angleDelta = angle - bl.angle;
          if (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
          if (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;
          angleDelta = Math.max(-this.maxZDelta, Math.min(this.maxZDelta, angleDelta));
          const targetRotZ = bl.rotZ + angleDelta;
          this.rotZ += (targetRotZ - this.rotZ) * this.rotZSmoothing;
        }
      }

      return {
        rotX: this.rotX,
        rotY: this.rotY,
        rotZ: this.rotZ,
        spread: this.spread,
        handsActive: true,
        grabbedCharId: null,
        grabPosition: null,
        didReset,
      };
    }

    // ══ SINGLE HAND -> pinch to grab individual chars ═══════
    this.baseline = null;
    this.bothFistsPrev = false;

    const thumbTip = landmarks[4]!;
    const indexTip = landmarks[8]!;
    const pinchDist = Math.sqrt(
      (thumbTip.x - indexTip.x) ** 2 + (thumbTip.y - indexTip.y) ** 2
    );
    const isPinching = pinchDist < this.pinchThreshold;

    let grabPosition: { x: number; y: number } | null = null;

    if (isPinching) {
      const midX = (thumbTip.x + indexTip.x) / 2;
      const midY = (thumbTip.y + indexTip.y) / 2;
      const px = mirrorX ? (1 - midX) * canvasWidth : midX * canvasWidth;
      const py = midY * canvasHeight;

      if (this.grabbedCharId === null && this.hitTestFn) {
        const hit = this.hitTestFn(px, py, 100);
        if (hit) {
          this.grabbedCharId = hit.id;
        }
      }

      if (this.grabbedCharId !== null) {
        grabPosition = { x: px, y: py };
      }
    } else {
      // Released pinch -> drop char
      this.grabbedCharId = null;
    }

    return {
      rotX: this.rotX,
      rotY: this.rotY,
      rotZ: this.rotZ,
      spread: this.spread,
      handsActive: false,
      grabbedCharId: this.grabbedCharId,
      grabPosition,
      didReset: false,
    };
  }

  /** Get current rotation values (useful for external reset logic) */
  getRotation(): { rotX: number; rotY: number; rotZ: number } {
    return { rotX: this.rotX, rotY: this.rotY, rotZ: this.rotZ };
  }

  /** Get current spread value */
  getSpread(): number {
    return this.spread;
  }

  /** Directly set rotation (e.g. after external reset) */
  setRotation(rotX: number, rotY: number, rotZ: number): void {
    this.rotX = rotX;
    this.rotY = rotY;
    this.rotZ = rotZ;
  }

  /** Directly set spread (e.g. after external reset) */
  setSpread(spread: number): void {
    this.spread = spread;
  }
}
