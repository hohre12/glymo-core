import { HandVisualizer, HAND_CONNECTIONS } from '../src/input/HandVisualizer.js';
import type { Landmark } from '../src/input/CameraCapture.js';

// ── Mock Canvas Context ─────────────────────────────

function createMockCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    transform: vi.fn(),
    resetTransform: vi.fn(),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    textAlign: '' as CanvasTextAlign,
    font: '',
    shadowBlur: 0,
    shadowColor: '',
    globalAlpha: 1,
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

    // NeonSkeletonStyle draws connections in two passes:
    // drawBoneGlow (glow pass) + drawBones (solid pass), each with 23 connections.
    // Plus 1 moveTo in drawPinchArc (the pinch indicator arc/line).
    // Total moveTo: 23 (glow) + 23 (bones) + 1 (pinch) = 47.
    const connectionCount = HAND_CONNECTIONS.length;
    expect(ctx.moveTo).toHaveBeenCalledTimes(
      connectionCount * 2 + 1, // two bone passes + pinch arc
    );
  });

  it('draws joints and fingertip circles for each landmark', () => {
    const landmarks = makeLandmarks();
    viz.draw(landmarks, false);

    // NeonSkeletonStyle arc breakdown (21 landmarks, 5 fingertips, 16 joints):
    //   drawJoints:     16 joints × 2 arcs (outer ring + inner dot) = 32
    //   drawFingerTips:  5 tips   × 3 arcs (glow + ring + center)   = 15
    //   drawIndexCursor: 1 arc (gradient fill circle)                =  1
    //   Total = 48
    expect(ctx.arc).toHaveBeenCalledTimes(48);
  });

  it('draws fingertip glow with radial gradient', () => {
    const landmarks = makeLandmarks();
    viz.draw(landmarks, true);

    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });

  it('uses different colors for pinch active vs inactive', () => {
    const landmarks = makeLandmarks();

    // Both active and inactive paths must invoke stroke at least once.
    viz.draw(landmarks, true);
    expect(ctx.stroke).toHaveBeenCalled();

    ctx.stroke.mockClear();
    viz.draw(landmarks, false);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('applies dashed line for inactive pinch indicator', () => {
    const landmarks = makeLandmarks();
    viz.draw(landmarks, false);

    // NeonSkeletonStyle uses [3, 5] for inactive dashed arc, then [] to reset.
    expect(ctx.setLineDash).toHaveBeenCalledWith([3, 5]);
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
  });

  it('applies solid line for active pinch indicator (no dashed dash)', () => {
    const landmarks = makeLandmarks();
    viz.draw(landmarks, true);

    // When pinching, setLineDash is never called (no dashed lines in active path).
    expect(ctx.setLineDash).not.toHaveBeenCalled();
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
    // The index cursor glow arc (drawIndexCursor) is drawn at the mirrored x.
    const arcCalls = ctx.arc.mock.calls as number[][];
    const glowCall = arcCalls.find(
      (call) => Math.abs(call[0]! - 448) < 1,
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
