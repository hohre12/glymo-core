// TextOverlayLayer — Phase 6 sub-slice 6a-3a, refactored Batch A to use
// `LAYER_DEFAULTS` constants. Public surface UNCHANGED from 0.26.2.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';
import { LAYER_DEFAULTS } from '../constants.js';

export interface TextOverlayLayerOptions {
  source: HTMLCanvasElement;
  name?: string;
  z?: number;
}

export class TextOverlayLayer extends CanvasMirrorLayer {
  constructor(opts: TextOverlayLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? LAYER_DEFAULTS.textOverlay.name,
      z: opts.z ?? LAYER_DEFAULTS.textOverlay.z,
      logName: LAYER_DEFAULTS.textOverlay.logName,
    });
  }
}
