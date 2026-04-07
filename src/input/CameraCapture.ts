import type { InputCapture, RawInputPoint } from '../types.js';
import { PINCH_THRESHOLD } from '../gesture/constants.js';
import { clamp01 } from '../gesture/math.js';
import { OneEuroFilter } from '../filter/OneEuroFilter.js';
import { GestureDetector } from './GestureDetector.js';
import { computePinchDistance, computeSpeed, zToPressure } from './camera-utils.js';

// Re-export so existing consumers (e.g. index.ts, tests) are not broken
export { PINCH_THRESHOLD };
export { computePinchDistance, computeSpeed, zToPressure };

// ── Constants ────────────────────────────────────────

/** Number of consecutive frames required to confirm a pen state change */
const PEN_STATE_DEBOUNCE_FRAMES = 3;

/** Minimum pixel movement to emit a new point (rejects sub-pixel jitter) */
const MIN_MOVE_DISTANCE = 2.0;

// OneEuroFilter for position smoothing — uses the canonical implementation
// from src/filter/OneEuroFilter.ts. Essential for hand tracking where
// MediaPipe landmarks jitter significantly.

/** MediaPipe hand landmarker model URL */
export const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/** MediaPipe WASM runtime URL */
export const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

// ── Types for MediaPipe (avoid hard dependency) ──────

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarkerResult {
  landmarks: Landmark[][];
  worldLandmarks: Landmark[][];
}

interface HandLandmarkerInstance {
  detectForVideo(video: HTMLVideoElement, timestamp: number): HandLandmarkerResult;
  close(): void;
}

type PointCallback = (point: RawInputPoint) => void;
type PenStateCallback = (isDown: boolean) => void;
type ErrorCallback = (error: Error) => void;
type SuccessCallback = () => void;

/** Callback for raw landmark data (used by HandVisualizer) */
type LandmarkCallback = (landmarks: Landmark[], isPinching: boolean, secondHand?: Landmark[]) => void;

/**
 * Captures hand input via MediaPipe HandLandmarker.
 * Dynamically imports @mediapipe/tasks-vision (optional peer dependency).
 *
 * Pen state: pinch only (thumb tip to index tip distance).
 * Debounced over N frames to reject noise.
 * Auto stroke-break when pinch-held hand jumps a large distance.
 *
 * Speed gate rejects ultra-fast hand movements to filter noise.
 * Mirror correction flips X for front-facing camera.
 */
export class CameraCapture implements InputCapture {
  private canvas: HTMLCanvasElement | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private handLandmarker: HandLandmarkerInstance | null = null;
  private animFrameId: number | null = null;
  private active = false;
  private penDown = false;

  // Gesture-based draw mode: ☝️ point = draw, ✊ fist/other = don't draw
  private alwaysDrawMode = false;
  // When true, all drawing input is suppressed (pen state + points).
  // Landmarks and hand visibility callbacks still fire normally.
  private drawingPaused = false;
  // Callback for transit trail visualization (emits position during letter-to-letter transitions)
  private onTransitMove: ((x: number, y: number) => void) | null = null;
  // Multi-signal gesture detector (replaces simple threshold + debounce)
  private gestureDetector = new GestureDetector();
  // Count of consecutive frames with no hand detected (for hand-disappear debounce)
  private noHandFrames = 0;
  private readonly NO_HAND_DEBOUNCE = 5;

  // Debounce state: count consecutive frames wanting the opposite state
  private pendingStateFrames = 0;
  private pendingState = false;

  // Position tracking
  private lastDrawPos: { x: number; y: number } | null = null;

  // ── Velocity-based pause detection for letter separation ──
  // Replaces bbox approach. Much more natural: detects the pause between
  // letters, then breaks when the hand moves to a new position.
  private pauseFrames = 0;
  private pausedAt: { x: number; y: number } | null = null;

  // ── Pinch-tap letter break ──
  // While drawing (pointing), a quick thumb-index pinch = letter break.
  // State machine: OPEN → PINCHED → OPEN = one tap = one break.
  // This is the most reliable signal MediaPipe provides.

  // OneEuroFilters for position smoothing (critical for forward-pointing fingers)
  // minCutoff=1.0: moderate smoothing when hand is still (filters jitter)
  // beta=0.5: high speed responsiveness (no lag when drawing fast)
  // dCutoff=1.0: derivative smoothing
  private xFilter = new OneEuroFilter(1.0, 0.5, 1.0);
  private yFilter = new OneEuroFilter(1.0, 0.5, 1.0);

