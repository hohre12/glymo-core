import { GlyphExtractor } from '../src/text/GlyphExtractor.js';
import { DEFAULT_TEXT_MODE_CONFIG } from '../src/text/types.js';
import type { TextModeConfig } from '../src/text/types.js';

// ── Mock setup ───────────────────────────────────────

const mockCtx = {
  clearRect: vi.fn(),
  fillText: vi.fn(),
  getImageData: vi.fn(),
  font: '',
  fillStyle: '',
  textBaseline: '',
  textAlign: '',
};

vi.stubGlobal('OffscreenCanvas', class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }
  getContext() {
    return mockCtx;
  }
});

// Mock document.fonts
const mockFonts = {
  ready: Promise.resolve(),
  check: vi.fn().mockReturnValue(true),
};

vi.stubGlobal('document', {
  fonts: mockFonts,
});

// ── Helpers ──────────────────────────────────────────

/**
 * Create synthetic ImageData with specified opaque pixel positions.
 * Canvas size is 128x128 (GLYPH_CANVAS_SIZE).
 */
function createImageData(
  opaquePixels: Array<{ x: number; y: number }>,
  size: number = 128,
): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  // All pixels start fully transparent (alpha = 0)

  for (const { x, y } of opaquePixels) {
    const idx = (y * size + x) * 4;
    data[idx] = 0;       // R
    data[idx + 1] = 0;   // G
    data[idx + 2] = 0;   // B
    data[idx + 3] = 255;  // A — fully opaque
  }

  return { data, width: size, height: size } as unknown as ImageData;
}

/** Create a filled rectangle of opaque pixels */
function createFilledRect(
  rx: number, ry: number, rw: number, rh: number, size: number = 128,
): ImageData {
  const pixels: Array<{ x: number; y: number }> = [];
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      pixels.push({ x, y });
    }
  }
  return createImageData(pixels, size);
}

function makeConfig(overrides?: Partial<TextModeConfig>): TextModeConfig {
  return { ...DEFAULT_TEXT_MODE_CONFIG, enabled: true, ...overrides };
}

// ── Border pixel detection ───────────────────────────

describe('GlyphExtractor border pixel detection', () => {
  let extractor: GlyphExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new GlyphExtractor(makeConfig({ glyphPointCount: 10 }));
  });

  it('should detect border pixels of a filled rectangle', () => {
    // 10x10 filled rectangle at (20,20) — border pixels are the edges
    const imageData = createFilledRect(20, 20, 10, 10);
    mockCtx.getImageData.mockReturnValue(imageData);

    const outline = extractor.extractChar('A', '72px sans-serif');

    // Should have found border points (edges of the rectangle)
    expect(outline.points.length).toBeGreaterThan(0);
    expect(outline.char).toBe('A');
  });

  it('should detect pixels at canvas edges as border pixels', () => {
    // Pixel at (0,0) — all out-of-bounds neighbors make it a border pixel
    const imageData = createImageData([{ x: 0, y: 0 }]);
    mockCtx.getImageData.mockReturnValue(imageData);

    const outline = extractor.extractChar('X', '72px sans-serif');

    expect(outline.points.length).toBeGreaterThan(0);
    expect(outline.points.some((p) => p.x === 0 && p.y === 0)).toBe(true);
  });

  it('should not detect fully interior pixels as border', () => {
    // 5x5 block — the center pixel (step=1 needed, but default step=2)
    // With step=2, we sample at (0,0), (2,0), (4,0), etc.
    // A 6x6 block at (10,10): interior at step=2 would be (12,12) which has
    // all 4 neighbors also opaque at step offsets
    const imageData = createFilledRect(10, 10, 20, 20);
    mockCtx.getImageData.mockReturnValue(imageData);

    const outline = extractor.extractChar('B', '72px sans-serif');

    // Interior points should NOT be detected as border
    // The center (20,20) has all neighbors at step=2 distances also opaque
    const centerPoints = outline.points.filter(
      (p) => p.x === 20 && p.y === 20,
    );
    expect(centerPoints.length).toBe(0);
  });

});

// ── Border pixel edge cases ─────────────────────────

