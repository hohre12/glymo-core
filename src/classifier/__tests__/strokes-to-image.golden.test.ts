/**
 * Preprocessing-parity regression test for strokesToImage.
 *
 * Guards against the class of bug that triggered the "Sun → ㅋ @ 100%" incident:
 * a silent rendering mismatch between the landing classifier pipeline and the
 * Python training code (01_download_quickdraw.py → strokes_to_image).
 *
 * Golden JSON files were generated ONCE under the fixed implementation (PADDING=0,
 * lineCap=butt, lineJoin=miter, square-bbox, NO post-binarisation) and committed.
 * Any future change to strokes-to-image.ts that alters pixel output will fail here.
 *
 * NOTE: since commit 4fd6563 ("drop hard-binarisation in inference preprocessing"),
 * the preprocessor emits Canvas 2D's AA gradient unmodified, so goldens and
 * output may contain fractional values in [0, 1]. Parity depends on exact
 * pixel match, not binarisation.
 *
 * To regenerate goldens after a deliberate, reviewed change:
 *   npx vitest run --config vitest.generate.config.ts
 */

import { describe, it, expect } from 'vitest';
import { strokesToImage } from '../strokes-to-image.js';
import type { StrokePoint } from '../types.js';
import {
  SQUARE_STROKES,
  DIAGONAL_STROKES,
  SUN_STROKES,
} from './stroke-fixtures.js';
import squareGolden from './golden/square.json';
import diagonalGolden from './golden/diagonal.json';
import sunGolden from './golden/sun.json';

const SIZE = 64;
const TOTAL_PIXELS = SIZE * SIZE; // 4096

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compares a Float32Array against a golden number[].
 * Canvas 2D AA emits deterministic fractional values in [0, 1], so we use
 * ±0 tolerance — the same input on the same Canvas 2D implementation must
 * produce byte-identical output. On failure we report the first differing
 * pixel for easy debugging.
 */
function assertMatchesGolden(result: Float32Array, golden: number[], label: string): void {
  expect(result).toHaveLength(TOTAL_PIXELS);
  expect(golden).toHaveLength(TOTAL_PIXELS);

  for (let i = 0; i < TOTAL_PIXELS; i++) {
    const got = result[i];
    const want = golden[i];
    if (got !== want) {
      const row = Math.floor(i / SIZE);
      const col = i % SIZE;
      throw new Error(
        `[${label}] pixel mismatch at index ${i} (row=${row} col=${col}): ` +
        `got ${got}, expected ${want}`,
      );
    }
  }
}

// ── Golden pixel-exact regression tests ───────────────────────────────────────

describe('strokesToImage — golden regression (preprocessing parity)', () => {
  it('square: 4-corner closed box matches golden', () => {
    const result = strokesToImage(SQUARE_STROKES);
    assertMatchesGolden(result, squareGolden as number[], 'square');
  });

  it('diagonal: single stroke top-left→bottom-right matches golden', () => {
    const result = strokesToImage(DIAGONAL_STROKES);
    assertMatchesGolden(result, diagonalGolden as number[], 'diagonal');
  });

  it('sun: circle + 4 rays (the bug shape) matches golden', () => {
    const result = strokesToImage(SUN_STROKES);
    assertMatchesGolden(result, sunGolden as number[], 'sun');
  });
});

// ── Degenerate-case tests ─────────────────────────────────────────────────────

describe('strokesToImage — degenerate cases', () => {
  it('empty stroke list → all-zero 64×64', () => {
    const result = strokesToImage([]);
    expect(result).toHaveLength(TOTAL_PIXELS);
    for (let i = 0; i < TOTAL_PIXELS; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it('stroke list of empty strokes → all-zero 64×64', () => {
    const result = strokesToImage([[], []]);
    expect(result).toHaveLength(TOTAL_PIXELS);
    for (let i = 0; i < TOTAL_PIXELS; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it('single-point stroke → small dot present on black canvas', () => {
    const singlePoint: StrokePoint[][] = [
      [{ x: 50, y: 50, pressure: 0.5, timestamp: 0 }],
    ];
    const result = strokesToImage(singlePoint);
    expect(result).toHaveLength(TOTAL_PIXELS);
    // There must be at least one lit pixel (the dot drawn via ctx.arc)
    const litCount = Array.from(result).filter((v) => v > 0).length;
    expect(litCount).toBeGreaterThan(0);
    // All values remain in the valid [0, 1] range (Canvas 2D AA preserved).
    for (const v of result) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('returns Float32Array of correct length for custom canvas size', () => {
    const result = strokesToImage(SQUARE_STROKES, 32);
    expect(result).toHaveLength(32 * 32);
  });

  it('output preserves Canvas 2D AA gradient (values in [0, 1])', () => {
    // Since commit 4fd6563 the preprocessor no longer binarises; it passes
    // Canvas 2D's AA gradient through so that gradient-trained heads (text,
    // half of symbol) are not distribution-shifted at inference. Here we
    // verify the contract: every pixel is a valid [0, 1] intensity.
    const cases: [string, StrokePoint[][]][] = [
      ['square', SQUARE_STROKES],
      ['diagonal', DIAGONAL_STROKES],
      ['sun', SUN_STROKES],
    ];
    for (const [label, strokes] of cases) {
      const result = strokesToImage(strokes);
      for (let i = 0; i < result.length; i++) {
        const v = result[i]!;
        if (!(v >= 0 && v <= 1)) {
          throw new Error(`[${label}] pixel ${i} out of [0, 1]: ${v}`);
        }
      }
    }
  });
});
