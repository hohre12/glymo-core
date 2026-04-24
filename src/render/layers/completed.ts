// ── Layer 10: Completed Strokes ──────────────────────

import type { Stroke } from '../../types.js';
import { resolveEffect } from '../../effects/registry.js';
import { renderGlowPass, renderMainStroke } from '../StrokeRenderer.js';
import type { StrokeOverrides } from '../StrokeRenderer.js';
import type { StrokeAnimator } from '../../animation/StrokeAnimator.js';
import type { AnimationTransform } from '../../animation/types.js';
import type { ObjectStore } from '../../store/ObjectStore.js';
import { computeBounds } from '../../util/math.js';

/** Extract per-stroke overrides from a Stroke (returns undefined if none set) */
function getOverrides(stroke: Stroke): StrokeOverrides | undefined {
  if (stroke.customColor == null && stroke.customWidth == null) return undefined;
  return { customColor: stroke.customColor, customWidth: stroke.customWidth };
}

/** Phase 2 of rendering-pipeline-v2: per-frame per-stroke
 *  `AnimationTransform` storage. CanvasRenderer owns these two
 *  structures and passes them in each frame — the layer function reuses
 *  the existing entries instead of allocating a fresh `Map` + fresh
 *  `AnimationTransform` object per animated stroke per frame, which was
 *  the dominant source of minor-GC churn under the Phase 0 hologram
 *  scenario (§2 reports 26 minor GCs in a 15 s trace). */
export type StrokeTransformPool = Map<string, AnimationTransform>;

function createTransformBuffer(): AnimationTransform {
  return {
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    glowIntensity: 1,
  };
}

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
export function renderCompletedStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
  cache: OffscreenCanvas | null,
  cacheCtx: OffscreenCanvasRenderingContext2D | null,
  dirty: boolean,
  animator: StrokeAnimator | null | undefined,
  objectStore: ObjectStore | null | undefined,
  /** Phase 2: frame-persistent `strokeId → AnimationTransform` pool. Reused
   *  across every frame; entries accrete on new animated strokes and are
   *  left in place afterwards so steady-state allocation is zero. */
  transformPool: StrokeTransformPool,
  /** Phase 2: reused per-frame set used as "which strokes are animated
   *  this frame". `.clear()` and re-populate — no Set reallocation. */
  activeAnimatedIds: Set<string>,
): boolean {
  const now = performance.now();
  const hasAnimator = animator != null && animator.hasAnimations();

  // Phase 2: reuse the pool's entries in place. `activeAnimatedIds` tracks
  // which strokes got a transform THIS frame so downstream consumers know
  // which pool entries are fresh. No per-frame Map / AnimationTransform
  // allocation once the pool stabilises.
  activeAnimatedIds.clear();
  if (hasAnimator) {
    for (const stroke of strokes) {
      let buf = transformPool.get(stroke.id);
      if (!buf) {
        buf = createTransformBuffer();
        transformPool.set(stroke.id, buf);
      }
      const ok = animator!.getTransform(stroke.id, now, buf);
      if (ok) activeAnimatedIds.add(stroke.id);
    }
  }

  const hasAnimated = activeAnimatedIds.size > 0;

  const staticStrokes = hasAnimated
    ? strokes.filter((s) => !activeAnimatedIds.has(s.id))
    : strokes;

  // When dirty, or when the set of static strokes changed due to animations,
  // re-render static strokes into the offscreen cache.
  const staticDirty = dirty || hasAnimated;
  if (staticDirty && cacheCtx && cache) {
    cacheCtx.clearRect(0, 0, cache.width, cache.height);
    for (const stroke of staticStrokes) {
      if (stroke.smoothed.length < 2) continue;
      if (objectStore) {
        const obj = objectStore.getObjectByStrokeId(stroke.id);
        if (obj?.metadata?.mediaArt) continue;
      }
      const style = resolveEffect(stroke.effect);
      const overrides = getOverrides(stroke);
      renderGlowPass(cacheCtx, stroke.smoothed, style, 1.0, overrides);
      renderMainStroke(cacheCtx, stroke.smoothed, style, overrides);
    }
  }

  // Blit cached static strokes
  if (staticStrokes.length > 0 && cache) {
    ctx.drawImage(cache, 0, 0);
  }

  // Render animated strokes directly with pooled transforms (Phase 2)
  if (hasAnimated) {
    for (const stroke of strokes) {
      if (!activeAnimatedIds.has(stroke.id)) continue;
      const transform = transformPool.get(stroke.id);
      if (!transform) continue;
      if (stroke.smoothed.length < 2) continue;
      const obj = objectStore?.getObjectByStrokeId(stroke.id);
      if (obj?.metadata?.mediaArt) continue;

      const style = resolveEffect(stroke.effect);
      const overrides = getOverrides(stroke);

      // Determine pivot: use object bbox center if stroke belongs to an object,
      // otherwise fall back to individual stroke bounds.
      // This ensures strokes and fills in the same object share the same pivot.
      let cx: number, cy: number;
      if (obj) {
        cx = obj.bbox.x + obj.bbox.width / 2;
        cy = obj.bbox.y + obj.bbox.height / 2;
      } else {
        const bounds = computeBounds(stroke.smoothed);
        cx = bounds.x + bounds.width / 2;
        cy = bounds.y + bounds.height / 2;
      }

      ctx.save();
      ctx.globalAlpha = transform.opacity;
      ctx.translate(cx + transform.translateX, cy + transform.translateY);
      ctx.rotate(transform.rotation);
      ctx.scale(transform.scale, transform.scale);
      ctx.translate(-cx, -cy);
      renderGlowPass(ctx, stroke.smoothed, style, transform.glowIntensity, overrides);
      renderMainStroke(ctx, stroke.smoothed, style, overrides);
      ctx.restore();
    }
  }

  // Keep dirty when animations are running so cache refreshes each frame
  return hasAnimated;
}
