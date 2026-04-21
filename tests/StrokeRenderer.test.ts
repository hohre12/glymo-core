import { renderGlowPass, renderMainStroke } from '../src/render/StrokeRenderer.js';
import type { EffectStyle, StrokePoint } from '../src/types.js';
import { EFFECT_PRESETS } from '../src/types.js';

const mockFn = vi.fn;

// ── Helpers ────────────────────────────────────────────

function createMockCtx() {
  return {
    save: mockFn(),
    restore: mockFn(),
    beginPath: mockFn(),
    moveTo: mockFn(),
    lineTo: mockFn(),
    stroke: mockFn(),
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'round' as CanvasLineCap,
    lineJoin: 'round' as CanvasLineJoin,
  } as unknown as CanvasRenderingContext2D;
}

function makePoints(count: number): StrokePoint[] {
  return Array.from({ length: count }, (_, i) => ({
    x: i * 10,
    y: i * 5,
    t: i * 16,
    pressure: 0.3 + (i / count) * 0.5,
  }));
}

const neonStyle: EffectStyle = EFFECT_PRESETS['neon'];

// ── renderGlowPass ────────────────────────────────────

describe('renderGlowPass', () => {
  it('calls save and restore on the context', () => {
    const ctx = createMockCtx();
    renderGlowPass(ctx, makePoints(3), neonStyle);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('sets shadowColor and shadowBlur from style', () => {
    const ctx = createMockCtx();
    renderGlowPass(ctx, makePoints(3), neonStyle);
    expect(ctx.shadowColor).toBe(neonStyle.glowColor);
    expect(ctx.shadowBlur).toBe(neonStyle.glowSize);
  });

  it('draws a path with beginPath, moveTo, lineTo, stroke', () => {
    const ctx = createMockCtx();
    const pts = makePoints(4);
    renderGlowPass(ctx, pts, neonStyle);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(pts[0]!.x, pts[0]!.y);
    expect(ctx.lineTo).toHaveBeenCalledTimes(3);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  // globalAlpha changed from 0.6 → 0.7 in commit e38bb96
  // ("feat: drawing mode tools, SpatialGrouper, Fill, recognition-based text split"),
  // rationale: "Fix animation memory leaks, glow transparency, morph timing".
  // Deliberate UX improvement — brighter glow pass for better visual quality.
  it('sets globalAlpha to 0.7 for glow (raised from 0.6 in commit e38bb96)', () => {
    const ctx = createMockCtx();
    renderGlowPass(ctx, makePoints(2), neonStyle);
    expect(ctx.globalAlpha).toBe(0.7);
  });
});

// ── renderMainStroke ──────────────────────────────────

describe('renderMainStroke', () => {
  it('calls save and restore on the context', () => {
    const ctx = createMockCtx();
    renderMainStroke(ctx, makePoints(3), neonStyle);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('draws one segment per pair of consecutive points', () => {
    const ctx = createMockCtx();
    const pts = makePoints(5);
    renderMainStroke(ctx, pts, neonStyle);
    // 5 points → 4 segments, each with beginPath + moveTo + lineTo + stroke
    expect(ctx.beginPath).toHaveBeenCalledTimes(4);
    expect(ctx.stroke).toHaveBeenCalledTimes(4);
  });

  it('applies variable lineWidth based on pressure', () => {
    const ctx = createMockCtx();
    const widths: number[] = [];
    Object.defineProperty(ctx, 'lineWidth', {
      set(v: number) { widths.push(v); },
      get() { return widths[widths.length - 1] ?? 1; },
    });
    renderMainStroke(ctx, makePoints(3), neonStyle);
    expect(widths.length).toBe(2);
    // Width = minWidth + pressure * (maxWidth - minWidth), should vary
    expect(widths[0]).toBeGreaterThan(0);
  });

  it('uses solid color when gradient is null', () => {
    const ctx = createMockCtx();
    const calligraphyStyle = EFFECT_PRESETS['calligraphy'];
    const colors: string[] = [];
    Object.defineProperty(ctx, 'strokeStyle', {
      set(v: string) { colors.push(v); },
      get() { return colors[colors.length - 1] ?? ''; },
    });
    renderMainStroke(ctx, makePoints(3), calligraphyStyle);
    expect(colors.every((c) => c === calligraphyStyle.color)).toBe(true);
  });
});
