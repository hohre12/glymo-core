import { PressureStage, PressureTaper } from '../src/pipeline/stages/PressureStage.js';
import type { StrokePoint } from '../src/types.js';

// ── Helpers ───────────────────────────────────────────

function makePoint(x: number, y: number, t: number, pressure = 0.5): StrokePoint {
  return { x, y, t, pressure };
}

// ── PressureStage: Per-Point Processing ───────────────

describe('PressureStage per-point pressure', () => {
  let stage: PressureStage;

  beforeEach(() => {
    stage = new PressureStage();
  });

  it('first point defaults to pressure 0.5', () => {
    const result = stage.process(makePoint(100, 100, 0));
    expect(result.pressure).toBe(0.5);
  });

  it('slow input produces high pressure (close to 1.0)', () => {
    stage.process(makePoint(100, 100, 0));
    // Move 1px over 100ms → speed = 1/100 = 0.01 px/ms
    // pressure = clamp(1.0 - 0.01 * 1.7, 0.15, 1.0) = clamp(0.983, ...) ≈ 0.983
    const result = stage.process(makePoint(101, 100, 100));
    expect(result.pressure).toBeGreaterThan(0.9);
    expect(result.pressure).toBeLessThanOrEqual(1.0);
  });

  it('fast input produces low pressure (close to 0.15)', () => {
    stage.process(makePoint(100, 100, 0));
    // Move 200px over 16ms → speed ≈ 12.5 px/ms
    // pressure = clamp(1.0 - 12.5 * 1.7, 0.15, 1.0) = clamp(-20.25, ...) = 0.15
    const result = stage.process(makePoint(300, 100, 16));
    expect(result.pressure).toBe(0.15);
  });

  it('stationary input produces pressure 1.0', () => {
    stage.process(makePoint(100, 100, 0));
    // No movement, speed = 0 → pressure = clamp(1.0, 0.15, 1.0) = 1.0
    const result = stage.process(makePoint(100, 100, 16));
    expect(result.pressure).toBe(1.0);
  });
});

describe('PressureStage formula verification', () => {
  let stage: PressureStage;

  beforeEach(() => {
    stage = new PressureStage();
  });

  it('matches formula: clamp(1.0 - speed * 1.7, 0.15, 1.0)', () => {
    stage.process(makePoint(0, 0, 0));
    // Move 10px horizontally over 16ms → speed = 10/16 = 0.625 px/ms
    // pressure = clamp(1.0 - 0.625 * 1.7, 0.15, 1.0) = clamp(-0.0625, ...) = 0.15
    const result = stage.process(makePoint(10, 0, 16));
    const expectedSpeed = 10 / 16;
    const expected = Math.max(0.15, Math.min(1.0, 1.0 - expectedSpeed * 1.7));
    expect(result.pressure).toBeCloseTo(expected, 10);
  });

  it('uses dt fallback of 16ms when timestamps are identical', () => {
    stage.process(makePoint(0, 0, 100));
    // Same timestamp → dt = 0, fallback to 16ms
    // Move 5px → speed = 5/16 = 0.3125
    // pressure = 1.0 - 0.3125 * 1.7 = 0.469
    const result = stage.process(makePoint(5, 0, 100));
    const expectedSpeed = 5 / 16;
    const expected = Math.max(0.15, Math.min(1.0, 1.0 - expectedSpeed * 1.7));
    expect(result.pressure).toBeCloseTo(expected, 10);
  });

  it('preserves x/y/t from input', () => {
    stage.process(makePoint(0, 0, 0));
    const result = stage.process(makePoint(50, 75, 100));
    expect(result.x).toBe(50);
    expect(result.y).toBe(75);
    expect(result.t).toBe(100);
  });
});

