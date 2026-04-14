import { BuiltInGesture, GestureDetectorFn } from './types.js';
/**
 * Pre-defined gesture detectors for common hand shapes.
 * Each function is a pure predicate: it receives a HandState snapshot and
 * returns true while the gesture is active.
 *
 * These definitions intentionally use only the HandState public API so they
 * remain decoupled from landmark indices and thresholds.
 */
export declare const BUILTIN_GESTURES: Record<BuiltInGesture, GestureDetectorFn>;
