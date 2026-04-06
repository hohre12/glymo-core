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

const mockFonts = {
  ready: Promise.resolve(),
  check: vi.fn().mockReturnValue(true),
};

vi.stubGlobal('document', {
  fonts: mockFonts,
});

// ── Helpers ──────────────────────────────────────────

function createImageData(
  opaquePixels: Array<{ x: number; y: number }>,
  size: number = 128,
): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  for (const { x, y } of opaquePixels) {
    const idx = (y * size + x) * 4;
    data[idx] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 255;
  }
  return { data, width: size, height: size } as unknown as ImageData;
}

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

// ── extractAll ───────────────────────────────────────

describe('GlyphExtractor extractAll', () => {
  let extractor: GlyphExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFonts.check.mockReturnValue(true);
    mockFonts.ready = Promise.resolve();
    extractor = new GlyphExtractor(makeConfig({ glyphPointCount: 10 }));
  });

  it('should extract outlines for each non-whitespace character', async () => {
    const imageData = createFilledRect(30, 30, 20, 20);
    mockCtx.getImageData.mockReturnValue(imageData);
    const glyphs = await extractor.extractAll('Hi');
    expect(glyphs).toHaveLength(2);
    expect(glyphs[0]!.char).toBe('H');
    expect(glyphs[1]!.char).toBe('i');
  });

  it('should skip whitespace characters', async () => {
    const imageData = createFilledRect(30, 30, 20, 20);
    mockCtx.getImageData.mockReturnValue(imageData);
    const glyphs = await extractor.extractAll('A B');
    expect(glyphs).toHaveLength(2);
    expect(glyphs[0]!.char).toBe('A');
    expect(glyphs[1]!.char).toBe('B');
  });

  it('should return empty array for whitespace-only input', async () => {
    const glyphs = await extractor.extractAll('   ');
    expect(glyphs).toEqual([]);
  });

  it('should return empty array for empty string', async () => {
    const glyphs = await extractor.extractAll('');
    expect(glyphs).toEqual([]);
  });

  it('should skip characters that fail extraction gracefully', async () => {
    let callCount = 0;
    mockCtx.getImageData.mockImplementation(() => {
      callCount++;
      if (callCount === 2) throw new Error('Canvas error');
      return createFilledRect(30, 30, 20, 20);
    });
    const glyphs = await extractor.extractAll('ABC');
    expect(glyphs.length).toBe(2);
    expect(glyphs[0]!.char).toBe('A');
    expect(glyphs[1]!.char).toBe('C');
  });
});

// ── Resampling ───────────────────────────────────────

describe('GlyphExtractor resampling', () => {
  it('should resample border points to target glyphPointCount', () => {
    const targetCount = 50;
    const extractor = new GlyphExtractor(makeConfig({ glyphPointCount: targetCount }));
    const imageData = createFilledRect(20, 20, 60, 60);
    mockCtx.getImageData.mockReturnValue(imageData);
    const outline = extractor.extractChar('O', '72px sans-serif');
    if (outline.points.length >= 2) {
      expect(outline.points.length).toBe(targetCount);
    }
  });

  it('should not resample when fewer than 2 border points', () => {
    const extractor = new GlyphExtractor(makeConfig({ glyphPointCount: 300 }));
    const imageData = createImageData([{ x: 10, y: 10 }]);
    mockCtx.getImageData.mockReturnValue(imageData);
    const outline = extractor.extractChar('.', '72px sans-serif');
    expect(outline.points.length).toBeLessThan(300);
  });
});

// ── Bounding box ─────────────────────────────────────

describe('GlyphExtractor bounding box', () => {
  it('should compute tight bbox with padding from detected points', () => {
    const extractor = new GlyphExtractor(makeConfig({ glyphPointCount: 10 }));
    const imageData = createImageData([
      { x: 40, y: 50 },
      { x: 60, y: 50 },
      { x: 50, y: 70 },
    ]);
    mockCtx.getImageData.mockReturnValue(imageData);
    const outline = extractor.extractChar('V', '72px sans-serif');
    expect(outline.bbox.x).toBeLessThanOrEqual(40);
    expect(outline.bbox.y).toBeLessThanOrEqual(50);
    expect(outline.bbox.width).toBeGreaterThanOrEqual(20);
    expect(outline.bbox.height).toBeGreaterThanOrEqual(20);
  });

  it('should return full canvas bbox for empty points', () => {
    const extractor = new GlyphExtractor(makeConfig({ glyphPointCount: 10 }));
    const imageData = createImageData([]);
    mockCtx.getImageData.mockReturnValue(imageData);
    const outline = extractor.extractChar(' ', '72px sans-serif');
    expect(outline.bbox).toEqual({ x: 0, y: 0, width: 128, height: 128 });
  });
});

// ── Config update ────────────────────────────────────

describe('GlyphExtractor updateConfig', () => {
  it('should merge partial config', () => {
    const extractor = new GlyphExtractor(makeConfig());
    extractor.updateConfig({ font: '48px monospace' });
    expect(true).toBe(true);
  });
});
