// ── PNG Export ───────────────────────────────────────

/**
 * Export canvas content as a PNG Blob.
 *
 * Uses the native canvas.toBlob API wrapped in a Promise.
 * Validates that the canvas has non-zero dimensions before export.
 */
export function exportPNG(canvas: HTMLCanvasElement): Promise<Blob> {
  validateCanvas(canvas);

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('canvas.toBlob returned null'));
          }
        },
        'image/png',
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

// ── Validation ──────────────────────────────────────

function validateCanvas(canvas: HTMLCanvasElement): void {
  if (canvas.width <= 0 || canvas.height <= 0) {
    throw new Error(
      `Invalid canvas dimensions: ${canvas.width}x${canvas.height}`,
    );
  }
}
