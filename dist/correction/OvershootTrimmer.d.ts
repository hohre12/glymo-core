import { TrimResult, StrokePoint } from '../types.js';
/**
 * Detect and trim overshoot at the end of a stroke.
 *
 * Algorithm:
 * 1. Compute per-segment velocity and direction
 * 2. Scan backwards from the end (only last 40% of stroke)
 * 3. Detect overshoot: velocity spike (>2x moving avg) AND direction reversal (>120°)
 * 4. Trim points after the reversal point
 *
 * Conservative: requires BOTH conditions to avoid false positives on intentional curves.
 *
 * @param raw - Raw stroke points
 * @param minRetainRatio - Minimum fraction of points to keep (default 0.6)
 */
export declare function trimOvershoot(raw: readonly StrokePoint[], minRetainRatio?: number): TrimResult;
