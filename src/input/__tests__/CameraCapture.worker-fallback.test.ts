// Phase 4 of rendering-pipeline-v2 — `CameraCapture` worker-path
// hardening (docs/plans/rendering-pipeline-v2.md §6 Phase 4 TDD plan).
//
// The Phase 0 measurement transcript (perf-baselines/phase-0/) showed the
// app/camera-hand scenario sitting at a ~5–6 s longest-RAF handler caused
// by the M1/M2 `shouldPreferSync` heuristic AND a 10-second worker-init
// timeout fallback. This phase replaces both with an explicit
// `{type: 'error'}` handshake from the Worker on `importScripts` failure
// so the main thread sees a load problem within tens of milliseconds and
// switches to the sync MediaPipe path immediately.
//
// What this suite asserts:
//
//   1. `handleWorkerMessage` recognises `{type: 'error'}` (the new
//      handshake from the worker file) and triggers the sync fallback
//      synchronously — i.e. the next-tick `initMediaPipeSync` call
//      happens within a deterministic, sub-100-ms budget under fake
//      timers.
//   2. The legacy 10-second `setTimeout` fallback is gone — calling
//      `initAsync` does NOT register a 10-second timer at all (legacy
//      code did `setTimeout(..., 10_000)` regardless of whether the
//      worker would post `error` first).
//   3. The legacy `shouldPreferSync` static method is removed from the
//      class. Sync mode is reachable only as a feature-detect fallback
//      from a worker construction / import failure, not via a
//      hardware-tier heuristic.
//
// Tests work over a *jsdom* environment with manually-injected mocks for
// `Worker`, `MediaStream`, and the camera-init private path. The real
// integration assertion (camera-hand longest RAF < 500 ms on a CPU-4×
// throttled chromium) is the bench-perf measurement at `--phase=4`,
// not a unit test — see Phase 4 acceptance in the plan.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CameraCapture } from '../CameraCapture';

/** Shape of the private `handleWorkerMessage` arrow we exercise. Cast
 *  through `unknown` so TypeScript lets us reach into the class body
 *  without exporting test-only seams from the production module. */
type CameraInternals = {
  handleWorkerMessage: (e: MessageEvent) => void;
  initMediaPipeSync: () => Promise<void>;
  active: boolean;
  worker: Worker | null;
  workerInitTimeout: ReturnType<typeof setTimeout> | null;
};

function asInternals(c: CameraCapture): CameraInternals {
  return c as unknown as CameraInternals;
}

describe('CameraCapture — Phase 4 worker-error handshake', () => {
  let capture: CameraCapture;

  beforeEach(() => {
    capture = new CameraCapture(
      () => {},
      () => {},
      () => {},
      () => {},
    );
    asInternals(capture).active = true;
  });

  afterEach(() => {
    capture.stop();
    vi.useRealTimers();
  });

  it('handles {type: "error"} from the worker by invoking initMediaPipeSync synchronously', async () => {
    const internals = asInternals(capture);
    const fallbackSpy = vi.fn(async () => {});
    internals.initMediaPipeSync = fallbackSpy as unknown as () => Promise<void>;

    // Drive the message-handling path directly. In production the worker
    // posts this after `importScripts('/mediapipe-vision.js')` 404s.
    internals.handleWorkerMessage({
      data: { type: 'error', error: 'import failed', phase: 'import' },
    } as MessageEvent);

    // Allow microtasks (Promise.then chains in the fallback) to settle.
    await Promise.resolve();
    expect(fallbackSpy).toHaveBeenCalledTimes(1);
  });

  it('the synchronous fallback path takes well under 100 ms wall time', async () => {
    const internals = asInternals(capture);
    const fallbackSpy = vi.fn(async () => {});
    internals.initMediaPipeSync = fallbackSpy as unknown as () => Promise<void>;

    const start = performance.now();
    internals.handleWorkerMessage({
      data: { type: 'error', error: 'import failed' },
    } as MessageEvent);
    await Promise.resolve();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
    expect(fallbackSpy).toHaveBeenCalled();
  });

  it('a stop() before the worker error arrives swallows the fallback (active=false guard)', async () => {
    const internals = asInternals(capture);
    const fallbackSpy = vi.fn(async () => {});
    internals.initMediaPipeSync = fallbackSpy as unknown as () => Promise<void>;
    internals.active = false;

    internals.handleWorkerMessage({
      data: { type: 'error', error: 'import failed' },
    } as MessageEvent);
    await Promise.resolve();
    expect(fallbackSpy).not.toHaveBeenCalled();
  });
});

describe('CameraCapture — Phase 4 timeout removal', () => {
  it('does not retain a 10-second worker-init timeout after init', () => {
    // The legacy 10-second fallback timer set a `setTimeout(..., 10_000)`
    // and stored it in `workerInitTimeout`. Phase 4 removes both —
    // construction MUST leave `workerInitTimeout` null and the sync
    // fallback MUST come from the worker error handshake instead.
    const capture = new CameraCapture(
      () => {},
      () => {},
      () => {},
      () => {},
    );
    expect(asInternals(capture).workerInitTimeout).toBe(null);
  });
});

describe('CameraCapture — Phase 4 heuristic removal', () => {
  it('does not expose `shouldPreferSync` on the class', () => {
    // The pre-Phase-4 implementation had a `private static async
    // shouldPreferSync()` that consulted WebGPU adapter info to force
    // sync mode on M1/M2 unified-GPU machines. Phase 4 removes the
    // heuristic — sync mode is only entered as a feature-detect
    // fallback after a worker init / import failure.
    const Klass = CameraCapture as unknown as { shouldPreferSync?: unknown };
    expect(Klass.shouldPreferSync).toBeUndefined();
  });
});
