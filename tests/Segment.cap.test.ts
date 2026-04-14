// ── SegmentStage MAX_POINTS cap ─────────────────────────────────────
//
// Guards against runaway memory when pen input never releases (stuck
// pointer, fuzz input). Verifies that:
//   1. The in-memory buffer never exceeds MAX_POINTS.
//   2. A single console.warn fires per stroke regardless of how many
//      points overflow.
//   3. Dropped-count accounting matches the overflow.
//
// See CLAUDE.md / SegmentStage.ts for the chosen MAX_POINTS value and its
// reasoning (~167 s at 60 Hz — longer than any realistic single stroke).

import { MAX_POINTS, SegmentStage } from '../src/pipeline/stages/SegmentStage.js';
import type { StrokePoint } from '../src/types.js';

function makePoint(x: number, y: number, t: number, pressure = 0.5): StrokePoint {
  return { x, y, t, pressure };
}

describe('SegmentStage MAX_POINTS cap', () => {
  let stage: SegmentStage;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stage = new SegmentStage();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* swallow */ });
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('caps buffer at MAX_POINTS when fed 20000 points', () => {
    const N = 20000;
    expect(N).toBeGreaterThan(MAX_POINTS); // sanity: test must actually overflow

    stage.penDown();
    for (let i = 0; i < N; i++) {
      stage.process(makePoint(i, i, i));
      // Never exceed the cap at any point during accumulation.
      expect(stage.getCurrentPoints().length).toBeLessThanOrEqual(MAX_POINTS);
    }

    // Final buffer sits exactly at the cap.
    expect(stage.getCurrentPoints().length).toBe(MAX_POINTS);

    // Exactly one warn for the whole stroke.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0]![0] as string;
    expect(msg).toContain('MAX_POINTS');
    expect(msg).toContain(String(MAX_POINTS));

    // Dropped count == overflow.
    expect(stage.getDroppedCount()).toBe(N - MAX_POINTS);

    // penUp still returns the capped buffer as a valid stroke.
    const finalized = stage.penUp();
    expect(finalized).not.toBeNull();
    expect(finalized!.length).toBe(MAX_POINTS);
  });

  it('does not warn when buffer stays below MAX_POINTS', () => {
    stage.penDown();
    for (let i = 0; i < 100; i++) {
      stage.process(makePoint(i, i, i));
    }
    stage.penUp();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(stage.getDroppedCount()).toBe(0);
  });

  it('resets dropped-count and warn-state between strokes', () => {
    // Stroke 1: overflow.
    stage.penDown();
    for (let i = 0; i < MAX_POINTS + 50; i++) {
      stage.process(makePoint(i, i, i));
    }
    stage.penUp();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Stroke 2: overflow again — must produce a fresh warn.
    stage.penDown();
    expect(stage.getDroppedCount()).toBe(0); // reset on penDown
    for (let i = 0; i < MAX_POINTS + 10; i++) {
      stage.process(makePoint(i, i, i));
    }
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(stage.getDroppedCount()).toBe(10);
    stage.penUp();
  });
});
