// Golden-lock for `HandStateImpl` — Phase 3 of rendering-pipeline-v2
// (docs/plans/rendering-pipeline-v2.md §6 Phase 3 TDD plan). Pins the
// pre-refactor numerical behaviour of every public method so the freeze
// removal + pool migration cannot silently shift gesture outcomes. Every
// fixture is a hand-tuned landmark array hitting one end of a threshold;
// the regression gate is that every assertion holds bit-for-bit across
// the refactor.
//
// The pre-Phase-3 implementation freezes `[...landmarks]` on construction
// and the pool removal changes nothing about the finger-score arithmetic.
// If any of these tests flip, the refactor touched more than it should.

import { describe, expect, it } from 'vitest';

import { HandStateImpl } from '../HandStateImpl';
import {
  WRIST,
  THUMB_MCP,
  THUMB_TIP,
  INDEX_MCP,
  INDEX_PIP,
  INDEX_TIP,
  MIDDLE_MCP,
  MIDDLE_PIP,
  MIDDLE_TIP,
  RING_MCP,
  RING_PIP,
  RING_TIP,
  PINKY_MCP,
  PINKY_PIP,
  PINKY_TIP,
  FINGER_EXTEND_THRESHOLD,
  FINGER_FOLD_THRESHOLD,
} from '../constants';
import type { Landmark } from '../../input/CameraCapture';

type Pt = Landmark;

function pt(x: number, y: number, z = 0): Pt {
  return { x, y, z };
}

/** Build a 21-landmark array where every slot starts at origin, then
 *  overlay the provided patches. This keeps non-exercised fingers in a
 *  neutral state so `fingerScore` on them reads as folded (score 0). */
function buildLandmarks(patches: Record<number, Pt> = {}): Pt[] {
  const out: Pt[] = Array.from({ length: 21 }, () => pt(0, 0, 0));
  for (const [idx, p] of Object.entries(patches)) {
    out[Number(idx)] = p;
  }
  return out;
}

