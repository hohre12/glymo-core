import { PipelineEngine } from '../src/pipeline/PipelineEngine.js';
import { EventBus } from '../src/state/EventBus.js';
import type { RawInputPoint } from '../src/types.js';

// ── Helpers ───────────────────────────────────────────

function makeRaw(x: number, y: number, t: number): RawInputPoint {
  return { x, y, t, source: 'mouse' };
}

function feedStroke(
  engine: PipelineEngine,
  count: number,
  spacing = 10,
  dt = 16,
): void {
  for (let i = 0; i < count; i++) {
    engine.processPoint(makeRaw(i * spacing, i * spacing * 0.5, i * dt));
  }
}

// ── processPoint ──────────────────────────────────────

describe('PipelineEngine processPoint', () => {
  let engine: PipelineEngine;
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    engine = new PipelineEngine(bus);
  });

  it('returns a StrokePoint with x, y, t, pressure', () => {
    engine.penDown();
    const result = engine.processPoint(makeRaw(100, 200, 0));
    expect(result).toHaveProperty('x');
    expect(result).toHaveProperty('y');
    expect(result).toHaveProperty('t');
    expect(result).toHaveProperty('pressure');
  });

  it('pressure is within valid range', () => {
    engine.penDown();
    engine.processPoint(makeRaw(0, 0, 0));
    const result = engine.processPoint(makeRaw(10, 10, 16));
    expect(result.pressure).toBeGreaterThanOrEqual(0.15);
    expect(result.pressure).toBeLessThanOrEqual(1.0);
  });

  it('first point gets default pressure 0.5', () => {
    engine.penDown();
    const result = engine.processPoint(makeRaw(50, 50, 0));
    expect(result.pressure).toBe(0.5);
  });
});

// ── penDown/penUp lifecycle ───────────────────────────

describe('PipelineEngine pen lifecycle — events', () => {
  let engine: PipelineEngine;
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    engine = new PipelineEngine(bus);
  });

  it('penDown emits stroke:start', () => {
    let emitted = false;
    bus.on('stroke:start', () => { emitted = true; });

    engine.penDown();
    expect(emitted).toBe(true);
  });

  it('penUp with valid stroke emits stroke:end', () => {
    let emitted = false;
    bus.on('stroke:end', () => { emitted = true; });

    engine.penDown();
    feedStroke(engine, 5);
    engine.penUp();

    expect(emitted).toBe(true);
  });
});

describe('PipelineEngine pen lifecycle — penUp results', () => {
  let engine: PipelineEngine;
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    engine = new PipelineEngine(bus);
  });

  it('penUp with short stroke returns null', () => {
    engine.penDown();
    engine.processPoint(makeRaw(0, 0, 0));
    engine.processPoint(makeRaw(5, 5, 16));

    const result = engine.penUp();
    expect(result).toBeNull();
  });

  it('penUp with valid stroke returns raw and smoothed', () => {
    engine.penDown();
    feedStroke(engine, 10);
    const result = engine.penUp();

    expect(result).not.toBeNull();
    expect(result!.raw.length).toBeGreaterThan(0);
    expect(result!.smoothed.length).toBeGreaterThan(0);
  });

  it('smoothed output has more points than raw', () => {
    engine.penDown();
    feedStroke(engine, 10);
    const result = engine.penUp();

    expect(result!.smoothed.length).toBeGreaterThan(result!.raw.length);
  });
});

// ── Active stroke state ───────────────────────────────

describe('PipelineEngine active stroke', () => {
  let engine: PipelineEngine;
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    engine = new PipelineEngine(bus);
  });

  it('getActivePoints returns empty before penDown', () => {
    expect(engine.getActivePoints()).toHaveLength(0);
  });

  it('getActivePoints returns accumulated points', () => {
    engine.penDown();
    feedStroke(engine, 5);
    expect(engine.getActivePoints()).toHaveLength(5);
  });

  it('isDrawing reflects pen state', () => {
    expect(engine.isDrawing()).toBe(false);

    engine.penDown();
    expect(engine.isDrawing()).toBe(true);

    feedStroke(engine, 5);
    engine.penUp();
    expect(engine.isDrawing()).toBe(false);
  });
});

// ── Reset ─────────────────────────────────────────────

describe('PipelineEngine reset', () => {
  it('clears all state', () => {
    const bus = new EventBus();
    const engine = new PipelineEngine(bus);

    engine.penDown();
    feedStroke(engine, 5);
    engine.reset();

    expect(engine.isDrawing()).toBe(false);
    expect(engine.getActivePoints()).toHaveLength(0);
  });

  it('can draw new stroke after reset', () => {
    const bus = new EventBus();
    const engine = new PipelineEngine(bus);

    engine.penDown();
    feedStroke(engine, 5);
    engine.penUp();
    engine.reset();

    engine.penDown();
    feedStroke(engine, 4);
    const result = engine.penUp();

    expect(result).not.toBeNull();
    expect(result!.raw).toHaveLength(4);
  });
});

// ── Multiple strokes ──────────────────────────────────

describe('PipelineEngine multiple strokes', () => {
  it('handles sequential draw cycles', () => {
    const bus = new EventBus();
    const engine = new PipelineEngine(bus);
    const results: Array<{ raw: unknown[]; smoothed: unknown[] }> = [];

    for (let s = 0; s < 3; s++) {
      engine.penDown();
      feedStroke(engine, 5, 10, 16);
      const r = engine.penUp();
      if (r) results.push(r);
    }

    expect(results).toHaveLength(3);
  });
});
