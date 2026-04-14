import { Point } from '../types.js';
import { PositionedChar } from './types.js';
/**
 * Position characters along a stroke path, with rotation aligned
 * to the tangent at each placement point.
 *
 * Characters are spaced at equal arc-length intervals along the path.
 */
export declare function layoutTextAlongCurve(text: string, strokePath: Point[], fontSize?: number): PositionedChar[];
/**
 * Position characters evenly around a circle.
 */
export declare function layoutTextInCircle(text: string, center: Point, radius: number, startAngle?: number): PositionedChar[];
/**
 * Distribute text lines within a closed stroke path.
 *
 * Uses @chenglou/pretext for proper line-breaking (word boundaries,
 * CJK keep-all, Unicode graphemes), then positions each line's characters
 * within the shape using scan-line polygon intersection for per-row width.
 */
export declare function layoutTextInShape(text: string, closedPath: Point[], fontSize?: number): PositionedChar[];
/**
 * Measure text dimensions using pretext (no DOM reflow).
 * Returns line count and total height for a given width constraint.
 */
export declare function measureText(text: string, font: string, maxWidth: number, lineHeight: number): {
    lineCount: number;
    height: number;
    lines: string[];
};
