import { GlyphCache } from '../src/text/GlyphCache.js';
import type { GlyphOutline } from '../src/text/types.js';

// ── Helpers ──────────────────────────────────────────

function makeOutline(char: string, font: string = 'sans-serif'): GlyphOutline {
  return {
    char,
    points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    bbox: { x: 0, y: 0, width: 10, height: 10 },
    fontUsed: font,
  };
}

// ── Basic get/set ────────────────────────────────────

describe('GlyphCache basic operations', () => {
  let cache: GlyphCache;

  beforeEach(() => {
    cache = new GlyphCache();
  });

  it('should return undefined on cache miss', () => {
    expect(cache.get('A', 'sans-serif')).toBeUndefined();
  });

  it('should store and retrieve a glyph outline', () => {
    const outline = makeOutline('A');
    cache.set('A', 'sans-serif', outline);
    expect(cache.get('A', 'sans-serif')).toBe(outline);
  });

  it('should use char::font as cache key format', () => {
    const outlineA = makeOutline('A', 'serif');
    const outlineB = makeOutline('A', 'monospace');
    cache.set('A', 'serif', outlineA);
    cache.set('A', 'monospace', outlineB);

    expect(cache.get('A', 'serif')).toBe(outlineA);
    expect(cache.get('A', 'monospace')).toBe(outlineB);
  });

  it('should differentiate characters with the same font', () => {
    const outlineA = makeOutline('A');
    const outlineB = makeOutline('B');
    cache.set('A', 'sans-serif', outlineA);
    cache.set('B', 'sans-serif', outlineB);

    expect(cache.get('A', 'sans-serif')).toBe(outlineA);
    expect(cache.get('B', 'sans-serif')).toBe(outlineB);
  });

  it('should report correct size', () => {
    expect(cache.size).toBe(0);
    cache.set('A', 'sans-serif', makeOutline('A'));
    expect(cache.size).toBe(1);
    cache.set('B', 'sans-serif', makeOutline('B'));
    expect(cache.size).toBe(2);
  });

  it('should overwrite existing entry for same key', () => {
    const first = makeOutline('A');
    const second = makeOutline('A');
    cache.set('A', 'sans-serif', first);
    cache.set('A', 'sans-serif', second);

    expect(cache.size).toBe(1);
    expect(cache.get('A', 'sans-serif')).toBe(second);
  });
});

// ── LRU eviction ─────────────────────────────────────

describe('GlyphCache LRU eviction', () => {
  it('should evict the oldest entry when capacity exceeded', () => {
    const cache = new GlyphCache(3);
    cache.set('A', 'f', makeOutline('A'));
    cache.set('B', 'f', makeOutline('B'));
    cache.set('C', 'f', makeOutline('C'));

    // Adding a 4th should evict 'A' (oldest)
    cache.set('D', 'f', makeOutline('D'));

    expect(cache.size).toBe(3);
    expect(cache.get('A', 'f')).toBeUndefined();
    expect(cache.get('B', 'f')).toBeDefined();
    expect(cache.get('D', 'f')).toBeDefined();
  });

  it('should evict oldest when adding 129 items to default 128 cache', () => {
    const cache = new GlyphCache(128);
    for (let i = 0; i < 129; i++) {
      cache.set(`char${i}`, 'f', makeOutline(`char${i}`));
    }

    expect(cache.size).toBe(128);
    expect(cache.get('char0', 'f')).toBeUndefined();
    expect(cache.get('char128', 'f')).toBeDefined();
  });

  it('should promote accessed item so it is not evicted', () => {
    const cache = new GlyphCache(3);
    cache.set('A', 'f', makeOutline('A'));
    cache.set('B', 'f', makeOutline('B'));
    cache.set('C', 'f', makeOutline('C'));

    // Access 'A' to promote it to most recent
    cache.get('A', 'f');

    // Add 'D' — 'B' should now be evicted (oldest after promotion)
    cache.set('D', 'f', makeOutline('D'));

    expect(cache.get('A', 'f')).toBeDefined();
    expect(cache.get('B', 'f')).toBeUndefined();
    expect(cache.get('D', 'f')).toBeDefined();
  });

  it('should promote on set (overwrite) to avoid premature eviction', () => {
    const cache = new GlyphCache(3);
    cache.set('A', 'f', makeOutline('A'));
    cache.set('B', 'f', makeOutline('B'));
    cache.set('C', 'f', makeOutline('C'));

    // Overwrite 'A' to promote it
    cache.set('A', 'f', makeOutline('A'));

    // Add 'D' — 'B' should be evicted
    cache.set('D', 'f', makeOutline('D'));

    expect(cache.get('A', 'f')).toBeDefined();
    expect(cache.get('B', 'f')).toBeUndefined();
  });
});

// ── Clear ────────────────────────────────────────────

describe('GlyphCache clear', () => {
  it('should empty the cache', () => {
    const cache = new GlyphCache();
    cache.set('A', 'f', makeOutline('A'));
    cache.set('B', 'f', makeOutline('B'));

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('A', 'f')).toBeUndefined();
    expect(cache.get('B', 'f')).toBeUndefined();
  });

  it('should allow new entries after clear', () => {
    const cache = new GlyphCache();
    cache.set('A', 'f', makeOutline('A'));
    cache.clear();

    cache.set('B', 'f', makeOutline('B'));
    expect(cache.size).toBe(1);
    expect(cache.get('B', 'f')).toBeDefined();
  });
});
