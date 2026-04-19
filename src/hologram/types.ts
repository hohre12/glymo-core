// ── Hologram 3D Types ─────────────────────────────────────────────────────────

/**
 * Minimal character data needed by the hologram renderer.
 * Extends the base RecognizedChar from CascadingRecognizer with animation fields.
 */
export interface HologramChar {
  id: string;
  char: string;
  /** CSS x-coordinate of the character center */
  x: number;
  /** CSS y-coordinate of the character center */
  y: number;
  width: number;
  height: number;
  /** performance.now() timestamp when the character entered */
  entryTime: number;
  /** Whether the character is being deleted (should be hidden) */
  isDeleting?: boolean;
}

/** Configuration for creating a Hologram3DRenderer */
export interface Hologram3DRendererOptions {
  /** The canvas element to render into */
  canvas: HTMLCanvasElement;
}

/** Result of a character hit test */
export interface HitTestResult {
  /** Character ID */
  id: string;
  /** Distance from the test point in CSS pixels */
  dist: number;
}

/** Snapshot of hologram manipulation state, output by HologramGesture */
export interface HologramGestureState {
  /** X-axis rotation in radians */
  rotX: number;
  /** Y-axis rotation in radians */
  rotY: number;
  /** Z-axis rotation in radians */
  rotZ: number;
  /** Spread multiplier: 0 = flat, 1 = normal, 2+ = explosion */
  spread: number;
  /** Whether two hands are actively controlling the hologram */
  handsActive: boolean;
  /** Currently grabbed character ID, or null */
  grabbedCharId: string | null;
  /** Grab position in CSS coords, if a char is grabbed */
  grabPosition: { x: number; y: number } | null;
  /** Whether the user just performed a reset gesture (both fists) */
  didReset: boolean;
}

// ── Media Art Mesh Source ─────────────────────────────────────────────────────
//
// Added in v0.7.0 (P3 of docs/plans/media-art-mvp.md). The Hologram3DRenderer
// switches between text mode (per-char TextGeometry, existing) and mesh mode
// (single GLB) via setModel(). Both modes share the same Three.js scene,
// camera, bloom postprocessing, and rotation/zoom/spread effects.
//
// Per §5 D5: a single Three.js context, internal mode flag routes geometry
// construction. The MeshSource interface keeps text/mesh paths cleanly
// separated without forcing the renderer into a god-class shape.

/**
 * Cache adapter for fetched GLB binaries. Implementations may persist to
 * IndexedDB, in-memory, or skip caching entirely. Keys are descriptor.id
 * (NOT URL) so reloading after a CDN move still hits cache.
 */
export interface MeshSourceCache {
  get(key: string): Promise<ArrayBuffer | null>;
  set(key: string, value: ArrayBuffer): Promise<void>;
}

/**
 * Descriptor for loading a GLB asset. Passed to Hologram3DRenderer.setModel().
 * Discriminated union — future descriptors (e.g. parametric primitives,
 * generated meshes) can be added without breaking existing call sites.
 */
export interface GltfMeshSourceDescriptor {
  type: 'gltf';
  /** Stable id from the catalog (e.g. "kenney-tree-01"). Used for cache key. */
  id: string;
  /** Public URL resolving to the GLB binary. */
  url: string;
  /** Optional cache adapter. If omitted, every load fetches the network. */
  cache?: MeshSourceCache;
}

/**
 * Union of all descriptors accepted by setModel(). Currently GLTF-only; future
 * additions (e.g. 'kenney-asset', 'tripo-generated') extend the union.
 */
export type MeshSourceDescriptor = GltfMeshSourceDescriptor;

/**
 * State of the loaded mesh-mode model. Produced by MeshSource.load() and
 * managed internally by Hologram3DRenderer. Disposing the renderer (or calling
 * setModel(null)) must call dispose() on this state to free GPU resources.
 */
export interface MediaArtMeshState {
  /** Stable id from the descriptor — survives across reloads for cache hits. */
  id: string;
  /** Root Group added to the scene. Owned by the MeshSource. */
  // Deliberately untyped here — full Three.js type lives in three/webgpu and
  // would force every consumer of this types module to import it. The
  // renderer treats it as opaque and only calls Group methods (add, remove,
  // traverse, dispose).
  group: unknown;
  /** Optional animation mixer for skinned/animated GLBs. */
  mixer?: unknown;
  /** Local-space bounding box for placement scale calculation. */
  bbox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  /** Dispose all GPU resources owned by this mesh (geometries, materials, textures). */
  dispose(): void;
}

/**
 * Mesh source contract. Implementations (GltfMeshSource, future: primitive
 * sources) are constructed from a descriptor and produce a MediaArtMeshState
 * via load(). The renderer never instantiates implementations directly — it
 * dispatches on descriptor.type.
 */
export interface MeshSource {
  /** Stable id used for dedup/idempotency (matches descriptor.id). */
  readonly id: string;
  /**
   * Load the mesh. Resolves with state ready to add to the scene; rejects
   * with a GlymoError on fetch/parse/validation failure. May take seconds for
   * large GLBs — callers should show loading UI.
   *
   * The THREE/tsl modules are passed in (not imported by the source) so the
   * renderer's lazy-import semantics are preserved and the source file stays
   * tree-shakeable.
   */
  load(deps: {
    THREE: typeof import('three/webgpu');
    tsl: typeof import('three/tsl');
  }): Promise<MediaArtMeshState>;
}
