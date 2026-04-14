import { AnimationParams, AnimationTransform } from './types.js';
/**
 * StrokeAnimator manages active animations and computes per-frame
 * AnimationTransform for each animated stroke.
 */
export declare class StrokeAnimator {
    private animations;
    private nextId;
    /**
     * Add an animation targeting one or more strokes.
     * Returns a unique animation ID for later removal.
     */
    addAnimation(strokeIds: string[], params: AnimationParams): string;
    /** Remove a specific animation by ID */
    removeAnimation(animationId: string): void;
    /** Remove all animations targeting a specific stroke ID */
    removeByStrokeId(strokeId: string): void;
    /**
     * Compute the current transform for a stroke at the given timestamp.
     * Returns null if the stroke has no active animation.
     * When multiple animations target the same stroke, transforms are composed additively.
     */
    getTransform(strokeId: string, now: number): AnimationTransform | null;
    /** Check if any animations are currently active */
    hasAnimations(): boolean;
    /** Return stroke IDs that have an active sparkle-type animation */
    getSparkleStrokeIds(now: number): string[];
    /** Get the animation params for a stroke (first active animation found) */
    getAnimationParams(strokeId: string): AnimationParams | null;
    /** Remove all animations */
    clear(): void;
    private computeAnimationTransform;
    /**
     * Linearly interpolate between keyframes at time t (0-1).
     * Keyframes must be sorted by t. Values between keyframes are lerped.
     */
    private interpolateKeyframes;
}
