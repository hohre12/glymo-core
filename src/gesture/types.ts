// ── Gesture DSL Types ────────────────────────────────

/** Named fingers on a hand */
export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

/** Names of built-in gesture presets */
export type BuiltInGesture = 'pinch' | 'fist' | 'point' | 'open-palm' | 'peace-sign' | 'thumbs-up';

/**
 * Ergonomic accessor over a set of hand landmarks.
 * All geometry is computed from the raw landmark array on-demand.
 * Immutable after construction — implementations must not mutate internal state.
 */
export interface HandState {
  /** Raw MediaPipe landmark positions (normalized screen coords + z depth) */
  readonly landmarks: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }>;

  /**
   * Returns true if ALL specified fingers have an extension score above
   * FINGER_EXTEND_THRESHOLD.
   */
  extended(...fingers: FingerName[]): boolean;

  /**
   * Returns true if ALL specified fingers have an extension score below
   * FINGER_FOLD_THRESHOLD.
   */
  folded(...fingers: FingerName[]): boolean;

  /**
   * 2D Euclidean distance between thumb tip (landmark 4) and index tip
   * (landmark 8) in normalized screen coordinates.
   */
  pinchDistance(): number;

  /**
   * Continuous extension score in [0, 1].
   * 0 = fully folded, 1 = fully extended.
   */
  fingerScore(finger: FingerName): number;
}

/**
 * A user-defined or built-in gesture detector function.
 * Called every frame with the current hand state.
 * Return true when the gesture is currently active.
 */
export type GestureDetectorFn = (hand: HandState, secondHand?: HandState) => boolean;

/** Event emitted when a gesture starts or ends */
export interface GestureEvent {
  /** Gesture name as registered via `define()` or a BuiltInGesture key */
  gesture: string;
  /** Primary hand state at the moment of emission */
  hand: HandState;
  /** Second hand state, present only for two-hand gestures */
  secondHand?: HandState;
  /** performance.now() timestamp at the moment of emission */
  timestamp: number;
}

/** Callback invoked on gesture start/end transitions */
export type GestureCallback = (event: GestureEvent) => void;
