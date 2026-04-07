// ── Layer 10: Completed Strokes ──────────────────────

import type { Stroke } from '../../types.js';
import { EFFECT_PRESETS } from '../../types.js';
import { renderGlowPass, renderMainStroke } from '../StrokeRenderer.js';

/**
 * Re-render completed strokes into the offscreen cache when dirty,
 * then blit the cached bitmap onto the main canvas — O(1) per frame.
 *
 * Returns the updated dirty flag (always `false` after painting).
 */
export function renderCompletedStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
  cache: OffscreenCanvas | null,
  cacheCtx: OffscreenCanvasRenderingContext2D | null,
  dirty: boolean,
): boolean {
  // When dirty, re-render into the offscreen cache (even if strokes is empty —
  // this ensures the cache is cleared when all strokes are removed).
  if (dirty && cacheCtx && cache) {
    cacheCtx.clearRect(0, 0, cache.width, cache.height);
    for (const stroke of strokes) {
      if (stroke.smoothed.length < 2) continue;
      const style = EFFECT_PRESETS[stroke.effect];
      renderGlowPass(cacheCtx, stroke.smoothed, style);
      renderMainStroke(cacheCtx, stroke.smoothed, style);
    }
    dirty = false;
  }

  // Blit cached bitmap onto the main canvas
  if (strokes.length > 0 && cache) {
    ctx.drawImage(cache, 0, 0);
  }

  return dirty;
}
