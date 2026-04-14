import { PipelineStage, BatchPipelineStage, StrokePoint } from '../../types.js';
/**
 * Stage 3: PRESSURE (design.md SS4.3)
 *
 * Simulates calligraphy physics:
 * Slow movement = high pressure (thick stroke)
 * Fast movement = low pressure (thin stroke)
 */
export declare class PressureStage implements PipelineStage {
    readonly name = "pressure";
    private prevPoint;
    private inputSource;
    /** Switch the input source — adjusts speed multiplier for natural stroke weight */
    setInputSource(source: 'mouse' | 'camera'): void;
    /** Calculate velocity-based pressure for a single point */
    process(input: StrokePoint): StrokePoint;
    reset(): void;
    private calculatePressure;
}
/**
 * Applies start/end taper to a completed stroke using easeInQuad.
 * Runs as a batch operation on finalizeStroke(), not per-point.
 */
export declare class PressureTaper implements BatchPipelineStage {
    readonly name = "pressure-taper";
    processBatch(points: StrokePoint[]): StrokePoint[];
    reset(): void;
}
