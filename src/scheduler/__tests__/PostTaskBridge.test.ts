// Vitest suite for `PostTaskBridge` — the feature-detected bridge over
// `Scheduler.postTask` (Chrome 115+) with a `setTimeout` fallback on
// browsers that don't ship it yet (Safari 26 and Firefox 130 at plan
// inception — see docs/plans/rendering-pipeline-v2.md §11).
//
// Contract under test:
//
//   1. `isPostTaskSupported()` truthfully reports whether `scheduler.postTask`
//      is available in the current global. No side effects, safe under SSR.
//
//   2. `postTask(fn, { priority })` resolves with the fn's return value
//      regardless of which code path was used.
//
//   3. When postTask is supported, the bridge calls
//      `scheduler.postTask(fn, { priority })` directly with the given
//      priority mapped to the spec enum ('user-blocking' | 'user-visible'
//      | 'background').
//
//   4. When postTask is NOT supported, the bridge falls back to
//      `setTimeout(fn, 0)` and schedules at "user-blocking" promptness;
//      lower priorities queue with a larger delay so background work does
//      not starve the main thread.
//
//   5. Async fn return values are unwrapped (awaited) so callers don't
//      deal with nested promises.
//
//   6. Errors thrown by the fn reject the returned promise rather than
//      being swallowed.
//
//   7. AbortSignal: when supported, the bridge forwards the signal to
//      `scheduler.postTask`'s signal option so aborts propagate natively.
//      On the fallback path, an aborted signal rejects the returned
//      promise without invoking the fn (or if already queued, cancels the
//      setTimeout).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PostTaskBridge,
  isPostTaskSupported,
  type PostTaskPriority,
} from '../PostTaskBridge';

type PostTaskOptions = {
  priority: PostTaskPriority;
  signal?: AbortSignal;
};

/** Capture the global `scheduler` reference the bridge inspects. */
type GlobalWithScheduler = typeof globalThis & {
  scheduler?: {
    postTask: <T>(fn: () => T | Promise<T>, options: PostTaskOptions) => Promise<T>;
  };
};

function installFakeScheduler(
  spy: (fn: () => unknown, options: PostTaskOptions) => unknown,
): () => void {
  const g = globalThis as GlobalWithScheduler;
  const previous = g.scheduler;
  g.scheduler = {
    postTask: spy as NonNullable<GlobalWithScheduler['scheduler']>['postTask'],
  };
  return () => {
    if (previous === undefined) {
      delete g.scheduler;
    } else {
      g.scheduler = previous;
    }
  };
}

function uninstallScheduler(): () => void {
  const g = globalThis as GlobalWithScheduler;
  const previous = g.scheduler;
  delete g.scheduler;
  return () => {
    if (previous !== undefined) g.scheduler = previous;
  };
}

describe('isPostTaskSupported', () => {
  let restore: () => void = () => {};
  afterEach(() => restore());

  it('returns false when `scheduler` is absent on the global', () => {
    restore = uninstallScheduler();
    expect(isPostTaskSupported()).toBe(false);
  });

  it('returns false when `scheduler` is present but `postTask` is not a function', () => {
    restore = installFakeScheduler(() => {});
    (globalThis as GlobalWithScheduler).scheduler = {
      // @ts-expect-error — intentionally wrong shape
      postTask: 'not-a-function',
    };
    expect(isPostTaskSupported()).toBe(false);
  });

  it('returns true when `scheduler.postTask` is callable', () => {
    restore = installFakeScheduler(() => {});
    expect(isPostTaskSupported()).toBe(true);
  });
});

