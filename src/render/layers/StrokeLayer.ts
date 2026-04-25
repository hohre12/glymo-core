// StrokeLayer — Phase 6 sub-slice 6a-2 (CanvasTexture quad mirror of the
// legacy `CanvasRenderer` 2D output). Refactored 6b-pre to inherit from
// `CanvasMirrorLayer`. Refactored Batch A to read defaults from
// `LAYER_DEFAULTS` constants (single source of truth — see
// `../constants.ts` module header).
//
// Public surface UNCHANGED from 0.26.1.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';
import { LAYER_DEFAULTS } from '../constants.js';

export interface StrokeLayerOptions {
  /** The 2D `<canvas>` whose contents this layer mirrors. */
  source: HTMLCanvasElement;
  /** Optional name override (default per `LAYER_DEFAULTS.stroke.name`). */
  name?: string;
  /** Z position override (default per `LAYER_DEFAULTS.stroke.z`). */
  z?: number;
}

export class StrokeLayer extends CanvasMirrorLayer {
  constructor(opts: StrokeLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? LAYER_DEFAULTS.stroke.name,
      z: opts.z ?? LAYER_DEFAULTS.stroke.z,
      logName: LAYER_DEFAULTS.stroke.logName,
    });
  }
}
