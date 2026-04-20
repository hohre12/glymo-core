import { ParticleSystem } from '../src/render/ParticleSystem.js';
import type { Stroke, StrokePoint } from '../src/types.js';

// Cross-compatible mock function
const mockFn = typeof vi !== 'undefined' ? vi.fn : jest.fn;

// ── Helpers ────────────────────────────────────────────

function makeStroke(pointCount: number): Stroke {
  const pts: StrokePoint[] = Array.from({ length: pointCount }, (_, i) => ({
    x: i * 10,
    y: i * 5,
    t: i * 16,
    pressure: 0.5,
  }));
  return {
    id: 'test-stroke',
    raw: pts,
    smoothed: pts,
    state: 'effected',
    effect: 'neon',
    createdAt: Date.now(),
  };
}

function createMockCtx() {
  return {
    save: mockFn(),
    restore: mockFn(),
    beginPath: mockFn(),
    arc: mockFn(),
    fill: mockFn(),
    globalAlpha: 1,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

// ── Spawn ─────────────────────────────────────────────

describe('ParticleSystem spawn', () => {
  it('spawnForStroke creates particles from a stroke', () => {
    const ps = new ParticleSystem();
    ps.spawnForStroke(makeStroke(5));
    const ctx = createMockCtx();
    ps.updateAndRender(ctx, 16);
    // Particles are spawned → arc should have been called
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('clear removes all particles', () => {
    const ps = new ParticleSystem();
    ps.spawnForStroke(makeStroke(5));
    ps.clear();
    const ctx = createMockCtx();
    ps.updateAndRender(ctx, 16);
    // After clear no particles remain to draw
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

// ── Update ────────────────────────────────────────────

describe('ParticleSystem update', () => {
  it('particles decay over time and eventually disappear', () => {
    const ps = new ParticleSystem();
    ps.spawnForStroke(makeStroke(3));
    const ctx = createMockCtx();
    // Simulate many frames so all particles die
    for (let i = 0; i < 200; i++) {
      ps.updateAndRender(ctx, 16);
    }
    // After enough frames, no particles should remain
    const ctx2 = createMockCtx();
    ps.updateAndRender(ctx2, 16);
    expect(ctx2.arc).not.toHaveBeenCalled();
  });

  it('dt=0 does not crash', () => {
    const ps = new ParticleSystem();
    ps.spawnForStroke(makeStroke(2));
    const ctx = createMockCtx();
    expect(() => ps.updateAndRender(ctx, 0)).not.toThrow();
  });
});

// ── Render ────────────────────────────────────────────

describe('ParticleSystem render', () => {
  it('saves and restores context state', () => {
    const ps = new ParticleSystem();
    ps.spawnForStroke(makeStroke(3));
    const ctx = createMockCtx();
    ps.updateAndRender(ctx, 16);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('calls fill for each alive particle', () => {
    // Spawn formula (from ParticleSystem.ts constants):
    //   PARTICLES_PER_POINT = 4  (particles per interior point)
    //   ENDPOINT_BURST      = 15 (extra particles at stroke start + end)
    //
    // For a 3-point stroke:
    //   endpoint burst start : 15
    //   interior points loop : 3 × 4 = 12  (i=0,1,2 — all 3 points iterated)
    //   endpoint burst end   : 15
    //   Total alive after 1 frame (dt=16, all still alive): 15 + 12 + 15 = 42
    //
    // The previous assertion of 19 was wrong (based on old constants 3/5 that
    // never existed in the codebase — PARTICLES_PER_POINT was 4 and
    // ENDPOINT_BURST was 15 from the first commit, 29cd400).
    const ps = new ParticleSystem();
    ps.spawnForStroke(makeStroke(3));
    const ctx = createMockCtx();
    ps.updateAndRender(ctx, 16);
    expect(ctx.fill).toHaveBeenCalledTimes(42);
  });

  it('renders nothing when no strokes have been added', () => {
    const ps = new ParticleSystem();
    const ctx = createMockCtx();
    ps.updateAndRender(ctx, 16);
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});