describe('PressureStage reset', () => {
  it('reset clears previous point state', () => {
    const stage = new PressureStage();
    stage.process(makePoint(0, 0, 0));
    stage.process(makePoint(10, 0, 16));

    stage.reset();

    // After reset, first point should use default pressure again
    const result = stage.process(makePoint(500, 500, 200));
    expect(result.pressure).toBe(0.5);
  });
});

// ── PressureTaper: Batch Taper ────────────────────────

describe('PressureTaper easeInQuad taper — start/end', () => {
  const taper = new PressureTaper();

  it('applies easeInQuad taper to start points', () => {
    const points = Array.from({ length: 20 }, (_, i) =>
      makePoint(i * 10, 0, i * 16, 1.0),
    );

    const result = taper.processBatch(points);
    // taperLength = min(8, floor(20 * 0.15)) = min(8, 3) = 3
    // Point 0: t=0/3, eased=0 → pressure *= 0 → 0
    // Point 1: t=1/3, eased=(1/3)^2 ≈ 0.111 → pressure ≈ 0.111
    // Point 2: t=2/3, eased=(2/3)^2 ≈ 0.444 → pressure ≈ 0.444
    expect(result[0]!.pressure).toBeCloseTo(0, 5);
    expect(result[1]!.pressure).toBeLessThan(1.0);
    expect(result[2]!.pressure).toBeLessThan(1.0);
  });

  it('applies easeInQuad taper to end points', () => {
    const points = Array.from({ length: 20 }, (_, i) =>
      makePoint(i * 10, 0, i * 16, 1.0),
    );

    const result = taper.processBatch(points);
    const len = result.length;
    // End taper mirrors start taper
    expect(result[len - 1]!.pressure).toBeCloseTo(0, 5);
    expect(result[len - 2]!.pressure).toBeLessThan(1.0);
    expect(result[len - 3]!.pressure).toBeLessThan(1.0);
  });

  it('middle points are unchanged by taper', () => {
    const points = Array.from({ length: 20 }, (_, i) =>
      makePoint(i * 10, 0, i * 16, 0.8),
    );

    const result = taper.processBatch(points);
    // Points in the middle should keep their original pressure
    expect(result[10]!.pressure).toBe(0.8);
  });
});

describe('PressureTaper easeInQuad taper — constraints', () => {
  const taper = new PressureTaper();

  it('does not mutate original array', () => {
    const points = [makePoint(0, 0, 0, 1.0), makePoint(10, 0, 16, 1.0)];
    const origPressures = points.map((p) => p.pressure);
    taper.processBatch(points);
    expect(points.map((p) => p.pressure)).toEqual(origPressures);
  });

  it('taper cap is 8 points maximum', () => {
    // 100 points → floor(100 * 0.15) = 15, capped at 8
    const points = Array.from({ length: 100 }, (_, i) =>
      makePoint(i, 0, i * 16, 1.0),
    );

    const result = taper.processBatch(points);
    // Point at index 8 should be untouched
    expect(result[8]!.pressure).toBe(1.0);
    // Point at index 7 (last tapered) should be < 1.0
    expect(result[7]!.pressure).toBeLessThan(1.0);
  });
});

describe('PressureTaper edge cases', () => {
  const taper = new PressureTaper();

  it('single point: no taper applied (taperLength=0)', () => {
    const points = [makePoint(0, 0, 0, 1.0)];
    const result = taper.processBatch(points);
    expect(result[0]!.pressure).toBe(1.0);
  });

  it('two points: taperLength=0 so no taper', () => {
    const points = [makePoint(0, 0, 0, 1.0), makePoint(10, 0, 16, 1.0)];
    const result = taper.processBatch(points);
    // floor(2 * 0.15) = 0, so no taper
    expect(result[0]!.pressure).toBe(1.0);
    expect(result[1]!.pressure).toBe(1.0);
  });

  it('empty array returns empty', () => {
    const result = taper.processBatch([]);
    expect(result).toEqual([]);
  });

  it('reset does nothing (stateless)', () => {
    expect(() => taper.reset()).not.toThrow();
  });
});
