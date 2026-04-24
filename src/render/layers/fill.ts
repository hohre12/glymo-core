// ── Layer: Fills (below strokes) ─────────────────────

import type { Fill } from '../../types.js';
import type { ObjectStore } from '../../store/ObjectStore.js';
import type { StrokeAnimator } from '../../animation/StrokeAnimator.js';
import type { AnimationTransform } from '../../animation/types.js';

/**
 * Render all fill bitmaps onto the canvas.
 *
 * When an ObjectStore and StrokeAnimator are provided, fills that belong
 * to a GlymoObject inherit the object's animation transform — so the
 * fill moves/rotates/scales together with the object's strokes.
 *
 * Phase 2 (rendering-pipeline-v2): the caller-provided `transformBuffer`
 * is reused in place across every fill in the render loop so this layer
 * allocates zero `AnimationTransform` objects per frame — the same
 * out-param pattern the completed-stroke layer uses.
 */
export function renderFills(
  ctx: CanvasRenderingContext2D,
  fills: readonly Fill[],
  objectStore: ObjectStore | null | undefined,
  animator: StrokeAnimator | null | undefined,
  transformBuffer: AnimationTransform,
): void {
  const now = performance.now();

  for (const fill of fills) {
    const obj = objectStore?.getObjectByFillId(fill.id);

    // Skip fills whose owning object has a 3D mesh applied (mediaArt guard)
    if (obj?.metadata?.mediaArt) continue;

    // Check if this fill belongs to an object with an active animation
    if (obj && animator && obj.strokeIds.length > 0) {
      // Get the animation transform from the first stroke in the object,
      // writing into the caller's reusable buffer (zero-alloc overload).
      const ok = animator.getTransform(obj.strokeIds[0]!, now, transformBuffer);
      if (ok) {
        const cx = obj.bbox.x + obj.bbox.width / 2;
        const cy = obj.bbox.y + obj.bbox.height / 2;
        ctx.save();
        ctx.globalAlpha = transformBuffer.opacity;
        ctx.translate(cx + transformBuffer.translateX, cy + transformBuffer.translateY);
        ctx.rotate(transformBuffer.rotation);
        ctx.scale(transformBuffer.scale, transformBuffer.scale);
        ctx.translate(-cx, -cy);
        ctx.drawImage(fill.bitmap, 0, 0);
        ctx.restore();
        continue;
      }
    }

    // No object or no animation — render normally
    ctx.drawImage(fill.bitmap, 0, 0);
  }
}
