/**
 * Fixed stroke patterns used by both the golden-generator and the regression
 * test. Coordinates are in arbitrary pixel units — strokesToImage normalises
 * them via bounding-box before rendering.
 */
import type { StrokePoint } from '../types.js';

function pt(x: number, y: number): StrokePoint {
  return { x, y, pressure: 0.5, timestamp: 0 };
}

// ── Square ────────────────────────────────────────────────────────────────────
// Four-corner closed box. Tests bbox normalisation and aspect-ratio handling
// (bbox is already square so no asymmetry introduced by the square-bbox path).
export const SQUARE_STROKES: StrokePoint[][] = [
  [pt(0, 0), pt(100, 0), pt(100, 100), pt(0, 100), pt(0, 0)],
];

// ── Diagonal line ─────────────────────────────────────────────────────────────
// Single stroke from top-left to bottom-right.  Tests orientation preservation:
// if normOffsetX / normOffsetY were wrong the line would shift off-centre.
export const DIAGONAL_STROKES: StrokePoint[][] = [
  [pt(0, 0), pt(100, 100)],
];

// ── Dense sun-like ────────────────────────────────────────────────────────────
// Approximated circle (16 pts) + 4 cardinal rays. Tests multi-stroke joining
// and is the canonical shape that triggered the Sun → ㅋ 100%-confidence bug.
//
// Circle: r=30 around centre (50, 50), 16 evenly-spaced vertices.
// Rays:   from circle edge to 55 px from centre.
function circlePoints(cx: number, cy: number, r: number, n: number): StrokePoint[] {
  const pts: StrokePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const angle = (i / n) * Math.PI * 2;
    pts.push(pt(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
  }
  return pts;
}

const CX = 50;
const CY = 50;
const R = 30;
const RAY = 55;

export const SUN_STROKES: StrokePoint[][] = [
  // Circle body
  circlePoints(CX, CY, R, 16),
  // Top ray
  [pt(CX, CY - R), pt(CX, CY - RAY)],
  // Bottom ray
  [pt(CX, CY + R), pt(CX, CY + RAY)],
  // Left ray
  [pt(CX - R, CY), pt(CX - RAY, CY)],
  // Right ray
  [pt(CX + R, CY), pt(CX + RAY, CY)],
];
