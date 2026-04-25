// WatermarkLayer — Phase 6 sub-slice 6b-5 first cut.
//
// Mirrors the legacy Compositor's `'watermark'` layer (per
// `CanvasEngine.tsx` 2295-2299). The watermark is a synthetic 2D canvas
// painted by `paintWatermarkTile()` with the per-background-mode
// variant; mounted as the topmost layer of the legacy compositor stack
// so it lands on every recorded frame as well as the live display.
//
// Phase 6 6b-1+6b-2 wired the 5 content layers but missed the
// watermark. This file is the fix. Same proven CanvasTexture-quad
// pattern as `CanvasMirrorLayer` — the watermark canvas is a static
// image (re-painted only when `backgroundMode` changes), so the
// per-frame `texture.needsUpdate = true` from CanvasMirrorLayer's
// render() is slightly wasteful but correct.
//
// ── Composition contract ───────────────────────────────────────────────
//
// WatermarkLayer's default `z = 4` is ABOVE HandLayer's `z = 3` —
// the watermark must be the topmost layer so it survives
// recording / screenshot / Pro-tier transparent export. Both
// `transparent: true` (the watermark's tile pattern has alpha) and
// `depthTest: false`.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';

export interface WatermarkLayerOptions {
  /** The 2D `<canvas>` whose contents this layer mirrors onto the
   *  SceneGraph. In production this is the synthetic canvas painted
   *  by `paintWatermarkTile()` inside `CanvasEngine.tsx` and held in
   *  `watermarkCanvasRef`. */
  source: HTMLCanvasElement;
  /** Optional name override (default `'watermark'`). */
  name?: string;
  /** Z position (default `4` — ABOVE HandLayer's `z = 3`; the topmost
   *  layer so the watermark lands on every recorded frame). */
  z?: number;
}

/**
 * WatermarkLayer — fullscreen quad that mirrors the synthetic
 * watermark canvas onto the SceneGraph. Topmost layer (z=4) of the
 * documented Phase 6 Z stack.
 */
export class WatermarkLayer extends CanvasMirrorLayer {
  constructor(opts: WatermarkLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? 'watermark',
      z: opts.z ?? 4,
      logName: 'WatermarkLayer',
    });
  }
}
