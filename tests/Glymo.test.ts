import {
  Glymo,
  type EffectPresetName,
  type GlymoEvent,
  type GlymoOptions,
  type GIFOptions,
} from '../src/index.js';

// ── Node-env polyfills ────────────────────────────────
// Glymo's internal renderer touches OffscreenCanvas during construction.
// Vitest runs in the `node` environment here, so we stub a minimal shim
// mirroring the pattern used in GlyphExtractor.test.ts.

const mockOffscreenCtx = {
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
  getImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
  drawImage: () => {},
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'round',
  lineJoin: 'round',
  globalAlpha: 1,
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
    getContext() {
      return mockOffscreenCtx;
    }
  },
);

// ── Helpers ────────────────────────────────────────────

function createMockCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  return {
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    // Required by CanvasRenderer.renderCompletedStrokes (offscreen cache blit):
    drawImage: noop,
    // Required by selection and transform layers:
    setTransform: noop,
    resetTransform: noop,
    scale: noop,
    translate: noop,
    rotate: noop,
    transform: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    setLineDash: noop,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D;
}

function createMockCanvas(): HTMLCanvasElement {
  return {
    width: 800,
    height: 600,
    getContext: () => createMockCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    style: { transition: '', opacity: '' },
  } as unknown as HTMLCanvasElement;
}

// ── Type export tests ──────────────────────────────────

describe('Type exports', () => {
  it('EffectPresetName accepts valid values', () => {
    const name: EffectPresetName = 'neon';
    expect(name).toBe('neon');
  });

  it('GlymoEvent accepts valid values', () => {
    const event: GlymoEvent = 'stroke:start';
    expect(event).toBe('stroke:start');
  });

  it('GlymoOptions can be constructed', () => {
    const opts: GlymoOptions = { width: 800, height: 600, effect: 'gold' };
    expect(opts.width).toBe(800);
  });

  it('GIFOptions can be constructed', () => {
    const opts: GIFOptions = { fps: 30, duration: 2000 };
    expect(opts.fps).toBe(30);
  });
});

// ── Constructor ────────────────────────────────────────

describe('Glymo constructor', () => {
  it('creates an instance with a canvas', () => {
    const canvas = createMockCanvas();
    const glymo = new Glymo(canvas);
    expect(glymo).toBeInstanceOf(Glymo);
  });

  it('creates an instance with options', () => {
    const canvas = createMockCanvas();
    const glymo = new Glymo(canvas, { width: 1024, effect: 'aurora' });
    expect(glymo).toBeInstanceOf(Glymo);
  });

  it('defaults options to empty object when omitted', () => {
    const canvas = createMockCanvas();
    const glymo = new Glymo(canvas);
    expect(glymo).toBeDefined();
  });
});

// ── getAvailableEffects ────────────────────────────────

describe('Glymo.getAvailableEffects', () => {
  let glymo: Glymo;

  beforeEach(() => {
    glymo = new Glymo(createMockCanvas());
  });

  it('returns an array of 5 presets', () => {
    const effects = glymo.getAvailableEffects();
    expect(effects).toHaveLength(5);
  });

  it('contains all expected preset names', () => {
    const effects = glymo.getAvailableEffects();
    expect(effects).toEqual(['neon', 'aurora', 'gold', 'calligraphy', 'fire']);
  });

  it('returns a new array on each call', () => {
    const a = glymo.getAvailableEffects();
    const b = glymo.getAvailableEffects();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ── Implemented input methods ────────────────────────

describe('Implemented input methods', () => {
  let glymo: Glymo;
  beforeEach(() => { glymo = new Glymo(createMockCanvas()); });

  it('bindMouse does not throw', () => {
    expect(() => glymo.bindMouse()).not.toThrow();
  });

  it('bindCamera resolves without throwing', async () => {
    await expect(glymo.bindCamera()).resolves.toBeUndefined();
  });

  it('unbind does not throw', () => {
    expect(() => glymo.unbind()).not.toThrow();
  });
});

// ── Implemented effect methods ──────────────────────

describe('Implemented effect methods', () => {
  let glymo: Glymo;
  beforeEach(() => { glymo = new Glymo(createMockCanvas()); });

  it('setEffect changes the effect', () => {
    glymo.setEffect('aurora');
    expect(glymo.getEffect()).toBe('aurora');
  });

  it('getEffect returns default neon', () => {
    expect(glymo.getEffect()).toBe('neon');
  });
});

// ── Implemented canvas methods ──────────────────────

describe('Implemented canvas methods', () => {
  let glymo: Glymo;
  beforeEach(() => { glymo = new Glymo(createMockCanvas()); });

  it('clear does not throw', () => {
    expect(() => glymo.clear()).not.toThrow();
  });

  it('undo does not throw', () => {
    expect(() => glymo.undo()).not.toThrow();
  });

  it('getStrokeCount returns 0 initially', () => {
    expect(glymo.getStrokeCount()).toBe(0);
  });
});

// ── Export & lifecycle ─────────────────────────────────

describe('Export and lifecycle methods', () => {
  let glymo: Glymo;
  beforeEach(() => { glymo = new Glymo(createMockCanvas()); });

  it('exportPNG is an async method', () => {
    expect(typeof glymo.exportPNG).toBe('function');
  });

  it('exportGIF is an async method', () => {
    expect(typeof glymo.exportGIF).toBe('function');
  });

  it('on registers a listener without throwing', () => {
    const unsub = glymo.on('error', () => {});
    expect(typeof unsub).toBe('function');
  });

  it('destroy does not throw', () => {
    expect(() => glymo.destroy()).not.toThrow();
  });
});

// ── loadStrokes (wire-format hydration) ──────────────

describe('Glymo.loadStrokes', () => {
  let glymo: Glymo;
  beforeEach(() => { glymo = new Glymo(createMockCanvas()); });

  it('hydrates strokes from the StrokeDoc wire shape', () => {
    glymo.loadStrokes([
      { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5, pressure: 0.5 }] },
      { points: [{ x: 100, y: 100 }] },
    ]);
    const strokes = glymo.getStrokes();
    expect(strokes).toHaveLength(2);
    expect(strokes[0]!.raw).toHaveLength(3);
    expect(strokes[1]!.raw).toHaveLength(1);
  });

  it('defaults missing pressure to 1.0 and synthesizes monotonic t', () => {
    glymo.loadStrokes([{ points: [{ x: 0, y: 0 }, { x: 1, y: 1, pressure: 0.25 }] }]);
    const pts = glymo.getStrokes()[0]!.raw;
    expect(pts[0]!.pressure).toBe(1.0);
    expect(pts[1]!.pressure).toBe(0.25);
    expect(pts[0]!.t).toBe(0);
    expect(pts[1]!.t).toBe(1);
  });

  it('replaces existing strokes on subsequent loads', () => {
    glymo.loadStrokes([{ points: [{ x: 0, y: 0 }] }, { points: [{ x: 1, y: 1 }] }]);
    expect(glymo.getStrokes()).toHaveLength(2);
    glymo.loadStrokes([{ points: [{ x: 5, y: 5 }] }]);
    expect(glymo.getStrokes()).toHaveLength(1);
  });

  it('accepts an empty array without throwing', () => {
    expect(() => glymo.loadStrokes([])).not.toThrow();
    expect(glymo.getStrokes()).toHaveLength(0);
  });
});
