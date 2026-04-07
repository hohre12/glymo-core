// ── Layer 25: Text Morph (FontMorphAnimator) ─────────

import type { MorphFrame } from '../../types.js';

/**
 * Render a FontMorphAnimator frame — connected glow path + per-segment main stroke.
 *
 * Gap detection: segments whose squared distance exceeds 400 (20 px) start a new sub-path.
 */
export function renderTextMorph(
  ctx: CanvasRenderingContext2D,
  frame: MorphFrame,
): void {
  const points = frame.points;
  if (points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Glow pass — connected path with gap detection
  const firstPt = points[0]!;
  const avgAlpha = points.reduce((s, p) => s + p.alpha, 0) / points.length;
  const glowColor = `rgba(${firstPt.color.r},${firstPt.color.g},${firstPt.color.b},${avgAlpha * 0.6})`;

  ctx.globalAlpha = avgAlpha * 0.7;
  ctx.strokeStyle = glowColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(firstPt.x, firstPt.y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (dx * dx + dy * dy > 400) {
      ctx.moveTo(curr.x, curr.y);
    } else {
      ctx.lineTo(curr.x, curr.y);
    }
  }
  ctx.stroke();

  // Main stroke pass — per-segment with per-point color and alpha
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 1.0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (dx * dx + dy * dy > 400) continue;

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.strokeStyle = `rgba(${curr.color.r},${curr.color.g},${curr.color.b},${curr.alpha})`;
    ctx.lineWidth = curr.size * 1.5;
    ctx.stroke();
  }

  ctx.restore();
}
