import { Stroke } from '../../types.js';
import { StrokeAnimator } from '../../animation/StrokeAnimator.js';
import { ObjectStore } from '../../store/ObjectStore.js';
/**
 * Re-render completed strokes into the offscreen cache when dirty,
 * then blit the cached bitmap onto the main canvas — O(1) per frame.
 *
 * When a StrokeAnimator is provided and has active animations, animated
 * strokes are rendered directly to the main canvas (bypassing the cache)
 * so per-frame transforms can be applied.
 *
 * When an ObjectStore is provided, strokes belonging to a GlymoObject
 * use the object's bbox center as the animation pivot — ensuring fills
 * and strokes in the same object rotate/scale around the same point.
 *
 * Returns the updated dirty flag (always `false` after painting).
 */
export declare function renderCompletedStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[], cache: OffscreenCanvas | null, cacheCtx: OffscreenCanvasRenderingContext2D | null, dirty: boolean, animator?: StrokeAnimator | null, objectStore?: ObjectStore | null): boolean;
