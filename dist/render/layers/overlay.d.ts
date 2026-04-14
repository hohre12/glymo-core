import { OverlayText } from '../../text/types.js';
/**
 * Render overlay text labels with fade-in and glow effect.
 *
 * Text is scaled to fit the stroke bounding box (capped at 3x).
 */
export declare function renderOverlayText(ctx: CanvasRenderingContext2D, overlayTexts: readonly OverlayText[], now: number): void;
