// WatermarkLayer — Phase 6 sub-slice 6b-5, refactored Batch A to use
// `LAYER_DEFAULTS` constants.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';
import { LAYER_DEFAULTS } from '../constants.js';

export interface WatermarkLayerOptions {
  source: HTMLCanvasElement;
  name?: string;
  z?: number;
}

export class WatermarkLayer extends CanvasMirrorLayer {
  constructor(opts: WatermarkLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? LAYER_DEFAULTS.watermark.name,
      z: opts.z ?? LAYER_DEFAULTS.watermark.z,
      logName: LAYER_DEFAULTS.watermark.logName,
    });
  }
}
