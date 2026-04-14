import { EffectStyle, StrokePoint } from '../../types.js';
/**
 * Render the stroke currently being drawn.
 *
 * Single point: small glowing dot. Two+ points: single-pass glow + core stroke.
 */
export declare function renderActiveStroke(ctx: CanvasRenderingContext2D, points: ReadonlyArray<StrokePoint>, style: EffectStyle): void;
