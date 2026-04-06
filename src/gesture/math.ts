// ── Gesture Math Utilities ───────────────────────────
// Pure functions with no side effects.
// These mirror the private helpers in CameraCapture.ts but are exported here
// for reuse across the gesture module.

/** Minimal landmark-like type accepted by gesture math functions */
export interface LandmarkLike {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Squared 2D Euclidean distance between two landmarks.
 * Cheaper than dist2d when only comparison is needed (avoids sqrt).
 */
export function dist2dSq(a: LandmarkLike, b: LandmarkLike): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * 3D Euclidean distance between two landmarks.
 * Uses all three axes — immune to camera foreshortening.
 */
export function dist3d(a: LandmarkLike, b: LandmarkLike): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Angle in degrees at vertex B for the triangle formed by A, B, C.
 * Works in 3D space. Returns 0 when any leg has near-zero length.
 *
 * @param a - First point
 * @param b - Vertex point (angle measured here)
 * @param c - Third point
 */
export function angleDeg(a: LandmarkLike, b: LandmarkLike, c: LandmarkLike): number {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const baz = a.z - b.z;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const bcz = c.z - b.z;

  const dot = bax * bcx + bay * bcy + baz * bcz;
  const magBA = Math.sqrt(bax * bax + bay * bay + baz * baz);
  const magBC = Math.sqrt(bcx * bcx + bcy * bcy + bcz * bcz);

  if (magBA < 0.0001 || magBC < 0.0001) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/**
 * Clamp a value to the closed interval [0, 1].
 */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
