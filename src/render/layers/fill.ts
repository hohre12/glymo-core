// ── Layer: Fills (below strokes) ─────────────────────

import type { Fill } from '../../types.js';

/** Render all fill bitmaps onto the canvas */
export function renderFills(
  ctx: CanvasRenderingContext2D,
  fills: readonly Fill[],
): void {
  for (const fill of fills) {
    ctx.drawImage(fill.bitmap, 0, 0);
  }
}
