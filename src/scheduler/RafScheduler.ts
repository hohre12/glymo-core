// Single render-clock scheduler — the master `requestAnimationFrame` consumer
// for `@glymo/core`, introduced in Phase 1 of the rendering-pipeline-v2
// refactor. Every subsystem that used to own its own `requestAnimationFrame`
// loop subscribes here instead, so the browser sees exactly one rAF user per
// `Glymo` instance instead of the eight measured on `main` (docs/plans/
// rendering-pipeline-v2.md §1 defect #1, §2 baseline 520 RAF/s in the
// hologram scenario on M4 Pro + 361 RAF/s on M1 Pro).
//
// Design principles (§4.1):
//
//   1. ONE `requestAnimationFrame` per frame, regardless of subscriber count.
//   2. Phased lifecycle so the engine expresses *when* each operation
//      happens instead of racing. Phases execute in a fixed order per frame:
//
//        beforeUpdate → update → afterUpdate → beforeRender → render → afterRender
//
//      Subsystems pick the phase that matches their semantics (input
//      dispatch before `update`, rendering in `render`, GIF capture after
//      `afterRender`, etc). Cross-phase invariants become trivially
//      enforceable — `update` always completes before `render` runs.
//
//   3. Subscription is cheap and symmetric. `subscribe(phase, fn)` returns
//      an idempotent teardown fn; callers hold it for the lifetime of the
//      subscription and call it on dispose.
//
//   4. The scheduler does NOT force subscribers to think about frame
//      identity. The callback receives `(timestamp, deltaMs)` — the first
//      frame's delta is 0, subsequent deltas are positive and monotonic.
//
//   5. Error isolation is absolute. A throw in one subscriber is logged to
//      `console.error` and MUST NOT affect sibling subscribers at the same
//      phase, later phases on the same frame, or future frames. This is
//      what lets `Glymo` continue animating even when a single hook
//      misbehaves.
//
//   6. Mutation during iteration is safe. A subscriber that unsubscribes
//      itself (or a sibling) mid-frame does NOT corrupt the iterator — each
//      phase snapshots its subscriber set at entry. New subscribers added
//      during the current frame take effect on the NEXT frame. This makes
//      teardown inside a callback (e.g. a one-shot effect) natural to write.
//
// Lifecycle:
//
//   const s = new RafScheduler();
//   const off = s.subscribe('update', (ts, delta) => engine.tick(delta));
//   s.start();          // begin dispatching frames
//   s.setActive(false); // pause (keeps subscriptions alive)
//   s.setActive(true);  // resume
//   s.stop();           // cancel the rAF chain (subscriptions survive)
//   off();              // teardown — idempotent
//
// Integration (Phase 1c–1g):
//
//   `Glymo.ts` owns a single `RafScheduler` and exposes `getScheduler()`.
//   `CanvasRenderer`, `WebGPURenderer`, `CameraCapture`, `FontMorphAnimator`,
//   and `GIFExporter` all take it via constructor injection and subscribe
//   instead of calling `requestAnimationFrame` directly. `@glymo/ui` will
//   consume `glymo.getScheduler()` in Phase 5 to migrate its own 12 rAF
//   callsites.

/** Phase identifiers in the order they execute each frame. Subscribers
 *  pick the phase whose semantics match their work. */
export type SchedulerPhase =
  | 'beforeUpdate'
  | 'update'
  | 'afterUpdate'
  | 'beforeRender'
  | 'render'
  | 'afterRender';

/** The order in which phases execute per frame. Exported as a const tuple
 *  so tests and documentation can assert against a single source of truth. */
export const SCHEDULER_PHASE_ORDER = [
  'beforeUpdate',
  'update',
  'afterUpdate',
  'beforeRender',
  'render',
  'afterRender',
] as const satisfies readonly SchedulerPhase[];

/** Invoked on each frame the scheduler is `start`ed AND `setActive(true)`.
 *  `timestamp` is the rAF high-resolution timestamp (ms since page origin).
 *  `deltaMs` is `timestamp - previousFrameTimestamp`; on the first frame
 *  after `start()` it is 0. */
export type SchedulerCallback = (timestamp: number, deltaMs: number) => void;

/** Idempotent teardown returned from `subscribe`. Calling it a second time
 *  is a no-op. */
export type SchedulerUnsubscribe = () => void;

export class RafScheduler {
  private readonly subscribers: Map<SchedulerPhase, Set<SchedulerCallback>>;
  private rafId: number | null = null;
  private active = true;
  private running = false;
  private lastTimestamp: number | null = null;

  constructor() {
    this.subscribers = new Map();
    for (const phase of SCHEDULER_PHASE_ORDER) {
      this.subscribers.set(phase, new Set());
    }
  }

  /** Register `fn` on `phase`. Returns an idempotent unsubscribe. */
  subscribe(phase: SchedulerPhase, fn: SchedulerCallback): SchedulerUnsubscribe {
    const set = this.getPhase(phase);
    set.add(fn);
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      set.delete(fn);
    };
  }

  /** Total subscriber count across all phases. Used by leak-detection tests. */
  get subscriberCount(): number {
    let total = 0;
    for (const set of this.subscribers.values()) total += set.size;
    return total;
  }

  /** Whether the rAF chain is currently armed. Independent of `setActive`. */
  get isRunning(): boolean {
    return this.running;
  }

  /** Begin dispatching frames. Idempotent. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = null;
    this.queueNext();
  }

  /** Stop dispatching frames. Subscriptions are preserved so a subsequent
   *  `start()` resumes firing with the same callback set. Idempotent. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
  }

  /** Pause callback firing without clearing subscriptions. The rAF chain
   *  keeps ticking so `setActive(true)` resumes instantly. Use for
   *  page-hidden / tab-inactive states where subscriber cost should drop
   *  to zero. */
  setActive(active: boolean): void {
    this.active = active;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private getPhase(phase: SchedulerPhase): Set<SchedulerCallback> {
    const set = this.subscribers.get(phase);
    if (!set) {
      // SCHEDULER_PHASE_ORDER is exhaustive over the type, so a missing
      // entry can only arise from external mutation of `this.subscribers`,
      // which is `private readonly`. Guard anyway so TypeScript's Map.get
      // undefined return is handled.
      throw new Error(`RafScheduler: unknown phase "${phase}"`);
    }
    return set;
  }

  private queueNext(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    this.rafId = requestAnimationFrame((ts) => this.tick(ts));
  }

  private tick(timestamp: number): void {
    if (!this.running) return;
    const delta = this.lastTimestamp === null ? 0 : timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    if (this.active) {
      for (const phase of SCHEDULER_PHASE_ORDER) {
        this.dispatchPhase(phase, timestamp, delta);
      }
    }
    this.queueNext();
  }

  private dispatchPhase(phase: SchedulerPhase, timestamp: number, delta: number): void {
    // Snapshot so unsubscribe-during-iteration is safe: a removed
    // subscriber still fires for this frame, and new subscribers are
    // picked up on the next frame.
    const snapshot = Array.from(this.getPhase(phase));
    for (const cb of snapshot) {
      try {
        cb(timestamp, delta);
      } catch (err) {
        // Errors are scoped to their subscriber. Log so debugging is
        // discoverable without crashing the render loop.
        // eslint-disable-next-line no-console
        console.error(
          `[RafScheduler] subscriber at phase "${phase}" threw — continuing:`,
          err,
        );
      }
    }
  }
}
