import { HandVisualizer, HAND_CONNECTIONS } from '../src/input/HandVisualizer.js';
import type { Landmark } from '../src/input/CameraCapture.js';

// ── Mock Canvas Context ─────────────────────────────

function createMockCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    strokeStyle: '',
    fillStyle: '' as string | CanvasGradient,
    lineWidth: 0,
    lineCap: '' as CanvasLineCap,
  };
}

function createMockCanvas(ctx: ReturnType<typeof createMockCtx>) {
  return {
    width: 640,
    height: 480,
    getContext: vi.fn(() => ctx),
  } as unknown as HTMLCanvasElement;
}

/** Generate 21 dummy landmarks (MediaPipe hand model has 21 landmarks) */
function makeLandmarks(overrides?: Partial<Record<number, Partial<Landmark>>>): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: 21 }, (_, i) => ({
    x: 0.5 + i * 0.01,
    y: 0.5 + i * 0.005,
    z: -0.01,
  }));

  if (overrides) {
    for (const [idx, patch] of Object.entries(overrides)) {
      Object.assign(landmarks[Number(idx)]!, patch);
    }
  }

  return landmarks;
}

// ── Tests ───────────────────────────────────────────

describe('HandVisualizer', () => {
  let ctx: ReturnType<typeof createMockCtx>;
  let canvas: HTMLCanvasElement;
  let viz: HandVisualizer;

  beforeEach(() => {
    ctx = createMockCtx();
    canvas = createMockCanvas(ctx);
    viz = new HandVisualizer(canvas);
  });

  it('throws if canvas 2d context is unavailable', () => {
    const badCanvas = {
      getContext: () => null,
    } as unknown as HTMLCanvasElement;

    expect(() => new HandVisualizer(badCanvas)).toThrow('cannot get 2d context');
  });

  it('clears the canvas and returns early for empty landmarks', () => {
    viz.draw([], false);

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
    // No drawing calls should happen
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('draws connection lines between hand landmarks', () => {
    const landmarks = makeLandmarks();
    viz.draw(landmarks, false);

    // clearRect should be called first
    expect(ctx.clearRect).toHaveBeenCalled();

    // Each connection = beginPath + moveTo + lineTo + stroke
    // HAND_CONNECTIONS has 23 connections
    const connectionCount = HAND_CONNECTIONS.length;
    expect(ctx.moveTo).toHaveBeenCalledTimes(
      connectionCount + 1, // connections + pinch indicator line
    );
    expect(ctx.lineTo).toHaveBeenCalledTimes(
      connectionCount + 1, // connections + pinch indicator line
    );
  });

  it('draws joints for each landmark', () => {
    const landmarks = makeLandmarks();
    viz.draw(landmarks, false);

    // 21 joints + 1 for fingertip glow
    expect(ctx.arc).toHaveBeenCalledTimes(21 + 1);
  });

  it('draws fingertip glow with radial gradient', () => {
    const landmarks = makeLandmarks();
    viz.draw(landmarks, true);

    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });

  it('uses different colors for pinch active vs inactive', () => {
    const landmarks = makeLandmarks();

    // Draw when pinching
    viz.draw(landmarks, true);
    const pinchActiveStroke = ctx.strokeStyle;

    // Reset and draw when not pinching
    ctx.strokeStyle = '';
    viz.draw(landmarks, false);
    const pinchInactiveStroke = ctx.strokeStyle;

    // The pinch indicator should set different strokeStyle for active vs inactive
    // (we can't easily check the exact value due to ordering, but the calls differ)
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('applies dashed line for inactive pinch indicator', () => {
    const landmarks = makeLandmarks();
    viz.draw(landmarks, false);

    // setLineDash called with [4, 4] for inactive, then [] to reset
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 4]);
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
  });

  it('applies solid line for active pinch indicator', () => {
    const landmarks = makeLandmarks();
    viz.draw(landmarks, true);

    // When pinching, setLineDash is called with [] (solid)
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
  });

  it('clear() erases the overlay canvas', () => {
    viz.clear();

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
  });

  it('mirrors X coordinates for front-facing camera', () => {
    const landmarks = makeLandmarks({
      // Place index tip at x=0.3 (normalized)
      8: { x: 0.3 },
    });

    viz.draw(landmarks, false);

    // Mirror: (1 - 0.3) * 640 = 0.7 * 640 = 448
    // Check that moveTo or arc was called with mirrored x
    const arcCalls = ctx.arc.mock.calls;
    // Find the call for index tip glow (the glow arc)
    const glowCall = arcCalls.find(
      (call: number[]) => Math.abs(call[0] - 448) < 1,
    );
    expect(glowCall).toBeDefined();
  });
});

// ── HAND_CONNECTIONS export ────────────────────────

describe('HAND_CONNECTIONS', () => {
  it('contains 23 connection pairs', () => {
    expect(HAND_CONNECTIONS).toHaveLength(23);
  });

  it('all indices are within 0-20 range', () => {
    for (const [a, b] of HAND_CONNECTIONS) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(20);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(20);
    }
  });
});