describe('GlyphExtractor border pixel edge cases', () => {
  let extractor: GlyphExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new GlyphExtractor(makeConfig({ glyphPointCount: 10 }));
  });

  it('should return empty points for completely transparent canvas', () => {
    const imageData = createImageData([]);
    mockCtx.getImageData.mockReturnValue(imageData);

    const outline = extractor.extractChar('?', '72px sans-serif');

    expect(outline.points.length).toBe(0);
  });

  it('should supplement with interior points when border points are insufficient', () => {
    const config = makeConfig({ glyphPointCount: 300 });
    const ext = new GlyphExtractor(config);

    const imageData = createFilledRect(60, 60, 4, 4);
    mockCtx.getImageData.mockReturnValue(imageData);

    const outline = ext.extractChar('i', '72px sans-serif');

    expect(outline.points.length).toBeGreaterThan(0);
  });
});

// ── Font loading ─────────────────────────────────────

describe('GlyphExtractor font loading', () => {
  let extractor: GlyphExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new GlyphExtractor(makeConfig());
  });

  it('should use the configured font when available', async () => {
    mockFonts.check.mockReturnValue(true);
    mockFonts.ready = Promise.resolve();

    const font = await extractor.ensureFontLoaded('72px "Noto Sans KR"');

    expect(font).toBe('72px "Noto Sans KR"');
  });

  it('should fallback to sans-serif when font is not available', async () => {
    mockFonts.check.mockReturnValue(false);
    mockFonts.ready = Promise.resolve();

    const font = await extractor.ensureFontLoaded('72px "Unknown Font"');

    // parseFontFamily strips quotes, so .replace puts sans-serif inside the original quotes
    expect(font).toBe('72px "sans-serif"');
  });

  it('should fallback to sans-serif on font load timeout', async () => {
    mockFonts.ready = new Promise(() => {}); // Never resolves — triggers timeout
    mockFonts.check.mockReturnValue(false);

    const font = await extractor.ensureFontLoaded('72px "Slow Font"');

    expect(font).toBe('72px "sans-serif"');
  }, 10000);

  it('should handle font string with no family (just size)', async () => {
    mockFonts.check.mockReturnValue(false);
    mockFonts.ready = Promise.resolve();

    const font = await extractor.ensureFontLoaded('72px');

    // parseFontFamily returns 'sans-serif' for empty family
    expect(font).toBe('72px');
  });
});

// ── Cache integration ────────────────────────────────

describe('GlyphExtractor cache integration', () => {
  it('should return cached outline on second extraction of same char', () => {
    const extractor = new GlyphExtractor(makeConfig({ glyphPointCount: 10 }));
    const imageData = createFilledRect(30, 30, 20, 20);
    mockCtx.getImageData.mockReturnValue(imageData);

    const first = extractor.extractChar('A', '72px sans-serif');
    mockCtx.getImageData.mockClear();

    const second = extractor.extractChar('A', '72px sans-serif');

    // Should be the exact same object reference (cached)
    expect(second).toBe(first);
    // getImageData should NOT have been called again
    expect(mockCtx.getImageData).not.toHaveBeenCalled();
  });

  it('should not use cache for different fonts', () => {
    const extractor = new GlyphExtractor(makeConfig({ glyphPointCount: 10 }));
    const imageData = createFilledRect(30, 30, 20, 20);
    mockCtx.getImageData.mockReturnValue(imageData);

    const first = extractor.extractChar('A', '72px serif');
    const second = extractor.extractChar('A', '72px monospace');

    // Different font → different cache key → different objects
    expect(second).not.toBe(first);
  });

  it('should clear cache when clearCache is called', () => {
    const extractor = new GlyphExtractor(makeConfig({ glyphPointCount: 10 }));
    const imageData = createFilledRect(30, 30, 20, 20);
    mockCtx.getImageData.mockReturnValue(imageData);

    extractor.extractChar('A', '72px sans-serif');
    extractor.clearCache();

    // After clear, getImageData will be called again
    mockCtx.getImageData.mockClear();
    extractor.extractChar('A', '72px sans-serif');
    expect(mockCtx.getImageData).toHaveBeenCalledTimes(1);
  });
});

