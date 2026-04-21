// Variant defaults registry — asserts each mesh source variant has a
// complete, type-narrow default set, and that getVariantDefaults() surfaces
// the correct branch.

import { describe, it, expect } from 'vitest';
import {
  VARIANT_DEFAULTS,
  getVariantDefaults,
} from '../src/hologram/sources/variantDefaults.js';
import {
  DEFAULT_ATMOSPHERE_COLOR_HEX,
  DEFAULT_AXIAL_TILT_DEG,
  DEFAULT_ENVIRONMENT_INTENSITY,
  DEFAULT_FILL_LIGHT_POSITION,
  DEFAULT_KEY_LIGHT_POSITION,
  DEFAULT_LIGHT_RIG_INTENSITY,
  DEFAULT_ROTATION_BODY,
  DEFAULT_ROTATION_CLOUDS,
} from '../src/hologram/sources/mediaArtDefaults.js';

describe('VARIANT_DEFAULTS registry', () => {
  it('exposes exactly three variants', () => {
    expect(Object.keys(VARIANT_DEFAULTS).sort()).toEqual([
      'gltf',
      'gltf-pbr',
      'procedural-planet',
    ]);
  });

  it('gltf variant bundles neutral env + rig + intensity', () => {
    const d = VARIANT_DEFAULTS.gltf;
    expect(d.kind).toBe('gltf');
    expect(d.environment.kind).toBe('room-environment');
    expect(d.environmentIntensity).toBe(DEFAULT_ENVIRONMENT_INTENSITY);
    expect(d.lightRigIntensity).toEqual(DEFAULT_LIGHT_RIG_INTENSITY);
    expect(d.keyLightPosition).toEqual(DEFAULT_KEY_LIGHT_POSITION);
    expect(d.fillLightPosition).toEqual(DEFAULT_FILL_LIGHT_POSITION);
  });

  it('gltf-pbr variant exposes only env intensity', () => {
    const d = VARIANT_DEFAULTS['gltf-pbr'];
    expect(d.kind).toBe('gltf-pbr');
    expect(d.environmentIntensity).toBe(DEFAULT_ENVIRONMENT_INTENSITY);
  });

  it('procedural-planet variant exposes tilt + rotation + atmosphere', () => {
    const d = VARIANT_DEFAULTS['procedural-planet'];
    expect(d.kind).toBe('procedural-planet');
    expect(d.axialTiltDeg).toBe(DEFAULT_AXIAL_TILT_DEG);
    expect(d.rotationBody).toBe(DEFAULT_ROTATION_BODY);
    expect(d.rotationClouds).toBe(DEFAULT_ROTATION_CLOUDS);
    expect(d.atmosphereColorHex).toBe(DEFAULT_ATMOSPHERE_COLOR_HEX);
  });

  it('getVariantDefaults narrows on the literal key', () => {
    const gltfDefaults = getVariantDefaults('gltf');
    expect(gltfDefaults.kind).toBe('gltf');

    const pbrDefaults = getVariantDefaults('gltf-pbr');
    expect(pbrDefaults.kind).toBe('gltf-pbr');

    const planetDefaults = getVariantDefaults('procedural-planet');
    expect(planetDefaults.kind).toBe('procedural-planet');
  });
});
