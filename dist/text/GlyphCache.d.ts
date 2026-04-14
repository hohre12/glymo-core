import { GlyphOutline } from './types.js';
/**
 * LRU cache for extracted glyph outlines.
 * Key: `char::font` — avoids re-rendering the same character outline.
 * Max 128 entries by default (design doc SS6.4).
 */
export declare class GlyphCache {
    private maxSize;
    private cache;
    constructor(maxSize?: number);
    private key;
    get(char: string, font: string): GlyphOutline | undefined;
    set(char: string, font: string, outline: GlyphOutline): void;
    clear(): void;
    get size(): number;
}
