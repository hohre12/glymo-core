import type { StrokePoint, EffectPresetName } from '../types.js';
import type { EventBus } from '../state/EventBus.js';
import { MORPH_DURATION_MS } from '../state/SessionStateMachine.js';

// ── Constants ────────────────────────────────────────

const TWO_PI_OVER_3 = (2 * Math.PI) / 3;
const ELASTIC_DECAY = -10;
const ELASTIC_OFFSET = 0.75;
const ELASTIC_PERIOD = 10;

// ── Easing ──────────────────────────────────────────

/**
 * Elastic bounce easing — IMMUTABLE (design.md SS4.10).
 * t=0→0, t=0.3→~1.07, t=0.5→~0.97, t=0.7→~1.01, t=1→1
 */
export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, ELASTIC_DECAY * t) *
    Math.sin((t * ELASTIC_PERIOD - ELASTIC_OFFSET) * TWO_PI_OVER_3) + 1;
}

// ── Stroke Interpolation ────────────────────────────

/** Resample a stroke to targetCount points via linear parameter interpolation */
export function resampleStroke(points: StrokePoint[], targetCount: number): StrokePoint[] {
  if (points.length < 2 || targetCount < 2) return [...points];

  const result: StrokePoint[] = [];
  const srcLen = points.length - 1;
  const dstLen = targetCount - 1;

  for (let i = 0; i < targetCount; i++) {
    const srcIdx = (i / dstLen) * srcLen;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, points.length - 1);
    const frac = srcIdx - lo;
    const a = points[lo]!;
    const b = points[hi]!;

    result.push({
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
      t: a.t + (b.t - a.t) * frac,
      pressure: a.pressure + (b.pressure - a.pressure) * frac,
    });
  }
  return result;
}

/** Interpolate between two equally-sized stroke arrays at eased progress */
export function lerpStrokes(from: StrokePoint[], to: StrokePoint[], t: number): StrokePoint[] {
  const result: StrokePoint[] = [];
  for (let i = 0; i < to.length; i++) {
    const a = from[i]!;
    const b = to[i]!;
    result.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      t: b.t,
      pressure: a.pressure + (b.pressure - a.pressure) * t,
    });
  }
  return result;
}

// ── MorphAnimator Options ───────────────────────────

export interface MorphAnimatorOptions {
  raw: StrokePoint[];
  smoothed: StrokePoint[];
  effect: EffectPresetName;
  eventBus: EventBus;
  duration?: number;
}

// ── MorphAnimator ───────────────────────────────────

/**
 * Animates the morph transition from raw stroke → smoothed stroke.
 * Driven by the render loop via update(dt).
 */
export class MorphAnimator {
  private elapsed = 0;
  private active = false;
  private readonly duration: number;
  private readonly eventBus: EventBus;
  readonly effect: EffectPresetName;

  /** Resampled raw points (same count as smoothed) */
  private readonly fromPoints: StrokePoint[];
  /** Target smoothed points */
  private readonly toPoints: StrokePoint[];
  /** Original raw input points — used by ParticleSystem.spawnBurstForMorph */
  private readonly rawPoints: StrokePoint[];

  constructor(options: MorphAnimatorOptions) {
    this.duration = options.duration ?? MORPH_DURATION_MS;
    this.eventBus = options.eventBus;
    this.effect = options.effect;
    this.toPoints = options.smoothed;
    this.rawPoints = options.raw;
    this.fromPoints = resampleStroke(options.raw, options.smoothed.length);
  }

  /** Begin the morph animation */
  start(): void {
    this.elapsed = 0;
    this.active = true;
    this.eventBus.emit('morph:start');
  }

  /** Advance animation by dt milliseconds. Returns interpolated points. */
  update(dt: number): StrokePoint[] | null {
    if (!this.active) return null;

    this.elapsed = Math.min(this.elapsed + dt, this.duration);
    const progress = this.elapsed / this.duration;
    const eased = easeOutElastic(progress);
    const points = lerpStrokes(this.fromPoints, this.toPoints, eased);

    if (progress >= 1) {
      this.active = false;
      this.eventBus.emit('morph:complete');
    }
    return points;
  }

  /** Cancel the animation */
  cancel(): void {
    this.active = false;
  }

  /** Get current linear progress (0..1) */
  getProgress(): number {
    return Math.min(this.elapsed / this.duration, 1);
  }

  /** Current linear progress (0..1) — convenience accessor for renderer */
  get progress(): number {
    return this.getProgress();
  }

  isActive(): boolean {
    return this.active;
  }

  /** Get the final smoothed points (for move to completed layer) */
  getSmoothedPoints(): StrokePoint[] {
    return this.toPoints;
  }

  /**
   * Minimal stroke-like view of the morph source data.
   * Used by ParticleSystem.spawnBurstForMorph() at morph start.
   */
  get sourceStroke(): { raw: StrokePoint[]; smoothed: StrokePoint[]; effect: EffectPresetName } {
    return { raw: this.rawPoints, smoothed: this.toPoints, effect: this.effect };
  }
}
