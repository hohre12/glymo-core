import type { PipelineStage, StrokePoint } from '../../types.js';

/** Minimum number of points for a valid stroke */
const MIN_POINTS_PER_STROKE = 3;

/** Hard cap on in-memory points per stroke. 10000 ≈ 167 s at 60 Hz — longer than any realistic single stroke; protects against runaway pen-stuck-down input. */
export const MAX_POINTS = 10000;

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
  /** Points dropped after the buffer hit MAX_POINTS during the current stroke. */
  private droppedThisStroke = 0;
  /** Whether the MAX_POINTS warning has already been emitted for the current stroke. */
  private capWarned = false;

  /**
   * Accumulate points during drawing (capped at MAX_POINTS).
   *
   * On overflow, further incoming points are silently dropped — FIFO-freeze,
   * not ring buffer. This preserves the stroke's start anchor (load-bearing
   * for morph matching) at the cost of losing the tail. Acceptable because
   * MAX_POINTS=10000 ≈ 167s at 60Hz — longer than any realistic single
   * stroke; the cap is an abuse-protection safety valve, not a normal path.
   */
  process(input: StrokePoint): StrokePoint {
    if (this.isDrawing) {
      if (this.currentPoints.length < MAX_POINTS) {
        this.currentPoints.push({ ...input });
      } else {
        this.droppedThisStroke += 1;
        if (!this.capWarned) {
          // Emit exactly once per stroke the first time we clip the buffer.
          // eslint-disable-next-line no-console
          console.warn(
            `[SegmentStage] stroke exceeded MAX_POINTS=${MAX_POINTS}; further points will be dropped for this stroke.`,
          );
          this.capWarned = true;
        }
      }
    }
    return input;
  }

  /** Signal pen down — start accumulating a new stroke */
  penDown(): void {
    this.isDrawing = true;
    this.currentPoints = [];
    this.droppedThisStroke = 0;
    this.capWarned = false;
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

  /** Number of points dropped because the MAX_POINTS cap was hit during the current stroke. Cleared on every penDown(). */
  getDroppedCount(): number {
    return this.droppedThisStroke;
  }

  reset(): void {
    this.currentPoints = [];
    this.isDrawing = false;
    this.droppedThisStroke = 0;
    this.capWarned = false;
  }
}
