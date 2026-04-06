import type { PipelineStage, BatchPipelineStage, StrokePoint } from '../../types.js';
import { clamp } from '../../util/math.js';

// ── Constants (design.md SS4.3) ──────────────────────

/** Multiplier converting speed to inverse pressure — mouse/default (design.md SS4.3) */
const SPEED_MULTIPLIER_MOUSE = 1.7;

/**
 * Multiplier for camera input. Hand tracking coordinates move inherently
 * slower in px/ms than a mouse cursor, so the default 1.7 makes camera
 * strokes too thin. 0.8 restores natural stroke weight.
 */
const SPEED_MULTIPLIER_CAMERA = 0.8;

/** Minimum allowed pressure (floor) */
const PRESSURE_MIN = 0.15;

/** Maximum allowed pressure (ceiling) */
const PRESSURE_MAX = 1.0;

/** Default pressure for the first point in a stroke */
const DEFAULT_FIRST_PRESSURE = 0.5;

/** Fallback dt when timestamps are identical (60fps assumption) */
const DEFAULT_DT_MS = 16;

/** Maximum number of points to taper at stroke endpoints */
const TAPER_CAP = 8;

/** Taper ratio: fraction of stroke length to taper */
const TAPER_RATIO = 0.15;

// ── Per-Point Processing ─────────────────────────────

/**
 * Stage 3: PRESSURE (design.md SS4.3)
 *
 * Simulates calligraphy physics:
 * Slow movement = high pressure (thick stroke)
 * Fast movement = low pressure (thin stroke)
 */
export class PressureStage implements PipelineStage {
  readonly name = 'pressure';

  private prevPoint: StrokePoint | null = null;
  private inputSource: 'mouse' | 'camera' = 'mouse';

  /** Switch the input source — adjusts speed multiplier for natural stroke weight */
  setInputSource(source: 'mouse' | 'camera'): void {
    this.inputSource = source;
  }

  /** Calculate velocity-based pressure for a single point */
  process(input: StrokePoint): StrokePoint {
    const pressure = this.calculatePressure(input);
    this.prevPoint = input;

    return { ...input, pressure };
  }

  reset(): void {
    this.prevPoint = null;
  }

  private calculatePressure(point: StrokePoint): number {
    if (!this.prevPoint) return DEFAULT_FIRST_PRESSURE;

    const dx = point.x - this.prevPoint.x;
    const dy = point.y - this.prevPoint.y;
    const dt = point.t - this.prevPoint.t || DEFAULT_DT_MS;
    const speed = Math.sqrt(dx * dx + dy * dy) / dt; // px/ms

    const multiplier = this.inputSource === 'camera'
      ? SPEED_MULTIPLIER_CAMERA
      : SPEED_MULTIPLIER_MOUSE;

    return clamp(PRESSURE_MAX - speed * multiplier, PRESSURE_MIN, PRESSURE_MAX);
  }
}

// ── Batch Taper Processing ───────────────────────────

/**
 * Applies start/end taper to a completed stroke using easeInQuad.
 * Runs as a batch operation on finalizeStroke(), not per-point.
 */
export class PressureTaper implements BatchPipelineStage {
  readonly name = 'pressure-taper';

  processBatch(points: StrokePoint[]): StrokePoint[] {
    const result = points.map((p) => ({ ...p }));
    applyTaper(result);
    return result;
  }

  reset(): void {
    // Stateless batch processor
  }
}

/** Apply easeInQuad taper to start and end of stroke (design.md SS4.3.1) */
function applyTaper(points: StrokePoint[]): void {
  const taperLength = Math.min(TAPER_CAP, Math.floor(points.length * TAPER_RATIO));
  if (taperLength === 0) return;

  for (let i = 0; i < taperLength; i++) {
    const t = i / taperLength;
    const eased = t * t; // easeInQuad
    points[i]!.pressure *= eased;
    points[points.length - 1 - i]!.pressure *= eased;
  }
}
