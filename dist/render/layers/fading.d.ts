import { Stroke } from '../../types.js';
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
export declare function renderFadingStrokes(ctx: CanvasRenderingContext2D, fadingStrokes: FadingStroke[], now: number): FadingStroke[];
