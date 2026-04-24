// ── HandStateImpl ────────────────────────────────────

import type { FingerName, HandState } from './types.js';
import {
  WRIST,
  THUMB_MCP, THUMB_TIP,
  INDEX_MCP, INDEX_PIP, INDEX_TIP,
  MIDDLE_MCP, MIDDLE_PIP, MIDDLE_TIP,
  RING_MCP, RING_PIP, RING_TIP,
  PINKY_MCP, PINKY_PIP, PINKY_TIP,
  FINGER_FOLD_THRESHOLD,
  FINGER_EXTEND_THRESHOLD,
  ANGLE_FULLY_EXTENDED,
  ANGLE_FULLY_FOLDED,
  THUMB_RATIO_EXTENDED,
  THUMB_RATIO_FOLDED,
} from './constants.js';
import { dist3d, dist2dSq, angleDeg, clamp01 } from './math.js';

// ── Finger descriptor ─────────────────────────────
interface FingerIndices {
  tip: number;
  pip: number;
  mcp: number;
}

/** Landmark indices for each non-thumb finger (MCP→PIP→TIP) */
const FINGER_INDICES: Record<Exclude<FingerName, 'thumb'>, FingerIndices> = {
  index:  { tip: INDEX_TIP,  pip: INDEX_PIP,  mcp: INDEX_MCP  },
  middle: { tip: MIDDLE_TIP, pip: MIDDLE_PIP, mcp: MIDDLE_MCP },
  ring:   { tip: RING_TIP,   pip: RING_PIP,   mcp: RING_MCP   },
  pinky:  { tip: PINKY_TIP,  pip: PINKY_PIP,  mcp: PINKY_MCP  },
};

/**
 * Mutable-backing implementation of HandState over a MediaPipe landmark
 * array.
 *
 * All finger scores are computed lazily on first access and cached for
 * the lifetime of this *instance frame* (i.e. until a `HandStatePool`
 * reuses the instance with fresh landmarks via `_reset`). This
 * guarantees O(1) repeated calls inside a single gesture-dispatch frame
 * without re-computing geometry.
 *
 * Phase 3 (rendering-pipeline-v2) — the pre-Phase-3 constructor froze a
 * shallow spread (`Object.freeze([...landmarks])`) on every construction.
 * That was a ~21-element allocation + freeze on every
 * `useGestureDispatcher` tick × 5 gestures × up to 2 hands, a measurable
 * share of minor-GC pressure in the hologram scenario (§1 defect #4,
 * §6 Phase 3 scope). The freeze is removed and the spread collapses to
 * a direct reference hold; callers MUST treat the landmark array as
 * immutable by convention. The `ReadonlyArray`-typed public surface is
 * unchanged — mutation is still a compile-time error for consumers.
 *
 * IMMUTABILITY CONTRACT (external callers):
 *
 *   const state = pool.acquire(landmarks);
 *   // DO NOT mutate state.landmarks[i] — TypeScript errors; runtime
 *   // effect is undefined and may corrupt other consumers reading the
 *   // same landmark reference during a shared-pool frame.
 *   state.fingerScore('thumb'); // OK — read-only accessor.
 *
 * Any engine-side code path that mutates `state.landmarks` is a bug. The
 * `HandStateImpl.test.ts` golden-lock pins the ReadonlyArray type shape.
 */
export class HandStateImpl implements HandState {
  /** Backing slot for the current frame's landmarks. Public access is
   *  through the ReadonlyArray-typed `landmarks` getter so consumers
   *  cannot mutate in place. `_reset` rewrites this when the pool hands
   *  an instance back with fresh input. */
  private _landmarks: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }>;

  /** Lazy cache: finger name → score in [0, 1]. Cleared by `_reset`
   *  when the instance is reused by the pool for a new frame. */
  private readonly _scoreCache = new Map<FingerName, number>();

  /**
   * @param landmarks - Raw 21-point MediaPipe landmark array.
   *   If the array is shorter than 21 elements the instance is still safe to
   *   use — missing landmarks default to the origin {0, 0, 0}.
   */
  constructor(
    landmarks: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }>,
  ) {
    this._landmarks = landmarks;
  }

  get landmarks(): ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }> {
    return this._landmarks;
  }

  /**
   * Phase 3 pool hook — reassign the backing landmark reference and
   * invalidate every cached finger score. Invoked by `HandStatePool`
   * when it hands an instance back to a caller with new input. External
   * callers MUST NOT invoke this directly; the contract is pool-private.
   *
   * @internal
   */
  _reset(
    landmarks: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }>,
  ): void {
    this._landmarks = landmarks;
    this._scoreCache.clear();
  }

  // ── HandState interface ───────────────────────────

  extended(...fingers: FingerName[]): boolean {
    return fingers.every((f) => this.fingerScore(f) > FINGER_EXTEND_THRESHOLD);
  }

  folded(...fingers: FingerName[]): boolean {
    return fingers.every((f) => this.fingerScore(f) < FINGER_FOLD_THRESHOLD);
  }

  pinchDistance(): number {
    const thumb = this._lm(THUMB_TIP);
    const index = this._lm(INDEX_TIP);
    return Math.sqrt(dist2dSq(thumb, index));
  }

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
  fingerScore(finger: FingerName): number {
    const cached = this._scoreCache.get(finger);
    if (cached !== undefined) return cached;

    const score = finger === 'thumb'
      ? this._thumbScore()
      : this._fingerAngleScore(FINGER_INDICES[finger]);

    this._scoreCache.set(finger, score);
    return score;
  }

  // ── Private helpers ───────────────────────────────

  /** Safe landmark accessor — returns origin for out-of-bounds indices */
  private _lm(index: number): { x: number; y: number; z: number } {
    return (this.landmarks[index] as { x: number; y: number; z: number } | undefined)
      ?? { x: 0, y: 0, z: 0 };
  }

  /**
   * Thumb score based on extension ratio (tip-to-wrist / MCP-to-wrist).
   * Uses 3D distance to be immune to camera perspective foreshortening.
   */
  private _thumbScore(): number {
    const wrist = this._lm(WRIST);
    const tip   = this._lm(THUMB_TIP);
    const mcp   = this._lm(THUMB_MCP);

    const tipDist = dist3d(tip, wrist);
    const mcpDist = dist3d(mcp, wrist);

    if (mcpDist < 0.001) return 0;

    const ratio = tipDist / mcpDist;
    // Linear map: [THUMB_RATIO_FOLDED, THUMB_RATIO_EXTENDED] → [0, 1]
    return clamp01(
      (ratio - THUMB_RATIO_FOLDED) / (THUMB_RATIO_EXTENDED - THUMB_RATIO_FOLDED),
    );
  }

  /**
   * Non-thumb finger score based on angle at PIP joint.
   *
   * The angle is measured from MCP through PIP to TIP:
   *   - Straight finger ≈ 160–180° → score ≈ 1.0
   *   - Tightly curled  ≈ 60–90°   → score ≈ 0.0
   */
  private _fingerAngleScore(indices: FingerIndices): number {
    const mcp = this._lm(indices.mcp);
    const pip = this._lm(indices.pip);
    const tip = this._lm(indices.tip);

    const angle = angleDeg(mcp, pip, tip);

    // Linear map: [ANGLE_FULLY_FOLDED, ANGLE_FULLY_EXTENDED] → [0, 1]
    return clamp01(
      (angle - ANGLE_FULLY_FOLDED) / (ANGLE_FULLY_EXTENDED - ANGLE_FULLY_FOLDED),
    );
  }
}
