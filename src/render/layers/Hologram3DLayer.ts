// Hologram3DLayer — Phase 6 sub-slice 6a-5a (R2 conservative wrapper of
// the legacy `Hologram3DRenderer` WebGPU output). Refactored 6b-pre to
// inherit from `CanvasMirrorLayer`.
//
// Public surface UNCHANGED from 0.27.0. Regression goldens
// (`hologram-mirror-diamond`, `hologram-mirror-orange`,
// `composite-4layer-stack`, `composite-4layer-without-hologram`) gate
// bit-for-bit visual equivalence pre/post extract.
//
// The 0.27.0 I10 (Issue #3) coexistence fix lives in
// `src/hologram/Hologram3DRenderer.ts` and is INDEPENDENT of this
// extract — the renderFrame rewrite was a behavioral fix to the legacy
// renderer; this class is the SceneGraph absorption wrapper. Both
// changes shipped together in 0.27.0; the extraction here does not
// touch the renderer.
//
// 6a-5b deferred contract (literal HologramLayer + MediaArtLayer split
// with separate renderers / RenderTargets / camera ownership) is
// unchanged — the extraction does not affect the future split path.
// 6a-5b will introduce two NEW classes (HologramLayer, MediaArtLayer)
// alongside this one; this class stays as the unified-canvas wrapper
// for back-compat consumers.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';

export interface Hologram3DLayerOptions {
  /** The output `<canvas>` of an existing `Hologram3DRenderer`
   *  instance. The Layer holds a reference but never mutates the
   *  source. */
  source: HTMLCanvasElement;
  /** Optional name override (default `'hologram-3d'`). */
  name?: string;
  /** Z position (default `2` — ABOVE TextOverlayLayer's z=1, BELOW
   *  HandLayer's z=3). */
  z?: number;
}

/**
 * Hologram3DLayer — fullscreen quad that mirrors the legacy
 * `Hologram3DRenderer` WebGPU output (post-6a-5a unified mesh + char
 * coexistence) onto the SceneGraph at z=2.
 */
export class Hologram3DLayer extends CanvasMirrorLayer {
  constructor(opts: Hologram3DLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? 'hologram-3d',
      z: opts.z ?? 2,
      logName: 'Hologram3DLayer',
    });
  }
}