  // ── Second-hand drawing (hand index 1) ───────────────
  // Tracks a second concurrent pinch-based stroke independently from hand 0.
  // Uses its own filters and pen state so the two hands never interfere.
  private penDown2 = false;
  private pendingStateFrames2 = 0;
  private pendingState2 = false;
  private lastDrawPos2: { x: number; y: number } | null = null;
  private xFilter2 = new OneEuroFilter(1.0, 0.5, 1.0);
  private yFilter2 = new OneEuroFilter(1.0, 0.5, 1.0);
  // Callbacks for the second-hand stroke stream (optional — only set when caller needs two-hand drawing)
  private onPoint2: PointCallback | null = null;
  private onPenState2: PenStateCallback | null = null;

  private readonly onPoint: PointCallback;
  private readonly onPenState: PenStateCallback;
  private readonly onError: ErrorCallback;
  private readonly onSuccess: SuccessCallback;
  private onLandmarks: LandmarkCallback | null = null;
  private onGestureLandmarks: ((landmarks: Landmark[], secondHand?: Landmark[]) => void) | null = null;
  private onHandVisibility: ((visible: boolean) => void) | null = null;
  private handWasVisible = false;

  constructor(
    onPoint: PointCallback,
    onPenState: PenStateCallback,
    onError: ErrorCallback = () => {},
    onSuccess: SuccessCallback = () => {},
  ) {
    this.onPoint = onPoint;
    this.onPenState = onPenState;
    this.onError = onError;
    this.onSuccess = onSuccess;
  }

  /** Enable gesture-based draw mode: ☝️ point = draw, ✊ fist/other = don't draw */
  setAlwaysDrawMode(enabled: boolean): void {
    this.alwaysDrawMode = enabled;
  }

  /** Set callback for transit move events (fast hand movement between letters) */
  setTransitMoveCallback(cb: ((x: number, y: number) => void) | null): void {
    this.onTransitMove = cb;
  }

  /** Pause/resume all drawing input. Landmarks + hand visibility still fire. */
  setDrawingPaused(paused: boolean): void {
    this.drawingPaused = paused;
    // If pausing while pen is down, force pen up so current stroke ends
    if (paused && this.penDown) {
      this.penDown = false;

      this.lastDrawPos = null;
      this.pauseFrames = 0;
      this.pausedAt = null;
      this.xFilter.reset();
      this.yFilter.reset();
      this.onPenState(false);
    }
  }

  /** Set callback for hand visibility changes (for hand:lost / hand:found events) */
  setHandVisibilityCallback(cb: ((visible: boolean) => void) | null): void {
    this.onHandVisibility = cb;
  }

  /** Register a callback to receive raw landmark data each frame */
  setLandmarkCallback(cb: LandmarkCallback | null): void {
    this.onLandmarks = cb;
  }

  /** Register a callback that receives raw landmarks every frame for gesture processing */
  setGestureCallback(cb: ((landmarks: Landmark[], secondHand?: Landmark[]) => void) | null): void {
    this.onGestureLandmarks = cb;
  }

  /**
   * Register callbacks for second-hand (hand index 1) drawing events.
   * When set, the second hand uses pinch detection to draw independently
   * from the first hand. Pass null to disable second-hand drawing.
   */
  setSecondHandCallbacks(
    onPoint: PointCallback | null,
    onPenState: PenStateCallback | null,
  ): void {
    this.onPoint2 = onPoint;
    this.onPenState2 = onPenState;
    // Reset second-hand state when callbacks change
    if (!onPoint || !onPenState) {
      if (this.penDown2) {
        this.onPenState2?.(false);
      }
      this.penDown2 = false;
      this.pendingStateFrames2 = 0;
      this.pendingState2 = false;
      this.lastDrawPos2 = null;
      this.xFilter2.reset();
      this.yFilter2.reset();
    }
  }

  /** Return the internal video element (for webcam preview) */
  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  /** Initialize camera + MediaPipe and start detection loop */
  start(canvas: HTMLCanvasElement): void {
    if (this.active) return;
    if (!isBrowserEnvironment()) {
      this.onError(new Error('CameraCapture requires a browser environment'));
      return;
    }

    this.canvas = canvas;
    this.active = true;
    this.initAsync().catch((err: unknown) => {
      this.handleInitError(err);
    });
  }

