import { Point } from '../types.js';
import { PositionedChar, LayoutMode, LayoutOptions } from './types.js';
/**
 * Orchestrates kinetic typography by computing layout positions
 * and providing staggered timing for character appearance along
 * curves, circles, or filled shapes.
 */
export declare class KineticEngine {
    private layoutMode;
    private options;
    private positioned;
    private staggerMs;
    constructor(options?: Partial<LayoutOptions>, staggerMs?: number);
    setLayoutMode(mode: LayoutMode): void;
    getLayoutMode(): LayoutMode;
    setOptions(options: Partial<LayoutOptions>): void;
    /**
     * Compute layout positions for the given text and stroke path.
     * The layout mode determines which algorithm is used.
     */
    computeLayout(text: string, strokePath: Point[]): PositionedChar[];
    /**
     * Re-layout existing text with an updated stroke path.
     * Returns the new positions or empty array if no text was set.
     */
    relayout(text: string, newPath: Point[]): PositionedChar[];
    /** Get the most recently computed positioned characters */
    getPositionedChars(): PositionedChar[];
    /**
     * Compute staggered delay for each character index.
     * Used for animating characters appearing one-by-one along the layout.
     */
    getStaggerDelay(charIndex: number): number;
    /**
     * Compute progress (0-1) for a character at a given elapsed time.
     * Duration is the total animation time per character.
     */
    getCharProgress(charIndex: number, elapsedMs: number, charDurationMs: number): number;
    /**
     * Total animation duration for all characters to finish,
     * given a per-character duration.
     */
    getTotalDuration(charCount: number, charDurationMs: number): number;
    /** Circle layout: derive center and radius from stroke path */
    private computeCircleLayout;
    /** Linear layout: horizontal placement starting at the first stroke point */
    private computeLinearLayout;
    /** Compute centroid of a set of points */
    private computeCentroid;
    /** Compute average distance from center to all points */
    private computeAvgRadius;
}
