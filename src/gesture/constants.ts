// ── MediaPipe Hand Landmark Indices ─────────────────
// Reference: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker

/** Wrist landmark index */
export const WRIST = 0;

// ── Thumb ─────────────────────────────────────────
export const THUMB_CMC = 1;
export const THUMB_MCP = 2;
export const THUMB_IP  = 3;
export const THUMB_TIP = 4;

// ── Index finger ──────────────────────────────────
export const INDEX_MCP = 5;
export const INDEX_PIP = 6;
export const INDEX_DIP = 7;
export const INDEX_TIP = 8;

// ── Middle finger ─────────────────────────────────
export const MIDDLE_MCP = 9;
export const MIDDLE_PIP = 10;
export const MIDDLE_DIP = 11;
export const MIDDLE_TIP = 12;

// ── Ring finger ───────────────────────────────────
export const RING_MCP = 13;
export const RING_PIP = 14;
export const RING_DIP = 15;
export const RING_TIP = 16;

// ── Pinky finger ──────────────────────────────────
export const PINKY_MCP = 17;
export const PINKY_PIP = 18;
export const PINKY_DIP = 19;
export const PINKY_TIP = 20;

// ── Total landmark count ──────────────────────────
export const LANDMARK_COUNT = 21;

// ── Gesture Detection Thresholds ─────────────────
/**
 * Normalized 2D distance between thumb tip and index tip below which
 * a pinch gesture is considered active.
 * Source: empirically tuned for MediaPipe normalized coords.
 */
export const PINCH_THRESHOLD = 0.055;

/**
 * Finger extension score below this value → finger is considered folded.
 * Used by HandState.folded(). Range: [0, 1].
 */
export const FINGER_FOLD_THRESHOLD = 0.6;

/**
 * Finger extension score above this value → finger is considered extended.
 * Used by HandState.extended(). Range: [0, 1].
 */
export const FINGER_EXTEND_THRESHOLD = 0.7;

// ── Finger Score Angle Thresholds ────────────────
/**
 * PIP joint angle (degrees) above which a finger is considered fully extended.
 * Based on GestureDetector.fingerExtensionScore in CameraCapture.ts.
 */
export const ANGLE_FULLY_EXTENDED = 160;

/**
 * PIP joint angle (degrees) below which a finger is considered fully folded.
 */
export const ANGLE_FULLY_FOLDED = 90;

// ── Thumb Score Ratio Thresholds ─────────────────
/**
 * Extension ratio (tip-to-wrist / MCP-to-wrist) above which thumb is fully extended.
 * Mirrors the (ratio - 1.0) / 0.5 formula: ratio >= 1.5 → score = 1.0
 */
export const THUMB_RATIO_EXTENDED = 1.5;

/**
 * Extension ratio at or below which thumb is fully folded.
 * ratio <= 1.0 → score = 0.0
 */
export const THUMB_RATIO_FOLDED = 1.0;

// ── GestureEngine Debounce ────────────────────────
/**
 * Number of consecutive frames a gesture must be detected before it is
 * considered active (start event fires).
 */
export const GESTURE_ACTIVATE_FRAMES = 2;

/**
 * Number of consecutive frames a gesture must be absent before it is
 * considered ended (end event fires).
 */
export const GESTURE_DEACTIVATE_FRAMES = 2;
