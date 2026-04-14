import { PipelineStage, StrokePoint, RawInputPoint } from '../../types.js';
/**
 * Stage 1: CAPTURE (design.md SS4.1)
 *
 * Wraps raw input into StrokePoint format.
 * For mouse/touch, this is a thin pass-through since MouseCapture
 * already handles coordinate normalization.
 */
export declare class CaptureStage implements PipelineStage {
    readonly name = "capture";
    /** Convert a RawInputPoint to a StrokePoint with default pressure */
    createStrokePoint(raw: RawInputPoint): StrokePoint;
    /** Per-point pass-through (already in StrokePoint format) */
    process(input: StrokePoint): StrokePoint;
    reset(): void;
}
