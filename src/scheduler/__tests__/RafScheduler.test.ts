// Vitest suite for the single render-clock scheduler introduced in Phase 1
// of the rendering-pipeline-v2 refactor (docs/plans/rendering-pipeline-v2.md
// §4.1 + §6 Phase 1 TDD plan).
//
// Invariants under test (each one corresponds to a published guarantee of
// the scheduler's public API — any break is a breaking change and requires
// the `@glymo/core` minor → major escalation):
//
//   Subscription:
//     1. subscriberCount starts at 0, increments per subscribe, decrements
//        per unsubscribe.
//     2. Unsubscribe is idempotent (calling twice is a no-op).
//     3. Subscribe-during-callback does NOT fire the new subscriber on the
//        current frame — iteration uses a per-phase snapshot.
//     4. Unsubscribe-during-callback is safe — the removed subscriber still
//        fires on the current frame (snapshot semantics) but is gone on the
//        next frame.
//
//   Lifecycle:
//     5. start() sets isRunning=true; stop() sets isRunning=false.
//     6. start() / stop() are idempotent.
//     7. Callbacks do not fire while isRunning=false.
//     8. setActive(false) pauses callback firing WITHOUT clearing
//        subscriptions; setActive(true) resumes.
//
//   Phase order (§4.1):
//     9. On each frame phases execute in the published order:
//        beforeUpdate → update → afterUpdate → beforeRender → render →
//        afterRender.
//    10. Multiple subscribers at the same phase fire in insertion order.
//
//   Error isolation:
//    11. An exception thrown by one subscriber does NOT prevent sibling
//        subscribers at the same phase from firing.
//    12. An exception in one phase does NOT prevent later phases from
//        firing on the same frame.
//
//   Timing:
//    13. The timestamp passed to subscribers is the rAF timestamp.
//    14. deltaMs on the first frame is 0; deltaMs on subsequent frames is
//        the positive difference from the previous frame's timestamp.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RafScheduler, type SchedulerCallback, type SchedulerPhase, SCHEDULER_PHASE_ORDER } from '../RafScheduler';

/** Drive N frames under fake timers. The vitest.setup.ts rAF polyfill
 *  implements `requestAnimationFrame(cb) = setTimeout(cb, 16)`, so
 *  advancing 16ms per frame exactly fires the queued tick. */
function advanceFrames(n: number): void {
  for (let i = 0; i < n; i++) {
    vi.advanceTimersByTime(16);
  }
}

describe('RafScheduler — subscription lifecycle', () => {
  let scheduler: RafScheduler;

  beforeEach(() => {
    scheduler = new RafScheduler();
  });

  it('subscriberCount starts at zero', () => {
    expect(scheduler.subscriberCount).toBe(0);
  });

  it('subscribe increments subscriberCount; unsubscribe decrements', () => {
    const off = scheduler.subscribe('update', () => {});
    expect(scheduler.subscriberCount).toBe(1);
    off();
    expect(scheduler.subscriberCount).toBe(0);
  });

  it('unsubscribe is idempotent', () => {
    const off = scheduler.subscribe('update', () => {});
    off();
    expect(() => off()).not.toThrow();
    expect(scheduler.subscriberCount).toBe(0);
  });

  it('multiple subscribes stack without collapsing', () => {
    scheduler.subscribe('update', () => {});
    scheduler.subscribe('update', () => {});
    scheduler.subscribe('render', () => {});
    expect(scheduler.subscriberCount).toBe(3);
  });
});

