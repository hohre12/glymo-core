import type { CorrectionOptions, Stroke, StrokePoint } from '../types.js';
import type { SmoothStage } from '../pipeline/stages/SmoothStage.js';
import { snapEndpoints } from './EndpointSnapper.js';
import { trimOvershoot } from './OvershootTrimmer.js';

/** Default correction options */
const DEFAULTS: Required<CorrectionOptions> = {
  snapThreshold: 15,
  endpointSnap: true,
  overshootTrim: true,
};

/**
 * Orchestrates stroke correction: overshoot trim → endpoint snap → re-smooth.
 *
 * Special handling:
 * - If a stroke appears to be self-closing (end near start), overshoot trim
 *   is skipped because the "direction reversal" at the closing point is
 *   intentional, not an overshoot.
 */
export class StrokeCorrector {
  /**
   * Correct raw points only (no re-smoothing).
   * Returns corrected raw and list of applied corrections.
   */
  correctRaw(
    raw: readonly StrokePoint[],
    otherStrokes: readonly Stroke[],
    options?: CorrectionOptions,
  ): { correctedRaw: StrokePoint[]; corrections: string[] } {
    const opts = { ...DEFAULTS, ...options };
    const corrections: string[] = [];
    let current: StrokePoint[] = raw.map(p => ({ ...p }));

    // Step 1: Overshoot trim — skip if stroke might self-close
    // (EndpointSnapper handles self-close trim separately)
    const mightSelfClose = this.checkSelfClosing(current, opts.snapThreshold);
    if (opts.overshootTrim && !mightSelfClose) {
      const trimResult = trimOvershoot(current);
      if (trimResult.trimmed) {
        current = trimResult.correctedRaw;
        corrections.push('overshoot-trim');
      }
    }

    // Step 2: Endpoint snap (self-close or cross-stroke)
    if (opts.endpointSnap) {
      const snapResult = snapEndpoints(current, otherStrokes, opts.snapThreshold);
      if (snapResult.snapped) {
        current = snapResult.correctedRaw;
        corrections.push('endpoint-snap');
      }
    }

    return { correctedRaw: current, corrections };
  }

  /**
   * Correct raw points and re-smooth via SmoothStage.
   * Returns corrected raw, corrected smoothed, and list of applied corrections.
   */
  correctAndSmooth(
    raw: readonly StrokePoint[],
    otherStrokes: readonly Stroke[],
    smoothStage: SmoothStage,
    options?: CorrectionOptions,
  ): { correctedRaw: StrokePoint[]; correctedSmoothed: StrokePoint[]; corrections: string[] } {
    const { correctedRaw, corrections } = this.correctRaw(raw, otherStrokes, options);

    // Re-smooth if any corrections were applied
    const correctedSmoothed = corrections.length > 0
      ? smoothStage.processBatch(correctedRaw)
      : smoothStage.processBatch(raw as StrokePoint[]);

    return { correctedRaw, correctedSmoothed, corrections };
  }

  /** Check if a stroke appears to be a closed shape (end near start relative to path length) */
  private checkSelfClosing(raw: readonly StrokePoint[], threshold: number): boolean {
    if (raw.length < 4) return false;
    const start = raw[0]!;
    const end = raw[raw.length - 1]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const selfDist = Math.sqrt(dx * dx + dy * dy);

    // Method 1: absolute distance within threshold
    if (selfDist < threshold) return true;

    // Method 2: ratio-based — stroke traveled far but came back
    let pathLen = 0;
    for (let i = 1; i < raw.length; i++) {
      const px = raw[i]!.x - raw[i - 1]!.x;
      const py = raw[i]!.y - raw[i - 1]!.y;
      pathLen += Math.sqrt(px * px + py * py);
    }
    return pathLen > 0 && (selfDist / pathLen) < 0.5;
  }
}
