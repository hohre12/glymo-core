import { PipelineStage, StrokePoint } from '../../types.js';
/** Hard cap on in-memory points per stroke. 10000 ≈ 167 s at 60 Hz — longer than any realistic single stroke; protects against runaway pen-stuck-down input. */
export declare const MAX_POINTS = 10000;
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
    /** Points dropped after the buffer hit MAX_POINTS during the current stroke. */
    private droppedThisStroke;
    /** Whether the MAX_POINTS warning has already been emitted for the current stroke. */
    private capWarned;
    /**
     * Accumulate points during drawing (capped at MAX_POINTS).
     *
     * On overflow, further incoming points are silently dropped — FIFO-freeze,
     * not ring buffer. This preserves the stroke's start anchor (load-bearing
     * for morph matching) at the cost of losing the tail. Acceptable because
     * MAX_POINTS=10000 ≈ 167s at 60Hz — longer than any realistic single
     * stroke; the cap is an abuse-protection safety valve, not a normal path.
     */
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
    /** Number of points dropped because the MAX_POINTS cap was hit during the current stroke. Cleared on every penDown(). */
    getDroppedCount(): number;
    reset(): void;
}
