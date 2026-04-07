// ── Layer 27: Overlay Text ───────────────────────────

import type { OverlayText } from '../../text/types.js';

/**
 * Render overlay text labels with fade-in and glow effect.
 *
 * Text is scaled to fit the stroke bounding box (capped at 3x).
 */
export function renderOverlayText(
  ctx: CanvasRenderingContext2D,
  overlayTexts: readonly OverlayText[],
  now: number,
): void {
  if (overlayTexts.length === 0) return;

  for (const overlay of overlayTexts) {
    const elapsed = now - overlay.startTime;
    const alpha = Math.min(1, elapsed / overlay.fadeDuration);

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.font = overlay.font;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const metrics = ctx.measureText(overlay.text);
    const textWidth = metrics.width;
    const textHeight = metrics.actualBoundingBoxDescent ?? 72;

    // Scale text to fit stroke bounding box
    const scaleX = overlay.width / Math.max(textWidth, 1);
    const scaleY = overlay.height / Math.max(textHeight, 1);
    const scale = Math.min(scaleX, scaleY, 3);

    const cx = overlay.x + overlay.width / 2;
    const cy = overlay.y + overlay.height / 2;

    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-textWidth / 2, -textHeight / 2);

    // Glow pass
    const glowIntensity = 0.5 + alpha * 0.5;
    ctx.shadowColor = overlay.glowColor;
    ctx.shadowBlur = overlay.glowSize * glowIntensity;
    ctx.fillStyle = overlay.effectColor;
    ctx.fillText(overlay.text, 0, 0);

    // Crisp pass on top
    ctx.shadowBlur = 0;
    ctx.fillText(overlay.text, 0, 0);

    ctx.restore();
  }
}
