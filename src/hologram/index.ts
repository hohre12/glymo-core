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
} from './sources/index.js';
export type { BaseMeshSourceOptions, FetchLike } from './sources/index.js';
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
