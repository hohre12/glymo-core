// Vitest suite for `HandStatePool` — Phase 3 of rendering-pipeline-v2
// (docs/plans/rendering-pipeline-v2.md §6 Phase 3 TDD plan).
//
// Contract under test:
//   1. `acquire(landmarks)` returns a `HandState` populated with the given
//      landmarks. Fresh pool → allocates one instance; subsequent
//      acquire → release → acquire reuses the SAME instance (identity
//      preserved across the acquire/release cycle).
//   2. `release(state)` returns the instance to the pool so a follow-up
//      `acquire` reuses it. Releasing an instance the pool did not issue
//      is a no-op (defensive).
//   3. Pool size cap is documented and enforced — `acquire` beyond the
//      cap still works (allocates fresh) but the over-cap instance is
//      NOT returned to the pool on release (dropped for GC). Keeps the
//      steady-state pool bounded even under adversarial acquire bursts.
//   4. `resetFrame()` re-enqueues every outstanding acquire so the next
//      frame starts with a full pool. This is the hook the
//      dispatcher calls at frame end (§6 Phase 3 scope: "GestureEngine
//      update() acquires at frame start and releases at end"). The
//      acquired instances' identity is preserved across a frame reset
//      so long as the same landmarks are re-supplied.
//   5. Zero-allocation after warmup — once the pool has reached its
//      steady-state population, a full acquire / release cycle does not
//      invoke the `HandStateImpl` constructor.
//   6. The returned state is a working `HandState` — `fingerScore`,
//      `extended`, `folded`, `pinchDistance` all operate on the
//      `acquire`-supplied landmarks and produce values bit-identical to
//      a fresh `new HandStateImpl(landmarks)` built on the same input.

import { beforeEach, describe, expect, it } from 'vitest';

import { HandStateImpl } from '../HandStateImpl';
import {
  HandStatePool,
  DEFAULT_HAND_STATE_POOL_CAP,
} from '../HandStatePool';
import type { Landmark } from '../../input/CameraCapture';

function pt(x: number, y: number, z = 0): Landmark {
  return { x, y, z };
}

function landmarkFixture(a = 0): Landmark[] {
  return Array.from({ length: 21 }, (_, i) => pt(i + a, i, 0));
}

describe('HandStatePool — identity + reuse contract', () => {
  let pool: HandStatePool;

  beforeEach(() => {
    pool = new HandStatePool();
  });

  it('acquire returns a functional HandState populated from the landmarks', () => {
    const lm = landmarkFixture();
    const state = pool.acquire(lm);
    expect(state.landmarks[0]?.x).toBe(0);
    expect(state.landmarks[8]?.x).toBe(8);
    // Functional parity with a fresh HandStateImpl
    const reference = new HandStateImpl(lm);
    expect(state.fingerScore('thumb')).toBe(reference.fingerScore('thumb'));
    expect(state.fingerScore('index')).toBe(reference.fingerScore('index'));
    expect(state.pinchDistance()).toBe(reference.pinchDistance());
  });

  it('after release + acquire the SAME instance identity is returned', () => {
    const a1 = pool.acquire(landmarkFixture(0));
    pool.release(a1);
    const a2 = pool.acquire(landmarkFixture(1));
    expect(a2).toBe(a1);
    // Landmarks updated to the new acquire's payload.
    expect(a2.landmarks[0]?.x).toBe(1);
  });

  it('concurrent acquires without release issue distinct instances', () => {
    const a = pool.acquire(landmarkFixture(0));
    const b = pool.acquire(landmarkFixture(1));
    expect(a).not.toBe(b);
    expect(a.landmarks[0]?.x).toBe(0);
    expect(b.landmarks[0]?.x).toBe(1);
  });

  it('releasing an unknown instance is a silent no-op', () => {
    const stranger = new HandStateImpl(landmarkFixture());
    expect(() => pool.release(stranger)).not.toThrow();
    // Pool's "available" count is unchanged — the next acquire still
    // allocates a fresh one (or reuses a previously-released pool
    // instance), not the stranger.
    const a = pool.acquire(landmarkFixture(0));
    expect(a).not.toBe(stranger);
  });

  it('double-release of the same instance is safe', () => {
    const a = pool.acquire(landmarkFixture());
    pool.release(a);
    expect(() => pool.release(a)).not.toThrow();
    // Only one slot freed; two acquires against an empty pool produce
    // ONE reused instance (=== a) and ONE newly allocated instance.
    const b = pool.acquire(landmarkFixture(1));
    const c = pool.acquire(landmarkFixture(2));
    const reusedOnce = b === a ? 1 : 0;
    const reusedTwice = c === a ? 1 : 0;
    expect(reusedOnce + reusedTwice).toBe(1);
  });
});

