// PostProcessLayer — public-API smoke (Phase 6 sub-slice 6a-4b).
//
// jsdom + Vitest cannot construct a real WebGPU device, so we cannot
// exercise the full TSL chain compile here (Three.js's `PostProcessing`
// would call into `WebGPURenderer.compile()` which requires a real GPU
// adapter). What we CAN verify in jsdom:
//
//   - Constructor accepts the new options shape (no source canvas
//     required; defaults applied for missing fields).
//   - Public `Layer` interface surface is present (init, render, resize,
//     dispose, setVisible).
//   - All 6 setters exist as functions and behave as no-ops before init
//     (Phase 6 6b-6d invariant — pre-init / post-dispose calls must not
//     throw).
//   - `dispose` is idempotent — second call is a no-op.
//   - `name` and `z` defaults are sourced from `LAYER_DEFAULTS.postProcess`.
//
// Full TSL chain validation (uniform mutation produces visible delta in
// rendered pixels) is the @glymo/ui Browser Mode acceptance gate per the
// plan doc — that tier of test runs in a real browser with a real
// WebGPURenderer.

import { describe, it, expect } from 'vitest';
import { PostProcessLayer } from '../src/render/layers/PostProcessLayer.js';
import { LAYER_DEFAULTS } from '../src/render/constants.js';

describe('PostProcessLayer (6a-4b smoke)', () => {
  it('constructs with no options (all defaults applied)', () => {
    const layer = new PostProcessLayer();
    expect(layer.name).toBe(LAYER_DEFAULTS.postProcess.name);
    expect(layer.z).toBe(LAYER_DEFAULTS.postProcess.z);
    expect(layer.isInitialized()).toBe(false);
  });

  it('accepts custom name + z + intensity + scanlines', () => {
    const layer = new PostProcessLayer({
      name: 'custom-pp',
      z: 5,
      initialIntensity: 0.42,
      scanlinesEnabled: true,
    });
    expect(layer.name).toBe('custom-pp');
    expect(layer.z).toBe(5);
  });

  it('clamps invalid initialIntensity to a safe default', () => {
    // Construction must not throw on garbage input.
    expect(() => new PostProcessLayer({ initialIntensity: NaN })).not.toThrow();
    expect(() => new PostProcessLayer({ initialIntensity: -5 })).not.toThrow();
    expect(() => new PostProcessLayer({ initialIntensity: 100 })).not.toThrow();
  });

  it('exposes the full Layer interface', () => {
    const layer = new PostProcessLayer();
    expect(typeof layer.init).toBe('function');
    expect(typeof layer.render).toBe('function');
    expect(typeof layer.resize).toBe('function');
    expect(typeof layer.dispose).toBe('function');
    expect(typeof layer.setVisible).toBe('function');
  });

  it('exposes all 6 public setters', () => {
    const layer = new PostProcessLayer();
    expect(typeof layer.setEffectIntensity).toBe('function');
    expect(typeof layer.setScanlinesEnabled).toBe('function');
    expect(typeof layer.setBloomStrength).toBe('function');
    expect(typeof layer.setBloomThreshold).toBe('function');
    expect(typeof layer.setChromaticAberration).toBe('function');
    expect(typeof layer.setScanlineOpacity).toBe('function');
  });

  it('setters are silent no-ops before init', () => {
    const layer = new PostProcessLayer();
    expect(() => layer.setEffectIntensity(0.5)).not.toThrow();
    expect(() => layer.setScanlinesEnabled(true)).not.toThrow();
    expect(() => layer.setBloomStrength(1.5)).not.toThrow();
    expect(() => layer.setBloomThreshold(0.2)).not.toThrow();
    expect(() => layer.setChromaticAberration(2.0)).not.toThrow();
    expect(() => layer.setScanlineOpacity(0.1)).not.toThrow();
  });

  it('render() / resize() / setVisible() are silent no-ops before init', () => {
    const layer = new PostProcessLayer();
    expect(() => layer.render(16)).not.toThrow();
    expect(() => layer.resize(800, 600, 1)).not.toThrow();
    expect(() => layer.setVisible(false)).not.toThrow();
    expect(() => layer.setVisible(true)).not.toThrow();
  });

  it('dispose is idempotent (second call is a no-op)', () => {
    const layer = new PostProcessLayer();
    expect(() => layer.dispose()).not.toThrow();
    expect(() => layer.dispose()).not.toThrow();
    expect(layer.isInitialized()).toBe(false);
  });

  it('setters remain silent no-ops after dispose', () => {
    const layer = new PostProcessLayer();
    layer.dispose();
    expect(() => layer.setEffectIntensity(0.3)).not.toThrow();
    expect(() => layer.setScanlinesEnabled(false)).not.toThrow();
    expect(() => layer.render(16)).not.toThrow();
    expect(() => layer.resize(800, 600, 1)).not.toThrow();
  });

  it('resize ignores non-finite / non-positive dimensions', () => {
    const layer = new PostProcessLayer();
    expect(() => layer.resize(NaN, 600, 1)).not.toThrow();
    expect(() => layer.resize(800, 0, 1)).not.toThrow();
    expect(() => layer.resize(-100, 600, 1)).not.toThrow();
  });
});
