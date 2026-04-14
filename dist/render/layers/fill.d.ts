import { Fill } from '../../types.js';
import { ObjectStore } from '../../store/ObjectStore.js';
import { StrokeAnimator } from '../../animation/StrokeAnimator.js';
/**
 * Render all fill bitmaps onto the canvas.
 *
 * When an ObjectStore and StrokeAnimator are provided, fills that belong
 * to a GlymoObject inherit the object's animation transform — so the
 * fill moves/rotates/scales together with the object's strokes.
 */
export declare function renderFills(ctx: CanvasRenderingContext2D, fills: readonly Fill[], objectStore?: ObjectStore | null, animator?: StrokeAnimator | null): void;
