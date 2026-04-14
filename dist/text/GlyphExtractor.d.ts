import { GlyphOutline, TextModeConfig } from './types.js';
/**
 * Stage 8: GlyphExtractor
 *
 * Takes recognized text and a target font, renders each character
 * to an OffscreenCanvas, extracts border pixels as a point cloud,
 * and returns glyph outlines ready for point matching (Stage 9).
 */
export declare class GlyphExtractor {
    private cache;
    private config;
    constructor(config: TextModeConfig);
    /** Wait for target font to be available. Returns actual font used. */
    ensureFontLoaded(font: string): Promise<string>;
    /** Extract glyph outlines for a string of characters */
    extractAll(text: string): Promise<GlyphOutline[]>;
    /** Extract outline for a single character */
    extractChar(char: string, font: string): GlyphOutline;
    /**
     * Border pixel detection on rendered character (design.md SS4.8).
     * For each pixel with alpha >= 128, check 4-directional neighbors.
     * If any neighbor is transparent or out of bounds, it's a border pixel.
     */
    private detectBorderPixels;
    /** Update configuration */
    updateConfig(partial: Partial<TextModeConfig>): void;
    /** Clear glyph cache */
    clearCache(): void;
}
