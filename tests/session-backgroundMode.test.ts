/**
 * SessionDoc.backgroundMode persistence contract (0.18.0).
 *
 * Pins the canonical round-trip for the session-level background theme
 * preference added in 0.18.0:
 *
 *   - `exportSession()` carries the current `sessionBackgroundMode` on the
 *     wire as `doc.backgroundMode` when it differs from the default
 *     `'dark'`. Default sessions omit the field entirely so v2 docs pre-
 *     dating 0.18.0 remain byte-equivalent on re-export.
 *   - `loadSession(doc)` emits a `'session:restore'` event carrying
 *     `backgroundMode`; missing field defaults to `'dark'` so subscribers
 *     always receive a concrete value.
 *
 * The field is a tagged pass-through — `core` does not interpret the
 * theme value; it is opaque to the engine and re-applied by the UI layer.
 */

import { vi, describe, it, expect } from 'vitest';
import {
  Glymo,
  type SessionDoc,
  type BitmapUploader,
  type BitmapLoader,
} from '../src/index.js';

// ── Node polyfills (mirrors session-roundtrip.test.ts pattern) ────────────────

const mockCtx: Record<string, unknown> = {
  clearRect: () => {},
  fillRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  quadraticCurveTo: () => {},
  bezierCurveTo: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  save: () => {},
  restore: () => {},
  scale: () => {},
  translate: () => {},
  rotate: () => {},
  setTransform: () => {},
  getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  putImageData: () => {},
  drawImage: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  createPattern: () => null,
  clip: () => {},
  closePath: () => {},
  fillText: () => {},
  measureText: () => ({ width: 0 }),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'round',
  lineJoin: 'round',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  shadowBlur: 0,
  shadowColor: '',
  font: '',
  textAlign: 'left',
  canvas: { width: 800, height: 600 },
};

vi.stubGlobal(
  'OffscreenCanvas',
  class MockOffscreenCanvas {
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
    getContext() { return mockCtx; }
  },
);

vi.stubGlobal('createImageBitmap', async () => ({ width: 32, height: 32, close: () => {} }));

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 800,
    height: 600,
    getContext: () => mockCtx,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
    style: {},
    setAttribute: () => {},
    dataset: {},
  } as unknown as HTMLCanvasElement;
}

function makeNoopIO(): { uploader: BitmapUploader; loader: BitmapLoader } {
  const uploader: BitmapUploader = {
    async upload(): Promise<string> {
      throw new Error('no fills expected in background-mode tests');
    },
  };
  const loader: BitmapLoader = {
    async load(): Promise<ImageBitmap> {
      throw new Error('no fills expected in background-mode tests');
    },
  };
  return { uploader, loader };
}

function makeEmptyDoc(overrides: Partial<SessionDoc> = {}): SessionDoc {
  return {
    version: 2,
    canvas: { w: 800, h: 600 },
    effect: { name: 'neon' },
    strokes: [],
    objects: [],
    fills: [],
    ...overrides,
  };
}

describe('SessionDoc.backgroundMode — export', () => {
  it('omits the field for a default-mode session (wire shape minimal)', async () => {
    const { uploader, loader } = makeNoopIO();
    const g = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });
    const doc = await g.exportSession();
    // Default is 'dark'; we intentionally elide the field to keep the wire
    // byte-equivalent with pre-0.18.0 docs that carry no backgroundMode.
    expect(doc.backgroundMode).toBeUndefined();
  });

  it("writes 'white' when the engine state has been set to white", async () => {
    const { uploader, loader } = makeNoopIO();
    const g = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });
    // The 0.18.0 setter widens to accept theme values as well — the UI
    // calls setBackgroundMode('white') as part of the light-theme switch.
    g.setBackgroundMode('white');
    const doc = await g.exportSession();
    expect(doc.backgroundMode).toBe('white');
  });

  it("writes 'dark' only when it was explicitly set back to dark after white (round-trip fidelity)", async () => {
    // Round-trip: the engine should persist whatever the user last chose.
    // Setting back to 'dark' returns to the default → default elides the
    // field, which is correct (dark ↔ omitted are wire-equivalent and
    // produce the same session:restore payload on load).
    const { uploader, loader } = makeNoopIO();
    const g = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });
    g.setBackgroundMode('white');
    g.setBackgroundMode('dark');
    const doc = await g.exportSession();
    expect(doc.backgroundMode).toBeUndefined();
  });
});

describe('SessionDoc.backgroundMode — load + session:restore event', () => {
  it("emits 'session:restore' with backgroundMode='dark' for a doc without the field", async () => {
    const { uploader, loader } = makeNoopIO();
    const g = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });
    const received: Array<{ backgroundMode: 'dark' | 'white' }> = [];
    g.on('session:restore', (payload: { backgroundMode: 'dark' | 'white' }) => {
      received.push(payload);
    });
    await g.loadSession(makeEmptyDoc());
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ backgroundMode: 'dark' });
  });

  it("emits 'session:restore' with backgroundMode='white' when the doc carries white", async () => {
    const { uploader, loader } = makeNoopIO();
    const g = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });
    const received: Array<{ backgroundMode: 'dark' | 'white' }> = [];
    g.on('session:restore', (payload: { backgroundMode: 'dark' | 'white' }) => {
      received.push(payload);
    });
    await g.loadSession(makeEmptyDoc({ backgroundMode: 'white' }));
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ backgroundMode: 'white' });
  });

  it('re-exports the loaded backgroundMode (round-trip fidelity)', async () => {
    const { uploader, loader } = makeNoopIO();
    const g = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });
    await g.loadSession(makeEmptyDoc({ backgroundMode: 'white' }));
    const reExported = await g.exportSession();
    expect(reExported.backgroundMode).toBe('white');
  });
});
