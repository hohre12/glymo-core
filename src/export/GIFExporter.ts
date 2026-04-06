// ── GIF Export ───────────────────────────────────────

import { GIFEncoder, quantize, applyPalette } from 'gifenc';

// ── Constants ───────────────────────────────────────

export const GIF_FPS = 20;
export const GIF_DURATION_MS = 2000;
export const GIF_MAX_FRAMES = 40;
export const GIF_SIZE_WARN_BYTES = 5_000_000;

// ── Types ───────────────────────────────────────────

/**
 * Optional replay function that advances the animation by one frame.
 * Called before each frame capture so the canvas reflects a new state.
 * Receives the 0-based frame index and total frame count.
 */
export type ReplayFn = (frameIndex: number, totalFrames: number) => void;

export interface GIFExportOptions {
  fps?: number;
  durationMs?: number;
  maxFrames?: number;
  onProgress?: (pct: number) => void;
  /** If provided, called before each frame capture to advance animation */
  replay?: ReplayFn;
}

// ── Main Export Function ────────────────────────────

/**
 * Export canvas content as an animated GIF Blob.
 *
 * Uses gifenc to encode frames captured via ctx.getImageData().
 * Defaults: 20fps, 2000ms duration, 40 max frames, 5MB size warning.
 */
export function exportGIF(
  canvas: HTMLCanvasElement,
  options?: GIFExportOptions,
): Promise<Blob> {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(
      new Error('Cannot get 2D context — GIF export requires a browser'),
    );
  }

  validateCanvas(canvas);

  const fps = options?.fps ?? GIF_FPS;
  const durationMs = options?.durationMs ?? GIF_DURATION_MS;
  const maxFrames = options?.maxFrames ?? GIF_MAX_FRAMES;
  const onProgress = options?.onProgress;
  const replay = options?.replay;

  const frameCount = Math.min(
    Math.floor((durationMs / 1000) * fps),
    maxFrames,
  );
  const delayMs = Math.round(1000 / fps);

  return encodeFrames(canvas, ctx, frameCount, delayMs, onProgress, replay);
}

// ── Encoding ────────────────────────────────────────

async function encodeFrames(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  frameCount: number,
  delayMs: number,
  onProgress?: (pct: number) => void,
  replay?: ReplayFn,
): Promise<Blob> {
  const { width, height } = canvas;
  const encoder = GIFEncoder();

  try {
    for (let i = 0; i < frameCount; i++) {
      if (replay) {
        replay(i, frameCount);
      } else {
        // Wait for the next render frame so the RAF-based render loop
        // produces a new canvas state (particles, morphing, etc.)
        await waitForFrame();
      }

      const imageData = ctx.getImageData(0, 0, width, height);
      const { data } = imageData;

      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);

      encoder.writeFrame(index, width, height, {
        palette,
        delay: delayMs,
      });

      if (onProgress) {
        const pct = Math.round(((i + 1) / frameCount) * 100);
        onProgress(pct);
      }
    }

    encoder.finish();
  } catch (err) {
    try { encoder.finish(); } catch { /* best-effort cleanup */ }
    throw err;
  }

  const bytes = encoder.bytes();
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/gif' });

  if (blob.size > GIF_SIZE_WARN_BYTES) {
    console.warn(
      `GIF size (${blob.size} bytes) exceeds ${GIF_SIZE_WARN_BYTES} byte limit`,
    );
  }

  return blob;
}

/** Wait for the next animation frame so the render loop updates the canvas. */
function waitForFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// ── Validation ──────────────────────────────────────

function validateCanvas(canvas: HTMLCanvasElement): void {
  if (canvas.width <= 0 || canvas.height <= 0) {
    throw new Error(
      `Invalid canvas dimensions: ${canvas.width}x${canvas.height}`,
    );
  }
}
