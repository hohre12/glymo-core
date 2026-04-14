import { EffectStyle, StrokePoint } from '../types.js';
/** Optional per-stroke overrides that take precedence over EffectStyle */
export interface StrokeOverrides {
    customColor?: string;
    customWidth?: number;
}
/**
 * Render the glow pass using a single-pass approach for performance.
 *
 * Single shadow draw: one wide semi-transparent stroke with shadowBlur.
 * Replaces the previous 3-pass approach which was too expensive at 60fps.
 *
 * @param intensityScale — default 1.0; pass > 1.0 during morph for extra brightness
 * @param overrides — optional per-stroke color/width overrides
 */
export declare function renderGlowPass(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, points: StrokePoint[], style: EffectStyle, intensityScale?: number, overrides?: StrokeOverrides): void;
/**
 * Render the main stroke with per-segment variable-width and optional gradient.
 *
 * @param overrides — optional per-stroke color/width overrides
 */
export declare function renderMainStroke(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, points: StrokePoint[], style: EffectStyle, overrides?: StrokeOverrides): void;
