import { SmoothStage } from '../src/pipeline/stages/SmoothStage.js';
import type { StrokePoint } from '../src/types.js';

// ── Helpers ───────────────────────────────────────────

function makePoint(x: number, y: number, t: number, pressure = 0.5): StrokePoint {
  return { x, y, t, pressure };
}

function makeLine(count: number): StrokePoint[] {
  return Array.from({ length: count }, (_, i) =>
    makePoint(i * 10, i * 5, i * 16, 0.7),
  );
}

// ── Point Count Growth ────────────────────────────────

describe('SmoothStage point count', () => {
  const stage = new SmoothStage();

  it('produces more points than input', () => {
    const input = makeLine(10);
    const result = stage.processBatch(input);
    expect(result.length).toBeGreaterThan(input.length);
  });

  it('4 iterations produce expected growth (~16x for n>3)', () => {
    const input = makeLine(10);
    const result = stage.processBatch(input);
    // Each iteration: n pairs → 2n new points + 2 endpoints
    // After 4 iters on 10 points: roughly 10 * 16 = 160 (plus endpoints)
    expect(result.length).toBeGreaterThan(100);
    expect(result.length).toBeLessThan(300);
  });

  it('3 points still get smoothed', () => {
    const input = makeLine(3);
    const result = stage.processBatch(input);
    expect(result.length).toBeGreaterThan(3);
  });
});

// ── Endpoint Preservation ─────────────────────────────

describe('SmoothStage endpoint preservation', () => {
  const stage = new SmoothStage();

  it('start point is preserved exactly', () => {
    const input = makeLine(10);
    const result = stage.processBatch(input);
    expect(result[0]!.x).toBe(input[0]!.x);
    expect(result[0]!.y).toBe(input[0]!.y);
    expect(result[0]!.t).toBe(input[0]!.t);
    expect(result[0]!.pressure).toBe(input[0]!.pressure);
  });

  it('end point is preserved exactly', () => {
    const input = makeLine(10);
    const result = stage.processBatch(input);
    const last = result[result.length - 1]!;
    const inputLast = input[input.length - 1]!;
    expect(last.x).toBe(inputLast.x);
    expect(last.y).toBe(inputLast.y);
    expect(last.t).toBe(inputLast.t);
    expect(last.pressure).toBe(inputLast.pressure);
  });
});

// ── Pressure Interpolation ────────────────────────────

describe('SmoothStage pressure interpolation', () => {
  const stage = new SmoothStage();

  it('pressure values are interpolated between endpoints', () => {
    const input = [
      makePoint(0, 0, 0, 0.2),
      makePoint(10, 0, 16, 0.8),
      makePoint(20, 0, 32, 0.4),
      makePoint(30, 0, 48, 1.0),
    ];

    const result = stage.processBatch(input);

    // All interior pressures should be bounded by the min/max of input
    for (const p of result) {
      expect(p.pressure).toBeGreaterThanOrEqual(0);
      expect(p.pressure).toBeLessThanOrEqual(1.0);
    }
  });

  it('uniform pressure is maintained', () => {
    const input = makeLine(5); // All pressure = 0.7
    const result = stage.processBatch(input);

    // Chaikin interpolation of uniform pressure should stay ~0.7
    for (const p of result) {
      expect(p.pressure).toBeCloseTo(0.7, 1);
    }
  });
});

// ── Short Input Edge Cases ────────────────────────────

describe('SmoothStage short input', () => {
  const stage = new SmoothStage();

  it('< 3 points returns input unchanged', () => {
    const input = [makePoint(0, 0, 0), makePoint(10, 10, 16)];
    const result = stage.processBatch(input);
    expect(result.length).toBe(2);
    expect(result[0]!.x).toBe(0);
    expect(result[1]!.x).toBe(10);
  });

  it('single point returns input unchanged', () => {
    const input = [makePoint(5, 5, 0)];
    const result = stage.processBatch(input);
    expect(result.length).toBe(1);
    expect(result[0]!.x).toBe(5);
  });

  it('empty array returns empty', () => {
    const result = stage.processBatch([]);
    expect(result.length).toBe(0);
  });
});

// ── Immutability ──────────────────────────────────────

describe('SmoothStage immutability', () => {
  const stage = new SmoothStage();

  it('does not mutate original points', () => {
    const input = makeLine(5);
    const origX = input.map((p) => p.x);
    stage.processBatch(input);
    expect(input.map((p) => p.x)).toEqual(origX);
  });

  it('reset does nothing (stateless)', () => {
    expect(() => stage.reset()).not.toThrow();
  });
});