  /** Stop detection, release camera and resources */
  stop(): void {
    if (!this.active) return;
    this.active = false;

    this.cancelAnimationFrame();
    this.releaseCamera();
    this.releaseHandLandmarker();

    this.canvas = null;
    this.penDown = false;
    this.pendingStateFrames = 0;
    this.pendingState = false;
    this.gestureDetector.reset();
    this.lastDrawPos = null;
    this.pauseFrames = 0;
    this.pausedAt = null;


    this.xFilter.reset();
    this.yFilter.reset();
    this.penDown2 = false;
    this.pendingStateFrames2 = 0;
    this.pendingState2 = false;
    this.lastDrawPos2 = null;
    this.xFilter2.reset();
    this.yFilter2.reset();
    this.onLandmarks = null;
  }

  isActive(): boolean {
    return this.active;
  }

  // ── Private: initialization ──────────────────────────

  private async initAsync(): Promise<void> {
    const mediapipe = await loadMediaPipe();
    if (!this.active) return;

    const vision = await mediapipe.FilesetResolver.forVisionTasks(WASM_URL);
    if (!this.active) return;

    this.handLandmarker = await mediapipe.HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      numHands: 2,
      runningMode: 'VIDEO',
      minHandDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    }) as HandLandmarkerInstance;
    if (!this.active) return;

    await this.startCamera();
    if (!this.active) return;

    this.startDetectionLoop();
    this.onSuccess();
  }

  private async startCamera(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    });

    this.video = document.createElement('video');
    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', '');
    await this.video.play();
  }

  private handleInitError(err: unknown): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.active = false;
    this.releaseCamera();
    this.onError(error);
  }

  // ── Private: detection loop ──────────────────────────

  private startDetectionLoop(): void {
    const detect = (): void => {
      if (!this.active) return;

      this.processFrame();
      this.animFrameId = requestAnimationFrame(detect);
    };

    this.animFrameId = requestAnimationFrame(detect);
  }

  private processFrame(): void {
    if (!this.video || !this.handLandmarker || !this.canvas) return;
    if (this.video.readyState < 2) return;

    const result = this.handLandmarker.detectForVideo(this.video, performance.now());
    const hasHand = (result.landmarks?.length ?? 0) > 0;

    // Handle hand disappearance → pen-up + hand:lost
    if (!hasHand) {
      this.noHandFrames++;
      if (this.penDown && this.noHandFrames >= this.NO_HAND_DEBOUNCE) {
        this.penDown = false;
  
        this.lastDrawPos = null;
        this.pauseFrames = 0;
        this.pausedAt = null;
        this.xFilter.reset();
        this.yFilter.reset();
        this.onPenState(false);
      }
      // Emit hand:lost when hand first disappears (after debounce)
      if (this.handWasVisible && this.noHandFrames >= this.NO_HAND_DEBOUNCE) {
        this.handWasVisible = false;
        this.onHandVisibility?.(false);
      }
      // Clear landmark overlay when no hand
      if (this.onLandmarks && this.noHandFrames >= this.NO_HAND_DEBOUNCE) {
        this.onLandmarks([], false);
      }
      return;
    }

    // Hand appeared
    if (!this.handWasVisible) {
      this.handWasVisible = true;
      this.onHandVisibility?.(true);
    }
    this.noHandFrames = 0;
    const landmarks = result.landmarks[0]!;
    const worldLandmarks = result.worldLandmarks[0]!;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const now = performance.now();

    // ── object-cover correction ──────────────────────────────────
    // The video is displayed with CSS object-cover, which scales the video
    // to fill the viewport while maintaining aspect ratio (cropping excess).
    // MediaPipe landmarks are in [0,1] normalized to the FULL video frame,
    // but we need coordinates in viewport/canvas space (accounting for crop).
    //
    // Without this correction, the skeleton and drawing positions are offset
    // from the actual hand position visible on screen.
    const videoW = this.video!.videoWidth || 640;
    const videoH = this.video!.videoHeight || 480;
    const coverScale = Math.max(canvasWidth / videoW, canvasHeight / videoH);
    const displayW = videoW * coverScale;
    const displayH = videoH * coverScale;
    const cropX = (displayW - canvasWidth) / 2;
    const cropY = (displayH - canvasHeight) / 2;

    /** Adjust a landmark from video-normalized to viewport-normalized [0,1] */
    const adjustLm = (lm: { x: number; y: number; z: number }) => ({
      x: (lm.x * displayW - cropX) / canvasWidth,
      y: (lm.y * displayH - cropY) / canvasHeight,
      z: lm.z,
    });

    // Adjust all landmarks for correct overlay alignment
    const adjLandmarks = landmarks.map(adjustLm);
    const adjSecondHand = (result.landmarks?.length ?? 0) > 1
      ? result.landmarks[1]!.map(adjustLm)
      : undefined;

    let isPenDown: boolean;

    // Drawing paused (e.g. eraser/move tool active) — skip all pen logic
    if (this.drawingPaused) {
      isPenDown = false;
      // Still emit landmarks for hand visualization + tool interaction
      if (this.onLandmarks) {
        this.onLandmarks(adjLandmarks, false, adjSecondHand);
      }
      return;
    }

    if (this.alwaysDrawMode) {
      // ── Dual-signal pen control ─────────────────────────
      //
      // Pen DOWN: gesture detector says "pointing" (index extended)
      // Pen UP:   pinch detected (thumb touches index) — INSTANT, no EMA delay
      //
      // Why pinch for pen-up? When making a fist, the thumb naturally touches
      // the index finger first. Pinch distance is MediaPipe's most reliable
      // signal — works perfectly regardless of finger orientation.
      //
      // The gesture detector (with slow EMA) is used ONLY for pen-down,
      // where a small delay (2-frame debounce) is acceptable.

      const isPointing = this.gestureDetector.update(landmarks, worldLandmarks);
      const pinchDist = computePinchDistance(landmarks[4]!, landmarks[8]!);
      const isPinching = pinchDist < PINCH_THRESHOLD;

      if (this.penDown) {
        // ── While drawing: pinch = INSTANT pen-up ──
        if (isPinching) {
          this.penDown = false;
    
          this.lastDrawPos = null;
          this.pauseFrames = 0;
          this.pausedAt = null;
          this.onPenState(false);
        }
      } else {
        // ── While not drawing: pointing + NOT pinching = pen-down ──
        // Both conditions required: finger must be extended AND thumb not touching
        if (isPointing && !isPinching) {
          this.penDown = true;
    
          this.lastDrawPos = null;
          this.pauseFrames = 0;
          this.pausedAt = null;
          this.xFilter.reset();
          this.yFilter.reset();
          this.onPenState(true);
        }
      }

      isPenDown = this.penDown;
    } else {
      // Pinch mode (original behavior)
      isPenDown = this.detectPenState(landmarks, worldLandmarks);
    }

    // Emit adjusted landmark data for HandVisualizer overlay
    if (this.onLandmarks) {
      this.onLandmarks(adjLandmarks, isPenDown, adjSecondHand);
    }
    // Feed raw landmarks into gesture engine (uses normalized coords)
    if (this.onGestureLandmarks) {
      const rawSecondHand = (result.landmarks?.length ?? 0) > 1 ? result.landmarks[1]! : undefined;
      this.onGestureLandmarks(landmarks, rawSecondHand);
    }

    // ── Compute drawing position ──────────────────────────
    // Only feed the OneEuroFilter when pen is down (or about to go down).
    // When pen is up (fist/other), the fingertip landmark is unreliable
    // (curled position, near palm) — feeding it would contaminate the filter
    // and cause the first frame of the next stroke to start at the wrong position.

    // Use adjusted (viewport-corrected) landmarks for drawing position
    const tip2d = adjLandmarks[8]!;
    const dip2d = adjLandmarks[7]!;

    // Detect forward-pointing: compare worldLandmark z-depths of tip vs MCP
    const tipZ = worldLandmarks[8]!.z;
    const mcpZ = worldLandmarks[5]!.z;
    const zDiff = mcpZ - tipZ;
    const forwardness = clamp01((zDiff - 0.01) / 0.04);
    const blendWeight = forwardness * 0.3;

    const rawX = (1 - (tip2d.x * (1 - blendWeight) + dip2d.x * blendWeight)) * canvasWidth;
    const rawY = (tip2d.y * (1 - blendWeight) + dip2d.y * blendWeight) * canvasHeight;

    // Only filter when drawing — keeps filter state clean
    const filteredX = isPenDown ? this.xFilter.filter(rawX, now) : rawX;
    const filteredY = isPenDown ? this.yFilter.filter(rawY, now) : rawY;

    const indexTip = {
      x: filteredX,
      y: filteredY,
      z: worldLandmarks[8]!.z,
    };

    this.emitPoint(indexTip, now);

    // ── Second-hand drawing (hand index 1) ───────────────────────────
    // Only runs when a caller has registered second-hand callbacks and drawing
    // is not paused. Uses simple pinch mode (same threshold as hand 0 pinch mode).
    if (this.onPoint2 && this.onPenState2 && !this.drawingPaused && adjSecondHand) {
      this.processSecondHand(adjSecondHand, now, canvasWidth, canvasHeight);
    } else if (this.penDown2 && this.onPenState2 && !adjSecondHand) {
      // Second hand disappeared — force pen up
      this.penDown2 = false;
      this.pendingStateFrames2 = 0;
      this.lastDrawPos2 = null;
      this.xFilter2.reset();
      this.yFilter2.reset();
      this.onPenState2(false);
    }
  }

  /**
   * Process the second hand (index 1) for drawing via pinch detection.
   * Uses its own filters and pen state, independent of hand 0.
   * Only called when second-hand callbacks are registered.
   */
  private processSecondHand(
    adjLandmarks2: Landmark[],
    now: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (adjLandmarks2.length < 21) return;

    const pinchDist = computePinchDistance(adjLandmarks2[4]!, adjLandmarks2[8]!);
    const isPinching2 = pinchDist < PINCH_THRESHOLD;

    // Debounce pen state changes for hand 1 (same logic as hand 0 detectPenState)
    if (isPinching2 !== this.penDown2) {
      if (isPinching2 === this.pendingState2) {
        this.pendingStateFrames2++;
      } else {
        this.pendingState2 = isPinching2;
        this.pendingStateFrames2 = 1;
      }

      if (this.pendingStateFrames2 >= PEN_STATE_DEBOUNCE_FRAMES) {
        this.penDown2 = isPinching2;
        this.pendingStateFrames2 = 0;
        this.lastDrawPos2 = null;

        if (isPinching2) {
          this.xFilter2.reset();
          this.yFilter2.reset();
          this.onPenState2!(true);
        } else {
          this.xFilter2.reset();
          this.yFilter2.reset();
          this.onPenState2!(false);
        }
      }
    } else {
      this.pendingStateFrames2 = 0;
    }

    if (!this.penDown2) return;

    // Compute mirrored position for hand 1 index fingertip
    const tip2 = adjLandmarks2[8]!;
    const rawX2 = (1 - tip2.x) * canvasWidth;
    const rawY2 = tip2.y * canvasHeight;

    const filteredX2 = this.xFilter2.filter(rawX2, now);
    const filteredY2 = this.yFilter2.filter(rawY2, now);

    // Minimum movement threshold to reject sub-pixel jitter
    if (this.lastDrawPos2) {
      const mdx = filteredX2 - this.lastDrawPos2.x;
      const mdy = filteredY2 - this.lastDrawPos2.y;
      if (Math.sqrt(mdx * mdx + mdy * mdy) < MIN_MOVE_DISTANCE) return;
    }

    this.lastDrawPos2 = { x: filteredX2, y: filteredY2 };

    const point2: RawInputPoint = {
      x: filteredX2,
      y: filteredY2,
      t: now,
      source: 'camera',
      pressure: zToPressure(tip2.z),
    };
    this.onPoint2!(point2);
  }

  /**
   * Detect pen state using pinch only, with debouncing.
   * Requires PEN_STATE_DEBOUNCE_FRAMES consecutive frames of the new state
   * before actually transitioning, to reject MediaPipe tracking noise.
   */
  private detectPenState(landmarks: Landmark[], _worldLandmarks: Landmark[]): boolean {
    const pinchDist = computePinchDistance(landmarks[4]!, landmarks[8]!);
    const isPinching = pinchDist < PINCH_THRESHOLD;

    // Debounce: only change state after N consecutive frames agree
    if (isPinching !== this.penDown) {
      if (isPinching === this.pendingState) {
        this.pendingStateFrames++;
      } else {
        this.pendingState = isPinching;
        this.pendingStateFrames = 1;
      }

      if (this.pendingStateFrames >= PEN_STATE_DEBOUNCE_FRAMES) {
        this.penDown = isPinching;
        this.pendingStateFrames = 0;
  

        if (isPinching) {
          this.lastDrawPos = null;
          this.pauseFrames = 0;
          this.pausedAt = null;
          this.onPenState(true);
        } else {
          this.lastDrawPos = null;
          this.pauseFrames = 0;
          this.pausedAt = null;
          this.onPenState(false);
        }
      }
    } else {
      // State matches — reset debounce counter
      this.pendingStateFrames = 0;
    }

    return isPinching;
  }

  private emitPoint(indexTip: { x: number; y: number; z: number }, now: number): void {
    const { x, y } = indexTip;

    // ── Not drawing — skip ──────────
    if (!this.penDown) {
      return;
    }

    // Minimum movement threshold: reject sub-pixel jitter from OneEuroFilter
    if (this.lastDrawPos) {
      const mdx = x - this.lastDrawPos.x;
      const mdy = y - this.lastDrawPos.y;
      if (Math.sqrt(mdx * mdx + mdy * mdy) < MIN_MOVE_DISTANCE) return;
    }

    // ── Velocity-based pause detection for letter separation ──────────
    // How it works:
    //   1. Compute frame-to-frame velocity of the filtered position
    //   2. If velocity stays below threshold for PAUSE_FRAMES_REQUIRED frames → "paused"
    //   3. When hand starts moving again after a pause, check displacement
    //   4. If displacement > BREAK_DISPLACEMENT → new letter → break stroke
    //
    // Why this is better than bbox:
    //   - Bbox grows from jitter, making the threshold too high
    //   - Velocity-pause naturally matches handwriting: write → pause → move → write
    //   - No false breaks during fast drawing (velocity is high, not paused)
    const PAUSE_VELOCITY = 3.0;    // px/frame — below this = "hand is resting"
    const PAUSE_FRAMES_REQUIRED = 5; // ~170ms at 30fps — catches natural between-letter pauses
    const BREAK_DISPLACEMENT = 40;   // px — must move this far after pause to break

    if (this.lastDrawPos) {
      const dx = x - this.lastDrawPos.x;
      const dy = y - this.lastDrawPos.y;
      const velocity = Math.sqrt(dx * dx + dy * dy);

      if (velocity < PAUSE_VELOCITY) {
        // Hand is resting
        this.pauseFrames++;
        if (this.pauseFrames >= PAUSE_FRAMES_REQUIRED && !this.pausedAt) {
          // Mark the pause position
          this.pausedAt = { x, y };
        }
      } else {
        // Hand is moving
        if (this.pausedAt) {
          // Was paused, now moving — check if this is a letter transition
          const pdx = x - this.pausedAt.x;
          const pdy = y - this.pausedAt.y;
          const displacement = Math.sqrt(pdx * pdx + pdy * pdy);

          if (displacement > BREAK_DISPLACEMENT) {
            // Letter break! Transit sparkle + stroke split
            if (this.onTransitMove) {
              this.onTransitMove(x, y);
            }
            this.onPenState(false);
            this.onPenState(true);
      
            this.lastDrawPos = null;
          }
          this.pausedAt = null;
        }
        this.pauseFrames = 0;
      }
    }

    this.lastDrawPos = { x, y };

    const point: RawInputPoint = {
      x,
      y,
      t: now,
      source: 'camera',
      pressure: zToPressure(indexTip.z),
    };
    this.onPoint(point);
  }

  // ── Private: cleanup ─────────────────────────────────

  private cancelAnimationFrame(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private releaseCamera(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
  }

  private releaseHandLandmarker(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
  }
}

// ── Helpers ──────────────────────────────────────────

/** Check if running in a browser environment */
function isBrowserEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

/** Dynamically import @mediapipe/tasks-vision */
async function loadMediaPipe(): Promise<{
  HandLandmarker: { createFromOptions: (...args: unknown[]) => Promise<unknown> };
  FilesetResolver: { forVisionTasks: (...args: unknown[]) => Promise<unknown> };
}> {
  try {
    return await import('@mediapipe/tasks-vision') as unknown as {
      HandLandmarker: { createFromOptions: (...args: unknown[]) => Promise<unknown> };
      FilesetResolver: { forVisionTasks: (...args: unknown[]) => Promise<unknown> };
    };
  } catch {
    throw new Error(
      '@mediapipe/tasks-vision is not installed. ' +
      'Install it as a peer dependency: npm install @mediapipe/tasks-vision',
    );
  }
}
