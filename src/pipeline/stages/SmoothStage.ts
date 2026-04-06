import type { BatchPipelineStage, StrokePoint } from '../../types.js';

/** Number of Chaikin iterations (IMMUTABLE — design.md SS4.5) */
const CHAIKIN_ITERATIONS = 4;

/** Minimum points required for smoothing */
const MIN_POINTS_FOR_SMOOTH = 3;

/** Interpolation weights for Q point (75% p0 + 25% p1) */
const Q_WEIGHT_NEAR = 0.75;
const Q_WEIGHT_FAR = 0.25;

/** Interpolation weights for R point (25% p0 + 75% p1) */
const R_WEIGHT_NEAR = 0.25;
const R_WEIGHT_FAR = 0.75;

/**
 * Stage 5: SMOOTH — Chaikin Corner-Cutting (design.md SS4.5)
 *
 * Transforms angular polyline into smooth curve.
 * Runs as batch operation on completed strokes (not per-frame).
 * Exactly 4 iterations required (IMMUTABLE).
 *
 * All four fields (x, y, t, pressure) are interpolated identically.
 * Start and end points are preserved exactly.
 */
export class SmoothStage implements BatchPipelineStage {
  readonly name = 'smooth';

  /** Apply Chaikin corner-cutting x4 to a completed stroke */
  processBatch(points: StrokePoint[]): StrokePoint[] {
    return chaikinSmooth(points, CHAIKIN_ITERATIONS);
  }

  reset(): void {
    // Stateless batch processor
  }
}

/**
 * Chaikin's corner-cutting subdivision algorithm.
 * Each consecutive pair generates two interpolation points (Q and R).
 */
function chaikinSmooth(points: StrokePoint[], iterations: number): StrokePoint[] {
  if (points.length < MIN_POINTS_FOR_SMOOTH) return points;

  let pts = points.map((p) => ({ ...p }));

  for (let iter = 0; iter < iterations; iter++) {
    pts = chaikinIteration(pts);
  }

  return pts;
}

/** Single iteration of Chaikin corner-cutting */
function chaikinIteration(pts: StrokePoint[]): StrokePoint[] {
  const newPts: StrokePoint[] = [pts[0]!]; // Preserve start point

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]!;
    const p1 = pts[i + 1]!;
    newPts.push(interpolatePoint(p0, p1, Q_WEIGHT_NEAR, Q_WEIGHT_FAR));
    newPts.push(interpolatePoint(p0, p1, R_WEIGHT_NEAR, R_WEIGHT_FAR));
  }

  newPts.push(pts[pts.length - 1]!); // Preserve end point
  return newPts;
}

/** Interpolate all fields of two StrokePoints with given weights */
function interpolatePoint(
  p0: StrokePoint,
  p1: StrokePoint,
  w0: number,
  w1: number,
): StrokePoint {
  return {
    x: p0.x * w0 + p1.x * w1,
    y: p0.y * w0 + p1.y * w1,
    t: p0.t * w0 + p1.t * w1,
    pressure: p0.pressure * w0 + p1.pressure * w1,
  };
}
