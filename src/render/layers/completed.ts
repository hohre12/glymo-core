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
  if (strokes.length === 0) return dirty;

  // Re-render into the offscreen cache only when strokes have changed.
  // Every other frame we simply blit the cached bitmap — O(1) cost.
  if (dirty && cacheCtx && cache) {
    cacheCtx.clearRect(0, 0, cache.width, cache.height);
    for (const stroke of strokes) {
      if (stroke.smoothed.length < 2) continue;
      const style = EFFECT_PRESETS[stroke.effect];
      renderGlowPass(cacheCtx as unknown as CanvasRenderingContext2D, stroke.smoothed, style);
      renderMainStroke(cacheCtx as unknown as CanvasRenderingContext2D, stroke.smoothed, style);
    }
    dirty = false;
  }

  if (cache) {
    ctx.drawImage(cache, 0, 0);
  }

  return dirty;
}
