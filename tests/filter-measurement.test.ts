// One-shot empirical measurement (NOT a regression gate).
//
// Built to back up the 2026-04-23 StabilizeStage retune with real
// numbers instead of speculation. The suite generates a stationary-
// target + Gaussian-noise input and walks it through four filter
// configurations, reporting the residual jitter variance for each. The
// ratio between configurations is what tells us whether the retune
// actually buys the user anything — the commit / CHANGELOG quote the
// numbers this suite printed at the time of writing.
//
// This file is intentionally standalone: rerunning it after any filter
// change gives a fresh before/after snapshot without perturbing the
// parameter-drift regression gate in `filter-regression.test.ts`.

import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from '../src/filter/OneEuroFilter.js';

// ── Seeded RNG + Gaussian (mirrors filter-regression.test.ts) ──

function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number, mean: number, sigma: number): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sigma;
}

// ── Scenario: stationary hand + MediaPipe-scale noise ──

const DT = 1000 / 60;
const N = 400;
const STARTUP = 100;
const NOISE_SIGMA = 3; // px — realistic MediaPipe fingertip jitter at 640×480

interface Point { x: number; y: number; t: number }

function buildStationaryNoisy(): Point[] {
  const rng = seededRng(9876);
  const out: Point[] = [];
  for (let i = 0; i < N; i++) {
    out.push({
      x: 640 + gaussian(rng, 0, NOISE_SIGMA),
      y: 360 + gaussian(rng, 0, NOISE_SIGMA),
      t: i * DT,
    });
  }
  return out;
}

function varianceXY(pts: Point[]): number {
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let v = 0;
  for (const p of pts) v += (p.x - mx) ** 2 + (p.y - my) ** 2;
  return v / pts.length;
}

function applyOneEuro(
  input: Point[],
  minCutoff: number,
  beta: number,
  dCutoff: number,
): Point[] {
  const fx = new OneEuroFilter(minCutoff, beta, dCutoff);
  const fy = new OneEuroFilter(minCutoff, beta, dCutoff);
  return input.map((p) => ({
    x: fx.filter(p.x, p.t),
    y: fy.filter(p.y, p.t),
    t: p.t,
  }));
}

// ── Report ────────────────────────────────────────────────────────────

describe('Filter measurement — 2026-04-23 retune jitter rejection', () => {
  it('prints residual variance for each filter configuration', () => {
    const raw = buildStationaryNoisy();
    const rawVar = varianceXY(raw.slice(STARTUP));

    // Single pre-2026-04-23 StabilizeStage (0.3, 0.001, 0.7) — the value
    // shipped from the first Glymo release through 0.23.0.
    const oldStabilize = applyOneEuro(raw, 0.3, 0.001, 0.7);
    const oldStabilizeVar = varianceXY(oldStabilize.slice(STARTUP));

    // Dual-filter pre-2026-04-23: CameraCapture pre-filter (1.0, 0.5, 1.0)
    // into the old StabilizeStage. The pre-filter was removed in
    // @glymo/core 0.23.0; 0.24.0 restores it.
    const pre = applyOneEuro(raw, 1.0, 0.5, 1.0);
    const oldDualVar = varianceXY(
      applyOneEuro(pre, 0.3, 0.001, 0.7).slice(STARTUP),
    );

    // New 2026-04-23 StabilizeStage (0.15, 0.001, 0.5) WITH the restored
    // pre-filter — the configuration shipping as @glymo/core 0.24.0.
    const newDualVar = varianceXY(
      applyOneEuro(pre, 0.15, 0.001, 0.5).slice(STARTUP),
    );

    // Reference values as of 2026-04-23 retune (rerun this suite locally
    // to refresh; see the final `expect` for the "new beats old"
    // regression guard). Units: px² of residual XY-sum variance.
    //
    //   raw_variance:                            18.49
    //   single_old_stabilize (0.3, 0.001, 0.7):   0.48  — 2.60% of raw
    //   dual_old_pre + old_stabilize:              0.50  — 2.69% of raw (pre-filter no-op)
    //   dual_new_pre + new_stabilize (0.15, 0.001, 0.5):  0.29  — 1.59% of raw
    //
    // Key takeaway: the CameraCapture pre-filter contributes essentially
    // nothing on a stationary target (0.48 → 0.50 is within noise). The
    // ~41% variance reduction between the old and new dual configs comes
    // almost entirely from the StabilizeStage retune.
    expect(rawVar).toBeGreaterThan(15); // sanity: σ=3 noise produces ~18
    expect(newDualVar).toBeLessThan(0.35); // tracks the 0.29 measurement
    expect(newDualVar).toBeLessThanOrEqual(oldDualVar); // the retune must not regress
    expect(newDualVar / oldDualVar).toBeLessThan(0.7); // and must actually beat old by >30%

    // Ratios printed by the companion measurement run (kept as comments,
    // not as gates, because noise-driven float equality is brittle):
    //   single_old_vs_raw: 0.026
    //   dual_old_vs_raw:   0.027
    //   dual_new_vs_raw:   0.016
    //   dual_new_vs_dual_old: 0.59
    void oldStabilizeVar; // suppress unused-var when only dual values are asserted
  });
});
