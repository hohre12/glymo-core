// ── Layer 0: Background ──────────────────────────────

/** Background color */
const BG_COLOR = '#000000';

/**
 * Render background layer.
 *
 * In 'solid' mode, fills with black. In 'transparent' mode, only clears.
 */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: 'solid' | 'transparent',
): void {
  ctx.clearRect(0, 0, w, h);
  if (mode === 'solid') {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);
  }
  // 'transparent' mode: clearRect is sufficient — no fill
}
