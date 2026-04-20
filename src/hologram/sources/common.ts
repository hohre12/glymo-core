// ── Mesh Source Common Utilities ──────────────────────────────────────────────
//
// Shared building blocks for every concrete MeshSource implementation. Lives
// at the source-pack root so each source file stays narrowly focused on its
// domain logic (GLB parsing, HDR environment setup, procedural sphere build).
//
// Public surface (intentionally tiny — every helper is one job):
//   - FetchLike — pluggable network adapter
//   - createGlymoFetcher — default fetcher with GlymoError wrapping
//   - fetchArrayBufferWithCache — cache lookup + network fallback
//   - computeBboxFromObject — scene-graph bbox extraction
//   - disposeObject3DTree — recursive dispose helper
//   - assertDescriptorType — runtime guard with consistent error code
//
// THREE is passed in (not imported) so this file stays out of the initial
// bundle for non-mesh-mode renderers.

import { GlymoError } from '../../types.js';
import type { MediaArtMeshState, MeshSourceCache } from '../types.js';

/** Pluggable fetcher signature so tests can stub the network layer. */
export type FetchLike = (url: string) => Promise<Response>;

/** Default fetcher — bare `fetch` with no extra behaviour. */
export function defaultFetcher(): FetchLike {
  return (url) => fetch(url);
}

/**
 * Fetch a remote URL as ArrayBuffer with optional cache short-circuit.
 *
 * - Cache hit: returns the cached buffer untouched.
 * - Cache miss: fetches, persists on success, returns the buffer.
 * - Cache write failure is non-fatal (logged via swallow — caller still gets
 *   the buffer it asked for).
 *
 * Errors are wrapped in GlymoError with a stable `code` so the picker / UI
 * layer can dispatch on the failure mode.
 */
export async function fetchArrayBufferWithCache(opts: {
  cacheKey: string;
  url: string;
  cache?: MeshSourceCache;
  fetcher: FetchLike;
  /** Stable error code under the `media-art/` namespace. */
  errorCode: string;
  /** Human-readable id for error messages (typically descriptor.id). */
  assetLabel: string;
}): Promise<ArrayBuffer> {
  const { cacheKey, url, cache, fetcher, errorCode, assetLabel } = opts;

  if (cache) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    } catch {
      // Cache read failure is non-fatal — fall through to network.
    }
  }

  let response: Response;
  try {
    response = await fetcher(url);
  } catch (err) {
    throw new GlymoError(
      errorCode,
      `Network error fetching ${assetLabel} from ${url}`,
      { recoverable: true, originalError: err as Error },
    );
  }

  if (!response.ok) {
    throw new GlymoError(
      errorCode,
      `HTTP ${response.status} fetching ${assetLabel} from ${url}`,
      { recoverable: true },
    );
  }

  const buffer = await response.arrayBuffer();

  if (cache) {
    try {
      await cache.set(cacheKey, buffer);
    } catch {
      // Cache write failure is non-fatal — the asset still loads.
    }
  }

  return buffer;
}

/**
 * Compute a MediaArtMeshState bbox from a Three.js Object3D scene root.
 * Captures the geometry-true bounds BEFORE any DoubleSide material swap that
 * would inflate the box.
 */
export function computeBboxFromObject(
  THREE: typeof import('three/webgpu'),
  root: unknown,
): MediaArtMeshState['bbox'] {
  const box = new THREE.Box3().setFromObject(
    root as InstanceType<typeof import('three/webgpu').Object3D>,
  );
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}

/**
 * Dispose every geometry, material, and material-attached texture under an
 * Object3D tree. Used by GltfMeshSource and friends so each implementation
 * does not re-write the traversal.
 *
 * Materials passed via `extraMaterials` are disposed defensively after the
 * traversal — useful when a source attaches materials it created but the
 * scene graph never references (paranoid path).
 */
export function disposeObject3DTree(
  root: unknown,
  extras: { extraMaterials?: unknown[]; extraTextures?: unknown[] } = {},
): void {
  (root as { traverse: (cb: (obj: unknown) => void) => void }).traverse((obj) => {
    const geometry = (obj as { geometry?: { dispose?: () => void } }).geometry;
    if (geometry?.dispose) geometry.dispose();
    const material = (obj as { material?: unknown }).material;
    if (material) {
      const list = Array.isArray(material) ? material : [material];
      for (const m of list) {
        const dispMat = m as {
          dispose?: () => void;
          map?: { dispose?: () => void };
          normalMap?: { dispose?: () => void };
          emissiveMap?: { dispose?: () => void };
        };
        if (dispMat.map?.dispose) dispMat.map.dispose();
        if (dispMat.normalMap?.dispose) dispMat.normalMap.dispose();
        if (dispMat.emissiveMap?.dispose) dispMat.emissiveMap.dispose();
        if (dispMat.dispose) dispMat.dispose();
      }
    }
  });

  if (extras.extraMaterials) {
    for (const m of extras.extraMaterials) {
      const dispMat = m as { dispose?: () => void };
      if (dispMat.dispose) dispMat.dispose();
    }
  }
  if (extras.extraTextures) {
    for (const t of extras.extraTextures) {
      const dispTex = t as { dispose?: () => void };
      if (dispTex.dispose) dispTex.dispose();
    }
  }
}

/**
 * Runtime guard — every concrete MeshSource calls this in its constructor to
 * ensure the descriptor it was handed actually matches its `type`. Centralising
 * the error format keeps the GlymoError code consistent across sources.
 */
export function assertDescriptorType<T extends string>(
  descriptor: { type: string },
  expected: T,
  className: string,
): asserts descriptor is { type: T } {
  if (descriptor.type !== expected) {
    throw new GlymoError(
      'media-art/invalid-descriptor',
      `${className} expected descriptor.type="${expected}", got "${descriptor.type}"`,
      { recoverable: false },
    );
  }
}

/**
 * Runtime guard — assert a required descriptor field is non-empty. Used by
 * sources for `id`, `url`, `hdriUrl`, etc.
 */
export function assertDescriptorField(
  value: unknown,
  fieldName: string,
  className: string,
): asserts value is string {
  if (!value || typeof value !== 'string') {
    throw new GlymoError(
      'media-art/invalid-descriptor',
      `${className} requires descriptor.${fieldName}`,
      { recoverable: false },
    );
  }
}
