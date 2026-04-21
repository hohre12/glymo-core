// Convert stroke data to a 64x64 grayscale Float32Array for ONNX model input.
// Normalizes coordinates and renders strokes as white lines on black background.
//
// This MUST mirror the training pipeline. Three of the four TYPE training
// sources render with anti-aliased gradients (synthetic vector_strokes.py
// uses cv2.LINE_AA, AI-Hub korean.py:185 ingests real grayscale PNG, EMNIST
// 02_prepare_emnist.py:111 uses bilinear upscale); only QuickDraw
// (01_download_quickdraw.py:190) renders hard-binary with cv2.line LINE_8.
// We therefore preserve Canvas 2D's native AA gradient here — binarising
// would forcibly mismatch three of the four sources.
//
//   • PADDING = 0 — training maps normalized x/y to the full 0..size-1 range
//     using `int(nx * (size - 1))`. A non-zero padding here would shrink the
//     stroke relative to training data and push type-classifier toward wrong
//     classes (we observed Sun → ㅋ @ 100% from a 4px padding mismatch).
//   • LINE_CAP / LINE_JOIN = flat — training uses cv2.line / cv2.polylines
//     which have square ends; round caps introduce bulbs the model hasn't seen.
//   • No post-binarisation — see the long comment at the pixel loop below.

import type { StrokePoint } from './types.js';

const DEFAULT_CANVAS_SIZE = 64;
const PADDING = 0;
const LINE_WIDTH = 2;

/**
 * Convert an array of strokes into a grayscale Float32Array image.
 * Each stroke is an array of StrokePoints with coordinates in any range
 * (pixel, normalized, etc.). The function auto-normalizes via bounding box.
 * Returns a Float32Array of length canvasSize * canvasSize where values are 0.0 (black) to 1.0 (white).
 */
export function strokesToImage(
  strokes: StrokePoint[][],
  canvasSize: number = DEFAULT_CANVAS_SIZE,
): Float32Array {
  const totalPixels = canvasSize * canvasSize;
  const result = new Float32Array(totalPixels);

  // No strokes: return blank image
  if (strokes.length === 0 || strokes.every((s) => s.length === 0)) {
    return result;
  }

  // Flatten all points to find bounding box
  const allPoints = strokes.flat();
  if (allPoints.length === 0) {
    return result;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  // Handle degenerate case where all points are identical
  const rangeX = maxX - minX || 0.001;
  const rangeY = maxY - minY || 0.001;

  // Square-bbox normalize THEN map to 0..(canvasSize-1), matching training
  // (01_download_quickdraw.py lines 106-124 + 156-159). Training embeds the
  // stroke inside a square bounding box of side `max_range`, not a rectangle,
  // then scales that square to fill the entire image. Using rectangular
  // aspect-ratio fit would stretch the drawing to the full canvas (losing
  // aspect ratio); the square-bbox approach keeps aspect while still filling
  // the image in the larger dimension.
  const maxRange = Math.max(rangeX, rangeY);
  const normOffsetX = (maxRange - rangeX) / 2;
  const normOffsetY = (maxRange - rangeY) / 2;
  const drawArea = canvasSize - PADDING * 2;
  const pixelSpan = drawArea - 1; // matches `size - 1` in training

  // Use OffscreenCanvas if available, otherwise fall back to regular canvas
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  let canvas: HTMLCanvasElement | OffscreenCanvas;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(canvasSize, canvasSize);
    const renderCtx = canvas.getContext('2d');
    if (!renderCtx) {
      console.warn('Failed to get OffscreenCanvas 2D context');
      return result;
    }
    ctx = renderCtx;
  } else if (typeof document !== 'undefined') {
    const htmlCanvas = document.createElement('canvas');
    htmlCanvas.width = canvasSize;
    htmlCanvas.height = canvasSize;
    const renderCtx = htmlCanvas.getContext('2d');
    if (!renderCtx) {
      console.warn('Failed to get Canvas 2D context');
      return result;
    }
    canvas = htmlCanvas;
    ctx = renderCtx;
  } else {
    // No canvas available (SSR) -- return blank
    return result;
  }

  // Black background
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Draw strokes as white lines. Flat caps/joins mirror cv2.line in training;
  // round caps produce bulbs at endpoints/corners that the model never saw.
  ctx.strokeStyle = 'white';
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 10;

  const projectX = (x: number): number =>
    PADDING + ((x - minX + normOffsetX) / maxRange) * pixelSpan;
  const projectY = (y: number): number =>
    PADDING + ((y - minY + normOffsetY) / maxRange) * pixelSpan;

  for (const stroke of strokes) {
    if (stroke.length === 0) continue;

    ctx.beginPath();

    const firstPt = stroke[0]!;
    const startX = projectX(firstPt.x);
    const startY = projectY(firstPt.y);
    ctx.moveTo(startX, startY);

    for (let i = 1; i < stroke.length; i++) {
      const pt = stroke[i]!;
      ctx.lineTo(projectX(pt.x), projectY(pt.y));
    }

    // If stroke is a single point, draw a small dot
    if (stroke.length === 1) {
      ctx.arc(startX, startY, LINE_WIDTH / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
    } else {
      ctx.stroke();
    }
  }

  // Extract pixel data as grayscale Float32Array.
  //
  // Phase 1.5 RCA (2026-04-13): the previous version binarised every pixel
  // at 0.4 to "match cv2.line LINE_8" — but that comment was based on
  // looking only at QuickDraw's ingest (01_download_quickdraw.py:190).
  // Synthetic vectors (vector_strokes.py:807) use cv2.LINE_AA, AI-Hub
  // PNGs (korean.py:185) are real grayscale, and EMNIST (02_prepare_emnist
  // .py:111) uses bilinear upscale. THREE of the four TYPE training
  // sources are gradient (anti-aliased) — only QuickDraw is hard-binary.
  //
  // Forcing inference to hard-binary biased TYPE strongly toward DRAWING /
  // QuickDraw-symbol classes (binary stroke distribution match) and away
  // from TEXT (gradient distribution mismatch). Confirmed by user tests
  // 2026-04-13: ㄸ → 웃는얼굴, 9 → △, ㄷ → △ — every TEXT input mis-routed.
  //
  // Canonical fix: pass the Canvas 2D AA gradient through unmodified.
  // cv2.LINE_AA and Canvas 2D AA are both Gaussian-like over 1-2 pixel
  // bands, so the resulting distribution is close enough that gradient-
  // trained heads (text + half of symbol) generalise. QuickDraw-trained
  // heads (drawing + half of symbol) take a smaller hit because their
  // stroke shapes are visually distinctive enough to survive the AA
  // softening. The proper fix (re-render QuickDraw with LINE_AA + retrain
  // all four heads) is Phase 2; this is the Phase 1 immediate mitigation.
  const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
  const pixels = imageData.data; // RGBA

  for (let i = 0; i < totalPixels; i++) {
    // Use red channel since we drew white on black (all channels are equal)
    result[i] = (pixels[i * 4] ?? 0) / 255;
  }

  return result;
}
