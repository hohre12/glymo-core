// TextOverlayLayer — Phase 6 sub-slice 6a-3a (R2 conservative wrapper of
// the legacy `TextOverlayCanvas` 2D output). Refactored 6b-pre to
// inherit from `CanvasMirrorLayer`.
//
// Public surface UNCHANGED from 0.26.2. Regression goldens
// (`text-mirror-magenta`, `text-mirror-yellow`, `composite-stroke-text`,
// `composite-stroke-only`) gate bit-for-bit visual equivalence pre/post
// extract.
//
// 6a-3b deferred contract (TSL InstancedMesh + glyph-centroid parity
// gate) is unchanged — the extraction does not affect the future TSL
// upgrade path. 6a-3b will REPLACE this class's superclass call with a
// custom InstancedMesh-based `init`/`render`/`dispose` once the parity
// gate exists; until then this thin shim is the canonical 6a-3a shape.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';

export interface TextOverlayLayerOptions {
  /** The 2D `<canvas>` whose contents this layer mirrors onto the
   *  SceneGraph. In production this is the canvas owned by
   *  `@glymo/ui/canvas/components/TextOverlayCanvas.tsx` exposed via
   *  its `onCanvasReady(canvas)` callback. */
  source: HTMLCanvasElement;
  /** Optional name override (default `'text-overlay'`). */
  name?: string;
  /** Z position (default `1` — ABOVE StrokeLayer's z=0, BELOW
   *  Hologram3DLayer's z=2). */
  z?: number;
}

/**
 * TextOverlayLayer — fullscreen quad that mirrors the legacy
 * `TextOverlayCanvas` output onto the SceneGraph at z=1.
 */
export class TextOverlayLayer extends CanvasMirrorLayer {
  constructor(opts: TextOverlayLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? 'text-overlay',
      z: opts.z ?? 1,
      logName: 'TextOverlayLayer',
    });
  }
}
