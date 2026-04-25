// HandLayer — Phase 6 sub-slice 6a-6 (R2 conservative wrapper of the
// legacy `HandVisualizer` 2D output). Refactored 6b-pre to inherit from
// `CanvasMirrorLayer`.
//
// Public surface UNCHANGED from 0.27.1. Regression goldens
// (`hand-mirror-skeleton`, `hand-mirror-dot`, `composite-5layer-full-stack`,
// `composite-5layer-without-hand`) gate bit-for-bit visual equivalence
// pre/post extract.
//
// 6a-6b deferred contract (Line2 + LineSegments2 from
// three/examples/jsm/lines/, with parity gate vs the 2D output) is
// unchanged — the extraction does not affect the future Line2 upgrade
// path. 6a-6b will REPLACE this class's superclass call with a custom
// Line2-based `init`/`render`/`dispose` once the parity gate exists.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';

export interface HandLayerOptions {
  /** The 2D `<canvas>` whose contents this layer mirrors onto the
   *  SceneGraph. In production this is the canvas owned by
   *  `HandVisualizer` (drawing MediaPipe Hands landmarks + connectors
   *  via 2D Canvas calls). */
  source: HTMLCanvasElement;
  /** Optional name override (default `'hand'`). */
  name?: string;
  /** Z position (default `3` — ABOVE Hologram3DLayer's z=2; the topmost
   *  layer of the documented Phase 6 Z stack so hand visualisation
   *  remains visible above every content surface). */
  z?: number;
}

/**
 * HandLayer — fullscreen quad that mirrors the legacy `HandVisualizer`
 * output onto the SceneGraph at z=3 (topmost in the documented stack).
 */
export class HandLayer extends CanvasMirrorLayer {
  constructor(opts: HandLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? 'hand',
      z: opts.z ?? 3,
      logName: 'HandLayer',
    });
  }
}
