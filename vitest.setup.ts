/**
 * Vitest global setup — polyfills for browser APIs used by @glymo/core under jsdom.
 *
 * Canonical polyfill strategy (not per-test mocks):
 *   - OffscreenCanvas: backed by @napi-rs/canvas so 2D draw calls produce REAL
 *     pixel data. Tests that only construct OffscreenCanvas without calling
 *     getImageData (e.g. CanvasRenderer construction smoke tests) are unaffected;
 *     tests that need real rasterisation (strokes-to-image golden parity) get it.
 *   - requestAnimationFrame / cancelAnimationFrame: deterministic setTimeout(cb, 16) stub
 *     so tests that depend on RAF scheduling get a real callback without needing fake timers.
 *   - window / devicePixelRatio: provided by jsdom when environment:'jsdom' is set;
 *     we only need to make sure window.devicePixelRatio has a sane default.
 *
 * NOTE: Do NOT add per-test behaviour here. Tests that need deterministic timing must
 * use vi.useFakeTimers() themselves and advance the clock explicitly.
 */

// node-canvas provides Cairo-backed Canvas 2D rasterisation matching the
// implementation jsdom auto-detects when the legacy `canvas` package is
// installed. Importing `createCanvas` directly is the canonical way to back
// our OffscreenCanvas polyfill with the SAME rasteriser that produced the
// committed golden fixtures under glymo-landing's test setup.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createCanvas } = require('canvas') as typeof import('canvas');

// ── OffscreenCanvas polyfill ──────────────────────────────────────────────
//
// jsdom does not implement OffscreenCanvas (it is a browser-only API).
// CanvasRenderer, WebGPURenderer, and GlymoTextMode all call
//   new OffscreenCanvas(width, height)
// in their setup paths, so tests fail at construction without this polyfill.
//
// We back the polyfill with node-canvas (Cairo) so that 2D draw calls
// (fillRect, stroke, arc, getImageData) produce REAL pixel output that is
// byte-identical to the rasteriser jsdom auto-detects when `canvas` is
// installed. This is required by the strokes-to-image golden-parity
// regression suite migrated from glymo-landing (whose goldens were captured
// against this exact backend). See docs/plans/drawing-classifier-migration.md
// §7.1 + R3 for the full migration rationale.
//
// (We deliberately do NOT use @napi-rs/canvas — it is a Skia-backed
// alternative whose AA gradient differs by ~0.5%/pixel from Cairo, which
// would break the pixel-exact golden parity invariant.)
//
// The polyfill satisfies the usage pattern:
//   const oc = new OffscreenCanvas(w, h);
//   const ctx = oc.getContext('2d');          // real Canvas 2D context
//   oc.width / oc.height                      // readable
//
// It does NOT implement transferToImageBitmap or WebGPU context — those paths
// are not exercised by the unit tests.

if (typeof globalThis.OffscreenCanvas === 'undefined') {
  class OffscreenCanvasPolyfill {
    width: number;
    height: number;
    private _backing: ReturnType<typeof createCanvas> | null = null;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }

    getContext(type: string): unknown {
      if (type !== '2d') return null;
      if (!this._backing) {
        this._backing = createCanvas(this.width, this.height);
      }
      // node-canvas returns a CanvasRenderingContext2D-compatible object.
      return this._backing.getContext('2d');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).OffscreenCanvas = OffscreenCanvasPolyfill;
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
