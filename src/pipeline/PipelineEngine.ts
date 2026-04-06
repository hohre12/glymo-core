import type { PipelineStage, RawInputPoint, StrokePoint } from '../types.js';
import type { EventBus } from '../state/EventBus.js';
import { CaptureStage } from './stages/CaptureStage.js';
import { StabilizeStage } from './stages/StabilizeStage.js';
import { PressureStage, PressureTaper } from './stages/PressureStage.js';
import { SegmentStage } from './stages/SegmentStage.js';
import { SmoothStage } from './stages/SmoothStage.js';

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
    let point = this.captureStage.createStrokePoint(raw);

    for (const stage of this.realTimeStages) {
      point = stage.process(point);
    }

    // Stage 4: accumulate in segment
    this.segmentStage.process(point);
    return point;
  }

  /** Signal pen down to start a new stroke */
  penDown(): void {
    this.segmentStage.penDown();
    this.eventBus.emit('stroke:start');
  }

  /**
   * Signal pen up — finalize the current stroke.
   * Applies taper (batch) and Chaikin smoothing (batch).
   * Returns { raw, smoothed } or null if stroke was too short.
   */
  penUp(): FinalizedStroke | null {
    const rawPoints = this.segmentStage.penUp();
    if (!rawPoints) return null;

    const tapered = this.pressureTaper.processBatch(rawPoints);
    const smoothed = this.smoothStage.processBatch(tapered);

    this.eventBus.emit('stroke:end');
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
