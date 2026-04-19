// ── GLTF Mesh Source ──────────────────────────────────────────────────────────
//
// Loads a GLB binary and produces a MediaArtMeshState ready to be added to
// the Hologram3DRenderer scene. Implements the MeshSource interface from
// hologram/types.ts.
//
// Cache contract (per docs/plans/media-art-mvp.md §6.1):
//   - Cache key is descriptor.id (NOT URL) — surviving CDN moves and the
//     glymo-app/public/media-art/<category>/<provider>/<id>.glb scheme.
//   - Cache miss → fetch(url), parse, cache.set(id, ArrayBuffer).
//   - Cache hit → parse the cached buffer directly, skip the network.
//   - Cache adapter is optional. Without it, every load fetches.
//
// Error contract:
//   - Network failures (fetch reject, non-OK status) → GlymoError code
//     'media-art/fetch-failed'.
//   - Parse failures (GLTFLoader rejection) → GlymoError 'media-art/parse-failed'.
//   - Validation failures (no scenes in the GLB) → GlymoError
//     'media-art/empty-gltf'.
//   - All errors are recoverable (caller can fall back to text mode or pick
//     another asset).
//
// The MediaArtMeshState owns disposal — the renderer just calls dispose()
// once and walks away. Inside dispose() we walk the scene graph, disposing
// every geometry, material, and texture we created (the GLTFLoader-attached
// ones get replaced by applyMediaArtShaderTreatment, but skinning meshes can
// keep their own buffers we must release).

import { GlymoError } from '../../types.js';
import type {
  GltfMeshSourceDescriptor,
  MediaArtMeshState,
  MeshSource,
  MeshSourceCache,
} from '../types.js';
import { applyMediaArtShaderTreatment } from '../mediaArtTSL.js';

/** Default fetcher — pluggable so tests can stub the network. */
type FetchLike = (url: string) => Promise<Response>;

export class GltfMeshSource implements MeshSource {
  readonly id: string;
  private readonly url: string;
  private readonly cache?: MeshSourceCache;
  private readonly fetcher: FetchLike;

  constructor(
    descriptor: GltfMeshSourceDescriptor,
    options: { fetcher?: FetchLike } = {},
  ) {
    if (descriptor.type !== 'gltf') {
      throw new GlymoError(
        'media-art/invalid-descriptor',
        `GltfMeshSource expected descriptor.type="gltf", got "${(descriptor as { type: string }).type}"`,
        { recoverable: false },
      );
    }
    if (!descriptor.id) {
      throw new GlymoError(
        'media-art/invalid-descriptor',
        'GltfMeshSource requires descriptor.id',
        { recoverable: false },
      );
    }
    if (!descriptor.url) {
      throw new GlymoError(
        'media-art/invalid-descriptor',
        'GltfMeshSource requires descriptor.url',
        { recoverable: false },
      );
    }
    this.id = descriptor.id;
    this.url = descriptor.url;
    if (descriptor.cache) this.cache = descriptor.cache;
    this.fetcher = options.fetcher ?? ((u) => fetch(u));
  }

  async load(deps: {
    THREE: typeof import('three/webgpu');
    tsl: typeof import('three/tsl');
  }): Promise<MediaArtMeshState> {
    const { THREE } = deps;

    // ── 1. Acquire the GLB binary (cache or network) ──────────────────────
    const buffer = await this.acquireBuffer();

    // ── 2. Parse GLB via GLTFLoader ───────────────────────────────────────
    const gltf = await this.parseGlb(buffer);

    if (!gltf.scene && (!gltf.scenes || gltf.scenes.length === 0)) {
      throw new GlymoError(
        'media-art/empty-gltf',
        `GLB ${this.id} contains no scenes`,
        { recoverable: true },
      );
    }
    const sceneRoot = gltf.scene ?? gltf.scenes[0];

    // ── 3. Compute bbox before swapping materials so we get geometry-true
    //      bounds (the holo material has DoubleSide which would inflate the
    //      bbox if we measured after).
    const box = new THREE.Box3().setFromObject(sceneRoot);
    const bbox = {
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
    };

    // ── 4. Apply the media-art shader treatment to every Mesh ─────────────
    const treatment = applyMediaArtShaderTreatment(sceneRoot, deps);

    // ── 5. Optional animation mixer (bake first available clip on play) ───
    let mixer: unknown = undefined;
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(sceneRoot);
      // Auto-play the first clip — most GLBs ship with idle/breathing as
      // clip[0]. Caller can override later by re-querying the mixer.
      const action = (mixer as { clipAction: (clip: unknown) => { play: () => void } })
        .clipAction(gltf.animations[0]);
      action.play();
    }

