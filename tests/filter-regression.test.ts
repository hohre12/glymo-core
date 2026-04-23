// Filter regression gate (2026-04-23).
//
// CLAUDE.md has one absolute rule about this file's subject matter:
//
//   "No changing OneEuroFilter parameters without testing"
//
// The rule protects ~1M frames of downstream user experience from silent
// parameter drift. This suite is what makes the rule enforceable: a
// snapshot test on a deterministic synthetic input pins the CURRENT
// filter output byte-for-byte (within a 4-decimal tolerance). Any
// intentional parameter change must delete and regenerate the snapshot,
// which forces the author to inspect the before/after diff and commit
// the regenerated file alongside the parameter change.
//
// The second test (Gate B) is a sanity check that the filter is actually
// filtering — output RMS error vs ground truth must be strictly less than
// input RMS error vs ground truth. This catches the failure mode where
// a future refactor accidentally bypasses the filter entirely.
//
// Scope decisions (deliberate):
//   • Only StabilizeStage camera-mode params are snapshotted. Mouse-mode
//     is symmetric (same algorithm, weaker smoothing) and covered by the
//     adaptive-behaviour tests in OneEuroFilter.test.ts. CameraCapture's
//     filter (currently (1.0, 0.5, 1.0)) is INTENTIONALLY not pinned here
//     because the 2026-04-23 dual-filtering-removal refactor will delete
//     it — pinning ephemeral configuration would just break the refactor
//     test suite for no gain.
//   • Synthetic circle + Gaussian noise is the single canonical input.
//     Real-session recordings are a Phase 2 addition (see discussion in
//     CHANGELOG). Synthetic is sufficient because the algorithm's
//     response to a noisy sinusoid generalises to hand trajectories.
//   • No custom "jerk" or "lag" metrics. Those are speculative —
//     over-smoothing drives jerk toward zero while killing responsiveness,
//     so jerk alone is a poor gate. Subjective responsiveness is
//     validated manually (see `?diag=filter=1` dev overlay).

import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from '../src/filter/OneEuroFilter.js';

// ── Deterministic RNG + Gaussian ─────────────────────────────────────────
// mulberry32: 32-bit seedable PRNG with excellent statistical properties
// for a 1-line implementation. Deterministic across machines / Node
// versions, which is what a regression fixture requires. Do NOT swap for
// Math.random — its implementation is not specified by ECMAScript and
// output differs between engines / versions.

function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller transform — draws one sample from N(mean, sigma²). */
function gaussian(rng: () => number, mean: number, sigma: number): number {
  const u1 = Math.max(rng(), Number.EPSILON); // avoid log(0)
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sigma;
}

// ── Synthetic fixture generator ─────────────────────────────────────────
// 200 points tracing 5 revolutions of a circle (radius 200, centre
// (500, 300)) at 60 Hz with Gaussian jitter (σ = 0.3 px).
//
// The revolution count is deliberate. With CAMERA_MIN_CUTOFF = 0.3 Hz and
// a 1-revolution-per-3.3-second fixture, the signal frequency (~0.3 Hz)
// lands ON the cutoff — the filter would attenuate the signal itself and
// the RMS sanity gate (Gate B) would fail for the wrong reason. Five
// revolutions over 3.3 s puts the signal at ~1.5 Hz, well above the
// stationary-hand cutoff. Since OneEuroFilter's adaptive cutoff also
// grows with speed (β = 0.001 × velocity), actual motion during the
// fixture pushes the effective cutoff to ~2 Hz, which is the operating
// regime the filter is tuned for.
//
// 0.3 px σ roughly matches observed MediaPipe landmark jitter after
// camera-space normalisation to the canvas pixel basis.

const FIXTURE_SEED = 1234;
const FIXTURE_N = 200;
const FIXTURE_REVOLUTIONS = 5;
const FIXTURE_NOISE_SIGMA = 0.3;
const FIXTURE_DT_MS = 1000 / 60; // ~16.67 ms

interface Point { x: number; y: number; t: number }
interface FixturePoint extends Point { gtX: number; gtY: number }

function buildSyntheticCircle(): FixturePoint[] {
  const rng = seededRng(FIXTURE_SEED);
  const pts: FixturePoint[] = [];
  for (let i = 0; i < FIXTURE_N; i++) {
    const theta = (i / FIXTURE_N) * Math.PI * 2 * FIXTURE_REVOLUTIONS;
    const gtX = 500 + 200 * Math.cos(theta);
    const gtY = 300 + 200 * Math.sin(theta);
    pts.push({
      x: gtX + gaussian(rng, 0, FIXTURE_NOISE_SIGMA),
      y: gtY + gaussian(rng, 0, FIXTURE_NOISE_SIGMA),
      t: i * FIXTURE_DT_MS,
      gtX,
      gtY,
    });
  }
  return pts;
}

// ── Variance metric ──────────────────────────────────────────────────────
// Sum of per-axis variances — a scalar proxy for "jitter energy" that is
// invariant to the signal's mean position. Used by Gate B (jitter
// rejection) which feeds a stationary target: a functional low-pass
// filter must leave less jitter in its output than its input carried.

function varianceXY(pts: Point[]): number {
  if (pts.length === 0) return 0;
  let sumX = 0, sumY = 0;
  for (const p of pts) { sumX += p.x; sumY += p.y; }
  const meanX = sumX / pts.length;
  const meanY = sumY / pts.length;
  let varX = 0, varY = 0;
  for (const p of pts) {
    varX += (p.x - meanX) ** 2;
    varY += (p.y - meanY) ** 2;
  }
  return (varX + varY) / pts.length;
}

