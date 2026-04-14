export declare const GIF_FPS = 20;
export declare const GIF_DURATION_MS = 2000;
export declare const GIF_MAX_FRAMES = 40;
export declare const GIF_SIZE_WARN_BYTES = 5000000;
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
/**
 * Export canvas content as an animated GIF Blob.
 *
 * Uses gifenc to encode frames captured via ctx.getImageData().
 * Defaults: 20fps, 2000ms duration, 40 max frames, 5MB size warning.
 */
export declare function exportGIF(canvas: HTMLCanvasElement, options?: GIFExportOptions): Promise<Blob>;
