// ── Base Mesh Source ──────────────────────────────────────────────────────────
//
// Abstract foundation for every concrete MeshSource. Owns the cross-cutting
// concerns (id validation, cache wiring, default fetcher) so each subclass
// stays focused on its domain (GLB parsing, HDR loading, sphere construction).
//
// Subclasses must:
//   1. Pass the descriptor to super()
//   2. Implement load(deps) — fetch + parse + assemble MediaArtMeshState
//   3. Use the protected helpers (fetchBuffer, makeDispose, etc.) instead of
//      forking their own copies
//
// THREE / tsl are NEVER imported here — kept in load(deps) signatures so the
// abstract base file stays out of the initial bundle.

import type {
  BaseMeshSourceDescriptor,
  MediaArtMeshState,
  MeshSource,
  MeshSourceCache,
  MeshSourceLoadContext,
} from '../types.js';
import {
  type FetchLike,
  type FetchProgressCallback,
  defaultFetcher,
  fetchArrayBufferWithCache,
  assertDescriptorField,
} from './common.js';

export interface BaseMeshSourceOptions {
  /** Override the default fetcher — primarily for tests. */
  fetcher?: FetchLike;
}

/**
 * Abstract MeshSource base. Subclasses inherit cache + fetcher plumbing and
 * must implement load(deps).
 *
 * The base intentionally does not own materials, geometries, or any
 * Three.js objects — those are subclass-specific. It just provides a
 * consistent shell for the cross-cutting concerns.
 */
export abstract class BaseMeshSource implements MeshSource {
  readonly id: string;
  protected readonly cache?: MeshSourceCache;
  protected readonly fetcher: FetchLike;

  constructor(descriptor: BaseMeshSourceDescriptor, options: BaseMeshSourceOptions = {}) {
    assertDescriptorField(descriptor.id, 'id', this.constructor.name);
    this.id = descriptor.id;
    if (descriptor.cache) this.cache = descriptor.cache;
    this.fetcher = options.fetcher ?? defaultFetcher();
  }

  abstract load(
    deps: {
      THREE: typeof import('three/webgpu');
      tsl: typeof import('three/tsl');
    },
    ctx?: MeshSourceLoadContext,
  ): Promise<MediaArtMeshState>;

  /**
   * Fetch a remote URL as ArrayBuffer using the configured cache + fetcher.
   * Wraps errors in GlymoError with the supplied code so the picker can
   * dispatch on failure mode.
   *
   * `cacheKey` defaults to `${this.id}:${url}` so a multi-asset source (planet
   * with three textures) gets distinct cache slots without subclass effort.
   *
   * `onProgress` is forwarded into the underlying streaming fetch so subclasses
   * implementing multi-fetch loads (GLB + HDR, three textures) can compose
   * weighted progress fractions on top of per-fetch byte progress without
   * duplicating the cache short-circuit semantics.
   *
   * `onCacheHit` is the per-fetch cache-hit signal (fires synchronously when
   * the buffer was served from the cache). Multi-fetch subclasses aggregate
   * per-slot signals into the single rollup callback exposed via
   * `MeshSourceLoadContext.onCacheHit`.
   */
  protected fetchBuffer(opts: {
    url: string;
    errorCode: string;
    cacheKeySuffix?: string;
    onProgress?: FetchProgressCallback;
    onCacheHit?: () => void;
  }): Promise<ArrayBuffer> {
    const cacheKey = opts.cacheKeySuffix
      ? `${this.id}:${opts.cacheKeySuffix}`
      : this.id;
    return fetchArrayBufferWithCache({
      cacheKey,
      url: opts.url,
      cache: this.cache,
      fetcher: this.fetcher,
      errorCode: opts.errorCode,
      assetLabel: this.id,
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
      ...(opts.onCacheHit ? { onCacheHit: opts.onCacheHit } : {}),
    });
  }
}
