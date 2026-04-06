// ── Stage 9: PointMatcher — Nearest-Neighbor Greedy Matching ──

import type { Point, StrokePoint, MatchedPair } from '../types.js';
import type { GlyphOutline, MatchedCharacter } from './types.js';
import { resamplePoints } from '../util/math.js';

/**
 * Stage 9: PointMatcher
 *
 * Matches hand-drawn stroke points to font glyph outline points
 * using nearest-neighbor greedy matching.
 *
 * CRITICAL: Sequential matching is FORBIDDEN (per CLAUDE.md).
 * Each hand point is matched to the nearest unmatched glyph point.
 */
export class PointMatcher {
  /**
   * Match hand-drawn strokes to glyph outlines for all characters.
   *
   * @param strokeArrays - Hand-drawn stroke points from stages 1-6
   * @param glyphs - Glyph outlines from stage 8
   * @returns Per-character matched point pairs
   */
  matchAll(
    strokeArrays: StrokePoint[][],
    glyphs: GlyphOutline[],
  ): MatchedCharacter[] {
    if (glyphs.length === 0 || strokeArrays.length === 0) return [];

    const handPoints = flattenStrokes(strokeArrays);
    const pointsPerChar = distributePoints(handPoints, glyphs);

    return glyphs.map((glyph, charIndex) => {
      const charHandPoints = pointsPerChar[charIndex] ?? [];
      const pairs = matchCharacter(charHandPoints, glyph.points, charIndex);
      return { char: glyph.char, charIndex, pairs };
    });
  }
}

// ── Internal Helpers ────────────────────────────────

/** Flatten all strokes into a single Point array (drop pressure/time) */
function flattenStrokes(strokes: StrokePoint[][]): Point[] {
  const result: Point[] = [];
  for (const stroke of strokes) {
    for (const pt of stroke) {
      result.push({ x: pt.x, y: pt.y });
    }
  }
  return result;
}

/**
 * Distribute hand-drawn points across characters proportionally
 * based on each glyph's point count.
 */
function distributePoints(
  handPoints: Point[],
  glyphs: GlyphOutline[],
): Point[][] {
  const totalGlyphPoints = glyphs.reduce((sum, g) => sum + g.points.length, 0);
  if (totalGlyphPoints === 0 || handPoints.length === 0) {
    return glyphs.map(() => []);
  }

  const result: Point[][] = [];
  let handOffset = 0;

  for (let i = 0; i < glyphs.length; i++) {
    const ratio = glyphs[i]!.points.length / totalGlyphPoints;
    const count = i === glyphs.length - 1
      ? handPoints.length - handOffset  // Last char gets remainder
      : Math.round(handPoints.length * ratio);

    result.push(handPoints.slice(handOffset, handOffset + count));
    handOffset += count;
  }

  return result;
}

/**
 * Match hand points to glyph points for a single character
 * using nearest-neighbor greedy matching.
 *
 * Resamples both point sets to equal count, then for each
 * glyph point finds the closest unmatched hand point.
 */
function matchCharacter(
  handPoints: Point[],
  glyphPoints: Point[],
  charIndex: number,
): MatchedPair[] {
  if (handPoints.length === 0 || glyphPoints.length === 0) return [];

  const count = Math.max(handPoints.length, glyphPoints.length);
  const hand = resamplePoints(handPoints, count);
  const font = resamplePoints(glyphPoints, count);

  return greedyNearestNeighbor(hand, font, charIndex);
}

/**
 * Nearest-neighbor greedy matching: for each font point,
 * find the closest unmatched hand point.
 *
 * Complexity: O(n^2) — acceptable for n <= ~400 points.
 */
function greedyNearestNeighbor(
  hand: Point[],
  font: Point[],
  charIndex: number,
): MatchedPair[] {
  const count = hand.length;
  const used = new Set<number>();
  const pairs: MatchedPair[] = [];

  for (let fi = 0; fi < count; fi++) {
    const fp = font[fi]!;
    let bestDistSq = Infinity;
    let bestHi = 0;

    for (let hi = 0; hi < count; hi++) {
      if (used.has(hi)) continue;
      const dx = fp.x - hand[hi]!.x;
      const dy = fp.y - hand[hi]!.y;
      const distSq = dx * dx + dy * dy; // Skip sqrt — comparison only

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestHi = hi;
      }
    }

    used.add(bestHi);
    pairs.push({
      hand: hand[bestHi]!,
      font: fp,
      charIndex,
      pointIndex: fi,
    });
  }

  return pairs;
}
