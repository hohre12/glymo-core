// ── Layer: Fills (below strokes) ─────────────────────

import type { Fill } from '../../types.js';
import type { ObjectStore } from '../../store/ObjectStore.js';
import type { StrokeAnimator } from '../../animation/StrokeAnimator.js';

/**
 * Render all fill bitmaps onto the canvas.
 *
 * When an ObjectStore and StrokeAnimator are provided, fills that belong
 * to a GlymoObject inherit the object's animation transform — so the
 * fill moves/rotates/scales together with the object's strokes.
 */
export function renderFills(
  ctx: CanvasRenderingContext2D,
  fills: readonly Fill[],
  objectStore?: ObjectStore | null,
  animator?: StrokeAnimator | null,
): void {
  const now = performance.now();

  for (const fill of fills) {
    // Check if this fill belongs to an object with an active animation
    if (objectStore && animator) {
      const obj = objectStore.getObjectByFillId(fill.id);
      if (obj && obj.strokeIds.length > 0) {
        // Get the animation transform from the first stroke in the object
        const transform = animator.getTransform(obj.strokeIds[0]!, now);
        if (transform) {
          const cx = obj.bbox.x + obj.bbox.width / 2;
          const cy = obj.bbox.y + obj.bbox.height / 2;
          ctx.save();
          ctx.globalAlpha = transform.opacity;
          ctx.translate(cx + transform.translateX, cy + transform.translateY);
          ctx.rotate(transform.rotation);
          ctx.scale(transform.scale, transform.scale);
          ctx.translate(-cx, -cy);
          ctx.drawImage(fill.bitmap, 0, 0);
          ctx.restore();
          continue;
        }
      }
    }

    // No object or no animation — render normally
    ctx.drawImage(fill.bitmap, 0, 0);
  }
}
