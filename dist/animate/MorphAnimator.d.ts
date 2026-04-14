import { StrokePoint, EffectPresetName } from '../types.js';
import { EventBus } from '../state/EventBus.js';
/**
 * Elastic bounce easing — IMMUTABLE (design.md SS4.10).
 * t=0→0, t=0.3→~1.07, t=0.5→~0.97, t=0.7→~1.01, t=1→1
 */
export declare function easeOutElastic(t: number): number;
/** Resample a stroke to targetCount points via linear parameter interpolation */
export declare function resampleStroke(points: StrokePoint[], targetCount: number): StrokePoint[];
/** Interpolate between two equally-sized stroke arrays at eased progress */
export declare function lerpStrokes(from: StrokePoint[], to: StrokePoint[], t: number): StrokePoint[];
export interface MorphAnimatorOptions {
    raw: StrokePoint[];
    smoothed: StrokePoint[];
    effect: EffectPresetName;
    eventBus: EventBus;
    duration?: number;
}
/**
 * Animates the morph transition from raw stroke → smoothed stroke.
 * Driven by the render loop via update(dt).
 */
export declare class MorphAnimator {
    private elapsed;
    private active;
    private readonly duration;
    private readonly eventBus;
    readonly effect: EffectPresetName;
    /** Resampled raw points (same count as smoothed) */
    private readonly fromPoints;
    /** Target smoothed points */
    private readonly toPoints;
    /** Original raw input points — used by ParticleSystem.spawnBurstForMorph */
    private readonly rawPoints;
    constructor(options: MorphAnimatorOptions);
    /** Begin the morph animation */
    start(): void;
    /** Advance animation by dt milliseconds. Returns interpolated points. */
    update(dt: number): StrokePoint[] | null;
    /** Cancel the animation */
    cancel(): void;
    /** Get current linear progress (0..1) */
    getProgress(): number;
    /** Current linear progress (0..1) — convenience accessor for renderer */
    get progress(): number;
    isActive(): boolean;
    /** Get the final smoothed points (for move to completed layer) */
    getSmoothedPoints(): StrokePoint[];
    /**
     * Minimal stroke-like view of the morph source data.
     * Used by ParticleSystem.spawnBurstForMorph() at morph start.
     */
    get sourceStroke(): {
        raw: StrokePoint[];
        smoothed: StrokePoint[];
        effect: EffectPresetName;
    };
}