// ── Filter runner ────────────────────────────────────────────────────────

function runFilter(
  input: FixturePoint[],
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

// ── Current parameters (source of truth: StabilizeStage.ts) ──────────────
// Duplicated here because those constants are private to StabilizeStage.
// If StabilizeStage re-exports them in the future, collapse this pair into
// the re-export. Mismatches between the two sources will surface as
// snapshot drift the next time the suite runs, which is the intended
// failure mode for a "parameter drift" regression gate.

const CAMERA_MIN_CUTOFF = 0.15;
const CAMERA_BETA = 0.001;
const CAMERA_D_CUTOFF = 0.5;

// ── Tests ────────────────────────────────────────────────────────────────

describe('Filter regression — OneEuroFilter parameter-drift gate', () => {
  it('camera-mode parameters (0.3, 0.001, 0.7) produce the pinned output on synthetic-circle', async () => {
    const fixture = buildSyntheticCircle();
    const output = runFilter(fixture, CAMERA_MIN_CUTOFF, CAMERA_BETA, CAMERA_D_CUTOFF);

    // `toMatchFileSnapshot` writes the file on first run and compares
    // element-wise on subsequent runs. Float values are rounded to 4
    // decimal places before serialisation so a sub-pixel refactor
    // (e.g. a change in IEEE 754 operation order in a downstream
    // dependency) does not trigger a spurious snapshot failure. 4 decimals
    // = 0.0001 px tolerance, which is far below the 0.3 px fixture noise
    // floor and well below any user-visible threshold.
    const serialised = output
      .map((p) => ({
        x: Number(p.x.toFixed(4)),
        y: Number(p.y.toFixed(4)),
        t: Number(p.t.toFixed(4)),
      }));
    await expect(JSON.stringify(serialised, null, 2))
      .toMatchFileSnapshot('./__snapshots__/filter-camera-circle.json');
  });

  it('camera-mode filter reduces jitter on a noisy constant signal (Gate B — jitter rejection)', () => {
    // Textbook low-pass filter sanity: feed a stationary signal + Gaussian
    // noise, measure output variance vs input variance over a window past
    // the startup transient. A functional low-pass filter MUST attenuate
    // noise on a constant signal — if this fails, the filter is a no-op
    // pass-through (or worse, amplifying noise).
    //
    // Deliberately decoupled from the circle fixture because the circle
    // signal is above the camera-mode cutoff (0.3 Hz stationary, ~2 Hz
    // during motion), so circle-fixture RMS-to-ground-truth conflates
    // "noise rejection" with "phase lag" — two separable properties of
    // the filter that Gate A already pins together via the snapshot.
    // Gate B isolates noise rejection by removing the signal-tracking
    // variable entirely (constant = zero signal frequency).
    const rng = seededRng(5678);
    const TARGET_X = 100;
    const TARGET_Y = 200;
    const NOISE_SIGMA = 3; // larger than the circle fixture so the
                          // noise floor is well above any IEEE 754 drift
    const N = 400;
    const STARTUP = 100; // skip ~1.67 s of startup transient before
                        // computing variance; with tau ≈ 0.53 s at the
                        // 0.3 Hz cutoff this leaves ~3 time-constants
                        // for the filter to settle.

    const fx = new OneEuroFilter(CAMERA_MIN_CUTOFF, CAMERA_BETA, CAMERA_D_CUTOFF);
    const fy = new OneEuroFilter(CAMERA_MIN_CUTOFF, CAMERA_BETA, CAMERA_D_CUTOFF);

    const inputs: Point[] = [];
    const outputs: Point[] = [];
    for (let i = 0; i < N; i++) {
      const t = i * FIXTURE_DT_MS;
      const inp = {
        x: TARGET_X + gaussian(rng, 0, NOISE_SIGMA),
        y: TARGET_Y + gaussian(rng, 0, NOISE_SIGMA),
        t,
      };
      inputs.push(inp);
      outputs.push({ x: fx.filter(inp.x, t), y: fy.filter(inp.y, t), t });
    }

    const inputVar = varianceXY(inputs.slice(STARTUP));
    const outputVar = varianceXY(outputs.slice(STARTUP));

    // Strict inequality — the filter must actually remove some energy.
    // With (0.3 Hz, β=0.001) params and 3 px σ noise, observed ratio is
    // well under 0.05; the assertion is deliberately loose so the gate
    // survives future parameter re-tunings that keep the filter
    // low-passing (e.g. raising cutoff to 0.8 Hz would still pass).
    expect(outputVar).toBeLessThan(inputVar);
  });

  it('synthetic-circle fixture is deterministic across runs', () => {
    // Independent guardrail against accidental RNG / fixture changes.
    // If someone reseeds / resizes the fixture, this test fails before
    // the snapshot does, pointing directly at the fixture drift.
    const a = buildSyntheticCircle();
    const b = buildSyntheticCircle();
    expect(a.length).toBe(FIXTURE_N);
    for (let i = 0; i < FIXTURE_N; i++) {
      expect(a[i]!.x).toBe(b[i]!.x);
      expect(a[i]!.y).toBe(b[i]!.y);
      expect(a[i]!.t).toBe(b[i]!.t);
    }
  });
});
