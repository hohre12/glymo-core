import {
  easeOutElastic,
  resampleStroke,
  lerpStrokes,
  MorphAnimator,
} from '../src/animate/MorphAnimator.js';
import { EventBus } from '../src/state/EventBus.js';
import type { StrokePoint } from '../src/types.js';

// ── Helpers ─────────────────────────────────────────

function makePoint(x: number, y: number, pressure = 0.5): StrokePoint {
  return { x, y, t: 0, pressure };
}

function makeStroke(count: number, offset = 0): StrokePoint[] {
  return Array.from({ length: count }, (_, i) =>
    makePoint(i + offset, i + offset, 0.5),
  );
}

// ── easeOutElastic ──────────────────────────────────

describe('easeOutElastic', () => {
  it('returns 0 at t=0', () => {
    expect(easeOutElastic(0)).toBe(0);
  });

  it('returns 1 at t=1', () => {
    expect(easeOutElastic(1)).toBe(1);
  });

  it('overshoots at t=0.15 (first peak)', () => {
    const val = easeOutElastic(0.15);
    expect(val).toBeGreaterThan(1.0);
    expect(val).toBeCloseTo(1.354, 2);
  });

  it('undershoots at t=0.3 (first valley)', () => {
    const val = easeOutElastic(0.3);
    expect(val).toBeLessThan(1.0);
    expect(val).toBeCloseTo(0.875, 3);
  });

  it('nearly settled at t=0.7', () => {
    const val = easeOutElastic(0.7);
    expect(Math.abs(val - 1)).toBeLessThan(0.02);
  });

  it('is monotonically converging toward 1', () => {
    const v03 = Math.abs(easeOutElastic(0.3) - 1);
    const v05 = Math.abs(easeOutElastic(0.5) - 1);
    const v07 = Math.abs(easeOutElastic(0.7) - 1);
    expect(v05).toBeLessThan(v03);
    expect(v07).toBeLessThan(v05);
  });
});

// ── resampleStroke ──────────────────────────────────

describe('resampleStroke', () => {
  it('resamples to target count', () => {
    const stroke = makeStroke(5);
    const resampled = resampleStroke(stroke, 10);
    expect(resampled).toHaveLength(10);
  });

  it('preserves start and end points', () => {
    const stroke = makeStroke(5);
    const resampled = resampleStroke(stroke, 10);
    expect(resampled[0]!.x).toBe(stroke[0]!.x);
    expect(resampled[9]!.x).toBe(stroke[4]!.x);
  });

  it('returns copy for < 2 points', () => {
    const stroke = [makePoint(1, 2)];
    const resampled = resampleStroke(stroke, 5);
    expect(resampled).toHaveLength(1);
  });

  it('returns copy for targetCount < 2', () => {
    const stroke = makeStroke(5);
    const resampled = resampleStroke(stroke, 1);
    expect(resampled).toHaveLength(5);
  });
});

// ── lerpStrokes ─────────────────────────────────────

describe('lerpStrokes', () => {
  it('returns from points at t=0', () => {
    const from = [makePoint(0, 0), makePoint(1, 1)];
    const to = [makePoint(10, 10), makePoint(11, 11)];
    const result = lerpStrokes(from, to, 0);

    expect(result[0]!.x).toBe(0);
    expect(result[1]!.x).toBe(1);
  });

  it('returns to points at t=1', () => {
    const from = [makePoint(0, 0), makePoint(1, 1)];
    const to = [makePoint(10, 10), makePoint(11, 11)];
    const result = lerpStrokes(from, to, 1);

    expect(result[0]!.x).toBe(10);
    expect(result[1]!.x).toBe(11);
  });

  it('interpolates at t=0.5', () => {
    const from = [makePoint(0, 0)];
    const to = [makePoint(10, 20)];
    const result = lerpStrokes(from, to, 0.5);

    expect(result[0]!.x).toBe(5);
    expect(result[0]!.y).toBe(10);
  });
});

// ── MorphAnimator lifecycle ─────────────────────────

