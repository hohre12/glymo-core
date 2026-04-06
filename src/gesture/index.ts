// ── Gesture DSL Public API ───────────────────────────

// Types
export type {
  FingerName,
  BuiltInGesture,
  HandState,
  GestureDetectorFn,
  GestureEvent,
  GestureCallback,
} from './types.js';

// Constants
export {
  // Landmark indices
  WRIST,
  THUMB_CMC, THUMB_MCP, THUMB_IP, THUMB_TIP,
  INDEX_MCP, INDEX_PIP, INDEX_DIP, INDEX_TIP,
  MIDDLE_MCP, MIDDLE_PIP, MIDDLE_DIP, MIDDLE_TIP,
  RING_MCP, RING_PIP, RING_DIP, RING_TIP,
  PINKY_MCP, PINKY_PIP, PINKY_DIP, PINKY_TIP,
  LANDMARK_COUNT,
  // Thresholds
  PINCH_THRESHOLD,
  FINGER_FOLD_THRESHOLD,
  FINGER_EXTEND_THRESHOLD,
  ANGLE_FULLY_EXTENDED,
  ANGLE_FULLY_FOLDED,
  THUMB_RATIO_EXTENDED,
  THUMB_RATIO_FOLDED,
  // Debounce
  GESTURE_ACTIVATE_FRAMES,
  GESTURE_DEACTIVATE_FRAMES,
} from './constants.js';

// Math utilities
export { dist2dSq, dist3d, angleDeg, clamp01 } from './math.js';
export type { LandmarkLike } from './math.js';

// HandState implementation
export { HandStateImpl } from './HandStateImpl.js';

// Built-in gesture definitions
export { BUILTIN_GESTURES } from './builtins.js';

// Engine
export { GestureEngine } from './GestureEngine.js';
export type { RawLandmark, GestureEmitFn } from './GestureEngine.js';
