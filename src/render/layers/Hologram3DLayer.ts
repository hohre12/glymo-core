// Hologram3DLayer — Phase 6 sub-slice 6a-5a, refactored Batch A to use
// `LAYER_DEFAULTS` constants. Public surface UNCHANGED from 0.27.0.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';
import { LAYER_DEFAULTS } from '../constants.js';

export interface Hologram3DLayerOptions {
  source: HTMLCanvasElement;
  name?: string;
  z?: number;
  /**
   * Phase 6 6b-6f — synchronous callback fired BEFORE the texture is
   * marked dirty for the GPU upload. Lets the consumer drive the
   * Hologram3DRenderer's `renderFrame()` exactly once per SceneGraph
   * tick, guaranteeing the texture sees the freshest frame instead of
   * a one-frame-stale snapshot driven by the renderer's separate RAF
   * subscription. Mirrors the legacy `Compositor.beforeRead` hook in
   * `glymo-ui/CanvasEngine.tsx:2300-2311`.
   */
  beforeRender?: () => void;
}

export class Hologram3DLayer extends CanvasMirrorLayer {
  constructor(opts: Hologram3DLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? LAYER_DEFAULTS.hologram3d.name,
      z: opts.z ?? LAYER_DEFAULTS.hologram3d.z,
      logName: LAYER_DEFAULTS.hologram3d.logName,
      beforeRender: opts.beforeRender,
    });
  }
}
