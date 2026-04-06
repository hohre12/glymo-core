import type { PipelineStage, StrokePoint } from '../../types.js';

/** Minimum number of points for a valid stroke */
const MIN_POINTS_PER_STROKE = 3;

/**
 * Stage 4: SEGMENT (design.md SS4.4)
 *
 * Detects pen state transitions and separates continuous input
 * into discrete strokes. For mouse/touch, pen state comes from
 * pointerdown/pointerup events via InputManager.
 */
export class SegmentStage implements PipelineStage {
  readonly name = 'segment';

  private currentPoints: StrokePoint[] = [];
  private isDrawing = false;

  /** Accumulate points during drawing */
  process(input: StrokePoint): StrokePoint {
    if (this.isDrawing) {
      this.currentPoints.push({ ...input });
    }
    return input;
  }

  /** Signal pen down — start accumulating a new stroke */
  penDown(): void {
    this.isDrawing = true;
    this.currentPoints = [];
  }

  /**
   * Signal pen up — finalize the current stroke.
   * Returns accumulated points if valid (>3 points), null otherwise.
   */
  penUp(): StrokePoint[] | null {
    this.isDrawing = false;
    const points = this.currentPoints;
    this.currentPoints = [];

    if (points.length < MIN_POINTS_PER_STROKE) {
      return null; // Discard short strokes
    }

    return points;
  }

  /** Get the current in-progress points (for live rendering) */
  getCurrentPoints(): ReadonlyArray<StrokePoint> {
    return this.currentPoints;
  }

  /** Check if currently accumulating a stroke */
  getIsDrawing(): boolean {
    return this.isDrawing;
  }

  reset(): void {
    this.currentPoints = [];
    this.isDrawing = false;
  }
}