describe('RafScheduler — start / stop / active', () => {
  let scheduler: RafScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new RafScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('isRunning reflects start/stop state', () => {
    expect(scheduler.isRunning).toBe(false);
    scheduler.start();
    expect(scheduler.isRunning).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning).toBe(false);
  });

  it('start is idempotent', () => {
    scheduler.start();
    scheduler.start();
    expect(scheduler.isRunning).toBe(true);
    // A single tick should still fire a given subscriber exactly once.
    const fn = vi.fn<SchedulerCallback>();
    scheduler.subscribe('update', fn);
    advanceFrames(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stop is idempotent', () => {
    scheduler.start();
    scheduler.stop();
    expect(() => scheduler.stop()).not.toThrow();
    expect(scheduler.isRunning).toBe(false);
  });

  it('does not fire callbacks before start', () => {
    const fn = vi.fn<SchedulerCallback>();
    scheduler.subscribe('update', fn);
    advanceFrames(3);
    expect(fn).not.toHaveBeenCalled();
  });

  it('fires callbacks every frame once running', () => {
    const fn = vi.fn<SchedulerCallback>();
    scheduler.subscribe('update', fn);
    scheduler.start();
    advanceFrames(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops firing after stop()', () => {
    const fn = vi.fn<SchedulerCallback>();
    scheduler.subscribe('update', fn);
    scheduler.start();
    advanceFrames(2);
    expect(fn).toHaveBeenCalledTimes(2);
    scheduler.stop();
    advanceFrames(5);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('setActive(false) pauses firing without dropping subscriptions', () => {
    const fn = vi.fn<SchedulerCallback>();
    scheduler.subscribe('update', fn);
    scheduler.start();
    advanceFrames(1);
    expect(fn).toHaveBeenCalledTimes(1);
    scheduler.setActive(false);
    advanceFrames(5);
    expect(fn).toHaveBeenCalledTimes(1); // no new calls while paused
    expect(scheduler.subscriberCount).toBe(1); // still subscribed
  });

  it('setActive(true) resumes firing', () => {
    const fn = vi.fn<SchedulerCallback>();
    scheduler.subscribe('update', fn);
    scheduler.start();
    scheduler.setActive(false);
    advanceFrames(3);
    expect(fn).not.toHaveBeenCalled();
    scheduler.setActive(true);
    advanceFrames(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('RafScheduler — phase order (§4.1)', () => {
  let scheduler: RafScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new RafScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('exposes SCHEDULER_PHASE_ORDER matching the §4.1 spec', () => {
    expect(SCHEDULER_PHASE_ORDER).toEqual([
      'beforeUpdate',
      'update',
      'afterUpdate',
      'beforeRender',
      'render',
      'afterRender',
    ]);
  });

  it('fires phases in the published order on each frame', () => {
    const trace: SchedulerPhase[] = [];
    for (const p of SCHEDULER_PHASE_ORDER) {
      scheduler.subscribe(p, () => trace.push(p));
    }
    scheduler.start();
    advanceFrames(1);
    expect(trace).toEqual([...SCHEDULER_PHASE_ORDER]);
  });

  it('preserves insertion order for sibling subscribers at the same phase', () => {
    const trace: string[] = [];
    scheduler.subscribe('update', () => trace.push('A'));
    scheduler.subscribe('update', () => trace.push('B'));
    scheduler.subscribe('update', () => trace.push('C'));
    scheduler.start();
    advanceFrames(1);
    expect(trace).toEqual(['A', 'B', 'C']);
  });
});

describe('RafScheduler — error isolation', () => {
  let scheduler: RafScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    // Silence the in-test console.error — the scheduler deliberately logs
    // swallowed exceptions, and a spammy test log hides signal from real
    // failures.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    scheduler = new RafScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not halt sibling subscribers at the same phase when one throws', () => {
    const a = vi.fn<SchedulerCallback>();
    const b = vi.fn<SchedulerCallback>(() => {
      throw new Error('boom');
    });
    const c = vi.fn<SchedulerCallback>();
    scheduler.subscribe('update', a);
    scheduler.subscribe('update', b);
    scheduler.subscribe('update', c);
    scheduler.start();
    advanceFrames(1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
  });

  it('does not halt later phases when an earlier phase throws', () => {
    const trace: string[] = [];
    scheduler.subscribe('beforeUpdate', () => {
      trace.push('before');
      throw new Error('boom');
    });
    scheduler.subscribe('update', () => trace.push('update'));
    scheduler.subscribe('afterRender', () => trace.push('afterRender'));
    scheduler.start();
    advanceFrames(1);
    expect(trace).toEqual(['before', 'update', 'afterRender']);
  });
});

describe('RafScheduler — mutation during callback', () => {
  let scheduler: RafScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new RafScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('subscribe during callback does not fire new subscriber on current frame', () => {
    const late = vi.fn<SchedulerCallback>();
    scheduler.subscribe('beforeUpdate', () => {
      scheduler.subscribe('beforeUpdate', late);
    });
    scheduler.start();
    advanceFrames(1);
    expect(late).not.toHaveBeenCalled();
    advanceFrames(1);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe during callback is safe; removed subscriber still fires on current frame', () => {
    const fn = vi.fn<SchedulerCallback>();
    let off = () => {};
    scheduler.subscribe('beforeUpdate', () => off());
    off = scheduler.subscribe('beforeUpdate', fn);
    scheduler.start();
    advanceFrames(1);
    // Snapshot semantics: fn was present when the phase started, so it
    // fires this frame, then is gone from the next.
    expect(fn).toHaveBeenCalledTimes(1);
    advanceFrames(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('RafScheduler — timing contract', () => {
  let scheduler: RafScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new RafScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('deltaMs is 0 on the first frame and positive on subsequent frames', () => {
    const deltas: number[] = [];
    scheduler.subscribe('update', (_ts, delta) => deltas.push(delta));
    scheduler.start();
    advanceFrames(3);
    expect(deltas).toHaveLength(3);
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeGreaterThan(0);
    expect(deltas[2]).toBeGreaterThan(0);
  });

  it('timestamp is monotonically non-decreasing across frames', () => {
    const stamps: number[] = [];
    scheduler.subscribe('update', (ts) => stamps.push(ts));
    scheduler.start();
    advanceFrames(4);
    for (let i = 1; i < stamps.length; i++) {
      const curr = stamps[i];
      const prev = stamps[i - 1];
      expect(curr).toBeDefined();
      expect(prev).toBeDefined();
      expect(curr!).toBeGreaterThanOrEqual(prev!);
    }
  });
});
