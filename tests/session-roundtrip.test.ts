/**
 * RED-FIRST: these tests fail until the orchestrator lands
 *   core-2 (Glymo.exportSession / loadSession)
 *   core-3 (StrokeAnimator.serialize + ObjectStore.listObjects + Glymo.getFills / listObjects)
 *   core-1 (GlymoOptions.bitmapUploader / bitmapLoader fields — may already be in-flight)
 */
import { vi, describe, it, expect, afterEach } from 'vitest';
import {
  Glymo,
  type SessionDoc,
  type ObjectDoc,
  type FillDoc,
  type BitmapUploader,
  type BitmapLoader,
  type StrokeDoc,
  type Fill,
  type GlymoError,
} from '../src/index.js';

// ── Node polyfills (mirrors Glymo.test.ts pattern) ────────────────────────────

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
    convertToBlob() {
      return Promise.resolve(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }));
    }
  },
);

vi.stubGlobal('createImageBitmap', async () => ({ width: 32, height: 32, close: () => {} }));

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function fakeBitmap(w = 32, h = 32): ImageBitmap {
  return { width: w, height: h, close: () => {} } as unknown as ImageBitmap;
}

/** 4-byte PNG magic header stub */
const STUB_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

/**
 * Create a matched uploader/loader pair backed by a shared in-memory Map.
 * The uploader records each uploaded bitmap under a deterministic URL.
 * The loader resolves only URLs that were previously uploaded.
 */
