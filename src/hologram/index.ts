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
} from './sources/index.js';
export type {
  BaseMeshSourceOptions,
  FetchLike,
  FetchProgressCallback,
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
