// ── Layer 20: Morphing Stroke ─────────────────────────

import type { EffectPresetName, StrokePoint } from '../../types.js';
import { EFFECT_PRESETS } from '../../types.js';
import { renderGlowPass, renderMainStroke } from '../StrokeRenderer.js';

/** Data needed to drive the morph render pass */
export interface MorphRenderData {
  /** The morph effect preset name */
  effect: EffectPresetName;
  /** Current interpolated points from the animator */
  points: StrokePoint[];
  /** Animation progress 0..1 */
  progress: number;
}

/**
 * Render a morph animation frame.
 *
 * Glow intensification peaks at 2.0x at the midpoint of the animation.
 */
export function renderMorphingStroke(
  ctx: CanvasRenderingContext2D,
  data: MorphRenderData,
): void {
  const { effect, points, progress } = data;
  if (points.length < 2) return;

  // Glow intensification: peaks at 2.0 at the midpoint of the animation
  const intensityScale = 1.0 + Math.sin(progress * Math.PI) * 1.0;

  const style = EFFECT_PRESETS[effect];
  renderGlowPass(ctx, points, style, intensityScale);
  renderMainStroke(ctx, points, style);
}
