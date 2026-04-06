import type { GlyphOutline } from './types.js';

/**
 * LRU cache for extracted glyph outlines.
 * Key: `char::font` — avoids re-rendering the same character outline.
 * Max 128 entries by default (design doc SS6.4).
 */
export class GlyphCache {
  private cache = new Map<string, GlyphOutline>();

  constructor(private maxSize: number = 128) {}

  private key(char: string, font: string): string {
    return `${char}::${font}`;
  }

  get(char: string, font: string): GlyphOutline | undefined {
    const k = this.key(char, font);
    const entry = this.cache.get(k);
    if (entry) {
      // Move to end (most recently used)
      this.cache.delete(k);
      this.cache.set(k, entry);
    }
    return entry;
  }

  set(char: string, font: string, outline: GlyphOutline): void {
    const k = this.key(char, font);
    if (this.cache.has(k)) this.cache.delete(k);
    this.cache.set(k, outline);
    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
