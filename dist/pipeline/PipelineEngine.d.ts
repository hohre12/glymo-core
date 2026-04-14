import { RawInputPoint, StrokePoint } from '../types.js';
import { EventBus } from '../state/EventBus.js';
/**
 * Orchestrates stages 1-5 of the 6-stage pipeline:
 * Capture -> Stabilize -> Pressure -> Segment -> Smooth
 *
 * Stage 6 (Effect) is applied by the renderer (see CanvasRenderer /
 * WebGPURenderer) at paint time, not by this engine.
 *
 * Processes points sequentially through real-time stages (1-3) and
 * accumulates them in Segment (stage 4); batch stages (Pressure taper
 * + Smooth) run on stroke finalization in penUp().
 */
export declare class PipelineEngine {
    private readonly captureStage;
    private readonly realTimeStages;
    private readonly stabilizeStage;
    private readonly pressureStage;
    private readonly segmentStage;
    private readonly smoothStage;
    private readonly pressureTaper;
    private readonly eventBus;
    /** Monotonic stroke counter. Assigned at penDown(), consumed by diag events. */
    private strokeCounter;
    /** Id of the currently in-progress stroke; empty between strokes. */
    private activeStrokeId;
    /** Points accumulated into segment since penDown — diag accounting. */
    private accumulatedCount;
    /** Points dropped inside realTime stages (stabilize/pressure reject). */
    private droppedRealTimeCount;
    constructor(eventBus: EventBus);
    /**
     * Propagate the input source to all source-aware pipeline stages.
     * Call this whenever the input device changes (mouse ↔ camera).
     */
    setInputSource(source: 'mouse' | 'camera'): void;
    /** Process a raw input point through the real-time pipeline (stages 1-3) */
    processPoint(raw: RawInputPoint): StrokePoint;
    /** Signal pen down to start a new stroke */
    penDown(): void;
    /**
     * Signal pen up — finalize the current stroke.
     * Applies taper (batch) and Chaikin smoothing (batch).
     * Returns { raw, smoothed } or null if stroke was too short.
     */
    penUp(): FinalizedStroke | null;
    /** Get current in-progress points (for live rendering) */
    getActivePoints(): ReadonlyArray<StrokePoint>;
    /** Check if currently drawing */
    isDrawing(): boolean;
    /** Reset all stages for a fresh state */
    reset(): void;
}
/** Result of finalizing a stroke through the pipeline */
export interface FinalizedStroke {
    raw: StrokePoint[];
    smoothed: StrokePoint[];
}