describe('PostTaskBridge — native path', () => {
  let restore: () => void = () => {};
  afterEach(() => restore());

  it('delegates to `scheduler.postTask` with the provided priority', async () => {
    const seen: Array<[unknown, PostTaskOptions]> = [];
    const native = vi.fn(async (fn: () => unknown, options: PostTaskOptions) => {
      seen.push([fn, options]);
      return fn();
    });
    restore = installFakeScheduler(native as never);
    const bridge = new PostTaskBridge();
    const result = await bridge.postTask(() => 42, { priority: 'user-blocking' });
    expect(result).toBe(42);
    expect(native).toHaveBeenCalledTimes(1);
    const first = seen[0];
    expect(first).toBeDefined();
    expect(first![1].priority).toBe('user-blocking');
  });

  it('forwards AbortSignal on the native path', async () => {
    const seen: Array<[unknown, PostTaskOptions]> = [];
    const native = vi.fn(async (fn: () => unknown, options: PostTaskOptions) => {
      seen.push([fn, options]);
      if (options.signal?.aborted) {
        throw new DOMException('aborted', 'AbortError');
      }
      return fn();
    });
    restore = installFakeScheduler(native as never);
    const bridge = new PostTaskBridge();
    const controller = new AbortController();
    controller.abort();
    const promise = bridge.postTask(() => 'never', {
      priority: 'background',
      signal: controller.signal,
    });
    // Attach the matcher's handler up front so the native scheduler's
    // synchronous rejection doesn't surface as unhandled.
    promise.catch(() => {});
    await expect(promise).rejects.toThrow(/abort/i);
    const first = seen[0];
    expect(first).toBeDefined();
    expect(first![1].signal).toBe(controller.signal);
  });

  it('unwraps async fn return values', async () => {
    restore = installFakeScheduler(
      (async (fn: () => unknown) => fn()) as never,
    );
    const bridge = new PostTaskBridge();
    const result = await bridge.postTask(async () => 'hello', {
      priority: 'user-visible',
    });
    expect(result).toBe('hello');
  });

  it('rejects when fn throws', async () => {
    restore = installFakeScheduler(
      (async (fn: () => unknown) => fn()) as never,
    );
    const bridge = new PostTaskBridge();
    await expect(
      bridge.postTask(
        () => {
          throw new Error('fn boom');
        },
        { priority: 'user-blocking' },
      ),
    ).rejects.toThrow('fn boom');
  });
});

describe('PostTaskBridge — setTimeout fallback', () => {
  let restore: () => void = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
    restore = uninstallScheduler();
  });

  afterEach(() => {
    restore();
    vi.useRealTimers();
  });

  it('queues the fn via setTimeout and resolves with its return value', async () => {
    const bridge = new PostTaskBridge();
    const promise = bridge.postTask(() => 'fallback', {
      priority: 'user-blocking',
    });
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('fallback');
  });

  it('applies a larger delay for lower priorities (background does not starve user-blocking)', async () => {
    const bridge = new PostTaskBridge();
    const order: string[] = [];
    const p1 = bridge.postTask(() => order.push('background'), {
      priority: 'background',
    });
    const p2 = bridge.postTask(() => order.push('user-blocking'), {
      priority: 'user-blocking',
    });
    // user-blocking completes first because its queued delay is smaller.
    await vi.advanceTimersByTimeAsync(10);
    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);
    expect(order[0]).toBe('user-blocking');
    expect(order).toContain('background');
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const bridge = new PostTaskBridge();
    const controller = new AbortController();
    controller.abort();
    const ran = vi.fn();
    const promise = bridge.postTask(
      () => {
        ran();
        return 1;
      },
      { priority: 'user-blocking', signal: controller.signal },
    );
    // Attach a no-op catch handler up front so the synchronous rejection
    // inside the bridge does NOT surface as an "unhandled rejection" before
    // the assertion's `.rejects` matcher finishes chaining.
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(50);
    await expect(promise).rejects.toThrow(/abort/i);
    expect(ran).not.toHaveBeenCalled();
  });

  it('rejects when the signal aborts after scheduling but before the task runs', async () => {
    const bridge = new PostTaskBridge();
    const controller = new AbortController();
    const ran = vi.fn();
    const promise = bridge.postTask(
      () => {
        ran();
        return 1;
      },
      { priority: 'background', signal: controller.signal },
    );
    // Same reasoning as above — attach the handler BEFORE the abort so the
    // rejection is considered handled the moment it fires.
    promise.catch(() => {});
    controller.abort();
    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).rejects.toThrow(/abort/i);
    expect(ran).not.toHaveBeenCalled();
  });
});
