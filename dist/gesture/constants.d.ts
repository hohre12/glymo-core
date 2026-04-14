/** Wrist landmark index */
export declare const WRIST = 0;
export declare const THUMB_CMC = 1;
export declare const THUMB_MCP = 2;
export declare const THUMB_IP = 3;
export declare const THUMB_TIP = 4;
export declare const INDEX_MCP = 5;
export declare const INDEX_PIP = 6;
export declare const INDEX_DIP = 7;
export declare const INDEX_TIP = 8;
export declare const MIDDLE_MCP = 9;
export declare const MIDDLE_PIP = 10;
export declare const MIDDLE_DIP = 11;
export declare const MIDDLE_TIP = 12;
export declare const RING_MCP = 13;
export declare const RING_PIP = 14;
export declare const RING_DIP = 15;
export declare const RING_TIP = 16;
export declare const PINKY_MCP = 17;
export declare const PINKY_PIP = 18;
export declare const PINKY_DIP = 19;
export declare const PINKY_TIP = 20;
export declare const LANDMARK_COUNT = 21;
/**
 * Normalized 2D distance between thumb tip and index tip below which
 * a pinch gesture is considered active.
 * Source: empirically tuned for MediaPipe normalized coords.
 */
export declare const PINCH_THRESHOLD = 0.045;
/**
 * Finger extension score below this value → finger is considered folded.
 * Used by HandState.folded(). Range: [0, 1].
 */
export declare const FINGER_FOLD_THRESHOLD = 0.6;
/**
 * Finger extension score above this value → finger is considered extended.
 * Used by HandState.extended(). Range: [0, 1].
 */
export declare const FINGER_EXTEND_THRESHOLD = 0.7;
/**
 * PIP joint angle (degrees) above which a finger is considered fully extended.
 * Based on GestureDetector.fingerExtensionScore in CameraCapture.ts.
 */
export declare const ANGLE_FULLY_EXTENDED = 160;
/**
 * PIP joint angle (degrees) below which a finger is considered fully folded.
 */
export declare const ANGLE_FULLY_FOLDED = 90;
/**
 * Extension ratio (tip-to-wrist / MCP-to-wrist) above which thumb is fully extended.
 * Mirrors the (ratio - 1.0) / 0.5 formula: ratio >= 1.5 → score = 1.0
 */
export declare const THUMB_RATIO_EXTENDED = 1.5;
/**
 * Extension ratio at or below which thumb is fully folded.
 * ratio <= 1.0 → score = 0.0
 */
export declare const THUMB_RATIO_FOLDED = 1;
/**
 * Number of consecutive frames a gesture must be detected before it is
 * considered active (start event fires).
 */
export declare const GESTURE_ACTIVATE_FRAMES = 2;
/**
 * Number of consecutive frames a gesture must be absent before it is
 * considered ended (end event fires).
 */
export declare const GESTURE_DEACTIVATE_FRAMES = 2;