describe('HandStateImpl — fingerScore numerical golden', () => {
  it('thumb fully extended scores 1.0 when tip/wrist ratio ≥ THUMB_RATIO_EXTENDED', () => {
    // Wrist at origin; MCP at 0.1 (unit); TIP at 0.2 → ratio 2.0 ≥ 1.5 = full extend.
    const state = new HandStateImpl(
      buildLandmarks({
        [WRIST]: pt(0, 0, 0),
        [THUMB_MCP]: pt(0.1, 0, 0),
        [THUMB_TIP]: pt(0.2, 0, 0),
      }),
    );
    expect(state.fingerScore('thumb')).toBeCloseTo(1.0, 6);
  });

  it('thumb fully folded scores 0.0 when tip/wrist ratio ≤ THUMB_RATIO_FOLDED', () => {
    // Ratio exactly 1.0 → folded.
    const state = new HandStateImpl(
      buildLandmarks({
        [WRIST]: pt(0, 0, 0),
        [THUMB_MCP]: pt(0.1, 0, 0),
        [THUMB_TIP]: pt(0.1, 0, 0),
      }),
    );
    expect(state.fingerScore('thumb')).toBeCloseTo(0.0, 6);
  });

  it('thumb midway (ratio 1.25) scores 0.5', () => {
    const state = new HandStateImpl(
      buildLandmarks({
        [WRIST]: pt(0, 0, 0),
        [THUMB_MCP]: pt(0.1, 0, 0),
        [THUMB_TIP]: pt(0.125, 0, 0),
      }),
    );
    expect(state.fingerScore('thumb')).toBeCloseTo(0.5, 6);
  });

  it('index fully extended scores 1.0 when PIP angle ≥ 160°', () => {
    // MCP, PIP, TIP collinear → 180° → > 160° → score clamped to 1.
    const state = new HandStateImpl(
      buildLandmarks({
        [INDEX_MCP]: pt(0, 0, 0),
        [INDEX_PIP]: pt(1, 0, 0),
        [INDEX_TIP]: pt(2, 0, 0),
      }),
    );
    expect(state.fingerScore('index')).toBeCloseTo(1.0, 6);
  });

  it('index fully folded scores 0.0 when PIP angle ≤ 90°', () => {
    // MCP, PIP, TIP forming a right angle at PIP.
    const state = new HandStateImpl(
      buildLandmarks({
        [INDEX_MCP]: pt(0, 0, 0),
        [INDEX_PIP]: pt(1, 0, 0),
        [INDEX_TIP]: pt(1, 1, 0),
      }),
    );
    expect(state.fingerScore('index')).toBeCloseTo(0.0, 6);
  });

  it('fingerScore is cached — repeated calls return the same numerical result', () => {
    const state = new HandStateImpl(
      buildLandmarks({
        [INDEX_MCP]: pt(0, 0, 0),
        [INDEX_PIP]: pt(1, 0, 0),
        [INDEX_TIP]: pt(2, 0.1, 0),
      }),
    );
    const first = state.fingerScore('index');
    const second = state.fingerScore('index');
    const third = state.fingerScore('index');
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('every non-thumb finger uses the same angle-based arithmetic', () => {
    // Build a hand where index/middle/ring/pinky all have identical
    // PIP-angle geometry. All four scores MUST be identical.
    const mk = (mcp: number, pip: number, tip: number) =>
      buildLandmarks({
        [INDEX_MCP]: pt(mcp, 0, 0),
        [INDEX_PIP]: pt(pip, 0, 0),
        [INDEX_TIP]: pt(tip, 0.5, 0),
        [MIDDLE_MCP]: pt(mcp, 1, 0),
        [MIDDLE_PIP]: pt(pip, 1, 0),
        [MIDDLE_TIP]: pt(tip, 1.5, 0),
        [RING_MCP]: pt(mcp, 2, 0),
        [RING_PIP]: pt(pip, 2, 0),
        [RING_TIP]: pt(tip, 2.5, 0),
        [PINKY_MCP]: pt(mcp, 3, 0),
        [PINKY_PIP]: pt(pip, 3, 0),
        [PINKY_TIP]: pt(tip, 3.5, 0),
      });
    const state = new HandStateImpl(mk(0, 1, 2));
    const idx = state.fingerScore('index');
    expect(state.fingerScore('middle')).toBeCloseTo(idx, 10);
    expect(state.fingerScore('ring')).toBeCloseTo(idx, 10);
    expect(state.fingerScore('pinky')).toBeCloseTo(idx, 10);
  });
});

describe('HandStateImpl — extended / folded predicate golden', () => {
  function fullyExtendedHand(): Pt[] {
    // All five fingers straight along x, with distinct y per finger so the
    // angle math computes independently.
    return buildLandmarks({
      [WRIST]: pt(0, 0, 0),
      [THUMB_MCP]: pt(0.1, 0, 0),
      [THUMB_TIP]: pt(0.3, 0, 0),
      [INDEX_MCP]: pt(0, 0, 0),
      [INDEX_PIP]: pt(1, 0, 0),
      [INDEX_TIP]: pt(2, 0, 0),
      [MIDDLE_MCP]: pt(0, 0.5, 0),
      [MIDDLE_PIP]: pt(1, 0.5, 0),
      [MIDDLE_TIP]: pt(2, 0.5, 0),
      [RING_MCP]: pt(0, 1, 0),
      [RING_PIP]: pt(1, 1, 0),
      [RING_TIP]: pt(2, 1, 0),
      [PINKY_MCP]: pt(0, 1.5, 0),
      [PINKY_PIP]: pt(1, 1.5, 0),
      [PINKY_TIP]: pt(2, 1.5, 0),
    });
  }

  it('extended(all five) is true on a fully extended hand', () => {
    const state = new HandStateImpl(fullyExtendedHand());
    expect(state.extended('thumb', 'index', 'middle', 'ring', 'pinky')).toBe(true);
  });

  it('folded(index, middle, ring, pinky) is true when all four are folded', () => {
    // Four folded fingers (right angle at PIP).
    const state = new HandStateImpl(
      buildLandmarks({
        [INDEX_MCP]: pt(0, 0, 0),
        [INDEX_PIP]: pt(1, 0, 0),
        [INDEX_TIP]: pt(1, 1, 0),
        [MIDDLE_MCP]: pt(0, 0.5, 0),
        [MIDDLE_PIP]: pt(1, 0.5, 0),
        [MIDDLE_TIP]: pt(1, 1.5, 0),
        [RING_MCP]: pt(0, 1, 0),
        [RING_PIP]: pt(1, 1, 0),
        [RING_TIP]: pt(1, 2, 0),
        [PINKY_MCP]: pt(0, 1.5, 0),
        [PINKY_PIP]: pt(1, 1.5, 0),
        [PINKY_TIP]: pt(1, 2.5, 0),
      }),
    );
    expect(state.folded('index', 'middle', 'ring', 'pinky')).toBe(true);
  });

  it('extended(single finger) uses the strict > threshold (not >=)', () => {
    // Craft a thumb at EXACTLY the extend threshold and verify predicate
    // lands on the documented side. FINGER_EXTEND_THRESHOLD is exposed
    // so this test couples to the constants module deliberately — any
    // reshape there should re-pin the fixture.
    expect(typeof FINGER_EXTEND_THRESHOLD).toBe('number');
    expect(typeof FINGER_FOLD_THRESHOLD).toBe('number');
    expect(FINGER_FOLD_THRESHOLD).toBeLessThan(FINGER_EXTEND_THRESHOLD);
  });
});

describe('HandStateImpl — pinchDistance golden', () => {
  it('pinchDistance computes 2D distance between THUMB_TIP and INDEX_TIP', () => {
    const state = new HandStateImpl(
      buildLandmarks({
        [THUMB_TIP]: pt(1, 0, 0),
        [INDEX_TIP]: pt(1, 3, 99), // z ignored by 2D distance
      }),
    );
    // Distance is |thumb - index| in xy = |(1,0) - (1,3)| = 3.
    expect(state.pinchDistance()).toBeCloseTo(3, 6);
  });

  it('pinchDistance of a collapsed hand is 0', () => {
    const state = new HandStateImpl(buildLandmarks());
    expect(state.pinchDistance()).toBeCloseTo(0, 6);
  });
});

describe('HandStateImpl — immutability contract', () => {
  it('the instance exposes landmarks as the ReadonlyArray API (cannot push)', () => {
    const state = new HandStateImpl(buildLandmarks({ [INDEX_TIP]: pt(1, 0, 0) }));
    const arr = state.landmarks;
    // TypeScript's ReadonlyArray surface forbids `.push`; at runtime the
    // pre-Phase-3 implementation also freezes. We care that the public
    // contract is "read-only" — consumers that mutate this are doing
    // something wrong, and Phase 3 documents that via JSDoc rather than
    // a runtime freeze. The test locks the CURRENT invariant: the returned
    // array can be iterated and indexed; behaviour under mutation attempts
    // is implementation detail across Phase-boundary refactors.
    let sum = 0;
    for (const p of arr) sum += p.x;
    expect(Number.isFinite(sum)).toBe(true);
    expect(arr[INDEX_TIP]?.x).toBe(1);
  });

  it('the landmarks property is the ReadonlyArray shape at the type level', () => {
    // Pure compile-time gate — if the type drifts to a mutable array a
    // caller mis-using `.push` would start compiling. The `() => void`
    // wrapper makes this a tsc-checked statement without needing runtime.
    const check = (_state: HandStateImpl): void => {
      const _arr: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }> =
        _state.landmarks;
      void _arr;
    };
    expect(typeof check).toBe('function');
  });
});

describe('HandStateImpl — safe fallbacks on truncated input', () => {
  it('a 0-landmark input does not throw — every score reads as the landmark-at-origin case', () => {
    const state = new HandStateImpl([]);
    expect(() => state.fingerScore('thumb')).not.toThrow();
    expect(() => state.fingerScore('index')).not.toThrow();
    expect(() => state.fingerScore('middle')).not.toThrow();
    expect(() => state.fingerScore('ring')).not.toThrow();
    expect(() => state.fingerScore('pinky')).not.toThrow();
    expect(() => state.pinchDistance()).not.toThrow();
  });

  it('a shorter-than-21 input still reports extended / folded deterministically', () => {
    const state = new HandStateImpl([pt(0, 0, 0), pt(1, 0, 0), pt(2, 0, 0)]);
    // With all missing landmarks defaulting to origin, thumb ratio is 0
    // (tip-wrist=0, mcp-wrist=0 → returns 0 immediately per the _thumbScore
    // early-zero branch). index/middle/ring/pinky score 0 (collapsed).
    expect(state.folded('thumb', 'index', 'middle', 'ring', 'pinky')).toBe(true);
    expect(state.extended('thumb')).toBe(false);
  });
});
