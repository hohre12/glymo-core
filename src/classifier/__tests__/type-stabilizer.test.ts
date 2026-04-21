import { describe, it, expect } from 'vitest';
import { TypeStabilizer } from '../type-stabilizer.js';

/**
 * Tests for the Phase 2 TYPE hysteresis layer.
 *
 * Timestamps are supplied explicitly so we never touch real clocks — the
 * stabilizer is a pure observer and vitest's fake timers would be overkill.
 * All scenarios mirror production traces captured during Phase 1 usage
 * (rapid flickers around the text↔drawing boundary on slow-drawn letters).
 */

describe('TypeStabilizer', () => {
  it('first observation sets stable type immediately (no warm-up)', () => {
    const s = new TypeStabilizer({ windowMs: 1500, minConsecutive: 2 });

    const result = s.observe('text', 0);

    expect(result).toEqual({ stableType: 'text', changed: true });
    expect(s.getStableType()).toBe('text');
  });

  it('reports changed=false while type stays identical', () => {
    const s = new TypeStabilizer({ windowMs: 1500, minConsecutive: 2 });

    s.observe('text', 0);
    const a = s.observe('text', 500);
    const b = s.observe('text', 1000);

    expect(a).toEqual({ stableType: 'text', changed: false });
    expect(b).toEqual({ stableType: 'text', changed: false });
  });

  it('isolated 200ms spike does NOT flip stable type', () => {
    // text stable → drawing for one sample (200ms) → text resumes.
    // Before Phase 2 this would fire a flip. After: stable stays 'text'.
    const s = new TypeStabilizer({ windowMs: 1500, minConsecutive: 2 });

    s.observe('text', 0);
    s.observe('text', 500);
    const spike = s.observe('drawing', 700); // 200ms after previous 'text'
    const recover = s.observe('text', 1200);

    expect(spike).toEqual({ stableType: 'text', changed: false });
    expect(recover).toEqual({ stableType: 'text', changed: false });
    expect(s.getStableType()).toBe('text');
  });

  it('sustained flip (drawing held 1600ms) DOES flip after the window', () => {
    // text stable, then drawing held continuously beyond 1500ms.
    const s = new TypeStabilizer({ windowMs: 1500, minConsecutive: 2 });

    s.observe('text', 0);
    s.observe('text', 500);

    // Start the drawing streak at t=1000, keep feeding until elapsed >=1500.
    const r1 = s.observe('drawing', 1000); // streak start — too fresh
    const r2 = s.observe('drawing', 1800); // 800ms into streak — still too fresh
    const r3 = s.observe('drawing', 2500); // 1500ms into streak — confirmed

    expect(r1.changed).toBe(false);
    expect(r1.stableType).toBe('text');
    expect(r2.changed).toBe(false);
    expect(r2.stableType).toBe('text');
    expect(r3).toEqual({ stableType: 'drawing', changed: true });
  });

  it('a single sample of new type cannot flip even past the time window', () => {
    // minConsecutive=2 guards against the degenerate case where one very
    // late sample crosses windowMs by itself.
    const s = new TypeStabilizer({ windowMs: 1500, minConsecutive: 2 });

    s.observe('text', 0);
    const lone = s.observe('drawing', 2000); // 2000ms > 1500ms but streak=1

    expect(lone.changed).toBe(false);
    expect(lone.stableType).toBe('text');
  });

  it('flip is reported exactly once, then subsequent same-type reports changed=false', () => {
    const s = new TypeStabilizer({ windowMs: 1500, minConsecutive: 2 });

    s.observe('text', 0);
    s.observe('drawing', 1000);
    const flipTick = s.observe('drawing', 2500);
    const afterFlip = s.observe('drawing', 3000);

    expect(flipTick.changed).toBe(true);
    expect(afterFlip).toEqual({ stableType: 'drawing', changed: false });
  });

  it('reset() clears history and stable type', () => {
    const s = new TypeStabilizer({ windowMs: 1500, minConsecutive: 2 });

    s.observe('text', 0);
    s.observe('text', 500);
    expect(s.getStableType()).toBe('text');

    s.reset();
    expect(s.getStableType()).toBeNull();

    // Post-reset, the first observation should snap again (changed=true).
    const fresh = s.observe('drawing', 1000);
    expect(fresh).toEqual({ stableType: 'drawing', changed: true });
  });

  it('interleaved flickers never confirm a flip', () => {
    // text, drawing, text, drawing, text — no streak ever reaches minConsecutive.
    const s = new TypeStabilizer({ windowMs: 1500, minConsecutive: 2 });

    s.observe('text', 0);
    const a = s.observe('drawing', 500);
    const b = s.observe('text', 1000);
    const c = s.observe('drawing', 1500);
    const d = s.observe('text', 2000);
    const e = s.observe('drawing', 2500);

    for (const r of [a, b, c, d, e]) {
      expect(r.changed).toBe(false);
    }
    expect(s.getStableType()).toBe('text');
  });
});
