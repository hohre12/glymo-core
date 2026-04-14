import { BatchPipelineStage, StrokePoint } from '../../types.js';
/**
 * Stage 5: SMOOTH — Chaikin Corner-Cutting (design.md SS4.5)
 *
 * Transforms angular polyline into smooth curve.
 * Runs as batch operation on completed strokes (not per-frame).
 * Exactly 4 iterations required (IMMUTABLE).
 *
 * All four fields (x, y, t, pressure) are interpolated identically.
 * Start and end points are preserved exactly.
 */
export declare class SmoothStage implements BatchPipelineStage {
    readonly name = "smooth";
    /** Apply Chaikin corner-cutting x4 to a completed stroke */
    processBatch(points: StrokePoint[]): StrokePoint[];
    reset(): void;
}
