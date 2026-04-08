import type { EffectStyle, StrokePoint } from '../types.js';
import { lerpGradient } from '../util/math.js';

// ── Per-stroke override options ─────────────────────

/** Optional per-stroke overrides that take precedence over EffectStyle */
export interface StrokeOverrides {
  customColor?: string;   // Solid color override (replaces gradient + base color)
  customWidth?: number;   // Fixed width override (ignores pressure)
}

// ── Hex-to-glow helper ─────────────────────────────

/** Convert a hex color like #ff0000 to an rgba string with 0.7 alpha for glow use */
function hexToGlowColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.7)`;
}

// ── Stroke Rendering Helpers ────────────────────────

/**
 * Render the glow pass using a single-pass approach for performance.
 *
 * Single shadow draw: one wide semi-transparent stroke with shadowBlur.
 * Replaces the previous 3-pass approach which was too expensive at 60fps.
 *
 * @param intensityScale — default 1.0; pass > 1.0 during morph for extra brightness
 * @param overrides — optional per-stroke color/width overrides
 */
export function renderGlowPass(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: StrokePoint[],
  style: EffectStyle,
  intensityScale: number = 1.0,
  overrides?: StrokeOverrides,
): void {
  if (points.length < 2) return;

  const glowColor = overrides?.customColor != null
    ? hexToGlowColor(overrides.customColor)
    : style.glowColor;
  const lineWidth = overrides?.customWidth != null
    ? overrides.customWidth * 1.2
    : style.maxWidth * 1.2;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.7 * Math.min(intensityScale, 2.0);
  ctx.strokeStyle = glowColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = style.glowSize * intensityScale;
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Render the main stroke with per-segment variable-width and optional gradient.
 *
 * @param overrides — optional per-stroke color/width overrides
 */
export function renderMainStroke(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: StrokePoint[],
  style: EffectStyle,
  overrides?: StrokeOverrides,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1.0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const width = overrides?.customWidth != null
      ? overrides.customWidth
      : computeStrokeWidth(curr.pressure, style);
    const color = overrides?.customColor != null
      ? overrides.customColor
      : computeSegmentColor(i, points.length, style);

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
}

// ── Helpers ─────────────────────────────────────────

/** Compute stroke width from pressure and effect style */
function computeStrokeWidth(pressure: number, style: EffectStyle): number {
  return style.minWidth + pressure * (style.maxWidth - style.minWidth);
}

/** Compute segment color using gradient or solid color */
function computeSegmentColor(
  index: number,
  totalPoints: number,
  style: EffectStyle,
): string {
  if (!style.gradient) return style.color;
  const t = totalPoints > 1 ? index / (totalPoints - 1) : 0;
  return lerpGradient(style.gradient, t);
}
