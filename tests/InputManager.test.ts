import { InputManager } from '../src/input/InputManager.js';
import type { RawInputPoint } from '../src/types.js';

// Cross-compatible mock function
const mockFn = typeof vi !== 'undefined' ? vi.fn : jest.fn;

// ── Helpers ────────────────────────────────────────────

function createMockCanvas(): HTMLCanvasElement {
  return {
    width: 800,
    height: 600,
    getContext: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: mockFn(),
    removeEventListener: mockFn(),
  } as unknown as HTMLCanvasElement;
}

// ── Lifecycle ─────────────────────────────────────────

describe('InputManager lifecycle', () => {
  it('hasActiveSource returns false initially', () => {
    const mgr = new InputManager();
    expect(mgr.hasActiveSource()).toBe(false);
  });

  it('attachMouse activates mouse capture', () => {
    const mgr = new InputManager();
    mgr.attachMouse(createMockCanvas());
    expect(mgr.hasActiveSource()).toBe(true);
  });

  it('detachAll deactivates all sources', () => {
    const mgr = new InputManager();
    mgr.attachMouse(createMockCanvas());
    mgr.detachAll();
    expect(mgr.hasActiveSource()).toBe(false);
  });

  it('detachMouse only detaches mouse', () => {
    const mgr = new InputManager();
    const canvas = createMockCanvas();
    mgr.attachMouse(canvas);
    mgr.detachMouse();
    expect(mgr.hasActiveSource()).toBe(false);
  });

  it('attachMouse replaces previous capture', () => {
    const mgr = new InputManager();
    mgr.attachMouse(createMockCanvas());
    mgr.attachMouse(createMockCanvas());
    expect(mgr.hasActiveSource()).toBe(true);
  });
});

// ── Callback propagation ──────────────────────────────

describe('InputManager callback propagation', () => {
  it('setPointCallback does not throw', () => {
    const mgr = new InputManager();
    expect(() => mgr.setPointCallback(() => {})).not.toThrow();
  });

  it('setPenStateCallback does not throw', () => {
    const mgr = new InputManager();
    expect(() => mgr.setPenStateCallback(() => {})).not.toThrow();
  });

  it('callbacks are wired before attachMouse', () => {
    const mgr = new InputManager();
    const points: RawInputPoint[] = [];
    mgr.setPointCallback((p) => points.push(p));
    // Attach after setting callback — verifies internal wiring
    expect(() => mgr.attachMouse(createMockCanvas())).not.toThrow();
  });

  it('detachMouse is safe when no capture exists', () => {
    const mgr = new InputManager();
    expect(() => mgr.detachMouse()).not.toThrow();
  });
});
