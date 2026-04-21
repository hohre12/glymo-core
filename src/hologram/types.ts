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
// via setModel(). Both modes share the same Three.js scene, camera, bloom
// postprocessing, and rotation/zoom/spread effects.
//
// Per §5 D5: a single Three.js context, internal mode flag routes geometry
// construction. The MeshSource interface keeps text/mesh paths cleanly
// separated without forcing the renderer into a god-class shape.
//
// v0.8.0 (2026-04-20) made the descriptor union polymorphic so each catalog
// category can ship its own production-grade mesh source (procedural planets,
// PBR-with-HDRI scenes, plain GLB) without forcing every asset through one
// loader. The factory createMeshSource(descriptor) dispatches on type; each
// concrete source extends BaseMeshSource for shared cache/dispose plumbing.

/**
 * Cache adapter for fetched binaries (GLB, HDR, image). Implementations may
 * persist to IndexedDB, in-memory, or skip caching entirely. Keys are
 * descriptor.id (NOT URL) so reloading after a CDN move still hits cache.
 *
 * For multi-asset sources (e.g. ProceduralPlanetMeshSource fetches three
 * textures), implementations namespace internally — the public contract is
 * still {get,set}(key, value).
 */
export interface MeshSourceCache {
  get(key: string): Promise<ArrayBuffer | null>;
  set(key: string, value: ArrayBuffer): Promise<void>;
}

/**
 * Fields common to every MeshSource descriptor variant. Concrete descriptors
 * extend this with their `type` discriminator and per-type fields.
 */
export interface BaseMeshSourceDescriptor {
  /** Stable id from the catalog (e.g. "kenney-tree-01"). Used for cache key. */
  id: string;
  /** Optional cache adapter. If omitted, every load fetches the network. */
  cache?: MeshSourceCache;
}

/**
 * Descriptor for loading a plain GLB asset whose visual treatment is the
 * cyan holographic media-art shader. Used by simple object/food/vehicle
 * categories where the asset is just a shape.
 *
 * v0.13.0 (2026-04-21, media-art-production-catalog HR5) — every gltf asset
 * now renders against a core-bundled neutral environment texture + 3-point
 * light rig by default, so plain GLBs inherit Earth/Dog-grade quality without
 * per-asset HDRI authoring. Both are optional overrides via the fields below.
 */
export interface GltfMeshSourceDescriptor extends BaseMeshSourceDescriptor {
  type: 'gltf';
  /** Public URL resolving to the GLB binary. */
  url: string;
  /**
   * Image-based lighting intensity multiplier applied to the bundled neutral
   * environment (scene.environmentIntensity). Default 0.6 — shared with the
   * gltf-pbr variant via DEFAULT_ENVIRONMENT_INTENSITY.
   */
  environmentIntensity?: number;
  /**
   * Optional override of the 3-point light rig intensities. Omitted keys fall
   * back to DEFAULT_LIGHT_RIG_INTENSITY (key 1.6, fill 0.4, ambient 0.2).
   */
  lightRigIntensity?: {
    key?: number;
    fill?: number;
    ambient?: number;
  };
}

/**
 * Descriptor for loading a GLB asset together with an HDR environment map.
 * The HDRI drives image-based lighting (scene.environment); each Mesh's
 * native PBR maps (`.map` / `.normalMap` / `.roughnessMap`) feed the textured
 * cyan holographic treatment so surface detail bleeds through into the
 * holographic look. Used for higher-fidelity categories (animals, hero
 * objects) where the asset is meant to read as a richly-detailed subject
 * inside a holographic scene.
 *
 * Pattern derived from .media-art-staging/DogPBRPreview.tsx.ref —
 * RGBELoader-loaded HDR + textured-luminance cyan tint + fresnel rim.
 */
export interface GltfPbrMeshSourceDescriptor extends BaseMeshSourceDescriptor {
  type: 'gltf-pbr';
  /** Public URL resolving to the GLB binary. */
  url: string;
  /** Public URL resolving to the .hdr environment map (RGBE). */
  hdriUrl: string;
  /**
   * Image-based lighting intensity multiplier (scene.environmentIntensity).
   * Default 0.6 (matches DogPBRPreview canonical).
   */
  environmentIntensity?: number;
}

/**
 * Descriptor for the procedural planet pattern: three layered spheres
 * (body / clouds / atmosphere) driven by NASA-Public-Domain texture maps
 * with a TSL-authored cyan-tinted Sobel-coastline shader. The visual
 * signature matches glymo-landing/components/preview/EarthPreview.tsx
 * (the canonical media-art quality bar from 2026-04-20).
 *
 * Used by the `space` category (Earth, future planets). Body texture
 * encodes daylight reflectance (used for Sobel edge detection to surface
 * coastlines as glow); clouds is single-channel atmosphere mask; normal
 * supplies surface relief.
 */
