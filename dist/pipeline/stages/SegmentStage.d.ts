import { PipelineStage, StrokePoint } from '../../types.js';
/**
 * Stage 4: SEGMENT (design.md SS4.4)
 *
 * Detects pen state transitions and separates continuous input
 * into discrete strokes. For mouse/touch, pen state comes from
 * pointerdown/pointerup events via InputManager.
 */
export declare class SegmentStage implements PipelineStage {
    readonly name = "segment";
    private currentPoints;
    private isDrawing;
    /** Accumulate points during drawing */
    process(input: StrokePoint): StrokePoint;
    /** Signal pen down — start accumulating a new stroke */
    penDown(): void;
    /**
     * Signal pen up — finalize the current stroke.
     * Returns accumulated points if valid (>3 points), null otherwise.
     */
    penUp(): StrokePoint[] | null;
    /** Get the current in-progress points (for live rendering) */
    getCurrentPoints(): ReadonlyArray<StrokePoint>;
    /** Check if currently accumulating a stroke */
    getIsDrawing(): boolean;
    reset(): void;
}
