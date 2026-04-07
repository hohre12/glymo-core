// ── Layer 30: Active Stroke ──────────────────────────

import type { EffectStyle, StrokePoint } from '../../types.js';

/**
 * Render the stroke currently being drawn.
 *
 * Single point: small glowing dot. Two+ points: single-pass glow + core stroke.
 */
export function renderActiveStroke(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<StrokePoint>,
  style: EffectStyle,
): void {
  if (points.length === 0) return;

  if (points.length === 1) {
    // Single point: draw as a small glowing dot using the preset color
    const pt = points[0]!;
    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, style.minWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = style.color;
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = style.glowSize * 0.3;
    ctx.fill();
    ctx.restore();
    return;
  }

  // Two or more points: render a live single-pass glow + main stroke for performance
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Single shadow glow pass
  ctx.shadowColor = style.glowColor;
  ctx.shadowBlur = style.glowSize * 0.6;
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = style.glowColor;
  ctx.lineWidth = style.maxWidth;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.stroke();

  // Core stroke on top
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.minWidth;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.stroke();

  ctx.restore();
}
