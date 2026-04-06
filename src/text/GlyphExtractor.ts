import type { Point } from '../types.js';
import type { GlyphOutline, TextModeConfig } from './types.js';
import { GlyphCache } from './GlyphCache.js';
import { resamplePoints } from '../util/math.js';

// Border pixel detection: alpha threshold (design.md SS4.8)
const ALPHA_THRESHOLD = 128;
// 4-directional neighbor offsets for border detection
const NEIGHBOR_DIRS: readonly [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
// RGBA bytes per pixel
const BYTES_PER_PIXEL = 4;
// Alpha channel offset within a pixel's RGBA bytes
const ALPHA_OFFSET = 3;
// Default rendering canvas size for glyph extraction
const GLYPH_CANVAS_SIZE = 128;
// Padding around rendered glyph to avoid clipping
const GLYPH_PADDING = 10;
// Default pixel sampling step for border detection
const DEFAULT_STEP = 2;
// Minimum border point ratio before supplementing with interior points
const MIN_BORDER_RATIO = 0.5;

/**
 * Stage 8: GlyphExtractor
 *
 * Takes recognized text and a target font, renders each character
 * to an OffscreenCanvas, extracts border pixels as a point cloud,
 * and returns glyph outlines ready for point matching (Stage 9).
 */
export class GlyphExtractor {
  private cache: GlyphCache;
  private config: TextModeConfig;

  constructor(config: TextModeConfig) {
    this.config = { ...config };
    this.cache = new GlyphCache(128); // Max 128 cached glyphs (design doc SS6.4)
  }

  /** Wait for target font to be available. Returns actual font used. */
  async ensureFontLoaded(font: string): Promise<string> {
    const fontFamily = parseFontFamily(font);

    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Font load timeout')), 3000),
        ),
      ]);

      // Verify the specific font is available
      if (document.fonts.check(font)) {
        return font;
      }
    } catch {
      // Timeout — fall through to system font
    }

    // Fallback to system font
    return font.replace(fontFamily, 'sans-serif');
  }

  /** Extract glyph outlines for a string of characters */
  async extractAll(text: string): Promise<GlyphOutline[]> {
    const actualFont = await this.ensureFontLoaded(this.config.font);
    const glyphs: GlyphOutline[] = [];

    for (const char of text) {
      if (char.trim() === '') continue; // Skip whitespace
      try {
        const outline = this.extractChar(char, actualFont);
        glyphs.push(outline);
      } catch {
        // Skip characters that fail extraction — graceful degradation
        continue;
      }
    }

    return glyphs;
  }

  /** Extract outline for a single character */
  extractChar(char: string, font: string): GlyphOutline {
    // Check cache first
    const cached = this.cache.get(char, font);
    if (cached) return cached;

    const size = GLYPH_CANVAS_SIZE;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Render character
    ctx.font = font;
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(char, size / 2, size / 2);

    // Get image data and detect border pixels
    const imageData = ctx.getImageData(0, 0, size, size);
    const rawBorderPoints = this.detectBorderPixels(imageData, size, size, DEFAULT_STEP);

    // Order border pixels as a continuous path for consistent point matching (morph mode)
    const orderedPoints = orderPointsAsPath(rawBorderPoints);

    // Resample to target point count (design doc: default 300)
    const points = orderedPoints.length >= 2
      ? resamplePoints(orderedPoints, this.config.glyphPointCount)
      : orderedPoints;

    // Compute tight bounding box from detected points
    const bbox = computeBbox(points, size);

    const outline: GlyphOutline = {
      char,
      points,
      bbox,
      fontUsed: font,
    };

    this.cache.set(char, font, outline);
    return outline;
  }

  /**
   * Border pixel detection on rendered character (design.md SS4.8).
   * For each pixel with alpha >= 128, check 4-directional neighbors.
   * If any neighbor is transparent or out of bounds, it's a border pixel.
   */
  private detectBorderPixels(
    imageData: ImageData,
    width: number,
    height: number,
    step: number = DEFAULT_STEP,
  ): Point[] {
    const pixels = imageData.data;
    const borderPoints: Point[] = [];

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const alpha = pixels[(y * width + x) * BYTES_PER_PIXEL + ALPHA_OFFSET]!;
        if (alpha < ALPHA_THRESHOLD) continue;

        let isBorder = false;
        for (const [dx, dy] of NEIGHBOR_DIRS) {
          const nx = x + dx * step;
          const ny = y + dy * step;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            isBorder = true;
            break;
          }
          if (pixels[(ny * width + nx) * BYTES_PER_PIXEL + ALPHA_OFFSET]! < ALPHA_THRESHOLD) {
            isBorder = true;
            break;
          }
        }

        if (isBorder) borderPoints.push({ x, y });
      }
    }

    // If insufficient border points, supplement with interior points
    if (borderPoints.length < this.config.glyphPointCount * MIN_BORDER_RATIO) {
      const interiorStep = step + 1;
      for (let y = 0; y < height; y += interiorStep) {
        for (let x = 0; x < width; x += interiorStep) {
          if (pixels[(y * width + x) * BYTES_PER_PIXEL + ALPHA_OFFSET]! > ALPHA_THRESHOLD) {
            borderPoints.push({ x, y });
          }
        }
      }
    }

    return borderPoints;
  }

  /** Update configuration */
  updateConfig(partial: Partial<TextModeConfig>): void {
    Object.assign(this.config, partial);
  }

  /** Clear glyph cache */
  clearCache(): void {
    this.cache.clear();
  }
}

/** Parse font family name from a CSS font string like '72px "Noto Sans KR"' */
function parseFontFamily(font: string): string {
  // Remove size prefix (e.g. '72px ')
  const parts = font.split(/\s+/);
  // Font family is everything after the size
  const familyParts = parts.slice(1);
  if (familyParts.length === 0) return 'sans-serif';
  // Join and strip quotes
  return familyParts.join(' ').replace(/["']/g, '');
}

/**
 * Order border pixels as a continuous nearest-neighbor path.
 * Starts from the top-left pixel and greedily picks the closest unvisited point.
 * This produces a coherent outline ordering required for stable point matching in morph mode.
 */
function orderPointsAsPath(points: Point[]): Point[] {
  if (points.length <= 2) return points;

  const ordered: Point[] = [];
  const used = new Uint8Array(points.length);

  // Start from top-left point
  let currentIdx = 0;
  for (let i = 1; i < points.length; i++) {
    const c = points[currentIdx]!;
    const p = points[i]!;
    if (p.y < c.y || (p.y === c.y && p.x < c.x)) {
      currentIdx = i;
    }
  }

  ordered.push(points[currentIdx]!);
  used[currentIdx] = 1;

  for (let step = 1; step < points.length; step++) {
    const curr = ordered[ordered.length - 1]!;
    let bestIdx = -1;
    let bestDistSq = Infinity;

    for (let i = 0; i < points.length; i++) {
      if (used[i]) continue;
      const dx = points[i]!.x - curr.x;
      const dy = points[i]!.y - curr.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    ordered.push(points[bestIdx]!);
    used[bestIdx] = 1;
  }

  return ordered;
}

/** Compute bounding box from a set of points, with padding */
function computeBbox(
  points: Point[],
  canvasSize: number,
): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) {
    return { x: 0, y: 0, width: canvasSize, height: canvasSize };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    x: Math.max(0, minX - GLYPH_PADDING),
    y: Math.max(0, minY - GLYPH_PADDING),
    width: Math.min(canvasSize, maxX - minX + GLYPH_PADDING * 2),
    height: Math.min(canvasSize, maxY - minY + GLYPH_PADDING * 2),
  };
}
