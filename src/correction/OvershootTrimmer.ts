import type { TrimResult, StrokePoint } from '../types.js';

/** Minimum points a stroke must retain after trimming */
const MIN_POINTS = 5;

/** Default: keep at least 60% of the stroke */
const DEFAULT_RETAIN_RATIO = 0.6;

/** Velocity spike threshold: must exceed moving average by this factor */
const VELOCITY_SPIKE_FACTOR = 2.0;

/** Direction reversal threshold in radians (~120 degrees) */
const DIRECTION_REVERSAL_RAD = (120 * Math.PI) / 180;

/** Window size for moving average (or 20% of stroke length, whichever is smaller) */
const WINDOW_SIZE = 5;

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
export function trimOvershoot(
  raw: readonly StrokePoint[],
  minRetainRatio: number = DEFAULT_RETAIN_RATIO,
): TrimResult {
  if (raw.length < MIN_POINTS) {
    return { trimmed: false, pointsRemoved: 0, correctedRaw: [...raw] };
  }

  // Compute per-segment velocity and direction
  const velocities: number[] = [];
  const directions: number[] = [];

  for (let i = 1; i < raw.length; i++) {
    const dx = raw[i]!.x - raw[i - 1]!.x;
    const dy = raw[i]!.y - raw[i - 1]!.y;
    const dt = Math.max(raw[i]!.t - raw[i - 1]!.t, 1); // avoid division by zero
    const speed = Math.sqrt(dx * dx + dy * dy) / dt;
    const angle = Math.atan2(dy, dx);
    velocities.push(speed);
    directions.push(angle);
  }

  const windowSize = Math.min(WINDOW_SIZE, Math.floor(raw.length * 0.2));
  if (windowSize < 2) {
    return { trimmed: false, pointsRemoved: 0, correctedRaw: [...raw] };
  }

  // Only scan the last 40% of the stroke
  const minIndex = Math.max(windowSize, Math.ceil(raw.length * minRetainRatio));

  // Scan backwards looking for overshoot
  for (let i = raw.length - 2; i >= minIndex; i--) {
    // Compute moving average of velocity before this point
    const avgSpeed = movingAverage(velocities, i - windowSize, i);
    if (avgSpeed <= 0) continue;

    // Check velocity spike
    if (velocities[i]! <= avgSpeed * VELOCITY_SPIKE_FACTOR) continue;

    // Check direction reversal around this point
    // Need at least 2 samples in the "after" window for reliable direction detection
    const afterEnd = Math.min(directions.length, i + windowSize);
    if (afterEnd - i < 2) continue;
    const angleBefore = averageAngle(directions, Math.max(0, i - windowSize), i);
    const angleAfter = averageAngle(directions, i, afterEnd);
    const angleDiff = Math.abs(normalizeAngle(angleAfter - angleBefore));

    if (angleDiff < DIRECTION_REVERSAL_RAD) continue;

    // Found overshoot — trim from this point
    const trimmedRaw = raw.slice(0, i + 1).map(p => ({ ...p }));
    return {
      trimmed: true,
      pointsRemoved: raw.length - trimmedRaw.length,
      correctedRaw: trimmedRaw,
    };
  }

  return { trimmed: false, pointsRemoved: 0, correctedRaw: [...raw] };
}

/** Compute moving average of a numeric array in range [start, end) */
function movingAverage(arr: number[], start: number, end: number): number {
  const from = Math.max(0, start);
  const to = Math.min(arr.length, end);
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += arr[i]!;
  return sum / (to - from);
}

/** Compute average angle using atan2 of summed sin/cos components */
function averageAngle(angles: number[], start: number, end: number): number {
  const from = Math.max(0, start);
  const to = Math.min(angles.length, end);
  if (to <= from) return 0;
  let sinSum = 0;
  let cosSum = 0;
  for (let i = from; i < to; i++) {
    sinSum += Math.sin(angles[i]!);
    cosSum += Math.cos(angles[i]!);
  }
  return Math.atan2(sinSum, cosSum);
}

/** Normalize angle to [-PI, PI] range */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}