    // ── 6. Wire up disposal — close over the resources we own ─────────────
    const dispose = () => {
      // Stop animation mixer first so no draw calls reference disposed buffers.
      if (mixer) {
        (mixer as { stopAllAction: () => void }).stopAllAction();
      }
      sceneRoot.traverse((obj: unknown) => {
        const geometry = (obj as { geometry?: { dispose?: () => void } }).geometry;
        if (geometry?.dispose) geometry.dispose();
        const material = (obj as { material?: unknown }).material;
        if (material) {
          const list = Array.isArray(material) ? material : [material];
          for (const m of list) {
            const dispMat = m as { dispose?: () => void; map?: { dispose?: () => void } };
            if (dispMat.map?.dispose) dispMat.map.dispose();
            if (dispMat.dispose) dispMat.dispose();
          }
        }
      });
      // Defensive: dispose any treatment material the GLB scene graph never
      // ended up referencing (paranoid path — applyMediaArtShaderTreatment
      // attaches every material to a Mesh, so the traverse above usually
      // covers them).
      for (const m of treatment.materials) {
        const dispMat = m as { dispose?: () => void };
        if (dispMat.dispose) dispMat.dispose();
      }
    };

    // Expose the treatment uniforms as plain enumerable properties so the
    // renderer's setModel() can read them via `state.uTime` / `state.uTransition`.
    // Earlier revisions wrapped these in Object.defineProperties + spread to
    // hide them from JSON.stringify, but spread only copies own ENUMERABLE
    // properties — the uniforms were silently dropped, leaving uTransition
    // at its initial 0 and rendering every mesh fully transparent.
    return {
      id: this.id,
      group: sceneRoot,
      ...(mixer ? { mixer } : {}),
      bbox,
      dispose,
      uTime: treatment.uTime,
      uTransition: treatment.uTransition,
    } as MediaArtMeshState & {
      uTime: ReturnType<typeof import('three/tsl').uniform>;
      uTransition: ReturnType<typeof import('three/tsl').uniform>;
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async acquireBuffer(): Promise<ArrayBuffer> {
    if (this.cache) {
      try {
        const cached = await this.cache.get(this.id);
        if (cached) return cached;
      } catch {
        // Cache read failure is non-fatal — proceed to network.
      }
    }

    let response: Response;
    try {
      response = await this.fetcher(this.url);
    } catch (err) {
      throw new GlymoError(
        'media-art/fetch-failed',
        `Network error fetching GLB ${this.id} from ${this.url}`,
        { recoverable: true, originalError: err as Error },
      );
    }

    if (!response.ok) {
      throw new GlymoError(
        'media-art/fetch-failed',
        `HTTP ${response.status} fetching GLB ${this.id} from ${this.url}`,
        { recoverable: true },
      );
    }

    const buffer = await response.arrayBuffer();

    if (this.cache) {
      try {
        await this.cache.set(this.id, buffer);
      } catch {
        // Cache write failure is non-fatal — the mesh still loads.
      }
    }

    return buffer;
  }

  private async parseGlb(buffer: ArrayBuffer): Promise<{
    scene?: { traverse: (cb: (obj: unknown) => void) => void };
    scenes: { traverse: (cb: (obj: unknown) => void) => void }[];
    animations?: unknown[];
  }> {
    // Lazy-load GLTFLoader so it stays out of the initial bundle. Keeping
    // this import inside the method (not at file top) means a renderer that
    // never enters mesh mode never pays the GLTFLoader cost.
    let GLTFLoaderClass: typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;
    try {
      const mod = await import('three/examples/jsm/loaders/GLTFLoader.js');
      GLTFLoaderClass = mod.GLTFLoader;
    } catch (err) {
      throw new GlymoError(
        'media-art/parse-failed',
        `Failed to load GLTFLoader for ${this.id}`,
        { recoverable: false, originalError: err as Error },
      );
    }

    const loader = new GLTFLoaderClass();
    return new Promise((resolve, reject) => {
      try {
        loader.parse(
          buffer,
          '',
          (gltf) =>
            resolve(
              gltf as unknown as {
                scene?: { traverse: (cb: (obj: unknown) => void) => void };
                scenes: { traverse: (cb: (obj: unknown) => void) => void }[];
                animations?: unknown[];
              },
            ),
          (err) =>
            reject(
              new GlymoError(
                'media-art/parse-failed',
                `GLTFLoader rejected ${this.id}`,
                { recoverable: true, originalError: err as Error },
              ),
            ),
        );
      } catch (err) {
        reject(
          new GlymoError(
            'media-art/parse-failed',
            `GLTFLoader threw on ${this.id}`,
            { recoverable: true, originalError: err as Error },
          ),
        );
      }
    });
  }
}
