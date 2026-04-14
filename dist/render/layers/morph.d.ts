import { EffectPresetName, StrokePoint } from '../../types.js';
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
export declare function renderMorphingStroke(ctx: CanvasRenderingContext2D, data: MorphRenderData): void;
