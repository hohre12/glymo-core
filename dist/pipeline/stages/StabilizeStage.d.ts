import { PipelineStage, StrokePoint } from '../../types.js';
export declare class StabilizeStage implements PipelineStage {
    readonly name = "stabilize";
    private inputSource;
    private filterX;
    private filterY;
    constructor();
    /**
     * Switch the input source and reconstruct filters with source-appropriate parameters.
     * Resets filter state so the new parameters take effect immediately.
     */
    setInputSource(source: 'mouse' | 'camera'): void;
    /** Apply independent 1D filters to x and y coordinates */
    process(input: StrokePoint): StrokePoint;
    /** Reset both axis filters for a new stroke */
    reset(): void;
}
