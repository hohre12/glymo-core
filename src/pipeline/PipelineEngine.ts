import type { PipelineStage, RawInputPoint, StrokePoint } from '../types.js';
import type { EventBus } from '../state/EventBus.js';
import { CaptureStage } from './stages/CaptureStage.js';
import { StabilizeStage } from './stages/StabilizeStage.js';
import { PressureStage, PressureTaper } from './stages/PressureStage.js';
import { SegmentStage } from './stages/SegmentStage.js';
import { SmoothStage } from './stages/SmoothStage.js';
import { DiagBus } from '../diag/DiagBus.js';

/**
 * Orchestrates the 6-stage pipeline:
 * Capture -> Stabilize -> Pressure -> Segment -> Smooth
 *
 * Processes points sequentially through real-time stages (1-4),
 * then applies batch stages (5) on stroke finalization.
 */
export class PipelineEngine {
  private readonly captureStage: CaptureStage;
  private readonly realTimeStages: PipelineStage[];
  private readonly stabilizeStage: StabilizeStage;
  private readonly pressureStage: PressureStage;
  private readonly segmentStage: SegmentStage;
  private readonly smoothStage: SmoothStage;
  private readonly pressureTaper: PressureTaper;
  private readonly eventBus: EventBus;

  /** Monotonic stroke counter. Assigned at penDown(), consumed by diag events. */
  private strokeCounter = 0;
  /** Id of the currently in-progress stroke; empty between strokes. */
  private activeStrokeId = '';
  /** Points accumulated into segment since penDown — diag accounting. */
  private accumulatedCount = 0;
  /** Points dropped inside realTime stages (stabilize/pressure reject). */
  private droppedRealTimeCount = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.captureStage = new CaptureStage();
    this.segmentStage = new SegmentStage();
    this.smoothStage = new SmoothStage();
    this.pressureTaper = new PressureTaper();

    // Keep named references for source-aware parameter switching
    this.stabilizeStage = new StabilizeStage();
    this.pressureStage = new PressureStage();

