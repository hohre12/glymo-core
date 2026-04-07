import type { InputCapture, RawInputPoint } from '../types.js';
import { PINCH_THRESHOLD } from '../gesture/constants.js';

// Re-export so existing consumers (e.g. index.ts) are not broken
export { PINCH_THRESHOLD };

// ── Constants ────────────────────────────────────────

/** Number of consecutive frames required to confirm a pen state change */
const PEN_STATE_DEBOUNCE_FRAMES = 3;

/** Minimum pixel movement to emit a new point (rejects sub-pixel jitter) */
const MIN_MOVE_DISTANCE = 2.0;

// ── OneEuroFilter (position smoothing) ──────────────
// Adaptive low-pass filter: low jitter when still, low latency when moving fast.
// Essential for hand tracking where MediaPipe landmarks jitter significantly.

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number): number {
    if (this.y === null || this.s === null) {
      this.y = value;
      this.s = value;
      return value;
    }
    this.s = alpha * value + (1 - alpha) * this.s;
    this.y = this.s;
    return this.y;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }

  lastValue(): number | null {
    return this.y;
  }
}

class OneEuroFilter {
  private freq: number;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;

  /**
   * @param freq    Expected signal frequency (Hz). ~30 for 30fps camera.
   * @param minCutoff  Minimum cutoff frequency. Lower = more smoothing when still. (default 1.0)
   * @param beta    Speed coefficient. Higher = less lag when moving fast. (default 0.007)
   * @param dCutoff Derivative cutoff frequency. (default 1.0)
   */
  constructor(freq = 30, minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number): number {
    const te = 1.0 / this.freq;
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  filter(value: number, timestamp?: number): number {
    if (this.lastTime !== null && timestamp !== undefined) {
      const dt = (timestamp - this.lastTime) / 1000; // ms → sec
      if (dt > 0) this.freq = 1.0 / dt;
    }
    this.lastTime = timestamp ?? null;

    const prevX = this.xFilter.lastValue();
    const dx = prevX !== null ? (value - prevX) * this.freq : 0;
    const edx = this.dxFilter.filter(dx, this.alpha(this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(value, this.alpha(cutoff));
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}


// ── Gesture Detection Engine ─────────────────────────

/**
 * Multi-signal gesture detector with hysteresis and EMA smoothing.
 *
 * Instead of a single binary check, this fuses 3 signals into a confidence
 * score [0,1], smooths it with an exponential moving average, then applies
 * hysteresis thresholds to produce a stable on/off state.
 *
 * Signals:
 *   1. Extension ratio — index tip distance from wrist vs MCP distance
 *   2. Curl angle — PIP-DIP-TIP angle (straight ≈ 180°, curled ≈ 60°)
 *   3. Other-fingers curl — middle+ring+pinky should be curled for ☝️ point
 *
 * This eliminates chattering at threshold boundaries and handles
 * transitional hand poses gracefully.
 */
class GestureDetector {
  // ── Hysteresis thresholds on the smoothed confidence ──
  private static readonly ACTIVATE_THRESHOLD = 0.50;
  private static readonly DEACTIVATE_THRESHOLD = 0.15;

  // ── Fixed EMA factor ──
  // 0.40 = responsive to deliberate gestures. The 4-frame debounce alone provides
  // noise immunity — a single garbage frame drops to 0.51, still above 0.15.
  // Fist detection: ~8 frames ≈ 270ms (was 15 frames ≈ 500ms with alpha=0.15)
  private static readonly EMA_ALPHA = 0.40;

  // ── Debounce: require N consecutive frames wanting state change ──
  // Balanced: pen-down responsive (2 frames), pen-up moderate (4 frames)
  // 4 frames ≈ 130ms at 30fps — filters single-frame noise but allows
  // the user to intentionally stop drawing by making a fist
  private static readonly ACTIVATE_DEBOUNCE = 2;
  private static readonly DEACTIVATE_DEBOUNCE = 4;

  private smoothedConfidence = 0;
  private isPointing = false;
  private deactivateFrames = 0;
  private activateFrames = 0;

  reset(): void {
    this.smoothedConfidence = 0;
    this.isPointing = false;
    this.deactivateFrames = 0;
    this.activateFrames = 0;
  }

  /**
   * Process one frame of landmarks. Returns stable pointing state.
   * Uses worldLandmarks (3D, meters) for gesture classification —
   * immune to camera perspective foreshortening.
   * Falls back to 2D landmarks if worldLandmarks unavailable.
   *
   * Stability strategy (3 layers):
   *   Layer 1: Fixed EMA (α=0.15) — single bad frames can't move the average
   *   Layer 2: Wide hysteresis gap (0.50 / 0.15) — needs sustained low confidence
   *   Layer 3: Frame debounce (8 frames for deactivation) — final safety net
   */
  update(landmarks: Landmark[], worldLandmarks?: Landmark[]): boolean {
    const gestureMarks = worldLandmarks ?? landmarks;
    const rawConfidence = this.computeConfidence(gestureMarks);

    // Fixed-rate EMA: immune to single-frame noise spikes
    this.smoothedConfidence =
      GestureDetector.EMA_ALPHA * rawConfidence +
      (1 - GestureDetector.EMA_ALPHA) * this.smoothedConfidence;

    // Hysteresis + frame-based debounce
    if (!this.isPointing) {
      // Trying to activate (pen down)
      if (this.smoothedConfidence >= GestureDetector.ACTIVATE_THRESHOLD) {
        this.activateFrames++;
        if (this.activateFrames >= GestureDetector.ACTIVATE_DEBOUNCE) {
          this.isPointing = true;
          this.activateFrames = 0;
          this.deactivateFrames = 0;
        }
      } else {
        this.activateFrames = 0;
      }
    } else {
      // Trying to deactivate (pen up) — must be sustained and deliberate
      if (this.smoothedConfidence <= GestureDetector.DEACTIVATE_THRESHOLD) {
        this.deactivateFrames++;
        if (this.deactivateFrames >= GestureDetector.DEACTIVATE_DEBOUNCE) {
          this.isPointing = false;
          this.deactivateFrames = 0;
          this.activateFrames = 0;
        }
      } else {
        this.deactivateFrames = 0;
      }
    }

    return this.isPointing;
  }

  getConfidence(): number {
    return this.smoothedConfidence;
  }

  /**
   * Multiplicative confidence: index must be extended AND middle must NOT be.
   *
   * Formula:
   *   confidence = indexScore × middleGate × othersBonus
   *
   * Results per gesture:
   *   ☝️ Point:     1.0 × 1.0 × 1.0 = 1.00  ✓ draw
   *   ✌️ Peace:     1.0 × 0.15 × 0.8 = 0.12  ✗ no draw
   *   ✊ Fist:      0.0 × 1.0 × 1.0  = 0.00  ✗ no draw
   *   ✋ Open hand: 1.0 × 0.15 × 0.6 = 0.09  ✗ no draw
   *   👆 Thumb+index: 1.0 × 1.0 × 0.8 = 0.80 ✓ draw (ok, natural pointing)
   */
  private computeConfidence(landmarks: Landmark[]): number {
    const indexScore = this.fingerExtensionScore(landmarks, 8, 6, 7, 5);
    const middleScore = this.fingerExtensionScore(landmarks, 12, 10, 11, 9);

    // Middle finger gate: if middle is extended, kill confidence
    // middleScore=0 (curled) → gate=1.0, middleScore=1 (extended) → gate=0.15
    const middleGate = 1.0 - middleScore * 0.85;

    // Ring + pinky curl bonus: more curled = more likely deliberate point
    const ringScore = this.fingerExtensionScore(landmarks, 16, 14, 15, 13);
    const pinkyScore = this.fingerExtensionScore(landmarks, 20, 18, 19, 17);
    const curledCount = (ringScore < 0.4 ? 1 : 0) + (pinkyScore < 0.4 ? 1 : 0);
    // 0 curled → 0.6, 1 curled → 0.8, 2 curled → 1.0
    const othersBonus = 0.6 + curledCount * 0.2;

    return indexScore * middleGate * othersBonus;
  }

  /**
   * Unified finger extension score [0, 1] combining two signals:
   *   1. Extension ratio: tip-to-wrist / MCP-to-wrist distance
   *   2. Curl angle: PIP→DIP→TIP angle (straight ≈ 170°, curled ≈ 60°)
   *
   * Returns the average of both signals for robustness against
   * single-metric failures (hand angle, occlusion, etc.)
   */
  private fingerExtensionScore(
    landmarks: Landmark[],
    tipIdx: number, pipIdx: number, dipIdx: number, mcpIdx: number,
  ): number {
    const wrist = landmarks[0]!;
    const tip = landmarks[tipIdx]!;
    const mcp = landmarks[mcpIdx]!;
    const pip = landmarks[pipIdx]!;
    const dip = landmarks[dipIdx]!;

    // Signal A: extension ratio (3D distance — immune to foreshortening)
    const tipDist = dist3d(tip, wrist);
    const mcpDist = dist3d(mcp, wrist);
    const ratio = mcpDist > 0.001 ? tipDist / mcpDist : 0;
    const extensionSignal = clamp01((ratio - 1.0) / 0.5);

    // Signal B: curl angle at DIP joint
    const angle = angleDeg(pip, dip, tip);
    const angleSignal = clamp01((angle - 80) / 80);

    // Average: robust against single-signal noise
    return (extensionSignal + angleSignal) / 2;
  }
}

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
  private lastPoint: { x: number; y: number; t: number } | null = null;
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
  private wasPinching = false;
  private pinchBreakReady = false; // true after pinch detected, waiting for release

  // OneEuroFilters for position smoothing (critical for forward-pointing fingers)
  // minCutoff=1.0: moderate smoothing when hand is still (filters jitter)
  // beta=0.5: high speed responsiveness (no lag when drawing fast)
  // dCutoff=1.0: derivative smoothing
  private xFilter = new OneEuroFilter(30, 1.0, 0.5, 1.0);
  private yFilter = new OneEuroFilter(30, 1.0, 0.5, 1.0);

  // ── Second-hand drawing (hand index 1) ───────────────
  // Tracks a second concurrent pinch-based stroke independently from hand 0.
  // Uses its own filters and pen state so the two hands never interfere.
  private penDown2 = false;
  private pendingStateFrames2 = 0;
  private pendingState2 = false;
  private lastDrawPos2: { x: number; y: number } | null = null;
  private xFilter2 = new OneEuroFilter(30, 1.0, 0.5, 1.0);
  private yFilter2 = new OneEuroFilter(30, 1.0, 0.5, 1.0);
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
      this.lastPoint = null;
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
    this.lastPoint = null;
    this.lastDrawPos = null;
    this.pauseFrames = 0;
    this.pausedAt = null;
    this.wasPinching = false;
    this.pinchBreakReady = false;
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
      video: { facingMode: 'user', width: 640, height: 480 },
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
        this.lastPoint = null;
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
          this.lastPoint = null;
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
          this.lastPoint = null;
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
        this.lastPoint = null;

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

    // ── Not drawing — just track last position ──────────
    if (!this.penDown) {
      this.lastPoint = { x, y, t: now };
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
            this.lastPoint = null;
            this.lastDrawPos = null;
          }
          this.pausedAt = null;
        }
        this.pauseFrames = 0;
      }
    }

