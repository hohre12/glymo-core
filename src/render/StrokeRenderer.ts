import type { EffectStyle, StrokePoint } from '../types.js';
import { lerpGradient } from '../util/math.js';

// ── Stroke Rendering Helpers ────────────────────────

/**
 * Render the glow pass using a single-pass approach for performance.
 *
 * Single shadow draw: one wide semi-transparent stroke with shadowBlur.
 * Replaces the previous 3-pass approach which was too expensive at 60fps.
 *
 * @param intensityScale — default 1.0; pass > 1.0 during morph for extra brightness
 */
export function renderGlowPass(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: StrokePoint[],
  style: EffectStyle,
  intensityScale: number = 1.0,
): void {
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.7 * Math.min(intensityScale, 2.0);
  ctx.strokeStyle = style.glowColor;
  ctx.shadowColor = style.glowColor;
  ctx.shadowBlur = style.glowSize * intensityScale;
  ctx.lineWidth = style.maxWidth * 1.2;

  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Render the main stroke with per-segment variable-width and optional gradient */
export function renderMainStroke(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: StrokePoint[],
  style: EffectStyle,
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
    const width = computeStrokeWidth(curr.pressure, style);
    const color = computeSegmentColor(i, points.length, style);

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
