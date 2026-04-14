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
export declare function dist2dSq(a: LandmarkLike, b: LandmarkLike): number;
/**
 * 3D Euclidean distance between two landmarks.
 * Uses all three axes — immune to camera foreshortening.
 */
export declare function dist3d(a: LandmarkLike, b: LandmarkLike): number;
/**
 * Angle in degrees at vertex B for the triangle formed by A, B, C.
 * Works in 3D space. Returns 0 when any leg has near-zero length.
 *
 * @param a - First point
 * @param b - Vertex point (angle measured here)
 * @param c - Third point
 */
export declare function angleDeg(a: LandmarkLike, b: LandmarkLike, c: LandmarkLike): number;
/**
 * Clamp a value to the closed interval [0, 1].
 */
export declare function clamp01(v: number): number;
