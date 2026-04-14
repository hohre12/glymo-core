import { MorphFrame } from '../types.js';
import { EventBus } from '../state/EventBus.js';
import { MatchedCharacter, FontMorphOptions } from './types.js';
/** Total morph duration in milliseconds */
export declare const MORPH_DURATION_MS = 800;
/** Per-character cascade delay in milliseconds */
export declare const CASCADE_DELAY_MS = 80;
/** Starting morph color — green */
export declare const MORPH_START_COLOR = "#10b981";
/**
 * Stage 10: FontMorphAnimator
 *
 * Animates morph from hand-drawn positions to font glyph positions.
 * Uses easeOutElastic easing (IMMUTABLE) over 800ms with 80ms
 * per-character cascade delay.
 *
 * Color interpolates from green (#10b981) to the effect color.
 */
export declare class FontMorphAnimator {
    private readonly matchedCharacters;
    private readonly allPairs;
    private readonly targetColor;
    private readonly duration;
    private readonly cascadeDelay;
    private readonly charCount;
    private readonly eventBus;
    private animFrameId;
    private startTime;
    private active;
    private lastFrame;
    constructor(options: FontMorphOptions, eventBus: EventBus);
    /** Begin the morph animation (uses requestAnimationFrame) */
    start(): void;
    /** Manually advance animation (for render-loop integration / testing) */
    update(elapsed: number): MorphFrame;
    /** Cancel ongoing animation */
    cancel(): void;
    isActive(): boolean;
    getLastFrame(): MorphFrame | null;
    getMatchedCharacters(): MatchedCharacter[];
    /** Schedule the next animation frame via rAF */
    private scheduleFrame;
    /** Animation frame callback */
    private onFrame;
    /** Compute rendered points for a single frame */
    private computeFrame;
}
