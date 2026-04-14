import { Point, RGB } from '../types.js';
/** Clamp a value between min and max */
export declare function clamp(value: number, min: number, max: number): number;
/** Euclidean distance between two points */
export declare function distance(a: Point, b: Point): number;
/** Convert hex color string to RGB object */
export declare function hexToRgb(hex: string): RGB;
/**
 * Interpolate along a multi-stop gradient at position t (0..1).
 * Returns a CSS rgb() color string.
 */
export declare function lerpGradient(colors: string[], t: number): string;
/** Compute axis-aligned bounding box for a set of points */
export declare function computeBounds(points: ReadonlyArray<{
    x: number;
    y: number;
}>): {
    x: number;
    y: number;
    width: number;
    height: number;
};
/**
 * Resample points to targetCount via uniform arc-length interpolation.
 * Preserves start and end points exactly.
 */
export declare function resamplePoints(points: Point[], targetCount: number): Point[];
