import { CorrectionOptions, Stroke, StrokePoint } from '../types.js';
import { SmoothStage } from '../pipeline/stages/SmoothStage.js';
/**
 * Orchestrates stroke correction: overshoot trim → endpoint snap → re-smooth.
 *
 * Special handling:
 * - If a stroke appears to be self-closing (end near start), overshoot trim
 *   is skipped because the "direction reversal" at the closing point is
 *   intentional, not an overshoot.
 */
export declare class StrokeCorrector {
    /**
     * Correct raw points only (no re-smoothing).
     * Returns corrected raw and list of applied corrections.
     */
    correctRaw(raw: readonly StrokePoint[], otherStrokes: readonly Stroke[], options?: CorrectionOptions): {
        correctedRaw: StrokePoint[];
        corrections: string[];
    };
    /**
     * Correct raw points and re-smooth via SmoothStage.
     * Returns corrected raw, corrected smoothed, and list of applied corrections.
     */
    correctAndSmooth(raw: readonly StrokePoint[], otherStrokes: readonly Stroke[], smoothStage: SmoothStage, options?: CorrectionOptions): {
        correctedRaw: StrokePoint[];
        correctedSmoothed: StrokePoint[];
        corrections: string[];
    };
    /** Check if a stroke appears to be a closed shape (end near start relative to path length) */
    private checkSelfClosing;
}
