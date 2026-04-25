// StrokeLayer — Phase 6 sub-slice 6a-2 (CanvasTexture quad mirror of the
// legacy `CanvasRenderer` 2D output). Refactored 6b-pre to inherit from
// `CanvasMirrorLayer` (the shared base extracted after 6a-6 once 5/5
// layers shared the pattern verbatim modulo defaults).
//
// Public surface UNCHANGED from 0.26.1 — `import { StrokeLayer,
// StrokeLayerOptions } from '@glymo/core/render'` still resolves to the
// same class shape; the regression goldens
// (`mirror-A-chromium-darwin.png`, `mirror-B-chromium-darwin.png`) gate
// bit-for-bit visual equivalence pre/post extract.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';

export interface StrokeLayerOptions {
  /** The 2D `<canvas>` whose contents this layer mirrors onto the
   *  SceneGraph. In production this is the canvas owned by the legacy
   *  `CanvasRenderer` from `@glymo/core/src/render/CanvasRenderer.ts`;
   *  StrokeLayer holds a reference but never mutates the source. */
  source: HTMLCanvasElement;
  /** Optional name override for the Layer registry (default `'stroke'`). */
  name?: string;
  /** Z position of the quad. Default `0` — base of the SceneGraph stack
   *  (above AmbientGlowLayer's z=-1, below TextOverlayLayer's z=1). */
  z?: number;
}

/**
 * StrokeLayer — fullscreen quad that mirrors a 2D source canvas onto the
 * SceneGraph at z=0. See `CanvasMirrorLayer` for the shared
 * implementation; this class only provides class-specific defaults.
 */
export class StrokeLayer extends CanvasMirrorLayer {
  constructor(opts: StrokeLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? 'stroke',
      z: opts.z ?? 0,
      logName: 'StrokeLayer',
    });
  }
}
