import { FingerName, HandState } from './types.js';
/**
 * Immutable implementation of HandState backed by a MediaPipe landmark array.
 *
 * All finger scores are computed lazily on first access and cached for the
 * lifetime of this instance. This guarantees O(1) repeated calls without
 * re-computing geometry.
 */
export declare class HandStateImpl implements HandState {
    readonly landmarks: ReadonlyArray<{
        readonly x: number;
        readonly y: number;
        readonly z: number;
    }>;
    /** Lazy cache: finger name → score in [0, 1] */
    private readonly _scoreCache;
    /**
     * @param landmarks - Raw 21-point MediaPipe landmark array.
     *   If the array is shorter than 21 elements the instance is still safe to
     *   use — missing landmarks default to the origin {0, 0, 0}.
     */
    constructor(landmarks: ReadonlyArray<{
        readonly x: number;
        readonly y: number;
        readonly z: number;
    }>);
    extended(...fingers: FingerName[]): boolean;
    folded(...fingers: FingerName[]): boolean;
    pinchDistance(): number;
    /**
     * Continuous extension score for a single finger.
     *
     * Thumb: ratio of TIP-to-wrist distance vs MCP-to-wrist distance.
     *   - ratio >= THUMB_RATIO_EXTENDED (1.5) → 1.0 (fully extended)
     *   - ratio <= THUMB_RATIO_FOLDED   (1.0) → 0.0 (fully folded)
     *   - between: linear interpolation
     *
     * Other fingers: angle at PIP joint (MCP → PIP → TIP).
     *   - angle >= ANGLE_FULLY_EXTENDED (160°) → 1.0
     *   - angle <= ANGLE_FULLY_FOLDED   (90°)  → 0.0
     *   - between: linear interpolation
     */
    fingerScore(finger: FingerName): number;
    /** Safe landmark accessor — returns origin for out-of-bounds indices */
    private _lm;
    /**
     * Thumb score based on extension ratio (tip-to-wrist / MCP-to-wrist).
     * Uses 3D distance to be immune to camera perspective foreshortening.
     */
    private _thumbScore;
    /**
     * Non-thumb finger score based on angle at PIP joint.
     *
     * The angle is measured from MCP through PIP to TIP:
     *   - Straight finger ≈ 160–180° → score ≈ 1.0
     *   - Tightly curled  ≈ 60–90°   → score ≈ 0.0
     */
    private _fingerAngleScore;
}
