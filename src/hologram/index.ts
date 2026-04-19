// ── Hologram Module Barrel Exports ────────────────────────────────────────────

export { Hologram3DRenderer } from './Hologram3DRenderer.js';
export type {
  HologramChar,
  Hologram3DRendererOptions,
  HitTestResult,
  HologramGestureState,
  // ── Media Art (v0.7.0) ──
  MeshSource,
  MeshSourceCache,
  MeshSourceDescriptor,
  GltfMeshSourceDescriptor,
  MediaArtMeshState,
} from './types.js';

// ── Media Art (v0.7.0) ──────────────────────────────────────────────────────
export { GltfMeshSource } from './sources/GltfMeshSource.js';
export {
  createMediaArtShaderNodes,
  applyMediaArtShaderTreatment,
  MEDIA_ART_LUMINANCE_STOPS,
} from './mediaArtTSL.js';
export type { MediaArtShaderNodes } from './mediaArtTSL.js';
