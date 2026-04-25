// AmbientGlowLayer — Phase 6 sub-slice 6a-4a, refactored Batch A to use
// `LAYER_DEFAULTS` constants. Public surface UNCHANGED from 0.26.3.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';
import { LAYER_DEFAULTS } from '../constants.js';

export interface AmbientGlowLayerOptions {
  source: HTMLCanvasElement;
  name?: string;
  z?: number;
}

export class AmbientGlowLayer extends CanvasMirrorLayer {
  constructor(opts: AmbientGlowLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? LAYER_DEFAULTS.ambientGlow.name,
      z: opts.z ?? LAYER_DEFAULTS.ambientGlow.z,
      logName: LAYER_DEFAULTS.ambientGlow.logName,
    });
  }
}
