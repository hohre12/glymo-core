// ── PretextLayout — Text Layout Engine ──────────────
//
// Provides layout algorithms for positioning text characters:
// - Along curves / circles: pure geometry (arc-length interpolation, trigonometry)
// - Inside shapes: uses @chenglou/pretext for proper line-breaking + measurement
//
// pretext handles: word boundaries, CJK keep-all, Unicode graphemes, soft hyphens.
// We handle: geometric positioning, tangent rotation, scan-line polygon intersection.

import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext';
import type { LayoutCursor } from '@chenglou/pretext';
import type { Point } from '../types.js';
import type { PositionedChar } from './types.js';
import { distance } from '../util/math.js';

// ── Constants ───────────────────────────────────────

const TWO_PI = Math.PI * 2;
const DEFAULT_FONT_SIZE = 16;
const SHAPE_FILL_PADDING = 4;
const DEFAULT_LINE_HEIGHT_RATIO = 1.4;

// ── Public API ──────────────────────────────────────

/**
 * Position characters along a stroke path, with rotation aligned
 * to the tangent at each placement point.
 *
 * Characters are spaced at equal arc-length intervals along the path.
 */
export function layoutTextAlongCurve(
  text: string,
  strokePath: Point[],
  fontSize: number = DEFAULT_FONT_SIZE,
): PositionedChar[] {
  if (text.length === 0 || strokePath.length < 2) return [];

  const arcLengths = computeArcLengths(strokePath);
  const totalLength = arcLengths[arcLengths.length - 1]!;

  if (totalLength === 0) return [];

  const minSpacing = fontSize * 0.6;
  const charSpacing = Math.max(minSpacing, totalLength / text.length);
  const result: PositionedChar[] = [];

  for (let i = 0; i < text.length; i++) {
    const targetDist = charSpacing * (i + 0.5);
    const { point, tangentAngle } = samplePathAtDistance(
      strokePath, arcLengths, targetDist,
    );

    result.push({
      char: text[i]!,
      x: point.x,
      y: point.y,
      rotation: tangentAngle,
      scale: 1,
    });
  }

  return result;
}

/**
 * Position characters evenly around a circle.
 */
export function layoutTextInCircle(
  text: string,
  center: Point,
  radius: number,
  startAngle: number = 0,
): PositionedChar[] {
  if (text.length === 0 || radius <= 0) return [];

  const angleStep = TWO_PI / text.length;
  const result: PositionedChar[] = [];

  for (let i = 0; i < text.length; i++) {
    const angle = startAngle + angleStep * i;
    result.push({
      char: text[i]!,
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      rotation: angle + Math.PI / 2,
      scale: 1,
    });
  }

  return result;
}

/**
 * Distribute text lines within a closed stroke path.
 *
 * Uses @chenglou/pretext for proper line-breaking (word boundaries,
 * CJK keep-all, Unicode graphemes), then positions each line's characters
 * within the shape using scan-line polygon intersection for per-row width.
 */
export function layoutTextInShape(
  text: string,
  closedPath: Point[],
  fontSize: number = DEFAULT_FONT_SIZE,
): PositionedChar[] {
  if (text.length === 0 || closedPath.length < 3) return [];

  const bbox = computeBBox(closedPath);
  const lineHeight = fontSize * DEFAULT_LINE_HEIGHT_RATIO;
  const font = `${fontSize}px sans-serif`;
  const result: PositionedChar[] = [];

  // Prepare text for layout with pretext (handles word-break, CJK, etc.)
  const prepared = prepareWithSegments(text, font);
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };

  for (
    let y = bbox.minY + SHAPE_FILL_PADDING + lineHeight / 2;
    y < bbox.maxY - SHAPE_FILL_PADDING;
    y += lineHeight
  ) {
    const span = scanLineIntersection(closedPath, y, bbox);
    if (!span) continue;

    const rowWidth = span.maxX - span.minX - SHAPE_FILL_PADDING * 2;
    if (rowWidth < fontSize * 0.5) continue;

    // Use pretext to break text into a line that fits this row width
    const line = layoutNextLine(prepared, cursor, rowWidth);
    if (line === null) break; // No more text to lay out

    const rowStart = span.minX + SHAPE_FILL_PADDING;
    const charWidth = line.text.length > 0 ? line.width / line.text.length : 0;

    for (let i = 0; i < line.text.length; i++) {
      const ch = line.text[i]!;
      if (ch.trim() === '') continue; // Skip whitespace characters in positioning
      result.push({
        char: ch,
        x: rowStart + charWidth * (i + 0.5),
        y,
        rotation: 0,
        scale: 1,
      });
    }

    cursor = line.end; // Advance cursor to continue from where this line ended
  }

  return result;
}

/**
 * Measure text dimensions using pretext (no DOM reflow).
 * Returns line count and total height for a given width constraint.
 */
export function measureText(
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
): { lineCount: number; height: number; lines: string[] } {
  const prepared = prepareWithSegments(text, font);
  const lines: string[] = [];
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };

  while (true) {
    const line = layoutNextLine(prepared, cursor, maxWidth);
    if (line === null) break;
    lines.push(line.text);
    cursor = line.end;
  }

  return {
    lineCount: lines.length,
    height: lines.length * lineHeight,
    lines,
  };
}

// ── Internal Helpers ────────────────────────────────

function computeArcLengths(path: Point[]): number[] {
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    lengths.push(lengths[i - 1]! + distance(path[i - 1]!, path[i]!));
  }
  return lengths;
}

function samplePathAtDistance(
  path: Point[],
  arcLengths: number[],
  targetDist: number,
): { point: Point; tangentAngle: number } {
  const clamped = Math.max(0, Math.min(targetDist, arcLengths[arcLengths.length - 1]!));

  let lo = 0;
  let hi = arcLengths.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (arcLengths[mid]! <= clamped) lo = mid;
    else hi = mid;
  }

  const segLen = arcLengths[hi]! - arcLengths[lo]!;
  const t = segLen > 0 ? (clamped - arcLengths[lo]!) / segLen : 0;

  const a = path[lo]!;
  const b = path[hi]!;

  return {
    point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
    tangentAngle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

function computeBBox(points: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function scanLineIntersection(
  polygon: Point[],
  y: number,
  bbox: { minX: number; maxX: number },
): { minX: number; maxX: number } | null {
  const xs: number[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % n]!;
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      const t = (y - a.y) / (b.y - a.y);
      xs.push(a.x + t * (b.x - a.x));
    }
  }

  if (xs.length < 2) return null;
  xs.sort((a, b) => a - b);
  return {
    minX: Math.max(xs[0]!, bbox.minX),
    maxX: Math.min(xs[xs.length - 1]!, bbox.maxX),
  };
}