    // Real-time stages: Stabilize -> Pressure (Capture is handled separately)
    this.realTimeStages = [
      this.stabilizeStage,
      this.pressureStage,
    ];
  }

  /**
   * Propagate the input source to all source-aware pipeline stages.
   * Call this whenever the input device changes (mouse ↔ camera).
   */
  setInputSource(source: 'mouse' | 'camera'): void {
    this.stabilizeStage.setInputSource(source);
    this.pressureStage.setInputSource(source);
  }

  /** Process a raw input point through the real-time pipeline (stages 1-3) */
  processPoint(raw: RawInputPoint): StrokePoint {
    const diagEnabled = DiagBus.enabled;

    const t0 = diagEnabled ? performance.now() : 0;
    let point = this.captureStage.createStrokePoint(raw);
    if (diagEnabled) {
      DiagBus.emit({
        stage: 'capture',
        strokeId: this.activeStrokeId,
        pointsIn: 1,
        pointsOut: 1,
        timeMs: performance.now() - t0,
        ts: performance.now(),
      });
    }

    for (const stage of this.realTimeStages) {
      const sT0 = diagEnabled ? performance.now() : 0;
      const before = point;
      point = stage.process(point);
      if (diagEnabled) {
        // Real-time stages return a point (never drop); record the transform.
        DiagBus.emit({
          stage: stage.name as 'stabilize' | 'pressure',
          strokeId: this.activeStrokeId,
          pointsIn: 1,
          pointsOut: 1,
          timeMs: performance.now() - sT0,
          meta: {
            dx: point.x - before.x,
            dy: point.y - before.y,
            pressureIn: before.pressure,
            pressureOut: point.pressure,
          },
          ts: performance.now(),
        });
      }
    }

    // Stage 4: accumulate in segment
    const segT0 = diagEnabled ? performance.now() : 0;
    this.segmentStage.process(point);
    if (diagEnabled) {
      this.accumulatedCount += 1;
      DiagBus.emit({
        stage: 'segment',
        strokeId: this.activeStrokeId,
        pointsIn: 1,
        pointsOut: 1,
        timeMs: performance.now() - segT0,
        meta: { phase: 'accumulate', total: this.accumulatedCount },
        ts: performance.now(),
      });
    }
    return point;
  }

  /** Signal pen down to start a new stroke */
  penDown(): void {
    this.strokeCounter += 1;
    this.activeStrokeId = `stroke-${this.strokeCounter}`;
    this.accumulatedCount = 0;
    this.droppedRealTimeCount = 0;
    this.segmentStage.penDown();
    this.eventBus.emit('stroke:start');
    if (DiagBus.enabled) {
      DiagBus.emit({
        stage: 'segment',
        strokeId: this.activeStrokeId,
        timeMs: 0,
        meta: { phase: 'pen-down' },
        ts: performance.now(),
      });
    }
  }

  /**
   * Signal pen up — finalize the current stroke.
   * Applies taper (batch) and Chaikin smoothing (batch).
   * Returns { raw, smoothed } or null if stroke was too short.
   */
  penUp(): FinalizedStroke | null {
    const diagEnabled = DiagBus.enabled;
    const strokeId = this.activeStrokeId;
    const accumulated = this.accumulatedCount;

    const segT0 = diagEnabled ? performance.now() : 0;
    const rawPoints = this.segmentStage.penUp();
    if (!rawPoints) {
      if (diagEnabled) {
        // Root-cause instrumentation: this is where short strokes
        // (likely Korean diacritic marks like ㆍ or fast Jamo ticks)
        // are dropped. `pointsIn` shows exactly what the user drew.
        DiagBus.emit({
          stage: 'segment',
          strokeId,
          pointsIn: accumulated,
          pointsOut: 0,
          timeMs: performance.now() - segT0,
          meta: { phase: 'pen-up', dropped: true, reason: 'min-points' },
          ts: performance.now(),
        });
      }
      this.activeStrokeId = '';
      this.accumulatedCount = 0;
      return null;
    }

    if (diagEnabled) {
      DiagBus.emit({
        stage: 'segment',
        strokeId,
        pointsIn: accumulated,
        pointsOut: rawPoints.length,
        timeMs: performance.now() - segT0,
        meta: { phase: 'pen-up', dropped: false },
        ts: performance.now(),
      });
    }

    const taperT0 = diagEnabled ? performance.now() : 0;
    const tapered = this.pressureTaper.processBatch(rawPoints);
    if (diagEnabled) {
      DiagBus.emit({
        stage: 'pressure',
        strokeId,
        pointsIn: rawPoints.length,
        pointsOut: tapered.length,
        timeMs: performance.now() - taperT0,
        meta: { phase: 'taper-batch' },
        ts: performance.now(),
      });
    }

    const smoothT0 = diagEnabled ? performance.now() : 0;
    const smoothed = this.smoothStage.processBatch(tapered);
    if (diagEnabled) {
      DiagBus.emit({
        stage: 'smooth',
        strokeId,
        pointsIn: tapered.length,
        pointsOut: smoothed.length,
        timeMs: performance.now() - smoothT0,
        meta: { phase: 'chaikin-batch' },
        ts: performance.now(),
      });
    }

    this.eventBus.emit('stroke:end');
    this.activeStrokeId = '';
    this.accumulatedCount = 0;
    return { raw: tapered, smoothed };
  }

  /** Get current in-progress points (for live rendering) */
  getActivePoints(): ReadonlyArray<StrokePoint> {
    return this.segmentStage.getCurrentPoints();
  }

  /** Check if currently drawing */
  isDrawing(): boolean {
    return this.segmentStage.getIsDrawing();
  }

  /** Reset all stages for a fresh state */
  reset(): void {
    this.captureStage.reset();
    for (const stage of this.realTimeStages) {
      stage.reset();
    }
    this.segmentStage.reset();
    this.smoothStage.reset();
    this.pressureTaper.reset();
  }
}

/** Result of finalizing a stroke through the pipeline */
export interface FinalizedStroke {
  raw: StrokePoint[];
  smoothed: StrokePoint[];
}
