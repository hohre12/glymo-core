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
 * Per-fetch progress callback.
 *
 * Fires monotonically as bytes arrive on the wire. `loaded` is the running
 * byte count; `total` is the Content-Length when the server sent one and
 * `null` otherwise (chunked-transfer responses, opaque CORS, etc.). Consumers
 * that want to render a percentage should clamp at ~95% when `total === null`
 * so the bar does not appear to lie about completion before the stream
 * actually finishes assembling.
 *
 * Cache hits invoke the callback exactly once with `loaded === total ===
 * buffer.byteLength` so consumers see a clean 0 → 100% transition rather than
 * a stuck 0% (since the cache short-circuit skips the streaming branch
 * entirely).
 *
 * Throws inside the callback are swallowed — a misbehaving consumer must not
 * abort the network fetch.
 */
export type FetchProgressCallback = (loaded: number, total: number | null) => void;

/**
 * Fetch a remote URL as ArrayBuffer with optional cache short-circuit.
 *
 * - Cache hit: returns the cached buffer untouched. If `onCacheHit` is
 *   supplied, that fires (no synthetic progress tick); otherwise falls
 *   back to firing `onProgress` once at 100% so legacy consumers without
 *   the cache-hit hook still see a clean 0 → done transition. The new
 *   `onCacheHit` channel exists so hosts can suppress a momentary
 *   loading-chip flash on cache hits — see
 *   `MediaArtOrchestrator.tsx` for the canonical wiring.
 * - Cache miss: fetches, persists on success, returns the buffer.
 * - Cache write failure is non-fatal (logged via swallow — caller still gets
 *   the buffer it asked for).
 * - When `onProgress` is supplied AND `response.body` is a streamable
 *   ReadableStream, the function reads chunks via the reader and fires the
 *   callback per chunk. Otherwise it falls back to `response.arrayBuffer()`
 *   (no progress events) so non-streaming environments still load correctly.
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
  /** Optional per-chunk progress callback. See {@link FetchProgressCallback}. */
  onProgress?: FetchProgressCallback;
  /**
   * Optional cache-hit signal. Fired synchronously the moment the cache
   * lookup succeeds, BEFORE the buffer is returned. When supplied, the
   * function does NOT also fire the synthetic 100% `onProgress` tick — the
   * caller is taking explicit responsibility for cache-hit UX. Throws are
   * swallowed (same contract as the other callbacks).
   */
  onCacheHit?: () => void;
}): Promise<ArrayBuffer> {
  const { cacheKey, url, cache, fetcher, errorCode, assetLabel, onProgress, onCacheHit } = opts;

  if (cache) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        if (onCacheHit) {
          try {
            onCacheHit();
          } catch {
            /* Callback throws are swallowed — see field doc. */
          }
        } else if (onProgress) {
          // Fire a single 100% tick so legacy consumers without onCacheHit
          // still transition cleanly from 0 → done (the cache hit skips the
          // streaming branch where progress would normally land).
          try {
            onProgress(cached.byteLength, cached.byteLength);
          } catch {
            /* Callback throws are swallowed — see FetchProgressCallback docs. */
          }
        }
        return cached;
      }
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

  // Stream the body when both a progress consumer AND a readable body are
  // available. Without either we fall back to the simple arrayBuffer() path
  // so older fetch shims (jsdom, certain workers) still work end-to-end.
  const reader = onProgress ? response.body?.getReader?.() : undefined;
  let buffer: ArrayBuffer;
  if (reader && onProgress) {
    const totalHeader = response.headers.get('Content-Length');
    const total = totalHeader ? Number(totalHeader) : null;
    const totalSafe = Number.isFinite(total) && (total ?? 0) > 0 ? total : null;
    let loaded = 0;
    const chunks: Uint8Array[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        try {
          onProgress(loaded, totalSafe);
        } catch {
          /* Swallow callback throws — see FetchProgressCallback docs. */
        }
      }
    }
    const merged = new Uint8Array(loaded);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.byteLength;
    }
    buffer = merged.buffer;
  } else {
    buffer = await response.arrayBuffer();
  }

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
          roughnessMap?: { dispose?: () => void };
          metalnessMap?: { dispose?: () => void };
          aoMap?: { dispose?: () => void };
          envMap?: { dispose?: () => void };
        };
        // Standard MeshStandardMaterial map slots — every PBR map must be
        // released or its GPU texture leaks for the lifetime of the page.
        if (dispMat.map?.dispose) dispMat.map.dispose();
        if (dispMat.normalMap?.dispose) dispMat.normalMap.dispose();
        if (dispMat.emissiveMap?.dispose) dispMat.emissiveMap.dispose();
        if (dispMat.roughnessMap?.dispose) dispMat.roughnessMap.dispose();
        if (dispMat.metalnessMap?.dispose) dispMat.metalnessMap.dispose();
        if (dispMat.aoMap?.dispose) dispMat.aoMap.dispose();
        if (dispMat.envMap?.dispose) dispMat.envMap.dispose();
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
