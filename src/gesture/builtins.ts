// ── Built-in Gesture Definitions ────────────────────

import type { BuiltInGesture, GestureDetectorFn } from './types.js';
import { PINCH_THRESHOLD } from './constants.js';

/**
 * Pre-defined gesture detectors for common hand shapes.
 * Each function is a pure predicate: it receives a HandState snapshot and
 * returns true while the gesture is active.
 *
 * These definitions intentionally use only the HandState public API so they
 * remain decoupled from landmark indices and thresholds.
 */
export const BUILTIN_GESTURES: Record<BuiltInGesture, GestureDetectorFn> = {
  /**
   * Thumb tip and index tip are close together (distance < PINCH_THRESHOLD).
   * Used as the default "pen-down" signal in camera drawing mode.
   */
  pinch: (hand) => hand.pinchDistance() < PINCH_THRESHOLD,

  /**
   * All four fingers (index through pinky) are folded into the palm.
   * Classic closed fist — useful as a "stop drawing" or "erase" gesture.
   */
  fist: (hand) => hand.folded('index', 'middle', 'ring', 'pinky'),

  /**
   * Index finger is extended while middle, ring, and pinky are folded.
   * Classic pointing gesture — useful as an "activate drawing" trigger.
   */
  point: (hand) => hand.extended('index') && hand.folded('middle', 'ring', 'pinky'),

  /**
   * All five fingers are extended outward (open hand / stop sign).
   * Useful as a "clear canvas" or "pause" gesture.
   */
  'open-palm': (hand) => hand.extended('thumb', 'index', 'middle', 'ring', 'pinky'),

  /**
   * Index and middle fingers extended, ring and pinky folded (victory / peace).
   * Useful as a mode-switch gesture.
   */
  'peace-sign': (hand) => hand.extended('index', 'middle') && hand.folded('ring', 'pinky'),

  /**
   * Thumb extended with index, middle, ring, and pinky folded.
   * Useful as a "confirm" or "like" gesture.
   */
  'thumbs-up': (hand) => hand.extended('thumb') && hand.folded('index', 'middle', 'ring', 'pinky'),
} as const;
