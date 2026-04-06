import type { PipelineStage, StrokePoint, RawInputPoint } from '../../types.js';

/** Default pressure for the first point in a stroke */
const DEFAULT_PRESSURE = 0.5;

/**
 * Stage 1: CAPTURE (design.md SS4.1)
 *
 * Wraps raw input into StrokePoint format.
 * For mouse/touch, this is a thin pass-through since MouseCapture
 * already handles coordinate normalization.
 */
export class CaptureStage implements PipelineStage {
  readonly name = 'capture';

  /** Convert a RawInputPoint to a StrokePoint with default pressure */
  createStrokePoint(raw: RawInputPoint): StrokePoint {
    return {
      x: raw.x,
      y: raw.y,
      t: raw.t,
      pressure: raw.pressure ?? DEFAULT_PRESSURE,
    };
  }

  /** Per-point pass-through (already in StrokePoint format) */
  process(input: StrokePoint): StrokePoint {
    return { ...input };
  }

  reset(): void {
    // No state to reset in capture stage
  }
}
