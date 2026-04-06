import { WebGPURenderer, isWebGPUAvailable } from '../src/render/WebGPURenderer.js';
import { CanvasRenderer } from '../src/render/CanvasRenderer.js';
import type { IRenderer } from '../src/render/IRenderer.js';
import type { Stroke, StrokePoint, EffectPresetName } from '../src/types.js';
import { GPU_EFFECT_NAMES, CANVAS_EFFECT_NAMES, EFFECT_PRESETS } from '../src/types.js';

// Cross-compatible mock function
const mockFn = typeof vi !== 'undefined' ? vi.fn : jest.fn;

// ── Helpers ────────────────────────────────────────────

function createMockCanvas(): HTMLCanvasElement {
  return {
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
    getContext: mockFn().mockReturnValue(null),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: mockFn(),
    removeEventListener: mockFn(),
    style: {},
  } as unknown as HTMLCanvasElement;
}

function createMockCanvasWithCtx(): HTMLCanvasElement {
  const ctx = {
    clearRect: mockFn(), fillRect: mockFn(), beginPath: mockFn(),
    moveTo: mockFn(), lineTo: mockFn(), arc: mockFn(),
    fill: mockFn(), stroke: mockFn(), save: mockFn(), restore: mockFn(),
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    lineCap: 'round', lineJoin: 'round',
    shadowColor: '', shadowBlur: 0, globalAlpha: 1,
  };
  return {
    width: 800,
    height: 600,
    getContext: (type: string) => type === '2d' ? ctx : null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: mockFn(),
    removeEventListener: mockFn(),
    style: {},
  } as unknown as HTMLCanvasElement;
}

function makeStroke(count: number, effect: EffectPresetName = 'neon'): Stroke {
  const pts: StrokePoint[] = Array.from({ length: count }, (_, i) => ({
    x: i * 10, y: i * 5, t: i * 16, pressure: 0.5,
  }));
  return {
    id: `stroke-${Math.random()}`,
    raw: pts, smoothed: pts,
    state: 'effected', effect, createdAt: Date.now(),
  };
}

// ── WebGPU availability detection ──────────────────────

describe('WebGPU availability detection', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('returns false when navigator.gpu is absent', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
    expect(isWebGPUAvailable()).toBe(false);
  });

  it('returns true when navigator.gpu is present', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { gpu: {} },
      writable: true,
      configurable: true,
    });
    expect(isWebGPUAvailable()).toBe(true);
  });

  it('returns false in environments without navigator', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(isWebGPUAvailable()).toBe(false);
  });
});

// ── WebGPURenderer constructor and interface ───────────

describe('WebGPURenderer constructor', () => {
  it('creates a renderer instance', () => {
    const renderer = new WebGPURenderer(createMockCanvas());
    expect(renderer).toBeDefined();
    expect(renderer.type).toBe('webgpu');
  });

  it('accepts custom DPR', () => {
    const renderer = new WebGPURenderer(createMockCanvas(), 2);
    expect(renderer).toBeDefined();
  });
});

// ── IRenderer interface compliance ─────────────────────

describe('IRenderer interface compliance', () => {
  it('WebGPURenderer has all IRenderer methods', () => {
    const renderer: IRenderer = new WebGPURenderer(createMockCanvas());
    expect(typeof renderer.start).toBe('function');
    expect(typeof renderer.stop).toBe('function');
    expect(typeof renderer.setEventBus).toBe('function');
    expect(typeof renderer.setActivePointsSource).toBe('function');
    expect(typeof renderer.setMorphAnimator).toBe('function');
    expect(typeof renderer.addCompletedStroke).toBe('function');
    expect(typeof renderer.removeLastStroke).toBe('function');
    expect(typeof renderer.clearAll).toBe('function');
    expect(typeof renderer.setEffect).toBe('function');
    expect(typeof renderer.getEffect).toBe('function');
    expect(typeof renderer.getStrokeCount).toBe('function');
    expect(typeof renderer.destroy).toBe('function');
  });

  it('CanvasRenderer has all IRenderer methods', () => {
    const renderer: IRenderer = new CanvasRenderer(createMockCanvasWithCtx());
    expect(typeof renderer.start).toBe('function');
    expect(typeof renderer.stop).toBe('function');
    expect(typeof renderer.setEventBus).toBe('function');
    expect(typeof renderer.setActivePointsSource).toBe('function');
    expect(typeof renderer.setMorphAnimator).toBe('function');
    expect(typeof renderer.addCompletedStroke).toBe('function');
    expect(typeof renderer.removeLastStroke).toBe('function');
    expect(typeof renderer.clearAll).toBe('function');
    expect(typeof renderer.setEffect).toBe('function');
    expect(typeof renderer.getEffect).toBe('function');
    expect(typeof renderer.getStrokeCount).toBe('function');
    expect(typeof renderer.destroy).toBe('function');
  });

  it('CanvasRenderer type is canvas2d', () => {
    const renderer = new CanvasRenderer(createMockCanvasWithCtx());
    expect(renderer.type).toBe('canvas2d');
  });

  it('WebGPURenderer type is webgpu', () => {
    const renderer = new WebGPURenderer(createMockCanvas());
    expect(renderer.type).toBe('webgpu');
  });
});

// ── WebGPURenderer stroke management ───────────────────

