import { PointMatcher } from '../src/text/PointMatcher.js';
import type { StrokePoint, Point } from '../src/types.js';
import type { GlyphOutline } from '../src/text/types.js';

// ── Helpers ─────────────────────────────────────────

function makeStrokePoint(x: number, y: number): StrokePoint {
  return { x, y, t: 0, pressure: 0.5 };
}

function makeStroke(points: [number, number][]): StrokePoint[] {
  return points.map(([x, y]) => makeStrokePoint(x, y));
}

function makeGlyph(char: string, points: [number, number][]): GlyphOutline {
  return {
    char,
    points: points.map(([x, y]) => ({ x, y })),
    bbox: { x: 0, y: 0, width: 100, height: 100 },
    fontUsed: 'sans-serif',
  };
}

// ── PointMatcher tests ──────────────────────────────

describe('PointMatcher', () => {
  const matcher = new PointMatcher();

  describe('nearest-neighbor matching', () => {
    it('matches hand points to nearest glyph points', () => {
      const strokes: StrokePoint[][] = [
        makeStroke([[10, 10], [20, 20], [30, 30], [40, 40]]),
      ];
      const glyphs: GlyphOutline[] = [
        makeGlyph('A', [[12, 12], [22, 22], [32, 32], [42, 42]]),
      ];

      const result = matcher.matchAll(strokes, glyphs);

      expect(result).toHaveLength(1);
      expect(result[0]!.char).toBe('A');
      expect(result[0]!.pairs.length).toBeGreaterThan(0);

      // Every pair should have both hand and font points
      for (const pair of result[0]!.pairs) {
        expect(pair.hand).toBeDefined();
        expect(pair.font).toBeDefined();
        expect(pair.charIndex).toBe(0);
        expect(typeof pair.pointIndex).toBe('number');
      }
    });

    it('uses nearest-neighbor NOT sequential matching', () => {
      // Create 5 hand points in scrambled positions and 5 font points
      // with matching positions. With enough points, resamplePoints preserves
      // the overall distribution and nearest-neighbor should match well.
      //
      // Sequential matching would pair by index, producing large distances.
      // Nearest-neighbor should minimize total matching distance.
      const strokes: StrokePoint[][] = [
        makeStroke([
          [100, 0], [0, 100], [50, 50], [100, 100], [0, 0],
        ]),
      ];
      const glyphs: GlyphOutline[] = [
        makeGlyph('X', [
          [0, 0], [0, 100], [50, 50], [100, 0], [100, 100],
        ]),
      ];

      const result = matcher.matchAll(strokes, glyphs);
      const pairs = result[0]!.pairs;

      // Compute total matching distance
      let totalDist = 0;
      for (const pair of pairs) {
        totalDist += Math.sqrt(
          (pair.hand.x - pair.font.x) ** 2 + (pair.hand.y - pair.font.y) ** 2,
        );
      }

      // For a sequential matcher on these scrambled points, the total distance
      // would be very large. Nearest-neighbor should produce a much smaller total.
      // With perfect matching on 5 identical point sets, total would be 0.
      // After resampling there's some distortion, but it should stay reasonable.
      const avgDist = totalDist / pairs.length;
      expect(avgDist).toBeLessThan(80); // Sequential would produce >100 avg

      // The key test: every pair should have a valid hand and font point
      for (const pair of pairs) {
        expect(pair.hand).toBeDefined();
        expect(pair.font).toBeDefined();
      }
    });

    it('produces unique pairings (no hand point used twice)', () => {
      const strokes: StrokePoint[][] = [
        makeStroke([[0, 0], [10, 10], [20, 20], [30, 30], [40, 40]]),
      ];
      const glyphs: GlyphOutline[] = [
        makeGlyph('B', [[5, 5], [15, 15], [25, 25], [35, 35], [45, 45]]),
      ];

      const result = matcher.matchAll(strokes, glyphs);
      const pairs = result[0]!.pairs;

      // Check hand point uniqueness by collecting hand coordinates
      const handKeys = pairs.map((p) => `${p.hand.x},${p.hand.y}`);
      const uniqueHands = new Set(handKeys);
      expect(uniqueHands.size).toBe(pairs.length);
    });
  });

  describe('mismatched point counts', () => {
    it('handles more hand points than glyph points', () => {
      const strokes: StrokePoint[][] = [
        makeStroke([[0, 0], [10, 10], [20, 20], [30, 30], [40, 40], [50, 50]]),
      ];
      const glyphs: GlyphOutline[] = [
        makeGlyph('C', [[5, 5], [25, 25], [45, 45]]),
      ];

      const result = matcher.matchAll(strokes, glyphs);
      expect(result).toHaveLength(1);
      // Resampling ensures equal count — pairs should be valid
      expect(result[0]!.pairs.length).toBeGreaterThan(0);
    });

    it('handles more glyph points than hand points', () => {
      const strokes: StrokePoint[][] = [
        makeStroke([[5, 5], [25, 25]]),
      ];
      const glyphs: GlyphOutline[] = [
        makeGlyph('D', [[0, 0], [10, 10], [20, 20], [30, 30], [40, 40]]),
      ];

      const result = matcher.matchAll(strokes, glyphs);
      expect(result).toHaveLength(1);
      expect(result[0]!.pairs.length).toBeGreaterThan(0);
    });
  });

  describe('multiple characters', () => {
    it('matches across multiple glyphs', () => {
      const strokes: StrokePoint[][] = [
        makeStroke([[0, 0], [10, 10], [20, 20], [30, 30]]),
        makeStroke([[50, 50], [60, 60], [70, 70], [80, 80]]),
      ];
      const glyphs: GlyphOutline[] = [
        makeGlyph('H', [[5, 5], [15, 15]]),
        makeGlyph('I', [[55, 55], [65, 65]]),
      ];

      const result = matcher.matchAll(strokes, glyphs);
      expect(result).toHaveLength(2);
      expect(result[0]!.char).toBe('H');
      expect(result[0]!.charIndex).toBe(0);
      expect(result[1]!.char).toBe('I');
      expect(result[1]!.charIndex).toBe(1);
    });
  });

  describe('empty input handling', () => {
    it('returns empty for no glyphs', () => {
      const strokes: StrokePoint[][] = [makeStroke([[0, 0], [10, 10]])];
      const result = matcher.matchAll(strokes, []);
      expect(result).toEqual([]);
    });

    it('returns empty for no strokes', () => {
      const glyphs: GlyphOutline[] = [
        makeGlyph('E', [[0, 0], [10, 10]]),
      ];
      const result = matcher.matchAll([], glyphs);
      expect(result).toEqual([]);
    });

    it('returns empty for both empty', () => {
      const result = matcher.matchAll([], []);
      expect(result).toEqual([]);
    });
  });
});
