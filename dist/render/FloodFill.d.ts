import { Stroke } from '../types.js';
/**
 * Create a stroke mask for flood fill boundary detection.
 * Renders all strokes as white on black, with gap closing via thicker lines.
 */
export declare function createStrokeMask(strokes: readonly Stroke[], width: number, height: number, gapCloseRadius?: number): OffscreenCanvas;
/**
 * Scanline flood fill algorithm.
 * Fast: processes entire horizontal spans at once.
 * Returns an ImageData with the fill (transparent elsewhere), or null if start point is on a boundary.
 */
export declare function scanlineFill(maskData: ImageData, startX: number, startY: number, fillColor: {
    r: number;
    g: number;
    b: number;
    a: number;
}): ImageData | null;
/**
 * High-level fill API: create mask, run scanline fill, return ImageBitmap.
 */
export declare function executeFill(strokes: readonly Stroke[], canvasWidth: number, canvasHeight: number, startX: number, startY: number, color: string, gapCloseRadius?: number): Promise<ImageBitmap | null>;
