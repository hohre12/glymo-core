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
export type { FetchLike, FetchProgressCallback } from './common.js';
export {
  getKtx2Loader,
  getDracoLoader,
  setLoaderDecoderPaths,
} from './loaders.js';
export {
  BUNDLED_NEUTRAL_ENVIRONMENT,
  DEFAULT_ATMOSPHERE_COLOR_HEX,
  DEFAULT_AXIAL_TILT_DEG,
  DEFAULT_ENVIRONMENT_INTENSITY,
  DEFAULT_FILL_LIGHT_POSITION,
  DEFAULT_KEY_LIGHT_POSITION,
  DEFAULT_LIGHT_RIG_INTENSITY,
  DEFAULT_ROTATION_BODY,
  DEFAULT_ROTATION_CLOUDS,
} from './mediaArtDefaults.js';
export type {
  BundledNeutralEnvironment,
  LightPosition,
  LightRigIntensity,
} from './mediaArtDefaults.js';
export {
  VARIANT_DEFAULTS,
  getVariantDefaults,
} from './variantDefaults.js';
export type {
  GltfPbrVariantDefaults,
  GltfVariantDefaults,
  ProceduralPlanetVariantDefaults,
  VariantDefaults,
  VariantKey,
} from './variantDefaults.js';
export { createNeutralEnvironmentTexture } from './neutralEnvironment.js';
export { createNeutralLightRig } from './neutralLightRig.js';
export type {
  NeutralLightRig,
  NeutralLightRigConfig,
} from './neutralLightRig.js';
