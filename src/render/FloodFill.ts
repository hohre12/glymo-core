// ── Flood Fill Algorithm ─────────────────────────────

import type { Stroke } from '../types.js';

/**
 * Create a stroke mask for flood fill boundary detection.
 * Renders all strokes as white on black, with gap closing via thicker lines.
 */
export function createStrokeMask(
  strokes: readonly Stroke[],
  width: number,
  height: number,
  gapCloseRadius: number = 5,
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  // Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // Draw strokes as white lines with extra width for gap closing
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of strokes) {
    const points = stroke.smoothed;
    if (points.length < 2) continue;

    // Use a fixed base width + gap close radius for the mask
    const baseWidth = 8;
    ctx.lineWidth = baseWidth + gapCloseRadius * 2;

    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();
  }

  return canvas;
}

/**
 * Scanline flood fill algorithm.
 * Fast: processes entire horizontal spans at once.
 * Returns an ImageData with the fill (transparent elsewhere), or null if start point is on a boundary.
 */
export function scanlineFill(
  maskData: ImageData,
  startX: number,
  startY: number,
  fillColor: { r: number; g: number; b: number; a: number },
): ImageData | null {
  const { width, height, data: mask } = maskData;

  // Check if start point is on a boundary (white pixel = stroke)
  const startIdx = (startY * width + startX) * 4;
  if ((mask[startIdx] ?? 0) > 128) return null; // On a stroke

  // Output image
  const output = new ImageData(width, height);
  const out = output.data;

  // Visited tracking via a Uint8Array (faster than checking output pixels)
  const visited = new Uint8Array(width * height);

  // Stack-based scanline fill
  const stack: [number, number][] = [[startX, startY]];

  const isOpen = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = y * width + x;
    if (visited[idx]) return false;
    return (mask[idx * 4] ?? 0) <= 128; // Dark pixel = fillable
  };

  const fillPixel = (x: number, y: number): void => {
    const idx = y * width + x;
    visited[idx] = 1;
    const px = idx * 4;
    out[px] = fillColor.r;
    out[px + 1] = fillColor.g;
    out[px + 2] = fillColor.b;
    out[px + 3] = fillColor.a;
  };

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (!isOpen(x, y)) continue;

    // Scan left
    let left = x;
    while (left > 0 && isOpen(left - 1, y)) left--;

    // Scan right
    let right = x;
    while (right < width - 1 && isOpen(right + 1, y)) right++;

    // Fill the span
    for (let i = left; i <= right; i++) {
      fillPixel(i, y);
    }

    // Check row above and below for new spans
    for (const dy of [-1, 1]) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      let i = left;
      while (i <= right) {
        // Skip boundary pixels
        while (i <= right && !isOpen(i, ny)) i++;
        if (i > right) break;
        // Found start of a new span
        stack.push([i, ny]);
        // Skip to end of this open region
        while (i <= right && isOpen(i, ny)) i++;
      }
    }
  }

  return output;
}

/**
 * High-level fill API: create mask, run scanline fill, return ImageBitmap.
 */
export async function executeFill(
  strokes: readonly Stroke[],
  canvasWidth: number,
  canvasHeight: number,
  startX: number,
  startY: number,
  color: string,
  gapCloseRadius: number = 5,
): Promise<ImageBitmap | null> {
  if (strokes.length === 0) return null;

  // Clamp start coordinates
  const sx = Math.max(0, Math.min(canvasWidth - 1, Math.round(startX)));
  const sy = Math.max(0, Math.min(canvasHeight - 1, Math.round(startY)));

  // Create boundary mask
  const mask = createStrokeMask(strokes, canvasWidth, canvasHeight, gapCloseRadius);
  const maskCtx = mask.getContext('2d')!;
  const maskData = maskCtx.getImageData(0, 0, canvasWidth, canvasHeight);

  // Parse CSS color to RGBA using a temporary canvas pixel
  const parseCanvas = new OffscreenCanvas(1, 1);
  const parseCtx = parseCanvas.getContext('2d')!;
  parseCtx.fillStyle = color;
  parseCtx.fillRect(0, 0, 1, 1);
  const colorData = parseCtx.getImageData(0, 0, 1, 1).data;
  const r = colorData[0] ?? 0;
  const g = colorData[1] ?? 0;
  const b = colorData[2] ?? 0;

  // Run scanline fill
  const fillData = scanlineFill(maskData, sx, sy, { r, g, b, a: 255 });
  if (!fillData) return null;

  // Convert to ImageBitmap
  return createImageBitmap(fillData);
}
