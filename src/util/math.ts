import type { Point, RGB } from '../types.js';

// ── Constants ────────────────────────────────────────

const HEX_RADIX = 16;
const RGB_MAX = 255;

// ── Utility Functions ────────────────────────────────

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Euclidean distance between two points */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Convert hex color string to RGB object */
export function hexToRgb(hex: string): RGB {
  const cleaned = hex.startsWith('#') ? hex.slice(1) : hex;
  const value = parseInt(cleaned, HEX_RADIX);
  return {
    r: (value >> 16) & RGB_MAX,
    g: (value >> 8) & RGB_MAX,
    b: value & RGB_MAX,
  };
}

/** Linearly interpolate between two RGB colors */
function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/** Format RGB as CSS rgb() string */
function rgbToCss(color: RGB): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * Interpolate along a multi-stop gradient at position t (0..1).
 * Returns a CSS rgb() color string.
 */
export function lerpGradient(colors: string[], t: number): string {
  if (colors.length === 0) return 'rgb(0, 0, 0)';
  if (colors.length === 1) return rgbToCss(hexToRgb(colors[0]!));

  const clamped = clamp(t, 0, 1);
  const segmentCount = colors.length - 1;
  const scaledT = clamped * segmentCount;
  const segmentIndex = Math.min(Math.floor(scaledT), segmentCount - 1);
  const localT = scaledT - segmentIndex;

  const startColor = hexToRgb(colors[segmentIndex]!);
  const endColor = hexToRgb(colors[segmentIndex + 1]!);

  return rgbToCss(lerpRgb(startColor, endColor, localT));
}

/** Compute axis-aligned bounding box for a set of points */
export function computeBounds(points: ReadonlyArray<{ x: number; y: number }>): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 100, height: 100 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Resample points to targetCount via uniform arc-length interpolation.
 * Preserves start and end points exactly.
 */
export function resamplePoints(points: Point[], targetCount: number): Point[] {
  if (points.length < 2 || targetCount < 2) return [...points];

  const totalLength = computeTotalArcLength(points);
  if (totalLength === 0) return [...points];

  const segmentLength = totalLength / (targetCount - 1);
  // Work on a copy to avoid mutating the caller's array
  const working = points.map((p) => ({ ...p }));
  return interpolateAlongPath(working, targetCount, segmentLength);
}

/** Compute total arc length of a polyline */
function computeTotalArcLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1]!, points[i]!);
  }
  return total;
}

/** Walk along path and place points at uniform intervals */
function interpolateAlongPath(
  points: Point[],
  targetCount: number,
  segmentLength: number,
): Point[] {
  const result: Point[] = [{ x: points[0]!.x, y: points[0]!.y }];
  let carry = 0;
  let pointIdx = 1;

  while (result.length < targetCount - 1 && pointIdx < points.length) {
    const prev = points[pointIdx - 1]!;
    const curr = points[pointIdx]!;
    const d = distance(prev, curr);

    if (carry + d >= segmentLength) {
      const ratio = (segmentLength - carry) / d;
      const newPoint: Point = {
        x: prev.x + ratio * (curr.x - prev.x),
        y: prev.y + ratio * (curr.y - prev.y),
      };
      result.push(newPoint);
      // Insert the new point and reset carry
      points.splice(pointIdx, 0, newPoint);
      carry = 0;
      pointIdx++;
    } else {
      carry += d;
      pointIdx++;
    }
  }

  // Always end with the last original point
  const last = points[points.length - 1]!;
  result.push({ x: last.x, y: last.y });
  return result;
}
