/**
 * Vitest global setup — polyfills for browser APIs used by @glymo/core under jsdom.
 *
 * Canonical polyfill strategy (not per-test mocks):
 *   - OffscreenCanvas: minimal stub with getContext() returning a no-op 2D context shape.
 *   - requestAnimationFrame / cancelAnimationFrame: deterministic setTimeout(cb, 16) stub
 *     so tests that depend on RAF scheduling get a real callback without needing fake timers.
 *   - window / devicePixelRatio: provided by jsdom when environment:'jsdom' is set;
 *     we only need to make sure window.devicePixelRatio has a sane default.
 *
 * NOTE: Do NOT add per-test behaviour here. Tests that need deterministic timing must
 * use vi.useFakeTimers() themselves and advance the clock explicitly.
 */

// ── OffscreenCanvas stub ───────────────────────────────────────────────────
//
// jsdom does not implement OffscreenCanvas (it is a browser-only API).
// CanvasRenderer, WebGPURenderer, and GlymoTextMode all call
//   new OffscreenCanvas(width, height)
// in their setup paths, so tests fail at construction without this stub.
//
// The stub satisfies the usage pattern:
//   const oc = new OffscreenCanvas(w, h);
//   const ctx = oc.getContext('2d');          // returns mock 2D context
//   oc.width / oc.height                      // readable
//
// It does NOT implement transferToImageBitmap or WebGPU context — those paths
// are not exercised by the unit tests.

if (typeof globalThis.OffscreenCanvas === 'undefined') {
  class OffscreenCanvasStub {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }

    getContext(type: string): unknown {
      if (type === '2d') {
        // Return a no-op context shape that mirrors the CanvasRenderingContext2D
        // surface used by CanvasRenderer. All methods are no-ops; numeric
        // properties hold default values so assignment succeeds.
        return {
          clearRect: () => {},
          fillRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          save: () => {},
          restore: () => {},
          drawImage: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
          putImageData: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          lineCap: 'round',
          lineJoin: 'round',
          shadowColor: '',
          shadowBlur: 0,
          globalAlpha: 1,
          globalCompositeOperation: 'source-over',
          font: '',
          textAlign: 'start',
          textBaseline: 'alphabetic',
        };
      }
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).OffscreenCanvas = OffscreenCanvasStub;
}

// ── requestAnimationFrame / cancelAnimationFrame stubs ─────────────────────
//
// jsdom sets environment:'jsdom' but does not provide a real rAF implementation
// (it delivers a stub that does nothing, not even call back). GIFExporter calls
// requestAnimationFrame to yield to the render loop between frames.
//
// Canonical stub: schedule via setTimeout(cb, 16) so the callback fires on the
// next event-loop tick. This is correct for tests that use real async/await
// (not fake timers). Tests that need deterministic control must override with
// vi.useFakeTimers() and advance the clock manually.

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  let rafId = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const id = ++rafId;
    setTimeout(() => cb(performance.now()), 16);
    return id;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).cancelAnimationFrame = (_id: number): void => {
    // No-op — the setTimeout cannot be cancelled by RAF id.
    // Tests that need cancellation must use vi.useFakeTimers().
  };
}

// ── window.devicePixelRatio default ───────────────────────────────────────
//
// jsdom provides window but does not set devicePixelRatio. HandVisualizer reads
// window.devicePixelRatio at draw time. Default to 1 (standard display).

if (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'undefined') {
  Object.defineProperty(window, 'devicePixelRatio', {
    value: 1,
    writable: true,
    configurable: true,
  });
}
