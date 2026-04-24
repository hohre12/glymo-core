// Feature-detected bridge over `Scheduler.postTask` — the browser-native
// priority-aware microtask scheduler shipped in Chromium 115+ and used by
// the Phase 1 `RafScheduler` integration to yield back to the main thread
// for lower-priority work (texture decoding, classifier inference queue
// drain, GIF frame encoding) without starving higher-priority render work.
//
// Browser support at plan inception (docs/plans/rendering-pipeline-v2.md §11):
//   - Chromium 115+ (Chrome / Edge):        native `scheduler.postTask`
//   - Safari 26:                             fallback (setTimeout)
//   - Firefox 130 (scheduler.yield, 2025-08): fallback (setTimeout) — Firefox
//                                             does not yet ship postTask.
//
// The fallback uses `setTimeout(fn, 0)` at the user-blocking priority and a
// small increasing delay at lower priorities. This is NOT a perfect
// emulation of postTask's priority semantics (the browser's task queue
// ordering is opaque) — but it guarantees background tasks cannot
// indefinitely starve user-blocking ones in the usual single-main-thread
// case.
//
// The bridge is intentionally a thin class: constructor-free bound-method
// usage is fine for consumers, and exposing it as a class lets callers
// inject a test double via DI without relying on module-scope state.

/** Priority tokens mirror the W3C Scheduler spec enum. */
export type PostTaskPriority = 'user-blocking' | 'user-visible' | 'background';

export interface PostTaskOptions {
  readonly priority: PostTaskPriority;
  readonly signal?: AbortSignal;
}

/** Narrow structural shape of the DOM `Scheduler` global we rely on. Typed
 *  locally so the file compiles under lib: ["ES2022"] without DOM. */
interface SchedulerLike {
  postTask<T>(
    fn: () => T | Promise<T>,
    options: { priority: PostTaskPriority; signal?: AbortSignal },
  ): Promise<T>;
}

function getNativeScheduler(): SchedulerLike | null {
  const g = globalThis as unknown as { scheduler?: unknown };
  const s = g.scheduler as Partial<SchedulerLike> | undefined;
  if (!s) return null;
  if (typeof s.postTask !== 'function') return null;
  return s as SchedulerLike;
}

/** Pure feature-detect. Safe to call on any runtime. */
export function isPostTaskSupported(): boolean {
  return getNativeScheduler() !== null;
}

/** Fallback delay curve. Native postTask decides ordering internally; the
 *  fallback has to express priority through setTimeout delay. Values were
 *  picked so `user-blocking` fires in the same macrotask drain as a bare
 *  `setTimeout(fn, 0)`, while `background` waits long enough that any
 *  `user-blocking` task scheduled at the same wall-clock wins the race. */
const FALLBACK_DELAY_MS: Record<PostTaskPriority, number> = {
  'user-blocking': 0,
  'user-visible': 4,
  background: 16,
};

export class PostTaskBridge {
  /** Queue `fn` with the given priority. Returns a promise that resolves
   *  with the fn's (awaited) return value. On browsers with native
   *  `scheduler.postTask`, delegates directly. Otherwise falls back to
   *  a priority-aware setTimeout. */
  postTask<T>(fn: () => T | Promise<T>, options: PostTaskOptions): Promise<T> {
    const native = getNativeScheduler();
    if (native) {
      return native.postTask(fn, {
        priority: options.priority,
        signal: options.signal,
      });
    }
    return this.fallbackPostTask(fn, options);
  }

  private fallbackPostTask<T>(
    fn: () => T | Promise<T>,
    options: PostTaskOptions,
  ): Promise<T> {
    const { signal, priority } = options;
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError(signal));
        return;
      }

      const delay = FALLBACK_DELAY_MS[priority];
      const timer = setTimeout(() => {
        if (signal) signal.removeEventListener('abort', onAbort);
        if (signal?.aborted) {
          reject(abortError(signal));
          return;
        }
        try {
          Promise.resolve(fn()).then(resolve, reject);
        } catch (err) {
          reject(err);
        }
      }, delay);

      const onAbort = () => {
        clearTimeout(timer);
        reject(abortError(signal!));
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

function abortError(signal: AbortSignal): Error {
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (reason instanceof Error) return reason;
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The task was aborted.', 'AbortError');
  }
  const err = new Error('The task was aborted.');
  err.name = 'AbortError';
  return err;
}
