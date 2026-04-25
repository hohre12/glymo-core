// PostProcessLayer — Phase 6 sub-slice 6a-4a (R2 conservative wrapper of
// the legacy `useWebGPUPostProcess` output canvas). Refactored Batch A
// to use `LAYER_DEFAULTS` constants.
//
// The legacy `useWebGPUPostProcess` hook runs a custom WGSL shader
// (bloom + chromatic aberration + scanlines for hologram/aurora
// effects) on its OWN WebGPU canvas. Pre-Phase-6, the Compositor adds
// that canvas as the `'webgpu'` layer and toggles between it and the
// raw `'drawing'` + `'overlay'` layers based on `webGPUAvailable`.
//
// Under renderV2, this layer mirrors the same WebGPU canvas as a
// CanvasTexture quad. The bloom + chromatic + scanlines are STILL
// produced by the legacy WGSL shader (it has its own canvas; it
// continues to render regardless of which compositor is reading it).
// This is the R2 conservative path — user-visible behaviour is
// pixel-equivalent to legacy.
//
// Sub-slice 6a-4b (deferred): true Three.js TSL bloom + chromatic
// aberration nodes that DELETE the 646 LOC of custom WGSL. Until
// 6a-4b ships, this PostProcessLayer is the canonical Phase 6 entry
// for post-process composition into the SceneGraph; the WGSL pipeline
// keeps producing the pixels.

import { CanvasMirrorLayer } from './CanvasMirrorLayer.js';
import { LAYER_DEFAULTS } from '../constants.js';

export interface PostProcessLayerOptions {
  /** The 2D / WebGPU `<canvas>` whose pixels this layer mirrors. In
   *  production this is `webGPUCanvasRef.current` — the canvas owned
   *  by the legacy `useWebGPUPostProcess` hook. */
  source: HTMLCanvasElement;
  name?: string;
  z?: number;
}

export class PostProcessLayer extends CanvasMirrorLayer {
  constructor(opts: PostProcessLayerOptions) {
    super({
      source: opts.source,
      name: opts.name ?? LAYER_DEFAULTS.postProcess.name,
      z: opts.z ?? LAYER_DEFAULTS.postProcess.z,
      logName: LAYER_DEFAULTS.postProcess.logName,
    });
  }
}
