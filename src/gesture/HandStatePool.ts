// `HandStatePool` — Phase 3 of rendering-pipeline-v2 (docs/plans/
// rendering-pipeline-v2.md §6 Phase 3). Amortises `HandStateImpl`
// allocation across frames so the gesture dispatcher's per-frame ×5
// gesture × up-to-2-hand blasts of `new HandStateImpl(landmarks)`
// collapse to zero allocations at steady state.
//
// Contract (tested in `HandStatePool.test.ts`):
//
//   acquire(landmarks) → HandState
//     • Warm pool → reuse a released instance (identity preserved) with
//       its internal cache cleared via `_reset(landmarks)`.
//     • Cold / empty pool → allocate one new `HandStateImpl`.
//     • Pool-exceeding acquire → allocate one new `HandStateImpl`
//       NOT tracked by the pool (returned to GC on release).
//
//   release(state) → void
//     • Pool-issued + cap-room → enqueue for reuse.
//     • Pool-issued + pool already at cap → drop silently.
//     • Not pool-issued → silent no-op (defensive).
//
//   resetFrame() → void
//     • Re-enqueues every currently-outstanding acquire as available.
//       This is the hook `GestureEngine.update()` calls at frame end so
//       every consumer is guaranteed to see a full pool on the next
//       frame without per-gesture explicit release discipline.
//
// The pool is intentionally very small (default cap = 4) — gesture
// dispatch issues at most 2 concurrent hand states (two hands) × 1
// working copy per dispatcher boundary = 3 live slots in practice. A
// cap of 4 keeps one free slot for a late third reader without letting
// adversarial burst acquires balloon the pool.

import { HandStateImpl } from './HandStateImpl.js';
import type { HandState } from './types.js';

/** Documented default pool capacity. Exported so tests couple to a single
 *  source of truth. */
export const DEFAULT_HAND_STATE_POOL_CAP = 4;

export interface HandStatePoolOptions {
  /** Max number of instances the pool retains across frames. Exceeding
   *  acquires still work (fresh allocation) but their release is
   *  dropped. */
  readonly cap?: number;
}

export class HandStatePool {
  private readonly cap: number;
  /** Instances currently free (available for reuse). */
  private readonly available: HandStateImpl[] = [];
  /** Instances currently handed out — tracked so `resetFrame` can
   *  reclaim them and `release` can identify pool-issued vs foreign. */
  private readonly outstanding: Set<HandStateImpl> = new Set();

  constructor(options: HandStatePoolOptions = {}) {
    this.cap = options.cap ?? DEFAULT_HAND_STATE_POOL_CAP;
  }

  /** Number of available (pooled, not in use) instances. Exposed for
   *  tests; callers should prefer `acquire` / `release`. */
  get availableCount(): number {
    return this.available.length;
  }

  /** Number of instances currently handed out. */
  get outstandingCount(): number {
    return this.outstanding.size;
  }

  /** Acquire a `HandState` populated with the given landmarks. Reuses a
   *  pooled instance when available; otherwise allocates. */
  acquire(
    landmarks: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }>,
  ): HandState {
    let state = this.available.pop();
    if (state) {
      state._reset(landmarks);
    } else {
      state = new HandStateImpl(landmarks);
    }
    // Track only up-to-cap live instances so over-cap acquires are
    // gc-able on release.
    if (this.outstanding.size < this.cap) {
      this.outstanding.add(state);
    }
    return state;
  }

  /** Return an instance to the pool. Foreign / already-released
   *  instances are silently ignored. */
  release(state: HandState): void {
    // Discriminate by identity against the `outstanding` set — foreign
    // instances (constructed directly by callers) are not tracked.
    if (!(state instanceof HandStateImpl)) return;
    if (!this.outstanding.has(state)) return;
    this.outstanding.delete(state);
    if (this.available.length >= this.cap) return;
    this.available.push(state);
  }

  /** Reclaim every outstanding instance. Called by the dispatcher at
   *  frame end so the next frame starts with a full pool regardless of
   *  whether individual gestures explicitly released. */
  resetFrame(): void {
    for (const state of this.outstanding) {
      if (this.available.length >= this.cap) break;
      this.available.push(state);
    }
    this.outstanding.clear();
  }
}
