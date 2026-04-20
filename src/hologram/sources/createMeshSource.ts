// ── Mesh Source Factory ───────────────────────────────────────────────────────
//
// Single dispatch point from a polymorphic MeshSourceDescriptor to a concrete
// MeshSource implementation. Centralising the dispatch here means:
//
//   1. Hologram3DRenderer never instantiates concrete sources directly — it
//      calls the factory and treats the result as opaque MeshSource.
//   2. Adding a new source variant is a one-line case in the switch + a fresh
//      file under sources/. The exhaustive `never` branch makes a missing case
//      a build-time error.
//   3. Tests can stub the factory to inject mock sources without monkey-patching
//      the renderer.
//
// Each subclass owns its own descriptor validation in its constructor (via
// assertDescriptorType + assertDescriptorField from common.ts), so this file
// stays purely structural.

import { GlymoError } from '../../types.js';
import type { MeshSource, MeshSourceDescriptor } from '../types.js';
import type { BaseMeshSourceOptions } from './BaseMeshSource.js';
import { GltfMeshSource } from './GltfMeshSource.js';
import { GlbPbrMeshSource } from './GlbPbrMeshSource.js';
import { ProceduralPlanetMeshSource } from './ProceduralPlanetMeshSource.js';

/**
 * Dispatch a descriptor to its concrete MeshSource. Throws GlymoError with
 * `media-art/invalid-descriptor` on an unknown type — the exhaustiveness check
 * catches this at build time, but the runtime guard handles freshly-saved
 * catalog entries that pre-date a renderer build.
 */
export function createMeshSource(
  descriptor: MeshSourceDescriptor,
  options: BaseMeshSourceOptions = {},
): MeshSource {
  switch (descriptor.type) {
    case 'gltf':
      return new GltfMeshSource(descriptor, options);
    case 'gltf-pbr':
      return new GlbPbrMeshSource(descriptor, options);
    case 'procedural-planet':
      return new ProceduralPlanetMeshSource(descriptor, options);
    default: {
      // Build-time exhaustiveness — if a new MeshSourceDescriptor variant is
      // added without a matching case, TS will fail this assignment.
      const _exhaustive: never = descriptor;
      throw new GlymoError(
        'media-art/invalid-descriptor',
        `Unknown mesh source descriptor type: ${JSON.stringify(_exhaustive)}`,
        { recoverable: false },
      );
    }
  }
}
