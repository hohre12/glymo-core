// Tests for GltfMeshSource fetch + cache + error paths (P3 / D5).
//
// We avoid the real Three.js graph here — the source's network + cache logic
// is testable in isolation by stubbing the GLTFLoader.parse result. The
// renderer-level mode-switch + dispose semantics live in
// tests/hologram-mesh-mode.test.ts.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GltfMeshSource } from '../src/hologram/sources/GltfMeshSource.js';
import { GlymoError } from '../src/types.js';
import type { MeshSourceCache } from '../src/hologram/types.js';

// ── Minimal stubs so the source's load() exercises real cache + fetch
//    branches without instantiating WebGPU. The shader-treatment helper
//    iterates the scene graph; we feed it an empty traverse so it is a no-op.

const stubScene = {
  traverse: (_cb: (obj: unknown) => void): void => {
    // Empty scene — applyMediaArtShaderTreatment finds no meshes and
    // produces zero materials. Sufficient for non-rendering tests.
  },
};

const stubBox3 = class {
  min = { x: 0, y: 0, z: 0 };
  max = { x: 1, y: 1, z: 1 };
  setFromObject(_obj: unknown): this { return this; }
};

const stubGltf = { scene: stubScene, scenes: [stubScene], animations: [] };

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    // KTX2/Draco extension wires registered by GltfMeshSource.parseGlb. The
    // real GLTFLoader exposes both as fluent setters; the stubs are no-ops so
    // the registration path runs cleanly without polluting stderr with
    // "loader.setKTX2Loader is not a function" warnings during the test
    // suite. Production code path is identical — the warn-and-continue
    // try/catch around the real registration would still shield us if a
    // future three release dropped the setter.
    setKTX2Loader(_l: unknown): this { return this; }
    setDRACOLoader(_l: unknown): this { return this; }
    parse(
      _buffer: ArrayBuffer,
      _path: string,
      onLoad: (gltf: unknown) => void,
      _onError: unknown,
    ): void {
      onLoad(stubGltf);
    }
  },
}));
// KTX2Loader / DRACOLoader are dynamically imported by `loaders.ts` on first
// use — stub them so the imports resolve in the jsdom test environment.
vi.mock('three/examples/jsm/loaders/KTX2Loader.js', () => ({
  KTX2Loader: class {
    setTranscoderPath(_p: string): this { return this; }
  },
}));
vi.mock('three/examples/jsm/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class {
    setDecoderPath(_p: string): this { return this; }
  },
}));

const fakeDeps = {
  THREE: {
    Mesh: class { material?: unknown },
    Box3: stubBox3,
    AnimationMixer: class { clipAction(_c: unknown): { play: () => void } { return { play: () => {} }; } },
    DoubleSide: 2,
    MeshStandardNodeMaterial: class { transparent = false; depthWrite = true; side = 0; dispose(): void {} },
    Color: class {
      r: number; g: number; b: number;
      constructor(hex: number) {
        this.r = ((hex >> 16) & 0xff) / 255;
        this.g = ((hex >> 8) & 0xff) / 255;
        this.b = (hex & 0xff) / 255;
      }
    },
  } as unknown as Parameters<GltfMeshSource['load']>[0]['THREE'],
  tsl: {
    Fn: (cb: () => unknown) => cb,
    float: (v: number) => v,
    vec3: (..._args: unknown[]) => ({}),
    uniform: (initial: number) => ({ value: initial }),
    color: (_c: unknown) => ({}),
    mix: (_a: unknown, _b: unknown, _t: unknown) => ({}),
    positionWorld: { y: { mul: (_n: number) => ({ sub: (_x: unknown) => ({ mul: (_n2: number) => ({ add: (_a: number) => ({}) }) }) }) } },
    normalWorld: {},
    cameraPosition: { sub: (_p: unknown) => ({ normalize: () => ({}) }) },
    sin: (_v: unknown) => ({ mul: (_n: number) => ({ add: (_a: unknown) => ({ sub: (_x: unknown) => ({}) }) }) }),
    smoothstep: (..._args: unknown[]) => ({ mul: (_n: number) => ({}) }),
    abs: (_v: unknown) => ({}),
    dot: (..._args: unknown[]) => ({}),
    pow: (..._args: unknown[]) => ({}),
    clamp: (..._args: unknown[]) => ({}),
  } as unknown as Parameters<GltfMeshSource['load']>[0]['tsl'],
};

