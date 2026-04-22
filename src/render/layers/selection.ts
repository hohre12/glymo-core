import type { ObjectStore } from '../../store/ObjectStore.js';

/** Padding around object bbox for the halo, in unscaled px. */
const HALO_PAD = 10;

/**
 * Breathing angular rate in rad/ms. Produces a ~1.57 s sin cycle and matches
 * the text-mode char halo breath in `TextOverlayCanvas.tsx` so a selected
 * char and a selected drawing object share a single visual language.
 */
const BREATH_RATE = 0.004;

/** Fixed halo color — brand neon. Intentionally NOT tied to the active
 *  paint effect so the selection indicator reads identically across modes
 *  regardless of which effect is painting the strokes themselves. */
const HALO_STROKE = '#00ffcc';
const HALO_FILL = 'rgba(0, 255, 204, 0.18)';

/** Corner-radius of the rounded halo rect. */
const HALO_RADIUS = 12;

/**
 * Layer 15 — Selection Halo
 *
 * Renders a breathing neon halo around each selected object. Unified with
 * the text-mode char halo (`TextOverlayCanvas.tsx`) so selection reads as a
 * single visual language across drawing- and text-modes:
 *
 *   - solid outline, not marching ants — Glymo is gesture-driven; the
 *     "dashed selection region" idiom inherited from desktop 2D apps does
 *     not match the interaction model.
 *   - no corner handles — there is no tap-drag-resize affordance for
 *     gesture users, so handles were dead UI and visual noise.
 *   - fixed `#00ffcc` — the paint effect recolors the strokes inside the
 *     halo; the halo itself stays brand-consistent, matching the text
 *     mode's ambient-rim-light.
 *
 * Drawn directly to the main canvas (not cached) because of the per-frame
 * breathing animation. The `_effectColor` parameter is preserved in the
 * public signature for API stability with `CanvasRenderer` but intentionally
 * unused — see rationale above. Rename to an underscore prefix keeps
 * `noUnusedParameters` happy without sacrificing the positional API.
 *
 * Background-agnostic composite (2026-04-22, 0.20.1):
 * The halo used to switch to `globalCompositeOperation = 'lighter'` for the
 * ambient fill pass, inherited from the dark-background-first design. Under
 * `SessionDoc.backgroundMode === 'white'` (added in 0.18.0) `lighter` clamps
 * every channel to 255 against the (255,255,255) dest, so the entire halo
 * goes invisible over a white canvas — exact mirror of the 0.29.0
 * `@glymo/ui` compositor fix (`screen → source-over`). We now stay on the
 * `save()` default (`source-over`) so alpha blending dominates, making the
 * halo read on light, mid, and dark backgrounds alike. The shadowBlur glow
 * around the stroke preserves the "ambient rim-light" feel without the
 * channel-saturation hazard of `lighter`.
 */
export function renderSelection(
  ctx: CanvasRenderingContext2D,
  selectedIds: ReadonlySet<string>,
  objectStore: ObjectStore,
  _effectColor: string,
  timestamp: number,
  dpr: number,
): void {
  if (selectedIds.size === 0) return;

  ctx.save();

  const breath = 0.5 + 0.5 * Math.sin(timestamp * BREATH_RATE);
  const fillAlpha = (0.55 + 0.25 * breath) * 0.3;
  const strokeAlpha = 0.7 + 0.2 * breath;
  const glowBlur = (10 + 4 * breath) * dpr;

  const pad = HALO_PAD * dpr;
  const radius = HALO_RADIUS * dpr;

  for (const objectId of selectedIds) {
    const obj = objectStore.getObject(objectId);
    if (!obj) continue;

    const x = obj.bbox.x - pad;
    const y = obj.bbox.y - pad;
    const w = obj.bbox.width + pad * 2;
    const h = obj.bbox.height + pad * 2;

    // Ambient rim-light — reads as a soft glow behind the object.
    // No composite override: we rely on the `save()` default (`source-over`)
    // so the halo is visible against light, mid, and dark backgrounds.
    // The shadowBlur glow below carries the "rim-light" feel that the old
    // `lighter` additive pass used to provide on dark canvases.
    ctx.globalAlpha = fillAlpha;
    ctx.fillStyle = HALO_FILL;
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fill();

    // Neon outline — single breathing stroke, no dash pattern.
    ctx.globalAlpha = strokeAlpha;
    ctx.strokeStyle = HALO_STROKE;
    ctx.lineWidth = 2 * dpr;
    ctx.shadowColor = HALO_STROKE;
    ctx.shadowBlur = glowBlur;
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();

    // Reset shadow between objects so the next iteration starts clean.
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

/**
 * Rounded-rect sub-path. `CanvasRenderingContext2D.roundRect` exists on
 * modern browsers but headless-canvas backends used in Node-based tests do
 * not ship it consistently, so we emit the arc construction directly.
 */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}
