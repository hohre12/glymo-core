// Pin-test for the shared media-art rendering constants.
//
// These values define the baseline visual quality for every mesh source variant
// (gltf / gltf-pbr / procedural-planet). A change here re-tones every asset
// that hasn't explicitly overridden the value, so the test locks them in place
// — a failing case is the prompt to add the intended override at the
// descriptor site, not to silently drift the constants.

import { describe, it, expect } from 'vitest';
import {
  BUNDLED_NEUTRAL_ENVIRONMENT,
  DEFAULT_ATMOSPHERE_COLOR_HEX,
  DEFAULT_AXIAL_TILT_DEG,
  DEFAULT_ENVIRONMENT_INTENSITY,
  DEFAULT_FILL_LIGHT_POSITION,
  DEFAULT_KEY_LIGHT_POSITION,
  DEFAULT_LIGHT_RIG_INTENSITY,
  DEFAULT_ROTATION_BODY,
  DEFAULT_ROTATION_CLOUDS,
} from '../src/hologram/sources/mediaArtDefaults.js';

describe('mediaArtDefaults', () => {
  it('pins DEFAULT_ENVIRONMENT_INTENSITY at 0.6', () => {
    expect(DEFAULT_ENVIRONMENT_INTENSITY).toBe(0.6);
  });

  it('pins the 3-point rig intensities', () => {
    expect(DEFAULT_LIGHT_RIG_INTENSITY).toEqual({
      key: 1.6,
      fill: 0.4,
      ambient: 0.2,
    });
  });

  it('pins the key / fill light positions', () => {
    expect(DEFAULT_KEY_LIGHT_POSITION).toEqual({ x: 3, y: 5, z: 4 });
    expect(DEFAULT_FILL_LIGHT_POSITION).toEqual({ x: -4, y: 2, z: -3 });
  });

  it('pins the procedural-planet defaults', () => {
    expect(DEFAULT_AXIAL_TILT_DEG).toBe(23.4);
    expect(DEFAULT_ROTATION_BODY).toBe(0.10);
    expect(DEFAULT_ROTATION_CLOUDS).toBe(0.13);
  });

  it('pins DEFAULT_ATMOSPHERE_COLOR_HEX as cyan (0x00ccff)', () => {
    expect(DEFAULT_ATMOSPHERE_COLOR_HEX).toBe(0x00ccff);
  });

  it('exposes BUNDLED_NEUTRAL_ENVIRONMENT as a room-environment marker', () => {
    expect(BUNDLED_NEUTRAL_ENVIRONMENT.kind).toBe('room-environment');
    expect(BUNDLED_NEUTRAL_ENVIRONMENT.cacheKey).toBe('@core:neutral-env');
  });
});