describe('MorphAnimator start', () => {
  it('emits morph:start on start()', () => {
    const bus = new EventBus();
    const events: string[] = [];
    bus.on('morph:start', () => events.push('start'));

    const animator = new MorphAnimator({
      raw: makeStroke(5),
      smoothed: makeStroke(8, 10),
      effect: 'neon',
      eventBus: bus,
    });

    animator.start();
    expect(events).toEqual(['start']);
    expect(animator.isActive()).toBe(true);
  });

  it('returns null from update when not started', () => {
    const animator = new MorphAnimator({
      raw: makeStroke(5),
      smoothed: makeStroke(8, 10),
      effect: 'neon',
      eventBus: new EventBus(),
    });

    expect(animator.update(16)).toBeNull();
  });
});

// ── MorphAnimator animation progress ────────────────

describe('MorphAnimator update', () => {
  it('returns interpolated points during animation', () => {
    const animator = new MorphAnimator({
      raw: makeStroke(5),
      smoothed: makeStroke(5, 10),
      effect: 'neon',
      eventBus: new EventBus(),
      duration: 100,
    });

    animator.start();
    const points = animator.update(50);
    expect(points).not.toBeNull();
    expect(points).toHaveLength(5);
  });

  it('progress increases with dt', () => {
    const animator = new MorphAnimator({
      raw: makeStroke(5),
      smoothed: makeStroke(5, 10),
      effect: 'neon',
      eventBus: new EventBus(),
      duration: 100,
    });

    animator.start();
    animator.update(25);
    expect(animator.getProgress()).toBeCloseTo(0.25);

    animator.update(25);
    expect(animator.getProgress()).toBeCloseTo(0.5);
  });

  it('clamps progress at 1.0', () => {
    const animator = new MorphAnimator({
      raw: makeStroke(5),
      smoothed: makeStroke(5, 10),
      effect: 'neon',
      eventBus: new EventBus(),
      duration: 100,
    });

    animator.start();
    animator.update(200); // exceed duration
    expect(animator.getProgress()).toBe(1);
  });
});

// ── MorphAnimator completion ────────────────────────

describe('MorphAnimator completion', () => {
  it('emits morph:complete when duration elapsed', () => {
    const bus = new EventBus();
    const events: string[] = [];
    bus.on('morph:complete', () => events.push('complete'));

    const animator = new MorphAnimator({
      raw: makeStroke(5),
      smoothed: makeStroke(5, 10),
      effect: 'neon',
      eventBus: bus,
      duration: 100,
    });

    animator.start();
    animator.update(100);
    expect(events).toEqual(['complete']);
    expect(animator.isActive()).toBe(false);
  });

  it('does not emit morph:complete before duration', () => {
    const bus = new EventBus();
    const events: string[] = [];
    bus.on('morph:complete', () => events.push('complete'));

    const animator = new MorphAnimator({
      raw: makeStroke(5),
      smoothed: makeStroke(5, 10),
      effect: 'neon',
      eventBus: bus,
      duration: 100,
    });

    animator.start();
    animator.update(50);
    expect(events).toHaveLength(0);
  });
});

// ── MorphAnimator cancel ────────────────────────────

describe('MorphAnimator cancel', () => {
  it('stops animation on cancel()', () => {
    const animator = new MorphAnimator({
      raw: makeStroke(5),
      smoothed: makeStroke(5, 10),
      effect: 'neon',
      eventBus: new EventBus(),
    });

    animator.start();
    animator.cancel();

    expect(animator.isActive()).toBe(false);
    expect(animator.update(16)).toBeNull();
  });
});

// ── MorphAnimator getSmoothedPoints ─────────────────

describe('MorphAnimator getSmoothedPoints', () => {
  it('returns the target smoothed points', () => {
    const smoothed = makeStroke(5, 10);
    const animator = new MorphAnimator({
      raw: makeStroke(5),
      smoothed,
      effect: 'neon',
      eventBus: new EventBus(),
    });

    const result = animator.getSmoothedPoints();
    expect(result).toBe(smoothed);
  });
});
