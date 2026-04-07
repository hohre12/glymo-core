// ── Layer 26: Fading Strokes ─────────────────────────

import type { Stroke } from '../../types.js';
import { EFFECT_PRESETS } from '../../types.js';
import { renderGlowPass, renderMainStroke } from '../StrokeRenderer.js';

/** A stroke that is fading out before removal */
export interface FadingStroke {
  stroke: Stroke;
  fadeStart: number;
  fadeDuration: number;
}

/**
 * Render fading strokes and return only the ones still alive.
 *
 * Each stroke is drawn with decreasing globalAlpha until its fade duration expires.
 */
export function renderFadingStrokes(
  ctx: CanvasRenderingContext2D,
  fadingStrokes: FadingStroke[],
  now: number,
): FadingStroke[] {
  return fadingStrokes.filter(({ stroke, fadeStart, fadeDuration }) => {
    const elapsed = now - fadeStart;
    if (elapsed >= fadeDuration) return false;

    const alpha = 1.0 - (elapsed / fadeDuration);
    const style = EFFECT_PRESETS[stroke.effect];
    ctx.save();
    ctx.globalAlpha = alpha;
    renderGlowPass(ctx, stroke.smoothed, style);
    renderMainStroke(ctx, stroke.smoothed, style);
    ctx.restore();
    return true;
  });
}
