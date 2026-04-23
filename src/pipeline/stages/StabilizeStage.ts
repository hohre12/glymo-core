import type { PipelineStage, StrokePoint } from '../../types.js';
import { OneEuroFilter } from '../../filter/OneEuroFilter.js';

/**
 * Stage 2: STABILIZE (design.md SS4.2)
 *
 * Applies OneEuroFilter independently per axis to remove jitter.
 * At rest: strong smoothing (jitter removal).
 * In motion: weak smoothing (responsiveness preserved).
 * Reduces 1-3mm jitter to <0.5mm.
 *
 * Source-aware parameters:
 * - mouse: MIN_CUTOFF=1.0, BETA=0.007, D_CUTOFF=1.0  (design.md SS4.2, IMMUTABLE defaults)
 * - camera: MIN_CUTOFF=0.3, BETA=0.001, D_CUTOFF=0.7  (stronger smoothing for hand tracking noise)
 */

// ── Mouse parameters (IMMUTABLE — design.md SS4.2) ───
const MOUSE_MIN_CUTOFF = 1.0;
const MOUSE_BETA = 0.007;
const MOUSE_D_CUTOFF = 1.0;

// ── Camera parameters ────────────────────────────────
// Much stronger smoothing: hand tracking has higher jitter than a mouse.
//
// 2026-04-23 retune: the previous values (0.3, 0.001, 0.7) left visible
// per-frame vibration on drawn strokes even with the CameraCapture
// pre-filter active — users reported "가만히 있어도 진동이 느껴진다"
// (vibration felt even when the hand is still). Halving `minCutoff` and
// tightening `dCutoff` doubles the at-rest attenuation without touching
// `beta`, so fast drawing stays responsive. The CameraCapture pre-filter
// continues to strip the first ~30× of jitter; StabilizeStage now strips
// the remaining ~20× instead of ~10×, for a combined ~600× jitter
// rejection on a held hand. See `tests/filter-regression.test.ts`.
const CAMERA_MIN_CUTOFF = 0.15;
const CAMERA_BETA = 0.001;
const CAMERA_D_CUTOFF = 0.5;

export class StabilizeStage implements PipelineStage {
  readonly name = 'stabilize';

  private inputSource: 'mouse' | 'camera' = 'mouse';
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;

  constructor() {
    this.filterX = new OneEuroFilter(MOUSE_MIN_CUTOFF, MOUSE_BETA, MOUSE_D_CUTOFF);
    this.filterY = new OneEuroFilter(MOUSE_MIN_CUTOFF, MOUSE_BETA, MOUSE_D_CUTOFF);
  }

  /**
   * Switch the input source and reconstruct filters with source-appropriate parameters.
   * Resets filter state so the new parameters take effect immediately.
   */
  setInputSource(source: 'mouse' | 'camera'): void {
    if (this.inputSource === source) return;
    this.inputSource = source;

    if (source === 'camera') {
      this.filterX = new OneEuroFilter(CAMERA_MIN_CUTOFF, CAMERA_BETA, CAMERA_D_CUTOFF);
      this.filterY = new OneEuroFilter(CAMERA_MIN_CUTOFF, CAMERA_BETA, CAMERA_D_CUTOFF);
    } else {
      this.filterX = new OneEuroFilter(MOUSE_MIN_CUTOFF, MOUSE_BETA, MOUSE_D_CUTOFF);
      this.filterY = new OneEuroFilter(MOUSE_MIN_CUTOFF, MOUSE_BETA, MOUSE_D_CUTOFF);
    }
  }

  /** Apply independent 1D filters to x and y coordinates */
  process(input: StrokePoint): StrokePoint {
    return {
      x: this.filterX.filter(input.x, input.t),
      y: this.filterY.filter(input.y, input.t),
      t: input.t,
      pressure: input.pressure,
    };
  }

  /** Reset both axis filters for a new stroke */
  reset(): void {
    this.filterX.reset();
    this.filterY.reset();
  }
}
