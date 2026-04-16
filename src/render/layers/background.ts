// ── Layer 0: Background ──────────────────────────────

/**
 * Render background layer.
 *
 * In 'solid' mode, fills with the given color. In 'transparent' mode, only clears.
 */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: 'solid' | 'transparent',
  color: string = '#000000',
): void {
  ctx.clearRect(0, 0, w, h);
  if (mode === 'solid') {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  }
  // 'transparent' mode: clearRect is sufficient — no fill
}
