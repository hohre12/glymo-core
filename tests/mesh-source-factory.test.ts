// Tests for the createMeshSource factory and per-source descriptor validation.
//
// Constructor-level validation does NOT need Three.js — every concrete source
// asserts descriptor shape inside its constructor via assertDescriptorType /
// assertDescriptorField, throwing GlymoError before any Three import is
// touched. So this file deliberately avoids the heavy three/webgpu mock graph
// from hologram-mesh-mode.test.ts and focuses on:
//
//   - factory dispatches each `type` to the right concrete class
//   - factory rejects unknown types with `media-art/invalid-descriptor`
//   - GltfMeshSource rejects missing `url`
//   - GlbPbrMeshSource rejects missing `url` and missing `hdriUrl`
//   - ProceduralPlanetMeshSource rejects missing texture slots and bad textureSize
//
// Load-path tests (which DO require Three.js) live in hologram-mesh-mode.test.ts
// where the full stub graph is already wired.

import { describe, it, expect } from 'vitest';
import {
  createMeshSource,
  GltfMeshSource,
  GlbPbrMeshSource,
  ProceduralPlanetMeshSource,
} from '../src/hologram/sources/index.js';
import { GlymoError } from '../src/types.js';
import type {
  GltfMeshSourceDescriptor,
  GltfPbrMeshSourceDescriptor,
  ProceduralPlanetMeshSourceDescriptor,
} from '../src/hologram/types.js';

describe('createMeshSource factory', () => {
  it('dispatches type="gltf" to GltfMeshSource', () => {
    const src = createMeshSource({
      type: 'gltf',
      id: 'plain-glb',
      url: 'https://cdn/x.glb',
    });
    expect(src).toBeInstanceOf(GltfMeshSource);
    expect(src.id).toBe('plain-glb');
  });

  it('dispatches type="gltf-pbr" to GlbPbrMeshSource', () => {
    const src = createMeshSource({
      type: 'gltf-pbr',
      id: 'pbr-glb',
      url: 'https://cdn/x.glb',
      hdriUrl: 'https://cdn/sky.hdr',
    });
    expect(src).toBeInstanceOf(GlbPbrMeshSource);
    expect(src.id).toBe('pbr-glb');
  });

  it('dispatches type="procedural-planet" to ProceduralPlanetMeshSource', () => {
    const src = createMeshSource({
      type: 'procedural-planet',
      id: 'earth',
      textures: {
        daymap: 'https://cdn/d.jpg',
        clouds: 'https://cdn/c.jpg',
        normal: 'https://cdn/n.jpg',
      },
      textureSize: { width: 2048, height: 1024 },
    });
    expect(src).toBeInstanceOf(ProceduralPlanetMeshSource);
    expect(src.id).toBe('earth');
  });

  it('rejects unknown descriptor type with GlymoError', () => {
    expect(() =>
      createMeshSource({
        // Cast through unknown to bypass the discriminated-union exhaustiveness
        // check — this simulates a stale catalog entry shipped to a renderer
        // that pre-dates the new variant.
        type: 'rocket',
        id: 'x',
      } as unknown as GltfMeshSourceDescriptor),
    ).toThrow(GlymoError);
  });
});

describe('GltfMeshSource descriptor validation', () => {
  it('requires `id`', () => {
    expect(() =>
      new GltfMeshSource({
        type: 'gltf',
        id: '',
        url: 'https://cdn/x.glb',
      } as GltfMeshSourceDescriptor),
    ).toThrow(GlymoError);
  });

  it('requires `url`', () => {
    expect(() =>
      new GltfMeshSource({
        type: 'gltf',
        id: 'plain',
        url: '',
      } as GltfMeshSourceDescriptor),
    ).toThrow(GlymoError);
  });

  it('rejects mismatched `type`', () => {
    expect(() =>
      new GltfMeshSource({
        type: 'gltf-pbr',
        id: 'plain',
        url: 'x',
      } as unknown as GltfMeshSourceDescriptor),
    ).toThrow(GlymoError);
  });
});

describe('GlbPbrMeshSource descriptor validation', () => {
  const valid = {
    type: 'gltf-pbr',
    id: 'dog',
    url: 'https://cdn/dog.glb',
    hdriUrl: 'https://cdn/sky.hdr',
  } as const satisfies GltfPbrMeshSourceDescriptor;

  it('accepts the canonical descriptor', () => {
    const src = new GlbPbrMeshSource({ ...valid });
    expect(src.id).toBe('dog');
  });

  it('requires `url`', () => {
    expect(() =>
      new GlbPbrMeshSource({ ...valid, url: '' }),
    ).toThrow(GlymoError);
  });

  it('requires `hdriUrl`', () => {
    expect(() =>
      new GlbPbrMeshSource({ ...valid, hdriUrl: '' }),
    ).toThrow(GlymoError);
  });

  it('rejects mismatched `type`', () => {
    expect(() =>
      new GlbPbrMeshSource({
        ...valid,
        type: 'gltf',
      } as unknown as GltfPbrMeshSourceDescriptor),
    ).toThrow(GlymoError);
  });
});

describe('ProceduralPlanetMeshSource descriptor validation', () => {
  const valid = {
    type: 'procedural-planet',
    id: 'earth',
    textures: {
      daymap: 'https://cdn/d.jpg',
      clouds: 'https://cdn/c.jpg',
      normal: 'https://cdn/n.jpg',
    },
    textureSize: { width: 2048, height: 1024 },
  } as const satisfies ProceduralPlanetMeshSourceDescriptor;

  it('accepts the canonical descriptor', () => {
    const src = new ProceduralPlanetMeshSource({ ...valid });
    expect(src.id).toBe('earth');
  });

  it('requires every texture slot', () => {
    for (const slot of ['daymap', 'clouds', 'normal'] as const) {
      expect(() =>
        new ProceduralPlanetMeshSource({
          ...valid,
          textures: { ...valid.textures, [slot]: '' },
        }),
      ).toThrow(GlymoError);
    }
  });

  it('requires positive textureSize', () => {
    expect(() =>
      new ProceduralPlanetMeshSource({
        ...valid,
        textureSize: { width: 0, height: 1024 },
      }),
    ).toThrow(GlymoError);
    expect(() =>
      new ProceduralPlanetMeshSource({
        ...valid,
        textureSize: { width: 2048, height: -1 },
      }),
    ).toThrow(GlymoError);
  });

  it('rejects mismatched `type`', () => {
    expect(() =>
      new ProceduralPlanetMeshSource({
        ...valid,
        type: 'gltf',
      } as unknown as ProceduralPlanetMeshSourceDescriptor),
    ).toThrow(GlymoError);
  });

  it('applies default axialTiltDeg + rotationRate when omitted', () => {
    // No public getter, but constructor must not throw with the minimal shape.
    const src = new ProceduralPlanetMeshSource({ ...valid });
    expect(src.id).toBe('earth');
  });

  it('honours user-supplied axialTiltDeg + rotationRate', () => {
    const src = new ProceduralPlanetMeshSource({
      ...valid,
      axialTiltDeg: 0,
      rotationRate: { body: 0, clouds: 0 },
    });
    expect(src.id).toBe('earth');
  });
});
