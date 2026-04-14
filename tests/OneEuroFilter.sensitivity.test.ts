// ── OneEuroFilter parameter sensitivity / regression gate ──────────────
//
// CLAUDE.md absolute rule: OneEuroFilter parameters MUST NOT be changed.
// This snapshot locks the tuned defaults (minCutoff=1.0, beta=0.007,
// dCutoff=1.0) to 1e-6 precision against a deterministic stroke.
//
// If anyone edits src/filter/OneEuroFilter.ts (MIN_CUTOFF / BETA / D_CUTOFF
// constants, the smoothing-factor formula, or the filter ordering), this
// test fails instantly. That is the intended behaviour — it is a regression
// gate, not a behaviour test. To update defaults, regenerate the snapshot
// AND get explicit design approval.

import { OneEuroFilter } from '../src/filter/OneEuroFilter.js';

// ── Fixture: deterministic 10-point stroke ─────────────────────────────
// Slow diagonal with small jitter, 16 ms (~60 fps) intervals.
const STROKE: ReadonlyArray<{ x: number; y: number; t: number }> = [
  { x: 10,   y: 20,   t: 0   },
  { x: 12.5, y: 22.1, t: 16  },
  { x: 15.2, y: 24.8, t: 32  },
  { x: 17.9, y: 27.4, t: 48  },
  { x: 20.3, y: 30.2, t: 64  },
  { x: 23.1, y: 33.5, t: 80  },
  { x: 26.4, y: 36.1, t: 96  },
  { x: 29.8, y: 39.7, t: 112 },
  { x: 33.2, y: 42.9, t: 128 },
  { x: 36.5, y: 45.8, t: 144 },
];

// ── Snapshot: locked smoothed output with tuned defaults ───────────────
// Regenerate with the helper script in task 2 notes if (and only if)
// defaults are changed via an approved design-doc revision.
const EXPECTED: ReadonlyArray<{ x: number; y: number }> = [
  { x: 10,                     y: 20                     },
  { x: 10.248914192228009,     y: 20.20634768672979      },
  { x: 10.816760808191198,     y: 20.72274512418082      },
  { x: 11.769220116781169,     y: 21.599210183498847     },
  { x: 13.098736684822503,     y: 22.91755485738262      },
  { x: 14.882865495463404,     y: 24.798719098490714     },
  { x: 17.20647955894139,      y: 27.066443097129287     },
  { x: 20.033319512078997,     y: 29.891664539839574     },
  { x: 23.263486439096802,     y: 33.06886565779689      },
  { x: 26.75113021546429,      y: 36.39731238614988      },
];

const EPS = 1e-6;

describe('OneEuroFilter default-parameter snapshot (regression gate)', () => {
  it('matches the locked smoothed output to 1e-6 precision', () => {
    // Two independent 1-D filters: one per axis (matches Stabilize stage usage).
    const fx = new OneEuroFilter();
    const fy = new OneEuroFilter();

    const actual = STROKE.map(({ x, y, t }) => ({
      x: fx.filter(x, t),
      y: fy.filter(y, t),
    }));

    expect(actual).toHaveLength(EXPECTED.length);

    for (let i = 0; i < EXPECTED.length; i++) {
      const a = actual[i]!;
      const e = EXPECTED[i]!;

      // absolute difference must be below the 1e-6 threshold
      const dx = Math.abs(a.x - e.x);
      const dy = Math.abs(a.y - e.y);

      expect(
        dx,
        `x drift at index ${i}: got ${a.x}, expected ${e.x} (diff ${dx})`,
      ).toBeLessThan(EPS);
      expect(
        dy,
        `y drift at index ${i}: got ${a.y}, expected ${e.y} (diff ${dy})`,
      ).toBeLessThan(EPS);
    }
  });

  it('passes the first sample through unchanged (initialisation contract)', () => {
    const fx = new OneEuroFilter();
    expect(fx.filter(STROKE[0]!.x, STROKE[0]!.t)).toBe(STROKE[0]!.x);
  });
});