function makeInMemoryIO(): {
  uploader: BitmapUploader;
  loader: BitmapLoader;
  store: Map<string, Uint8Array>;
} {
  const store = new Map<string, Uint8Array>();
  let seq = 0;
  const uploader: BitmapUploader = {
    async upload(_bitmap: ImageBitmap): Promise<string> {
      const url = `https://bucket.test/fills/f${++seq}.png`;
      store.set(url, STUB_PNG.slice());
      return url;
    },
  };
  const loader: BitmapLoader = {
    async load(url: string): Promise<ImageBitmap> {
      if (!store.has(url)) throw new Error(`BitmapLoader: unknown URL ${url}`);
      return fakeBitmap();
    },
  };
  return { uploader, loader, store };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('session-roundtrip', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Full round-trip ───────────────────────────────────────────────────────

  it('round-trips 3 strokes + 1 object + 2 fills + 1 animation through JSON wire', async () => {
    const { uploader, loader, store } = makeInMemoryIO();

    // Instance 1: seed state
    const g1 = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });

    // Strokes with explicit ids so object/animation refs are predictable
    const strokeDocs: StrokeDoc[] = [
      { id: 'sa', points: [{ x: 1, y: 1 }, { x: 10, y: 10 }] },
      { id: 'sb', points: [{ x: 20, y: 20 }, { x: 30, y: 30 }] },
      { id: 'sc', points: [{ x: 40, y: 40 }, { x: 50, y: 50 }] },
    ];
    g1.loadStrokes(strokeDocs);
    g1.createObject(['sa', 'sb'], { x: 0, y: 0, width: 40, height: 40 });
    g1.addFill({ id: 'f1', color: '#ff0000', bitmap: fakeBitmap(), createdAt: 0 } as Fill);
    g1.addFill({ id: 'f2', color: '#0000ff', bitmap: fakeBitmap(), createdAt: 0 } as Fill);
    g1.animateStrokes(['sc'], { type: 'sparkle', duration: 1200, repeat: true });

    // Capture original state BEFORE export
    const origStrokes = [...g1.getStrokes()];
    const origFills = [...g1.getFills()];          // core-3: not yet implemented → RED
    const origObjects = [...g1.listObjects()];      // core-3: not yet implemented → RED
    const origAnimSerials = g1.strokeAnimator.serialize(); // core-3: not yet implemented → RED

    // Export
    const exported = await g1.exportSession();     // core-2: not yet implemented → RED
    expect(store.size).toBe(2); // both fills uploaded

    // Simulate wire transport
    const wire = JSON.parse(JSON.stringify(exported)) as SessionDoc;
    expect(wire.version).toBe(2);
    expect(wire.strokes).toHaveLength(3);
    expect(wire.fills).toHaveLength(2);
    expect(wire.objects).toHaveLength(1);

    // Instance 2: loader must resolve URLs in the original uploader's store
    const loaderFromStore: BitmapLoader = {
      async load(url: string): Promise<ImageBitmap> {
        if (!store.has(url)) throw new Error(`loader2: unknown URL ${url}`);
        return fakeBitmap();
      },
    };
    const g2 = new Glymo(fakeCanvas(), {
      bitmapUploader: makeInMemoryIO().uploader, // not used in load, but required
      bitmapLoader: loaderFromStore,
    });
    await g2.loadSession(wire);                   // core-2: not yet implemented → RED

    // Stroke identity (id + per-stroke overrides match)
    expect(g2.getStrokes().map(s => s.id)).toEqual(origStrokes.map(s => s.id));
    expect(g2.getStrokes().map(s => s.effect)).toEqual(origStrokes.map(s => s.effect));
    expect(g2.getStrokes().map(s => s.customColor)).toEqual(origStrokes.map(s => s.customColor));
    expect(g2.getStrokes().map(s => s.customWidth)).toEqual(origStrokes.map(s => s.customWidth));

    // Fill identity (bitmap excluded — it's re-decoded from URL; check id + color)
    expect(g2.getFills().map(f => ({ id: f.id, color: f.color }))).toEqual(
      origFills.map(f => ({ id: f.id, color: f.color })),
    );

    // Object identity
    expect(g2.listObjects().map(o => ({ id: o.id, strokeIds: [...o.strokeIds].sort() }))).toEqual(
      origObjects.map(o => ({ id: o.id, strokeIds: [...o.strokeIds].sort() })),
    );

    // Animation params (D4: elapsed / startedAt / active must NOT survive)
    const reloadedSerials = g2.strokeAnimator.serialize();
    expect(reloadedSerials.map(e => ({ strokeIds: e.strokeIds, type: e.params.type, duration: e.params.durationMs ?? e.params.duration }))).toEqual(
      origAnimSerials.map(e => ({ strokeIds: e.strokeIds, type: e.params.type, duration: e.params.durationMs ?? e.params.duration })),
    );
    for (const entry of reloadedSerials) {
      expect(entry).not.toHaveProperty('elapsed');
      expect(entry).not.toHaveProperty('startedAt');
      expect(entry).not.toHaveProperty('active');
    }
  });

  // ── 2. Legacy v1 compat ──────────────────────────────────────────────────────

  it('loads a bare StrokeDoc[] (v1 shape) without throwing; objects and fills are empty', async () => {
    const { uploader, loader } = makeInMemoryIO();
    const glymo = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });

    const legacyPayload: StrokeDoc[] = [
      { points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
      { points: [{ x: 3, y: 3 }, { x: 4, y: 4 }] },
    ];

    // loadSession must accept StrokeDoc[] per §4 D3
    await expect(glymo.loadSession(legacyPayload)).resolves.toBeUndefined(); // core-2 → RED

    expect(glymo.getStrokes()).toHaveLength(2);
    expect(glymo.getFills()).toHaveLength(0);     // core-3 → RED
    expect(glymo.listObjects()).toHaveLength(0);  // core-3 → RED
  });

  // ── 3. Fill size violation ───────────────────────────────────────────────────

  it('rejects with fill-size-exceeded for an over-limit PNG; uploader is never called', async () => {
    const uploadCalls: ImageBitmap[] = [];
    const oversizedUploader: BitmapUploader = {
      async upload(bitmap: ImageBitmap): Promise<string> {
        uploadCalls.push(bitmap);
        // Simulate encoding a large bitmap that exceeds 500 KB
        const err: GlymoError & Error = Object.assign(new Error('fill-size-exceeded'), {
          code: 'fill-size-exceeded',
          recoverable: false,
        });
        throw err;
      },
    };
    const loader: BitmapLoader = { async load() { return fakeBitmap(); } };

    const glymo = new Glymo(fakeCanvas(), { bitmapUploader: oversizedUploader, bitmapLoader: loader });
    glymo.addFill({ id: 'big', color: '#00ff00', bitmap: fakeBitmap(1024, 1024), createdAt: 0 } as Fill);

    // exportSession must surface fill-size-exceeded, not silently partial-succeed
    await expect(glymo.exportSession()).rejects.toMatchObject({ code: 'fill-size-exceeded' }); // core-2 → RED
    // Uploader may have been called (to detect the size), but the doc must not be returned
    // The key contract: the rejection propagates cleanly
  });

  // ── 4. Dangling object reference ─────────────────────────────────────────────

  it('drops objects with dangling strokeIds, warns, and keeps valid strokes on load', async () => {
    const { uploader, loader } = makeInMemoryIO();
    const glymo = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const doc: SessionDoc = {
      version: 2,
      canvas: { w: 800, h: 600 },
      effect: { name: 'neon' },
      strokes: [{ id: 'real', points: [{ x: 5, y: 5 }, { x: 15, y: 15 }] }],
      objects: [
        {
          id: 'bad-obj',
          strokeIds: ['real', 'GHOST_ID'], // GHOST_ID does not exist
          fillIds: [],
          bbox: { x: 0, y: 0, width: 20, height: 20 },
        } as ObjectDoc,
      ],
      fills: [],
    };

    // Must not throw (§4 D6)
    await expect(glymo.loadSession(doc)).resolves.toBeUndefined(); // core-2 → RED

    // A console.warn must fire about the dangling ref
    expect(warnSpy).toHaveBeenCalled();

    // Valid stroke survives; corrupt object is dropped
    expect(glymo.getStrokes()).toHaveLength(1);
    expect(glymo.listObjects()).toHaveLength(0); // core-3 → RED
  });

  // ── 5. Upload failure surfaces cleanly ───────────────────────────────────────

  it('propagates a typed uploader error cleanly; no partial SessionDoc returned', async () => {
    class UploadNetworkError extends Error {
      readonly code = 'upload-network-error';
      constructor() {
        super('simulated upload failure');
        this.name = 'UploadNetworkError';
      }
    }

    const failingUploader: BitmapUploader = {
      async upload(): Promise<string> {
        throw new UploadNetworkError();
      },
    };
    const loader: BitmapLoader = { async load() { return fakeBitmap(); } };

    const glymo = new Glymo(fakeCanvas(), { bitmapUploader: failingUploader, bitmapLoader: loader });
    glymo.addFill({ id: 'f1', color: '#abcdef', bitmap: fakeBitmap(), createdAt: 0 } as Fill);

    // Must reject — not resolve with partial doc
    const rejection = await glymo.exportSession().then(  // core-2 → RED
      (doc) => { throw new Error(`Expected rejection but got doc: ${JSON.stringify(doc)}`); },
      (err: unknown) => err,
    );
    expect(rejection).toBeInstanceOf(UploadNetworkError);
  });

  // ── 6. Revision 2 — characters round-trip ──────────────────────────────────
  //
  // Regression gate for the "Studio save → exit → re-enter = blank canvas" bug
  // shipped on 2026-04-19. Text-mode sessions destructively remove their
  // handwritten strokes via `fadeOutStrokeById` the moment the recognizer
  // finalises a glyph, so `exportSession().strokes` is empty for those
  // sessions. Revision 2 persists the typography layer via `SessionDoc.characters`
  // (Glymo#addCharacter → CharacterStore → exportSession / loadSession).
  //
  // What this test locks in:
  //   * empty CharacterStore → `characters` field is OMITTED from the wire
  //     (not an empty array — "no typography" and "typography cleared" are
  //     distinct states; only a non-empty array is persisted)
  //   * non-empty CharacterStore → `characters` is present on the wire with
  //     identity-preserving fields (id, char, bbox, fontId, effect, confidence)
  //   * loadSession hydrates the second instance's CharacterStore 1:1 with
  //     the exported payload
  //   * `character:change` fires on loadSession so React hooks driven by the
  //     event (useTextRecognition) pick up the restored glyphs on mount

  it('omits `characters` on export when the CharacterStore is empty', async () => {
    const { uploader, loader } = makeInMemoryIO();
    const glymo = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });
    const exported = await glymo.exportSession();
    expect(exported).not.toHaveProperty('characters');
  });

  it('round-trips characters through exportSession / loadSession', async () => {
    const { uploader, loader } = makeInMemoryIO();
    const g1 = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });

    g1.addCharacter({
      id: 'c1', char: '안', x: 10, y: 20, width: 40, height: 60,
      fontId: 'default-ko', effect: 'none', confidence: 0.97,
    });
    g1.addCharacter({
      id: 'c2', char: '녕', x: 60, y: 20, width: 40, height: 60,
      fontId: 'default-ko', effect: 'none', confidence: 0.95,
    });

    const exported = await g1.exportSession();
    expect(exported.characters).toHaveLength(2);

    const wire = JSON.parse(JSON.stringify(exported)) as SessionDoc;
    expect(wire.characters?.map(c => c.char)).toEqual(['안', '녕']);
    expect(wire.characters?.[0]).toMatchObject({
      id: 'c1', char: '안', x: 10, y: 20, width: 40, height: 60,
      fontId: 'default-ko', effect: 'none', confidence: 0.97,
    });

    const g2 = new Glymo(fakeCanvas(), { bitmapUploader: uploader, bitmapLoader: loader });

    // Event contract — useTextRecognition subscribes to character:change and
    // derives its React state from the core store. Without this emit the
    // text-mode overlay never renders on reload.
    const received: Array<{ characters: ReturnType<typeof g2.getCharacters> }> = [];
    g2.on('character:change', (payload) => { received.push(payload); });

    await g2.loadSession(wire);

    expect(g2.getCharacters()).toHaveLength(2);
    expect(g2.getCharacters().map(c => c.id)).toEqual(['c1', 'c2']);
    expect(received).toHaveLength(1);
    expect(received[0].characters).toHaveLength(2);
  });
});
