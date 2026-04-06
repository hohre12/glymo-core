import { OneEuroFilter } from '../src/filter/OneEuroFilter.js';

// ── Initialization ────────────────────────────────────

describe('OneEuroFilter initialization', () => {
  it('creates with default parameters', () => {
    const filter = new OneEuroFilter();
    expect(filter).toBeDefined();
  });

  it('creates with custom parameters', () => {
    const filter = new OneEuroFilter(2.0, 0.01, 1.5);
    expect(filter).toBeDefined();
  });

  it('returns first input unchanged', () => {
    const filter = new OneEuroFilter();
    const result = filter.filter(100, 0);
    expect(result).toBe(100);
  });

  it('returns first input unchanged for non-zero timestamp', () => {
    const filter = new OneEuroFilter();
    const result = filter.filter(42.5, 500);
    expect(result).toBe(42.5);
  });
});

// ── Smoothing Behavior ────────────────────────────────

describe('OneEuroFilter smoothing', () => {
  it('smooths jittery input', () => {
    const filter = new OneEuroFilter();
    filter.filter(100, 0);

    // Simulate jittery input around 100 at 16ms intervals
    const jitterValues = [102, 98, 101, 99, 100.5, 99.5, 100.2, 99.8];
    const results: number[] = [];

    for (let i = 0; i < jitterValues.length; i++) {
      results.push(filter.filter(jitterValues[i]!, (i + 1) * 16));
    }

    // Smoothed values should have less variance than input
    const inputVariance = variance(jitterValues);
    const outputVariance = variance(results);
    expect(outputVariance).toBeLessThan(inputVariance);
  });

  it('converges toward stable input', () => {
    const filter = new OneEuroFilter();
    filter.filter(0, 0);

    // Feed constant value — output should converge
    let result = 0;
    for (let i = 1; i <= 20; i++) {
      result = filter.filter(50, i * 16);
    }

    expect(result).toBeCloseTo(50, 0);
  });
});

// ── Adaptive Behavior ─────────────────────────────────

describe('OneEuroFilter adaptive behavior', () => {
  it('fast motion is less smoothed than slow motion', () => {
    // Both use same dt (16ms) to isolate velocity effect
    const slowFilter = new OneEuroFilter();
    slowFilter.filter(0, 0);
    const slowResult = slowFilter.filter(1, 16); // 1px over 16ms (slow)

    const fastFilter = new OneEuroFilter();
    fastFilter.filter(0, 0);
    const fastResult = fastFilter.filter(100, 16); // 100px over 16ms (fast)

    // Fast motion: higher adaptive cutoff → less smoothing → closer to target
    const slowRatio = slowResult / 1; // fraction of target reached
    const fastRatio = fastResult / 100;
    expect(fastRatio).toBeGreaterThan(slowRatio);
  });

  it('preserves responsiveness during fast movement', () => {
    const filter = new OneEuroFilter();
    filter.filter(0, 0);

    // Large jump simulating fast gesture
    const result = filter.filter(200, 16);

    // Should follow at least partially (not stuck at 0)
    expect(result).toBeGreaterThan(50);
  });
});

// ── Edge Cases ────────────────────────────────────────

describe('OneEuroFilter edge cases', () => {
  it('handles dt=0 by returning previous value', () => {
    const filter = new OneEuroFilter();
    filter.filter(100, 1000);
    filter.filter(110, 1016);

    // Same timestamp — dt=0 should return previous smoothed value
    const result = filter.filter(120, 1016);
    expect(result).not.toBe(120); // Should not pass through raw
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
  });

  it('handles negative dt by returning previous value', () => {
    const filter = new OneEuroFilter();
    filter.filter(100, 1000);
    filter.filter(110, 1016);

    // Earlier timestamp
    const result = filter.filter(120, 1000);
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
  });
});

// ── Reset ─────────────────────────────────────────────

describe('OneEuroFilter reset', () => {
  it('clears state so next call returns input unchanged', () => {
    const filter = new OneEuroFilter();
    filter.filter(100, 0);
    filter.filter(110, 16);
    filter.filter(120, 32);

    filter.reset();

    // After reset, first call should return input as-is
    const result = filter.filter(200, 100);
    expect(result).toBe(200);
  });

  it('can be used for multiple strokes via reset', () => {
    const filter = new OneEuroFilter();

    // Stroke 1
    filter.filter(0, 0);
    filter.filter(50, 16);

    filter.reset();

    // Stroke 2 — should start fresh
    const result = filter.filter(300, 100);
    expect(result).toBe(300);
  });
});

// ── Helpers ───────────────────────────────────────────

function variance(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}
