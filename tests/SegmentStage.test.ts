import { SegmentStage } from '../src/pipeline/stages/SegmentStage.js';
import type { StrokePoint } from '../src/types.js';

// ── Helpers ───────────────────────────────────────────

function makePoint(x: number, y: number, t: number, pressure = 0.5): StrokePoint {
  return { x, y, t, pressure };
}

// ── Pen Down/Up Lifecycle ─────────────────────────────

describe('SegmentStage pen lifecycle', () => {
  let stage: SegmentStage;

  beforeEach(() => {
    stage = new SegmentStage();
  });

  it('pen down starts stroke recording', () => {
    stage.penDown();
    expect(stage.getIsDrawing()).toBe(true);
  });

  it('pen down then process accumulates points', () => {
    stage.penDown();
    stage.process(makePoint(0, 0, 0));
    stage.process(makePoint(10, 10, 16));
    stage.process(makePoint(20, 20, 32));

    expect(stage.getCurrentPoints()).toHaveLength(3);
  });

  it('pen up finalizes stroke with >= 3 points', () => {
    stage.penDown();
    stage.process(makePoint(0, 0, 0));
    stage.process(makePoint(10, 10, 16));
    stage.process(makePoint(20, 20, 32));

    const result = stage.penUp();
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    expect(stage.getIsDrawing()).toBe(false);
  });

  it('pen up returns correct point data', () => {
    stage.penDown();
    stage.process(makePoint(5, 15, 100));
    stage.process(makePoint(25, 35, 116));
    stage.process(makePoint(45, 55, 132));

    const result = stage.penUp();
    expect(result![0]!.x).toBe(5);
    expect(result![1]!.x).toBe(25);
    expect(result![2]!.x).toBe(45);
  });
});

// ── Short Stroke Discard ──────────────────────────────

describe('SegmentStage short strokes', () => {
  let stage: SegmentStage;

  beforeEach(() => {
    stage = new SegmentStage();
  });

  it('< 3 points are discarded', () => {
    stage.penDown();
    stage.process(makePoint(0, 0, 0));
    stage.process(makePoint(10, 10, 16));

    const result = stage.penUp();
    expect(result).toBeNull();
  });

  it('single point is discarded', () => {
    stage.penDown();
    stage.process(makePoint(0, 0, 0));

    const result = stage.penUp();
    expect(result).toBeNull();
  });

  it('zero points is discarded', () => {
    stage.penDown();
    const result = stage.penUp();
    expect(result).toBeNull();
  });
});

// ── Multiple Strokes — sequential ─────────────────────

describe('SegmentStage sequential strokes', () => {
  let stage: SegmentStage;
  beforeEach(() => { stage = new SegmentStage(); });

  it('handles sequential strokes', () => {
    stage.penDown();
    for (let i = 0; i < 5; i++) {
      stage.process(makePoint(i * 10, 0, i * 16));
    }
    const stroke1 = stage.penUp();
    expect(stroke1).toHaveLength(5);

    stage.penDown();
    for (let i = 0; i < 3; i++) {
      stage.process(makePoint(i * 20, 100, 100 + i * 16));
    }
    const stroke2 = stage.penUp();
    expect(stroke2).toHaveLength(3);
  });

  it('points accumulate independently per stroke', () => {
    stage.penDown();
    stage.process(makePoint(100, 100, 0));
    stage.process(makePoint(200, 200, 16));
    stage.process(makePoint(300, 300, 32));
    stage.penUp();
    stage.penDown();
    expect(stage.getCurrentPoints()).toHaveLength(0);
  });
});

// ── Multiple Strokes — discard behavior ───────────────

describe('SegmentStage discard behavior', () => {
  let stage: SegmentStage;
  beforeEach(() => { stage = new SegmentStage(); });

  it('discarded stroke does not affect next stroke', () => {
    stage.penDown();
    stage.process(makePoint(0, 0, 0));
    stage.penUp();

    stage.penDown();
    stage.process(makePoint(10, 10, 100));
    stage.process(makePoint(20, 20, 116));
    stage.process(makePoint(30, 30, 132));
    const result = stage.penUp();
    expect(result).toHaveLength(3);
  });
});

// ── State and Reset ───────────────────────────────────

describe('SegmentStage state', () => {
  let stage: SegmentStage;

  beforeEach(() => {
    stage = new SegmentStage();
  });

  it('process without penDown does not accumulate', () => {
    stage.process(makePoint(0, 0, 0));
    stage.process(makePoint(10, 10, 16));
    expect(stage.getCurrentPoints()).toHaveLength(0);
  });

  it('getCurrentPoints returns readonly array', () => {
    stage.penDown();
    stage.process(makePoint(0, 0, 0));
    const points = stage.getCurrentPoints();
    expect(points).toHaveLength(1);
  });

  it('process returns input unchanged', () => {
    stage.penDown();
    const input = makePoint(42, 84, 100, 0.75);
    const result = stage.process(input);
    expect(result.x).toBe(42);
    expect(result.y).toBe(84);
    expect(result.t).toBe(100);
    expect(result.pressure).toBe(0.75);
  });

  it('reset clears drawing state', () => {
    stage.penDown();
    stage.process(makePoint(0, 0, 0));

    stage.reset();

    expect(stage.getIsDrawing()).toBe(false);
    expect(stage.getCurrentPoints()).toHaveLength(0);
  });
});