    this.lastDrawPos = { x, y };
    this.lastPoint = { x, y, t: now };

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

/** Euclidean distance between thumb tip and index tip (normalized coords) */
export function computePinchDistance(thumb: Landmark, index: Landmark): number {
  return Math.sqrt(
    (thumb.x - index.x) ** 2 +
    (thumb.y - index.y) ** 2,
  );
}

/** Compute movement speed in canvas-px per ms */
export function computeSpeed(
  prev: { x: number; y: number; t: number },
  curr: { x: number; y: number },
  now: number,
): number {
  const dt = now - prev.t;
  if (dt <= 0) return Infinity;
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;
  return Math.sqrt(dx * dx + dy * dy) / dt;
}

/** 3D Euclidean distance between two landmarks (works with both 2D and 3D coords) */
function dist3d(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/** Angle in degrees at vertex B for triangle A-B-C (3D-aware) */
function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);
  if (magBA < 0.0001 || magBC < 0.0001) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/** Clamp value to [0, 1] */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Map Z-depth to pressure (closer to camera = higher pressure) */
export function zToPressure(z: number): number {
  // z is in meters, negative = closer to camera
  // Map range [-0.15, 0] → [1.0, 0.6]
  // Raised floor from 0.3 to 0.6 so camera strokes are never too thin.
  const normalized = Math.max(0, Math.min(1, -z / 0.15));
  return 0.6 + normalized * 0.4;
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
