// ── Visual-regression helpers ───────────────────────────────────────
//
// Headless rendering of pipeline-produced strokes via @napi-rs/canvas.
// Image comparison via pixelmatch + pngjs (same stack the jest/vitest
// image-snapshot libraries sit on). No browser, no WebGPU, no DOM — the
// whole thing runs inside Vitest's node environment.

import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatchModule from 'pixelmatch';

import { CaptureStage } from '../../src/pipeline/stages/CaptureStage.js';
import { PressureStage, PressureTaper } from '../../src/pipeline/stages/PressureStage.js';
import { SegmentStage } from '../../src/pipeline/stages/SegmentStage.js';
import { SmoothStage } from '../../src/pipeline/stages/SmoothStage.js';
import { StabilizeStage } from '../../src/pipeline/stages/StabilizeStage.js';
import type { RawInputPoint, StrokePoint } from '../../src/types.js';

// pixelmatch publishes as a CJS default-export; normalise for ESM imports.
const pixelmatch = (pixelmatchModule as unknown as { default?: typeof pixelmatchModule }).default
  ?? (pixelmatchModule as unknown as typeof pixelmatchModule);

const HERE = dirname(fileURLToPath(import.meta.url));
export const SNAPSHOT_DIR = join(HERE, '__snapshots__');

export const CANVAS_SIZE = 256;

/** Per-pixel tolerance for pixelmatch (0-1, higher = more lenient). */
const MATCH_THRESHOLD = 0.1;
/** Maximum allowed differing pixels before a test fails. */
const MAX_DIFF_PIXELS = 50;

/**
 * Runs the real pipeline stages (1-5) against a raw input stroke and
 * returns the smoothed output exactly as the engine would deliver it
 * to the renderer.
 */
export function runPipeline(raw: RawInputPoint[]): StrokePoint[] {
  const capture = new CaptureStage();
  const stabilize = new StabilizeStage();
  const pressure = new PressureStage();
  const segment = new SegmentStage();
  const taper = new PressureTaper();
  const smooth = new SmoothStage();

  segment.penDown();
  for (const r of raw) {
    let pt = capture.createStrokePoint(r);
    pt = stabilize.process(pt);
    pt = pressure.process(pt);
    segment.process(pt);
  }
  const accumulated = segment.penUp();
  if (!accumulated) {
    throw new Error('runPipeline: stroke was discarded by SegmentStage (too short)');
  }
  const tapered = taper.processBatch(accumulated);
  return smooth.processBatch(tapered);
}

/**
 * Paints a smoothed stroke as a variable-width polyline onto a
 * fixed-size canvas. Deterministic: same input always yields the same
 * pixel output.
 */
export function renderStrokeToPng(points: StrokePoint[]): Buffer {
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext('2d');

  // Solid background — keeps PNGs diffing cleanly regardless of
  // transparent-pixel quirks in different renderers.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  drawPolyline(ctx, points);

  return canvas.toBuffer('image/png');
}

function drawPolyline(ctx: SKRSContext2D, points: StrokePoint[]): void {
  if (points.length < 2) return;

  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Width modulated by per-point pressure (slow = thick, fast = thin).
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1]!;
    const p1 = points[i]!;
    const avgPressure = (p0.pressure + p1.pressure) / 2;
    ctx.lineWidth = 1 + avgPressure * 5;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
}

/**
 * Compares `actualPng` against the golden stored at `tests/visual/__snapshots__/<name>.png`.
 *
 * - If UPDATE_SNAPSHOTS=1 is set (or the snapshot does not yet exist),
 *   the golden is (re)written and the test passes.
 * - Otherwise, decodes both PNGs, runs pixelmatch, and fails the test
 *   if more than MAX_DIFF_PIXELS pixels differ beyond MATCH_THRESHOLD.
 */
export function matchSnapshot(actualPng: Buffer, name: string): void {
  if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const goldenPath = join(SNAPSHOT_DIR, `${name}.png`);
  const shouldUpdate = process.env.UPDATE_SNAPSHOTS === '1' || !existsSync(goldenPath);

  if (shouldUpdate) {
    writeFileSync(goldenPath, actualPng);
    return;
  }

  const golden = PNG.sync.read(readFileSync(goldenPath));
  const actual = PNG.sync.read(actualPng);

  if (golden.width !== actual.width || golden.height !== actual.height) {
    throw new Error(
      `[visual] size mismatch for ${name}: golden=${golden.width}x${golden.height} actual=${actual.width}x${actual.height}`,
    );
  }

  const diff = new PNG({ width: golden.width, height: golden.height });
  const diffPixels = pixelmatch(
    golden.data,
    actual.data,
    diff.data,
    golden.width,
    golden.height,
    { threshold: MATCH_THRESHOLD },
  );

  if (diffPixels > MAX_DIFF_PIXELS) {
    // Emit a side-by-side diff artefact next to the golden so failures
    // are inspectable locally / in CI.
    const diffPath = join(SNAPSHOT_DIR, `${name}.diff.png`);
    writeFileSync(diffPath, PNG.sync.write(diff));
    throw new Error(
      `[visual] ${name}: ${diffPixels} pixels differ (allowed ≤ ${MAX_DIFF_PIXELS}). See ${diffPath}.`,
    );
  }
}

// ── Fixtures: deterministic raw-input strokes ─────────────────────────

/** A clockwise circle sampled at 64 evenly-spaced angles. */
export function circleFixture(): RawInputPoint[] {
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  const r = 80;
  const N = 64;
  const points: RawInputPoint[] = [];
  for (let i = 0; i <= N; i++) {
    const theta = (i / N) * 2 * Math.PI;
    points.push({
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
      t: i * 16, // 60 Hz
      source: 'mouse',
    });
  }
  return points;
}

/** A block capital "A": left diagonal, right diagonal, crossbar — as one stroke. */
export function letterAFixture(): RawInputPoint[] {
  // Three legs, sampled with a consistent step so the polyline tracks
  // pipeline smoothing realistically.
  const segments: Array<[number, number, number, number]> = [
    [80, 200, 128, 60],   // left diagonal up
    [128, 60, 176, 200],  // right diagonal down
    [100, 140, 156, 140], // crossbar
  ];
  const STEP = 12;
  const points: RawInputPoint[] = [];
  let t = 0;
  for (const [x0, y0, x1, y1] of segments) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.ceil(len / STEP));
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      points.push({
        x: x0 + dx * f,
        y: y0 + dy * f,
        t,
        source: 'mouse',
      });
      t += 16;
    }
  }
  return points;
}

/** A short cursive-ish signature built from three overlapping sine loops. */
export function signatureFixture(): RawInputPoint[] {
  const points: RawInputPoint[] = [];
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    // Base progresses left-to-right; amplitude modulated by a slow
    // cosine so the signature has a rise-fall-rise shape.
    const x = 40 + f * 176;
    const envelope = 30 * (0.5 + 0.5 * Math.cos(f * Math.PI));
    const y = CANVAS_SIZE / 2 + envelope * Math.sin(f * 4 * Math.PI);
    points.push({ x, y, t: i * 16, source: 'mouse' });
  }
  return points;
}
