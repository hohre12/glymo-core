import { StrokePoint } from '../types.js';
import { GlyphOutline, MatchedCharacter } from './types.js';
/**
 * Stage 9: PointMatcher
 *
 * Matches hand-drawn stroke points to font glyph outline points
 * using nearest-neighbor greedy matching.
 *
 * CRITICAL: Sequential matching is FORBIDDEN (per CLAUDE.md).
 * Each hand point is matched to the nearest unmatched glyph point.
 */
export declare class PointMatcher {
    /**
     * Match hand-drawn strokes to glyph outlines for all characters.
     *
     * @param strokeArrays - Hand-drawn stroke points from stages 1-6
     * @param glyphs - Glyph outlines from stage 8
     * @returns Per-character matched point pairs
     */
    matchAll(strokeArrays: StrokePoint[][], glyphs: GlyphOutline[]): MatchedCharacter[];
}
