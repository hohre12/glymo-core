// ── Mesh Sources Barrel ───────────────────────────────────────────────────────
//
// Public re-exports for the mesh source pack. Consumers (Hologram3DRenderer,
// tests, glymo-app orchestrator if it ever needs to peek under the hood) import
// from here to avoid coupling to individual source filenames.

export { BaseMeshSource } from './BaseMeshSource.js';
export type { BaseMeshSourceOptions } from './BaseMeshSource.js';
export { GltfMeshSource } from './GltfMeshSource.js';
export { GlbPbrMeshSource } from './GlbPbrMeshSource.js';
export { ProceduralPlanetMeshSource } from './ProceduralPlanetMeshSource.js';
export { createMeshSource } from './createMeshSource.js';
export {
  defaultFetcher,
  fetchArrayBufferWithCache,
  computeBboxFromObject,
  disposeObject3DTree,
  assertDescriptorType,
  assertDescriptorField,
} from './common.js';
export type { FetchLike } from './common.js';
