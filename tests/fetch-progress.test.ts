// Tests for `fetchArrayBufferWithCache` progress callback (PerfPath-1).
//
// The progress callback is the foundation of the apply-time UI chip — every
// concrete MeshSource composes per-fetch byte ratios into a weighted [0..1]
// fraction and the renderer surfaces it via `MeshSourceLoadContext.onProgress`.
// This file pins the callback semantics at the lowest layer of the stack so
// the per-source weighting tests (gltf/glb-pbr/procedural-planet) can rely on
// the contract documented in `common.ts` (`FetchProgressCallback` JSDoc).
//
// Branches under test:
//   - Streaming branch fires once per chunk with running byte counts.
//   - `Content-Length` header populates `total`; absent header passes `null`.
//   - Cache hit short-circuits the streaming branch but still fires once with
//     loaded === total === byteLength so consumers see 0 → 100 cleanly.
//   - Consumer throws inside the callback do NOT abort the fetch.
//   - When `onProgress` is omitted entirely the legacy non-streaming branch is
//     used (no `getReader` calls) and the function returns the buffer as-is.

import { describe, it, expect, vi } from 'vitest';
import {
  fetchArrayBufferWithCache,
  type FetchLike,
} from '../src/hologram/sources/common.js';
import type { MeshSourceCache } from '../src/hologram/types.js';

/**
 * Build a `Response` whose body streams the supplied chunks via a
 * ReadableStream. Optionally sets the `Content-Length` header so the
 * `total` argument of the progress callback can be inspected.
 */
function makeStreamingResponse(
  chunks: Uint8Array[],
  opts: { contentLength?: number | null } = {},
): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const headers: Record<string, string> = {};
  if (opts.contentLength !== undefined && opts.contentLength !== null) {
    headers['Content-Length'] = String(opts.contentLength);
  }
  return new Response(body, { status: 200, headers });
}

const fakeFetcherFor =
  (response: Response): FetchLike =>
  () =>
    Promise.resolve(response);

