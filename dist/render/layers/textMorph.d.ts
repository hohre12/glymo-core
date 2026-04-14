import { MorphFrame } from '../../types.js';
/**
 * Render a FontMorphAnimator frame — connected glow path + per-segment main stroke.
 *
 * Gap detection: segments whose squared distance exceeds 400 (20 px) start a new sub-path.
 */
export declare function renderTextMorph(ctx: CanvasRenderingContext2D, frame: MorphFrame): void;
