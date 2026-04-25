// AmbientGlowLayer — Phase 6 sub-slice 6a-4a (R2 conservative wrapper of
// the legacy `useAmbientGlow` 2D output). Refactored 6b-pre to inherit
// from `CanvasMirrorLayer`.
//
// Public surface UNCHANGED from 0.26.3. Regression goldens
// (`ambient-mirror-amber`, `ambient-mirror-teal`,
// `composite-ambient-stroke-text`, `composite-ambient-stroke`,
// `composite-ambient-only`) gate bit-for-bit visual equivalence
// pre/post extract.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';

export interface AmbientGlowLayerOptions {
  /** The 2D `<canvas>` whose contents this layer mirrors onto the
   *  SceneGraph. In production this is the canvas owned by the legacy
   *  `useAmbientGlow` hook (rendered behind characters via radial
   *  gradients with per-char fade tracking). */
  source: HTMLCanvasElement;
  /** Optional name override (default `'ambient-glow'`). */
  name?: string;
  /** Z position (default `-1` — BELOW StrokeLayer's z=0; ambient is the
   *  background layer of the SceneGraph stack). */
  z?: number;
}

/**
 * AmbientGlowLayer — fullscreen quad that mirrors the legacy
 * `useAmbientGlow` output canvas onto the SceneGraph at z=-1.
 */
export class AmbientGlowLayer extends CanvasMirrorLayer {
  constructor(opts: AmbientGlowLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? 'ambient-glow',
      z: opts.z ?? -1,
      logName: 'AmbientGlowLayer',
    });
  }
}
