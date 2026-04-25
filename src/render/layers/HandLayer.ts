// HandLayer — Phase 6 sub-slice 6a-6, refactored Batch A to use
// `LAYER_DEFAULTS` constants. Public surface UNCHANGED from 0.27.1.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';
import { LAYER_DEFAULTS } from '../constants.js';

export interface HandLayerOptions {
  source: HTMLCanvasElement;
  name?: string;
  z?: number;
}

export class HandLayer extends CanvasMirrorLayer {
  constructor(opts: HandLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? LAYER_DEFAULTS.hand.name,
      z: opts.z ?? LAYER_DEFAULTS.hand.z,
      logName: LAYER_DEFAULTS.hand.logName,
    });
  }
}
