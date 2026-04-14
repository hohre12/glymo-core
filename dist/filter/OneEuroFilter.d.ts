/** Minimum cutoff frequency (Hz). Strong smoothing at rest. */
export declare const MIN_CUTOFF = 1;
/** Speed coefficient. Smoothing release during fast movement. */
export declare const BETA = 0.007;
/** Derivative cutoff frequency. Usually fixed. */
export declare const D_CUTOFF = 1;
/**
 * 1D OneEuroFilter. Use one instance per axis (X and Y independently).
 *
 * Algorithm (design.md SS4.2.1):
 * 1. Compute velocity (derivative) of input signal
 * 2. Smooth velocity with fixed-cutoff low-pass
 * 3. Compute adaptive cutoff: faster motion = higher cutoff (less smoothing)
 * 4. Apply low-pass filter with adaptive cutoff to position
 */
export declare class OneEuroFilter {
    private xPrev;
    private dxPrev;
    private tPrev;
    private initialized;
    private readonly minCutoff;
    private readonly beta;
    private readonly dCutoff;
    constructor(minCutoff?: number, beta?: number, dCutoff?: number);
    /** Filter a single value at the given timestamp (ms) */
    filter(x: number, timestamp: number): number;
    /** Reset filter state for a new stroke */
    reset(): void;
    private initializeWith;
    private computeSmoothedVelocity;
}