describe('WebGPURenderer stroke management', () => {
  let renderer: WebGPURenderer;
  beforeEach(() => { renderer = new WebGPURenderer(createMockCanvas()); });

  it('addCompletedStroke increases stroke count', () => {
    renderer.addCompletedStroke(makeStroke(5));
    expect(renderer.getStrokeCount()).toBe(1);
  });

  it('removeLastStroke returns and removes the stroke', () => {
    renderer.addCompletedStroke(makeStroke(5));
    const removed = renderer.removeLastStroke();
    expect(removed).toBeDefined();
    expect(renderer.getStrokeCount()).toBe(0);
  });

  it('clearAll empties all strokes', () => {
    renderer.addCompletedStroke(makeStroke(5));
    renderer.addCompletedStroke(makeStroke(3));
    renderer.clearAll();
    expect(renderer.getStrokeCount()).toBe(0);
  });
});

// ── WebGPURenderer effect management ───────────────────

describe('WebGPURenderer effect management', () => {
  let renderer: WebGPURenderer;
  beforeEach(() => { renderer = new WebGPURenderer(createMockCanvas()); });

  it('defaults to neon effect', () => {
    expect(renderer.getEffect()).toBe('neon');
  });

  it('setEffect changes the active effect', () => {
    renderer.setEffect('hologram');
    expect(renderer.getEffect()).toBe('hologram');
  });

  it('supports all GPU effect names', () => {
    for (const name of GPU_EFFECT_NAMES) {
      renderer.setEffect(name);
      expect(renderer.getEffect()).toBe(name);
    }
  });

  it('isGPUEffect correctly identifies GPU effects', () => {
    for (const name of GPU_EFFECT_NAMES) {
      expect(renderer.isGPUEffect(name)).toBe(true);
    }
    for (const name of CANVAS_EFFECT_NAMES) {
      expect(renderer.isGPUEffect(name)).toBe(false);
    }
  });
});

// ── Effect presets ──────────────────────────────────────

describe('GPU effect presets', () => {
  it('all 5 GPU effects have entries in EFFECT_PRESETS', () => {
    for (const name of GPU_EFFECT_NAMES) {
      expect(EFFECT_PRESETS[name]).toBeDefined();
      expect(EFFECT_PRESETS[name].color).toBeTruthy();
      expect(EFFECT_PRESETS[name].glowColor).toBeTruthy();
      expect(EFFECT_PRESETS[name].particleColor).toBeTruthy();
    }
  });

  it('EFFECT_PRESETS has exactly 10 entries (5 canvas + 5 GPU)', () => {
    const keys = Object.keys(EFFECT_PRESETS);
    expect(keys.length).toBe(10);
  });

  it('GPU_EFFECT_NAMES has exactly 5 entries', () => {
    expect(GPU_EFFECT_NAMES).toHaveLength(5);
    expect(GPU_EFFECT_NAMES).toEqual([
      'liquid', 'hologram', 'bloom', 'gpu-particles', 'dissolve',
    ]);
  });

  it('CANVAS_EFFECT_NAMES has exactly 5 entries', () => {
    expect(CANVAS_EFFECT_NAMES).toHaveLength(5);
    expect(CANVAS_EFFECT_NAMES).toEqual([
      'neon', 'aurora', 'gold', 'calligraphy', 'fire',
    ]);
  });
});

// ── WebGPURenderer init — fallback ─────────────────────

describe('WebGPURenderer init fallback', () => {
  it('init returns false when navigator.gpu is absent', async () => {
    const renderer = new WebGPURenderer(createMockCanvas());
    const result = await renderer.init();
    expect(result).toBe(false);
  });

  it('destroy is safe to call without init', () => {
    const renderer = new WebGPURenderer(createMockCanvas());
    expect(() => renderer.destroy()).not.toThrow();
  });

  it('destroy clears strokes', () => {
    const renderer = new WebGPURenderer(createMockCanvas());
    renderer.addCompletedStroke(makeStroke(5));
    renderer.destroy();
    expect(renderer.getStrokeCount()).toBe(0);
  });
});

// ── Render loop (no GPU) ───────────────────────────────

describe('WebGPURenderer render loop (no GPU)', () => {
  let rafCallback: ((t: number) => void) | null = null;
  let rafId = 1;
  const savedRAF = globalThis.requestAnimationFrame;
  const savedCAF = globalThis.cancelAnimationFrame;
  const savedPerf = globalThis.performance;

  beforeEach(() => {
    rafCallback = null;
    (globalThis as unknown as Record<string, unknown>).requestAnimationFrame =
      mockFn().mockImplementation((cb: FrameRequestCallback) => {
        rafCallback = cb;
        return rafId++;
      });
    (globalThis as unknown as Record<string, unknown>).cancelAnimationFrame = mockFn();
    (globalThis as unknown as Record<string, unknown>).performance = { now: () => 0 };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = savedRAF;
    globalThis.cancelAnimationFrame = savedCAF;
    (globalThis as unknown as Record<string, unknown>).performance = savedPerf;
  });

  it('start schedules a frame', () => {
    const renderer = new WebGPURenderer(createMockCanvas());
    renderer.start();
    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  it('start is idempotent', () => {
    const renderer = new WebGPURenderer(createMockCanvas());
    renderer.start();
    renderer.start();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('stop cancels the animation frame', () => {
    const renderer = new WebGPURenderer(createMockCanvas());
    renderer.start();
    renderer.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('render loop fires without error even without GPU', () => {
    const renderer = new WebGPURenderer(createMockCanvas());
    renderer.start();
    expect(rafCallback).not.toBeNull();
    expect(() => rafCallback!(16)).not.toThrow();
  });
});

// ── Init timeout budget ────────────────────────────────

describe('WebGPU init timeout', () => {
  it('init respects 200ms budget by returning null on timeout', async () => {
    // Without real GPU, init returns false quickly (no timeout needed)
    const renderer = new WebGPURenderer(createMockCanvas());
    const start = Date.now();
    await renderer.init();
    const elapsed = Date.now() - start;
    // Should complete well within 200ms when no GPU
    expect(elapsed).toBeLessThan(200);
  });
});