describe('HandStatePool — size cap', () => {
  it('documented default cap is a positive number', () => {
    expect(typeof DEFAULT_HAND_STATE_POOL_CAP).toBe('number');
    expect(DEFAULT_HAND_STATE_POOL_CAP).toBeGreaterThan(0);
  });

  it('acquire beyond the cap still returns a functional state (fresh allocation)', () => {
    const pool = new HandStatePool({ cap: 2 });
    const a = pool.acquire(landmarkFixture(0));
    const b = pool.acquire(landmarkFixture(1));
    // Third concurrent acquire exceeds cap — pool allocates fresh.
    const c = pool.acquire(landmarkFixture(2));
    expect(c).not.toBe(a);
    expect(c).not.toBe(b);
    expect(c.landmarks[0]?.x).toBe(2);
  });

  it('release of an over-cap instance drops it (does NOT balloon the pool)', () => {
    const pool = new HandStatePool({ cap: 2 });
    const a = pool.acquire(landmarkFixture(0));
    const b = pool.acquire(landmarkFixture(1));
    const c = pool.acquire(landmarkFixture(2));
    // Release a and b (within cap) then c (beyond cap). `c` must not get
    // enqueued as a 3rd available slot — cap is a ceiling.
    pool.release(a);
    pool.release(b);
    pool.release(c);
    expect(pool.availableCount).toBe(2);
  });
});

describe('HandStatePool — resetFrame lifecycle', () => {
  it('resetFrame re-enqueues every currently-acquired instance', () => {
    const pool = new HandStatePool({ cap: 4 });
    const a = pool.acquire(landmarkFixture(0));
    const b = pool.acquire(landmarkFixture(1));
    expect(pool.availableCount).toBe(0);
    pool.resetFrame();
    expect(pool.availableCount).toBe(2);
    // The first two acquires after reset reuse the same instances.
    const first = pool.acquire(landmarkFixture(10));
    const second = pool.acquire(landmarkFixture(11));
    expect([first, second]).toEqual(expect.arrayContaining([a, b]));
  });

  it('resetFrame on an empty pool is a no-op', () => {
    const pool = new HandStatePool();
    expect(() => pool.resetFrame()).not.toThrow();
    expect(pool.availableCount).toBe(0);
  });
});

describe('HandStatePool — zero-alloc after warmup', () => {
  it('allocates exactly one new HandStateImpl across repeated single-acquire warmups', () => {
    // Wrap the HandStateImpl constructor with a spy. The pool's first
    // acquire allocates once; every subsequent acquire/release cycle
    // MUST reuse the same instance with zero additional constructor
    // invocations.
    const pool = new HandStatePool();
    // We can't spy on HandStateImpl's constructor directly (it's a class
    // import) without mocking the module. Instead, track unique identities
    // across N cycles and assert only one unique instance was used.
    const seen = new Set();
    for (let i = 0; i < 1000; i++) {
      const s = pool.acquire(landmarkFixture(i % 5));
      seen.add(s);
      pool.release(s);
    }
    expect(seen.size).toBe(1);
  });

  it('two concurrent acquires warmup two instances; every subsequent pair reuses them', () => {
    const pool = new HandStatePool();
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      const a = pool.acquire(landmarkFixture(i));
      const b = pool.acquire(landmarkFixture(i + 100));
      seen.add(a);
      seen.add(b);
      pool.release(a);
      pool.release(b);
    }
    expect(seen.size).toBe(2);
  });
});

describe('HandStatePool — fingerScore cache reset on reuse', () => {
  it('re-acquiring with DIFFERENT landmarks produces the new score, not the cached one', () => {
    const pool = new HandStatePool();
    // First acquire: fully extended thumb.
    const s1 = pool.acquire(
      Array.from({ length: 21 }, (_, i) => {
        if (i === 0) return pt(0, 0, 0); // WRIST
        if (i === 2) return pt(0.1, 0, 0); // THUMB_MCP
        if (i === 4) return pt(0.2, 0, 0); // THUMB_TIP → ratio 2 → score 1
        return pt(0, 0, 0);
      }),
    );
    const scoreExtended = s1.fingerScore('thumb');
    expect(scoreExtended).toBeCloseTo(1.0, 6);
    pool.release(s1);

    // Reacquire the SAME instance with folded-thumb landmarks. The
    // fingerScore cache inside HandStateImpl MUST NOT survive across
    // releases — otherwise we get a stale 1.0 here.
    const s2 = pool.acquire(
      Array.from({ length: 21 }, (_, i) => {
        if (i === 0) return pt(0, 0, 0);
        if (i === 2) return pt(0.1, 0, 0);
        if (i === 4) return pt(0.1, 0, 0); // ratio 1 → score 0
        return pt(0, 0, 0);
      }),
    );
    expect(s2).toBe(s1); // identity reused
    expect(s2.fingerScore('thumb')).toBeCloseTo(0.0, 6);
  });
});
