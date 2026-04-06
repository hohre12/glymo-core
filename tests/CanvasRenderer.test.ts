import { CanvasRenderer } from '../src/render/CanvasRenderer.js';
import type { Stroke, StrokePoint } from '../src/types.js';

// Cross-compatible mock function
const mockFn = typeof vi !== 'undefined' ? vi.fn : jest.fn;

// ── Helpers ────────────────────────────────────────────

function createMockCtx(): CanvasRenderingContext2D {
  return {
    clearRect: mockFn(),
    fillRect: mockFn(),
    beginPath: mockFn(),
    moveTo: mockFn(),
    lineTo: mockFn(),
    arc: mockFn(),
    fill: mockFn(),
    stroke: mockFn(),
    save: mockFn(),
    restore: mockFn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

function createMockCanvas(ctx?: CanvasRenderingContext2D): HTMLCanvasElement {
  const mockCtx = ctx ?? createMockCtx();
  return {
    width: 800,
    height: 600,
    getContext: () => mockCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: mockFn(),
    removeEventListener: mockFn(),
  } as unknown as HTMLCanvasElement;
}

function makeStroke(pointCount: number, effect: 'neon' | 'aurora' = 'neon'): Stroke {
  const pts: StrokePoint[] = Array.from({ length: pointCount }, (_, i) => ({
    x: i * 10,
    y: i * 5,
    t: i * 16,
    pressure: 0.5,
  }));
  return {
    id: `stroke-${Math.random()}`,
    raw: pts,
    smoothed: pts,
    state: 'effected',
    effect,
    createdAt: Date.now(),
  };
}

// ── Shared RAF mock setup for render loop tests ──────

let rafCallback: ((t: number) => void) | null = null;
let rafId = 1;

const savedRAF = globalThis.requestAnimationFrame;
const savedCAF = globalThis.cancelAnimationFrame;
const savedPerf = globalThis.performance;

function setupRafMocks() {
  rafCallback = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).requestAnimationFrame = mockFn().mockImplementation((cb: FrameRequestCallback) => {
    rafCallback = cb;
    return rafId++;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).cancelAnimationFrame = mockFn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).performance = { now: () => 0 };
}

function teardownRafMocks() {
  globalThis.requestAnimationFrame = savedRAF;
  globalThis.cancelAnimationFrame = savedCAF;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).performance = savedPerf;
}

// ── Constructor ───────────────────────────────────────

describe('CanvasRenderer constructor', () => {
  it('creates a renderer with a mock canvas', () => {
    const renderer = new CanvasRenderer(createMockCanvas());
    expect(renderer).toBeDefined();
  });

  it('throws when canvas context is null', () => {
    const canvas = {
      ...createMockCanvas(),
      getContext: () => null,
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement;
    expect(() => new CanvasRenderer(canvas)).toThrow('Failed to get 2D context');
  });

  it('accepts a custom DPR', () => {
    const renderer = new CanvasRenderer(createMockCanvas(), 2);
    expect(renderer).toBeDefined();
  });
});

// ── Stroke management ─────────────────────────────────

describe('CanvasRenderer stroke management', () => {
  let renderer: CanvasRenderer;
  beforeEach(() => { renderer = new CanvasRenderer(createMockCanvas()); });

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

// ── Effect management ─────────────────────────────────

describe('CanvasRenderer effect management', () => {
  let renderer: CanvasRenderer;
  beforeEach(() => { renderer = new CanvasRenderer(createMockCanvas()); });

  it('defaults to neon effect', () => {
    expect(renderer.getEffect()).toBe('neon');
  });

  it('setEffect changes the active effect', () => {
    renderer.setEffect('aurora');
    expect(renderer.getEffect()).toBe('aurora');
  });
});

// ── Render loop — basic ──────────────────────────────

describe('CanvasRenderer render loop — basic', () => {
  beforeEach(setupRafMocks);
  afterEach(teardownRafMocks);

  it('start schedules a frame via requestAnimationFrame', () => {
    const renderer = new CanvasRenderer(createMockCanvas());
    renderer.start();
    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  it('start is idempotent (no double scheduling)', () => {
    const renderer = new CanvasRenderer(createMockCanvas());
    renderer.start();
    renderer.start();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('stop cancels the animation frame', () => {
    const renderer = new CanvasRenderer(createMockCanvas());
    renderer.start();
    renderer.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('destroy stops the loop and clears strokes', () => {
    const renderer = new CanvasRenderer(createMockCanvas());
    renderer.start();
    renderer.addCompletedStroke(makeStroke(5));
    renderer.destroy();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(renderer.getStrokeCount()).toBe(0);
  });
});

// ── Render loop — background ─────────────────────────

describe('CanvasRenderer render loop — background', () => {
  beforeEach(setupRafMocks);
  afterEach(teardownRafMocks);

  it('renderLoop clears and fills background when RAF fires', () => {
    const ctx = createMockCtx();
    const canvas = createMockCanvas(ctx);
    const renderer = new CanvasRenderer(canvas);
    renderer.addCompletedStroke(makeStroke(5));
    renderer.start();
    expect(rafCallback).not.toBeNull();
    rafCallback!(16);
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});

// ── Render loop — completed strokes ──────────────────

describe('CanvasRenderer render loop — completed strokes', () => {
  beforeEach(setupRafMocks);
  afterEach(teardownRafMocks);

  it('renderLoop renders completed strokes with effects', () => {
    const ctx = createMockCtx();
    const canvas = createMockCanvas(ctx);
    const renderer = new CanvasRenderer(canvas);
    renderer.addCompletedStroke(makeStroke(5));
    renderer.start();
    rafCallback!(16);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('renderLoop skips strokes with fewer than 2 points', () => {
    const ctx = createMockCtx();
    const canvas = createMockCanvas(ctx);
    const renderer = new CanvasRenderer(canvas);
    renderer.addCompletedStroke(makeStroke(1));
    renderer.start();
    rafCallback!(16);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

// ── Render loop — active points ──────────────────────

describe('CanvasRenderer render loop — active points', () => {
  beforeEach(setupRafMocks);
  afterEach(teardownRafMocks);

  it('renderLoop renders active points when source is set', () => {
    const ctx = createMockCtx();
    const canvas = createMockCanvas(ctx);
    const renderer = new CanvasRenderer(canvas);
    const pts: StrokePoint[] = [
      { x: 10, y: 20, t: 0, pressure: 0.5 },
      { x: 30, y: 40, t: 16, pressure: 0.6 },
    ];
    renderer.setActivePointsSource(() => pts);
    renderer.start();
    rafCallback!(16);
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('renderLoop handles empty active points without error', () => {
    const ctx = createMockCtx();
    const canvas = createMockCanvas(ctx);
    const renderer = new CanvasRenderer(canvas);
    renderer.setActivePointsSource(() => []);
    renderer.start();
    expect(() => rafCallback!(16)).not.toThrow();
  });
});

// ── Active points source ──────────────────────────────

describe('CanvasRenderer active points source', () => {
  it('setActivePointsSource sets the callback', () => {
    const renderer = new CanvasRenderer(createMockCanvas());
    const pts: StrokePoint[] = [{ x: 10, y: 20, t: 0, pressure: 0.5 }];
    expect(() => renderer.setActivePointsSource(() => pts)).not.toThrow();
  });
});
