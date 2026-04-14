/**
 * Export canvas content as a PNG Blob.
 *
 * Uses the native canvas.toBlob API wrapped in a Promise.
 * Validates that the canvas has non-zero dimensions before export.
 */
export declare function exportPNG(canvas: HTMLCanvasElement): Promise<Blob>;