describe('GltfMeshSource', () => {
  describe('descriptor validation', () => {
    it('rejects non-gltf descriptor types', () => {
      expect(
        () => new GltfMeshSource({ type: 'unknown' as 'gltf', id: 'x', url: 'y' }),
      ).toThrow(GlymoError);
    });

    it('rejects missing id', () => {
      expect(
        () => new GltfMeshSource({ type: 'gltf', id: '', url: 'y' }),
      ).toThrow(/requires descriptor.id/);
    });

    it('rejects missing url', () => {
      expect(
        () => new GltfMeshSource({ type: 'gltf', id: 'x', url: '' }),
      ).toThrow(/requires descriptor.url/);
    });
  });

  describe('fetch behaviour', () => {
    it('fetches the URL when no cache is supplied', async () => {
      const fetcher = vi.fn(async (_url: string) =>
        new Response(new ArrayBuffer(8), { status: 200 }),
      );
      const src = new GltfMeshSource(
        { type: 'gltf', id: 'a', url: 'https://cdn.test/a.glb' },
        { fetcher },
      );
      const state = await src.load(fakeDeps);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith('https://cdn.test/a.glb');
      expect(state.id).toBe('a');
      expect(state.bbox).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } });
    });

    it('surfaces network errors as recoverable GlymoError', async () => {
      const fetcher = vi.fn(async () => {
        throw new Error('offline');
      });
      const src = new GltfMeshSource(
        { type: 'gltf', id: 'a', url: 'https://cdn.test/a.glb' },
        { fetcher },
      );
      await expect(src.load(fakeDeps)).rejects.toMatchObject({
        code: 'media-art/fetch-failed',
        recoverable: true,
      });
    });

    it('surfaces non-OK HTTP status as GlymoError', async () => {
      const fetcher = vi.fn(async () => new Response(null, { status: 404 }));
      const src = new GltfMeshSource(
        { type: 'gltf', id: 'a', url: 'https://cdn.test/missing.glb' },
        { fetcher },
      );
      await expect(src.load(fakeDeps)).rejects.toMatchObject({
        code: 'media-art/fetch-failed',
      });
    });
  });

  describe('cache behaviour', () => {
    let cacheStore: Map<string, ArrayBuffer>;
    let cache: MeshSourceCache;
    let cacheGetSpy: ReturnType<typeof vi.fn>;
    let cacheSetSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      cacheStore = new Map();
      cacheGetSpy = vi.fn(async (key: string) => cacheStore.get(key) ?? null);
      cacheSetSpy = vi.fn(async (key: string, value: ArrayBuffer) => {
        cacheStore.set(key, value);
      });
      cache = { get: cacheGetSpy, set: cacheSetSpy };
    });

    it('writes to cache after a fresh fetch', async () => {
      const fetcher = vi.fn(async () =>
        new Response(new ArrayBuffer(16), { status: 200 }),
      );
      const src = new GltfMeshSource(
        { type: 'gltf', id: 'cached', url: 'https://cdn.test/c.glb', cache },
        { fetcher },
      );
      await src.load(fakeDeps);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cacheSetSpy).toHaveBeenCalledTimes(1);
      expect(cacheSetSpy).toHaveBeenCalledWith('cached', expect.any(ArrayBuffer));
      expect(cacheStore.get('cached')).toBeInstanceOf(ArrayBuffer);
    });

    it('cache hit skips network fetch', async () => {
      cacheStore.set('cached', new ArrayBuffer(16));
      const fetcher = vi.fn(async () =>
        new Response(new ArrayBuffer(16), { status: 200 }),
      );
      const src = new GltfMeshSource(
        { type: 'gltf', id: 'cached', url: 'https://cdn.test/c.glb', cache },
        { fetcher },
      );
      await src.load(fakeDeps);
      expect(cacheGetSpy).toHaveBeenCalledTimes(1);
      expect(fetcher).not.toHaveBeenCalled();
      expect(cacheSetSpy).not.toHaveBeenCalled();
    });

    it('cache read failure falls back to network', async () => {
      cache.get = vi.fn(async () => {
        throw new Error('IDB closed');
      });
      const fetcher = vi.fn(async () =>
        new Response(new ArrayBuffer(8), { status: 200 }),
      );
      const src = new GltfMeshSource(
        { type: 'gltf', id: 'cached', url: 'https://cdn.test/c.glb', cache },
        { fetcher },
      );
      const state = await src.load(fakeDeps);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(state.id).toBe('cached');
    });

    it('cache write failure is non-fatal', async () => {
      cache.set = vi.fn(async () => {
        throw new Error('quota exceeded');
      });
      const fetcher = vi.fn(async () =>
        new Response(new ArrayBuffer(8), { status: 200 }),
      );
      const src = new GltfMeshSource(
        { type: 'gltf', id: 'cached', url: 'https://cdn.test/c.glb', cache },
        { fetcher },
      );
      const state = await src.load(fakeDeps);
      expect(state.id).toBe('cached');
    });
  });

  describe('disposal', () => {
    it('dispose() is callable on returned state', async () => {
      const fetcher = vi.fn(async () =>
        new Response(new ArrayBuffer(8), { status: 200 }),
      );
      const src = new GltfMeshSource(
        { type: 'gltf', id: 'a', url: 'https://cdn.test/a.glb' },
        { fetcher },
      );
      const state = await src.load(fakeDeps);
      expect(() => state.dispose()).not.toThrow();
    });
  });
});