describe('fetchArrayBufferWithCache — onProgress callback', () => {
  it('streams two chunks and reports running byte counts with Content-Length', async () => {
    const chunkA = new Uint8Array(50).fill(0xaa);
    const chunkB = new Uint8Array(50).fill(0xbb);
    const response = makeStreamingResponse([chunkA, chunkB], {
      contentLength: 100,
    });
    const onProgress = vi.fn();
    const buffer = await fetchArrayBufferWithCache({
      cacheKey: 'k',
      url: 'https://cdn.test/a.glb',
      fetcher: fakeFetcherFor(response),
      errorCode: 'media-art/fetch-failed',
      assetLabel: 'a',
      onProgress,
    });
    expect(buffer.byteLength).toBe(100);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 50, 100);
    expect(onProgress).toHaveBeenNthCalledWith(2, 100, 100);
  });

  it('passes null total when Content-Length is absent', async () => {
    const chunk = new Uint8Array(32).fill(0xcc);
    const response = makeStreamingResponse([chunk]);
    const onProgress = vi.fn();
    await fetchArrayBufferWithCache({
      cacheKey: 'k2',
      url: 'https://cdn.test/b.glb',
      fetcher: fakeFetcherFor(response),
      errorCode: 'media-art/fetch-failed',
      assetLabel: 'b',
      onProgress,
    });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(32, null);
  });

  it('cache hit fires the callback exactly once with loaded === total === byteLength', async () => {
    const cached = new ArrayBuffer(64);
    const cache: MeshSourceCache = {
      get: vi.fn(async () => cached),
      set: vi.fn(),
    };
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    const onProgress = vi.fn();
    const buffer = await fetchArrayBufferWithCache({
      cacheKey: 'cached',
      url: 'https://cdn.test/c.glb',
      cache,
      fetcher,
      errorCode: 'media-art/fetch-failed',
      assetLabel: 'cached',
      onProgress,
    });
    expect(buffer).toBe(cached);
    expect(fetcher).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(64, 64);
  });

  it('consumer throws inside the callback do NOT abort the fetch', async () => {
    const chunkA = new Uint8Array(10);
    const chunkB = new Uint8Array(10);
    const response = makeStreamingResponse([chunkA, chunkB], {
      contentLength: 20,
    });
    const onProgress = vi.fn(() => {
      throw new Error('consumer blew up');
    });
    const buffer = await fetchArrayBufferWithCache({
      cacheKey: 'k3',
      url: 'https://cdn.test/d.glb',
      fetcher: fakeFetcherFor(response),
      errorCode: 'media-art/fetch-failed',
      assetLabel: 'd',
      onProgress,
    });
    expect(buffer.byteLength).toBe(20);
    // Both chunks were streamed; both callbacks were attempted (and threw).
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it('cache hit with onCacheHit supplied fires onCacheHit and SKIPS the synthetic onProgress(100%)', async () => {
    // 2026-04-20: orchestrator's chip-flash-on-warm-reload fix relies on
    // this contract — when the consumer takes responsibility for cache-hit
    // UX (delayed seed timer, etc.) we must NOT also fire the synthetic
    // 100% tick or the chip resets to 100% mid-cancel.
    const cached = new ArrayBuffer(64);
    const cache: MeshSourceCache = {
      get: vi.fn(async () => cached),
      set: vi.fn(),
    };
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    const onProgress = vi.fn();
    const onCacheHit = vi.fn();
    const buffer = await fetchArrayBufferWithCache({
      cacheKey: 'cached-hit',
      url: 'https://cdn.test/cached-hit.glb',
      cache,
      fetcher,
      errorCode: 'media-art/fetch-failed',
      assetLabel: 'cached-hit',
      onProgress,
      onCacheHit,
    });
    expect(buffer).toBe(cached);
    expect(fetcher).not.toHaveBeenCalled();
    expect(onCacheHit).toHaveBeenCalledTimes(1);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('cache MISS with onCacheHit supplied does NOT fire onCacheHit (network was hit)', async () => {
    const chunk = new Uint8Array(20).fill(0xee);
    const response = makeStreamingResponse([chunk], { contentLength: 20 });
    const cache: MeshSourceCache = {
      get: vi.fn(async () => null),
      set: vi.fn(),
    };
    const onCacheHit = vi.fn();
    await fetchArrayBufferWithCache({
      cacheKey: 'cold',
      url: 'https://cdn.test/cold.glb',
      cache,
      fetcher: fakeFetcherFor(response),
      errorCode: 'media-art/fetch-failed',
      assetLabel: 'cold',
      onCacheHit,
    });
    expect(onCacheHit).not.toHaveBeenCalled();
  });

  it('onCacheHit consumer throws are swallowed (same contract as onProgress)', async () => {
    const cached = new ArrayBuffer(8);
    const cache: MeshSourceCache = {
      get: vi.fn(async () => cached),
      set: vi.fn(),
    };
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    const onCacheHit = vi.fn(() => {
      throw new Error('consumer blew up in onCacheHit');
    });
    const buffer = await fetchArrayBufferWithCache({
      cacheKey: 'cached-throws',
      url: 'https://cdn.test/cached-throws.glb',
      cache,
      fetcher,
      errorCode: 'media-art/fetch-failed',
      assetLabel: 'cached-throws',
      onCacheHit,
    });
    expect(buffer).toBe(cached);
    expect(onCacheHit).toHaveBeenCalledTimes(1);
  });

  it('without onProgress the legacy arrayBuffer() branch is used', async () => {
    const chunk = new Uint8Array(8);
    const response = makeStreamingResponse([chunk], { contentLength: 8 });
    // Spy on the body's getReader — it must NOT be invoked when no callback
    // is supplied (the legacy branch must use response.arrayBuffer()).
    const bodyGetReader = vi.fn(() => response.body!.getReader());
    Object.defineProperty(response, 'body', {
      configurable: true,
      get: () => ({
        getReader: bodyGetReader,
      }),
    });
    const buffer = await fetchArrayBufferWithCache({
      cacheKey: 'k4',
      url: 'https://cdn.test/e.glb',
      fetcher: fakeFetcherFor(response),
      errorCode: 'media-art/fetch-failed',
      assetLabel: 'e',
    });
    expect(bodyGetReader).not.toHaveBeenCalled();
    expect(buffer.byteLength).toBe(8);
  });
});
