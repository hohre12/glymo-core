// OneEuroFilter — Adaptive low-pass filter (design.md SS4.2)
// Parameters are IMMUTABLE — do not change without explicit approval and testing.

const TWO_PI = 2 * Math.PI;

// ── Tuned Parameters (IMMUTABLE) ─────────────────────

/** Minimum cutoff frequency (Hz). Strong smoothing at rest. */
const MIN_CUTOFF = 1.0;

/** Speed coefficient. Smoothing release during fast movement. */
const BETA = 0.007;

/** Derivative cutoff frequency. Usually fixed. */
const D_CUTOFF = 1.0;

// ── Filter Implementation ────────────────────────────

/**
 * 1D OneEuroFilter. Use one instance per axis (X and Y independently).
 *
 * Algorithm (design.md SS4.2.1):
 * 1. Compute velocity (derivative) of input signal
 * 2. Smooth velocity with fixed-cutoff low-pass
 * 3. Compute adaptive cutoff: faster motion = higher cutoff (less smoothing)
 * 4. Apply low-pass filter with adaptive cutoff to position
 */
export class OneEuroFilter {
  private xPrev = 0;
  private dxPrev = 0;
  private tPrev = 0;
  private initialized = false;

  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;

  constructor(
    minCutoff: number = MIN_CUTOFF,
    beta: number = BETA,
    dCutoff: number = D_CUTOFF,
  ) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  /** Filter a single value at the given timestamp (ms) */
  filter(x: number, timestamp: number): number {
    if (!this.initialized) {
      return this.initializeWith(x, timestamp);
    }

    const dt = (timestamp - this.tPrev) / 1000; // Convert ms to seconds
    if (dt <= 0) return this.xPrev;

    const smoothedVelocity = this.computeSmoothedVelocity(x, dt);
    const adaptiveCutoff = this.minCutoff + this.beta * Math.abs(smoothedVelocity);
    const alpha = smoothingFactor(dt, adaptiveCutoff);
    const xHat = alpha * x + (1 - alpha) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = smoothedVelocity;
    this.tPrev = timestamp;

    return xHat;
  }

  /** Reset filter state for a new stroke */
  reset(): void {
    this.initialized = false;
  }

  private initializeWith(x: number, timestamp: number): number {
    this.xPrev = x;
    this.tPrev = timestamp;
    this.initialized = true;
    return x;
  }

  private computeSmoothedVelocity(x: number, dt: number): number {
    const dx = (x - this.xPrev) / dt;
    const alphaD = smoothingFactor(dt, this.dCutoff);
    return alphaD * dx + (1 - alphaD) * this.dxPrev;
  }
}

/** Exponential smoothing factor from dt and cutoff frequency */
function smoothingFactor(dt: number, cutoff: number): number {
  const tau = 1.0 / (TWO_PI * cutoff);
  return 1.0 / (1.0 + tau / dt);
}
