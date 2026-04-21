// ── Hologram Module Barrel Exports ────────────────────────────────────────────

export { Hologram3DRenderer } from './Hologram3DRenderer.js';
export type {
  HologramChar,
  Hologram3DRendererOptions,
  HitTestResult,
  HologramGestureState,
  // ── Media Art (v0.7.0+) ──
  MeshSource,
  MeshSourceCache,
  MeshSourceDescriptor,
  MeshSourceLoadContext,
  BaseMeshSourceDescriptor,
  GltfMeshSourceDescriptor,
  GltfPbrMeshSourceDescriptor,
  ProceduralPlanetMeshSourceDescriptor,
  MediaArtMeshState,
} from './types.js';

// ── Media Art (v0.8.0 — polymorphic source pack) ────────────────────────────
export {
  BaseMeshSource,
  GltfMeshSource,
  GlbPbrMeshSource,
  ProceduralPlanetMeshSource,
  createMeshSource,
  setLoaderDecoderPaths,
  getKtx2Loader,
  getDracoLoader,
  // v0.13.0 — shared rendering defaults + neutral environment/rig helpers
  BUNDLED_NEUTRAL_ENVIRONMENT,
  DEFAULT_ATMOSPHERE_COLOR_HEX,
  DEFAULT_AXIAL_TILT_DEG,
  DEFAULT_ENVIRONMENT_INTENSITY,
  DEFAULT_FILL_LIGHT_POSITION,
  DEFAULT_KEY_LIGHT_POSITION,
  DEFAULT_LIGHT_RIG_INTENSITY,
  DEFAULT_ROTATION_BODY,
  DEFAULT_ROTATION_CLOUDS,
  VARIANT_DEFAULTS,
  getVariantDefaults,
  createNeutralEnvironmentTexture,
  createNeutralLightRig,
} from './sources/index.js';
export type {
  BaseMeshSourceOptions,
  FetchLike,
  FetchProgressCallback,
  // v0.13.0 types
  BundledNeutralEnvironment,
  LightPosition,
  LightRigIntensity,
  GltfVariantDefaults,
  GltfPbrVariantDefaults,
  ProceduralPlanetVariantDefaults,
  VariantDefaults,
  VariantKey,
  NeutralLightRig,
  NeutralLightRigConfig,
} from './sources/index.js';
export {
  createMediaArtShaderNodes,
  applyMediaArtShaderTreatment,
  applyTexturedMediaArtShaderTreatment,
  MEDIA_ART_LUMINANCE_STOPS,
} from './mediaArtTSL.js';
export type {
  MediaArtShaderNodes,
  MediaArtTreatmentResult,
} from './mediaArtTSL.js';