export interface ProceduralPlanetMeshSourceDescriptor extends BaseMeshSourceDescriptor {
  type: 'procedural-planet';
  /** Public texture URLs — daymap + clouds + normal map. */
  textures: {
    daymap: string;
    clouds: string;
    normal: string;
  };
  /**
   * Texture atlas pixel dimensions — required for the Sobel coastline
   * neighbour-pixel offset (1/W, 1/H). All three textures must share these
   * dimensions; the source does not rescale.
   */
  textureSize: {
    width: number;
    height: number;
  };
  /** Axial tilt in degrees applied to the body group. Earth: 23.4°. */
  axialTiltDeg?: number;
  /**
   * Per-frame rotation rates in radians per second.
   *   body — body sphere y-rotation (Earth: 0.10)
   *   clouds — cloud shell y-rotation (Earth: 0.13)
   * Defaults match Earth.
   */
  rotationRate?: {
    body?: number;
    clouds?: number;
  };
  /**
   * Override the atmosphere BackSide shell colour. Default 0x00ccff (cyan,
   * matches Earth). Set a warm hex (e.g. 0xffaa55 for Sun corona, 0xff5522
   * for Mars dust) to re-tone the planet without forking the shader.
   */
  atmosphereColorHex?: number;
}

/**
 * Union of all descriptors accepted by setModel(). The factory
 * createMeshSource(descriptor) dispatches on `type`; adding a new variant
 * forces the switch to be updated (exhaustiveness check).
 */
export type MeshSourceDescriptor =
  | GltfMeshSourceDescriptor
  | GltfPbrMeshSourceDescriptor
  | ProceduralPlanetMeshSourceDescriptor;

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
  /**
   * Optional uniform driven by the renderer with elapsed seconds since
   * startup. Sources that author their own TSL nodes (procedural planet,
   * holographic GLB) attach this so per-frame shader animation works without
   * additional plumbing.
   */
  uTime?: { value: number };
  /**
   * Optional uniform driven by the renderer with the 0..1 transition value
   * (mesh-mode entry/exit easing).
   */
  uTransition?: { value: number };
  /**
   * Optional per-frame update hook. Called after the mixer advance and uniform
   * writes, with elapsed wall-clock seconds and frame delta seconds. Sources
   * that need to drive group transforms (e.g. procedural planet axial spin)
   * or other non-uniform state attach this — there is no need to fork the
   * renderer's frame loop.
   */
  update?(elapsed: number, dt: number): void;
  /**
   * Optional scene-level attach hook. Called once by the renderer after the
   * group is added to its scene. Returns an optional cleanup function that
   * fires when the state is disposed (alongside `dispose()`).
   *
   * Use this for scene-graph properties the source can't reach through its
   * own group — chiefly `scene.environment` for HDR-driven image-based
   * lighting and scene-level fog. Sources that don't need it omit the hook.
   */
  attachToScene?(scene: unknown): (() => void) | void;
}

/**
 * Optional per-load context passed alongside the THREE/tsl deps. Carries
 * cross-cutting concerns (progress reporting today; cancellation tokens or
 * priority hints in the future) that subclasses opt into individually.
 *
 * `onProgress` receives a fraction in `[0, 1]` covering the entire load —
 * single-fetch sources pass the network ratio directly; multi-fetch sources
 * (GLB + HDR, three textures) compose weighted fractions per asset and emit
 * a final `1.0` once the parse + scene assembly completes.
 *
 * `onCacheHit` fires once when EVERY underlying network asset for the load
 * resolved from cache (no bytes hit the wire). Multi-fetch sources internally
 * aggregate per-slot signals and emit the single rollup. The callback is the
 * orchestrator's signal to suppress its loading-chip flash on warm reloads —
 * see MediaArtOrchestrator.tsx for the canonical wiring.
 */
export interface MeshSourceLoadContext {
  /**
   * Optional progress consumer. Fires monotonically in `[0, 1]`. Callbacks
   * thrown inside are swallowed by the source pack — a misbehaving consumer
   * must not abort the load.
   */
  onProgress?: (progress: number) => void;
  /**
   * Optional cache-hit signal. Fires AT MOST ONCE per load, only when every
   * underlying fetch resolved from cache. Synchronous; thrown errors are
   * swallowed (same contract as onProgress). Multi-fetch sources only fire
   * when the FULL set of assets was a cache hit — a single network miss
   * suppresses the signal even if the others were warm.
   */
  onCacheHit?: () => void;
}

/**
 * Mesh source contract. Implementations are constructed via the
 * createMeshSource factory and produce a MediaArtMeshState via load(). The
 * renderer never instantiates implementations directly — it dispatches on
 * descriptor.type through the factory.
 */
export interface MeshSource {
  /** Stable id used for dedup/idempotency (matches descriptor.id). */
  readonly id: string;
  /**
   * Load the mesh. Resolves with state ready to add to the scene; rejects
   * with a GlymoError on fetch/parse/validation failure. May take seconds
   * for large assets — callers should show loading UI.
   *
   * The THREE/tsl modules are passed in (not imported by the source) so the
   * renderer's lazy-import semantics are preserved and the source file stays
   * tree-shakeable.
   *
   * `ctx` is optional and back-compatible: callers that omit it get the
   * historical behaviour. Sources that opt into progress reporting forward
   * `ctx.onProgress` through {@link MeshSourceLoadContext}.
   */
  load(
    deps: {
      THREE: typeof import('three/webgpu');
      tsl: typeof import('three/tsl');
    },
    ctx?: MeshSourceLoadContext,
  ): Promise<MediaArtMeshState>;
}
