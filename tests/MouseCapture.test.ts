import { MouseCapture } from '../src/input/MouseCapture.js';
import type { RawInputPoint } from '../src/types.js';

// Cross-compatible mock function
const mockFn = typeof vi !== 'undefined' ? vi.fn : jest.fn;

// ── Helpers ────────────────────────────────────────────

type Listener = (e: unknown) => void;

function createMockCanvas() {
  const listeners: Record<string, Listener[]> = {};
  return {
    addEventListener: mockFn().mockImplementation((event: string, handler: Listener) => {
      (listeners[event] ??= []).push(handler);
    }),
    removeEventListener: mockFn().mockImplementation((event: string, handler: Listener) => {
      const arr = listeners[event];
      if (arr) {
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
      }
    }),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 600 }),
    width: 800,
    height: 600,
    _listeners: listeners,
    _fire(event: string, data: unknown) {
      for (const fn of listeners[event] ?? []) fn(data);
    },
  } as unknown as HTMLCanvasElement & { _listeners: Record<string, Listener[]>; _fire: (e: string, d: unknown) => void };
}

function makePointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return {
    clientX: 110,
    clientY: 120,
    pressure: 0.7,
    pointerType: 'mouse',
    ...overrides,
  } as unknown as PointerEvent;
}

// ── Shared globalThis mock setup ─────────────────────

const savedPerf = globalThis.performance;
const savedWindow = typeof window !== 'undefined' ? window : undefined;

function setupGlobalMocks(dpr: number = 2, perfNow: number = 1000) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).performance = { now: () => perfNow };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = { devicePixelRatio: dpr };
}

function teardownGlobalMocks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).performance = savedPerf;
  if (savedWindow !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = savedWindow;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
  }
}

// ── attach / detach ───────────────────────────────────

describe('MouseCapture attach/detach', () => {
  it('start binds 4 pointer event listeners', () => {
    const canvas = createMockCanvas();
    const capture = new MouseCapture(() => {}, () => {});
    capture.start(canvas);
    expect(canvas.addEventListener).toHaveBeenCalledTimes(4);
  });

  it('stop removes all pointer event listeners', () => {
    const canvas = createMockCanvas();
    const capture = new MouseCapture(() => {}, () => {});
    capture.start(canvas);
    capture.stop();
    expect(canvas.removeEventListener).toHaveBeenCalledTimes(4);
  });

  it('isActive returns true after start', () => {
    const capture = new MouseCapture(() => {}, () => {});
    capture.start(createMockCanvas());
    expect(capture.isActive()).toBe(true);
  });

  it('isActive returns false after stop', () => {
    const capture = new MouseCapture(() => {}, () => {});
    capture.start(createMockCanvas());
    capture.stop();
    expect(capture.isActive()).toBe(false);
  });

  it('start is idempotent when already active', () => {
    const canvas = createMockCanvas();
    const capture = new MouseCapture(() => {}, () => {});
    capture.start(canvas);
    capture.start(canvas);
    expect(canvas.addEventListener).toHaveBeenCalledTimes(4);
  });

  it('stop is safe when not started', () => {
    const capture = new MouseCapture(() => {}, () => {});
    expect(() => capture.stop()).not.toThrow();
  });
});

// ── Pointer events — basic ───────────────────────────

describe('MouseCapture pointer events — basic', () => {
  beforeEach(() => setupGlobalMocks(2, 1000));
  afterEach(teardownGlobalMocks);

  it('pointerdown emits a point and pen state true', () => {
    const points: RawInputPoint[] = [];
    const penStates: boolean[] = [];
    const canvas = createMockCanvas();
    const capture = new MouseCapture(
      (p) => points.push(p),
      (s) => penStates.push(s),
    );
    capture.start(canvas);
    canvas._fire('pointerdown', makePointerEvent());
    expect(penStates).toEqual([true]);
    expect(points).toHaveLength(1);
  });

  it('pointermove emits points only while pointer is down', () => {
    const points: RawInputPoint[] = [];
    const canvas = createMockCanvas();
    const capture = new MouseCapture((p) => points.push(p), () => {});
    capture.start(canvas);
    canvas._fire('pointermove', makePointerEvent());
    expect(points).toHaveLength(0);
    canvas._fire('pointerdown', makePointerEvent());
    canvas._fire('pointermove', makePointerEvent({ clientX: 200, clientY: 200 }));
    expect(points).toHaveLength(2);
  });

  it('pointerup emits pen state false', () => {
    const penStates: boolean[] = [];
    const canvas = createMockCanvas();
    const capture = new MouseCapture(() => {}, (s) => penStates.push(s));
    capture.start(canvas);
    canvas._fire('pointerdown', makePointerEvent());
    canvas._fire('pointerup', makePointerEvent());
    expect(penStates).toEqual([true, false]);
  });

  it('pointerup without prior down does not emit', () => {
    const penStates: boolean[] = [];
    const canvas = createMockCanvas();
    const capture = new MouseCapture(() => {}, (s) => penStates.push(s));
    capture.start(canvas);
    canvas._fire('pointerup', makePointerEvent());
    expect(penStates).toHaveLength(0);
  });
});

// ── Pointer events — DPR and edge cases ──────────────

describe('MouseCapture pointer events — DPR and edge cases', () => {
  beforeEach(() => setupGlobalMocks(3, 500));
  afterEach(teardownGlobalMocks);

  it('coordinates are scaled by device pixel ratio', () => {
    const points: RawInputPoint[] = [];
    const canvas = createMockCanvas();
    const capture = new MouseCapture((p) => points.push(p), () => {});
    capture.start(canvas);
    canvas._fire('pointerdown', makePointerEvent({ clientX: 110, clientY: 120 }));
    expect(points[0]!.x).toBe(100 * 3); // (110-10) * 3
    expect(points[0]!.y).toBe(100 * 3); // (120-20) * 3
  });

  it('touch pointer type sets source to touch', () => {
    const points: RawInputPoint[] = [];
    const canvas = createMockCanvas();
    const capture = new MouseCapture((p) => points.push(p), () => {});
    capture.start(canvas);
    canvas._fire('pointerdown', makePointerEvent({ pointerType: 'touch' }));
    expect(points[0]!.source).toBe('touch');
  });
});
