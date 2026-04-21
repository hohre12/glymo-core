/**
 * ONE-TIME golden-file generator. NOT part of the regular test suite.
 *
 * Run once under the FIXED implementation to capture parity-aligned goldens:
 *
 *   cd landing
 *   npx vitest run lib/classifier/__tests__/__generate-goldens__.test.ts
 *
 * Then commit the produced golden/*.json files alongside the regression test.
 * Do not run this file again unless you intentionally want to re-baseline
 * (e.g. after a deliberate, reviewed change to strokes-to-image.ts).
 *
 * This file is excluded from regular `npm test` runs via vitest.config.ts
 * (exclude: ['**\/__generate-goldens__*']).
 */

import { beforeAll, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { strokesToImage } from '../strokes-to-image.js';
import type { StrokePoint } from '../types.js';
import {
  SQUARE_STROKES,
  DIAGONAL_STROKES,
  SUN_STROKES,
} from './stroke-fixtures.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(__dirname, 'golden');

function makeGolden(name: string, strokes: StrokePoint[][]): void {
  const result = strokesToImage(strokes);
  const arr = Array.from(result) as number[];
  writeFileSync(join(goldenDir, `${name}.json`), JSON.stringify(arr));
  console.log(
    `  [golden] wrote ${name}.json — ${arr.filter((v) => v > 0).length} lit pixels`,
  );
}

beforeAll(() => {
  mkdirSync(goldenDir, { recursive: true });
  makeGolden('square', SQUARE_STROKES);
  makeGolden('diagonal', DIAGONAL_STROKES);
  makeGolden('sun', SUN_STROKES);
});

it('golden files were written', () => {
  // Sanity: the generator itself verifies the files exist by reaching this point.
  // If strokesToImage threw or FS writes failed, beforeAll would have aborted.
  expect(true).toBe(true);
});
