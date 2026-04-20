// ── GLTF Mesh Source ──────────────────────────────────────────────────────────
//
// Loads a GLB binary and produces a MediaArtMeshState ready to be added to
// the Hologram3DRenderer scene. Inherits cache + fetcher plumbing from
// BaseMeshSource — this file owns only the GLB parse + holographic shader
// treatment.
//
// Cache contract (per docs/plans/media-art-mvp.md §6.1):
//   - Cache key is descriptor.id (NOT URL) — surviving CDN moves and the
//     glymo-app/public/media-art/<category>/<provider>/<id>.glb scheme.
//   - Cache hit → parse the cached buffer directly, skip the network.
//   - Cache miss → fetch + persist + parse.
//   - Cache adapter is optional. Without it, every load fetches.
//
// Error contract (all GlymoError-wrapped, recoverable except parse-failed
// originating from a missing GLTFLoader module):
//   - 'media-art/fetch-failed' — network error or non-OK status.
//   - 'media-art/parse-failed' — GLTFLoader rejection.
//   - 'media-art/empty-gltf' — GLB has no scenes.
//
// The MediaArtMeshState owns disposal — the renderer just calls dispose()
// once and walks away. The base disposeObject3DTree helper walks the scene
// graph; this source layers in defensive disposal of the holographic shader
// materials (some of which the GLB scene graph might never reference).

import { GlymoError } from '../../types.js';
import type {
  GltfMeshSourceDescriptor,
  MediaArtMeshState,
  MeshSourceLoadContext,
} from '../types.js';
import { applyMediaArtShaderTreatment } from '../mediaArtTSL.js';
import { BaseMeshSource, type BaseMeshSourceOptions } from './BaseMeshSource.js';
import { getDracoLoader, getKtx2Loader } from './loaders.js';
import {
  assertDescriptorField,
  assertDescriptorType,
  computeBboxFromObject,
  disposeObject3DTree,
} from './common.js';

export class GltfMeshSource extends BaseMeshSource {
  private readonly url: string;

  constructor(descriptor: GltfMeshSourceDescriptor, options: BaseMeshSourceOptions = {}) {
    assertDescriptorType(descriptor, 'gltf', 'GltfMeshSource');
    assertDescriptorField(descriptor.url, 'url', 'GltfMeshSource');
    super(descriptor, options);
    this.url = descriptor.url;
  }

  async load(
    deps: {
      THREE: typeof import('three/webgpu');
      tsl: typeof import('three/tsl');
    },
    ctx?: MeshSourceLoadContext,
  ): Promise<MediaArtMeshState> {
    const { THREE } = deps;

    // ── 1. Acquire the GLB binary (cache or network) ──────────────────────
    //
    // Single-fetch source: the rollup `ctx.onCacheHit` fires iff the GLB came
    // from cache. Pass-through, no aggregation needed.
    const reportProgress = ctx?.onProgress;
    const reportCacheHit = ctx?.onCacheHit;
    const buffer = await this.fetchBuffer({
      url: this.url,
      errorCode: 'media-art/fetch-failed',
      ...(reportProgress
        ? {
            onProgress: (loaded: number, total: number | null) => {
              // Single-fetch source: byte ratio == load progress. Clamp at
              // 0.95 when the server omitted Content-Length so the bar does
              // not lie about completion before the parse finishes.
              const ratio = total && total > 0 ? loaded / total : 0.95;
              try {
                reportProgress(Math.min(ratio, 1));
              } catch {
                /* swallow consumer throws */
              }
            },
          }
        : {}),
      ...(reportCacheHit
        ? {
            onCacheHit: () => {
              try {
                reportCacheHit();
              } catch {
                /* swallow consumer throws */
              }
            },
          }
        : {}),
    });

    // ── 2. Parse GLB via GLTFLoader ───────────────────────────────────────
    const gltf = await this.parseGlb(deps, buffer);
    if (reportProgress) {
      try {
        reportProgress(1);
      } catch {
        /* swallow consumer throws */
      }
    }

    if (!gltf.scene && (!gltf.scenes || gltf.scenes.length === 0)) {
      throw new GlymoError(
        'media-art/empty-gltf',
        `GLB ${this.id} contains no scenes`,
        { recoverable: true },
      );
    }
    const sceneRoot = gltf.scene ?? gltf.scenes[0];

    // ── 3. Compute bbox before swapping materials so we get geometry-true
    //      bounds (a future material with DoubleSide would otherwise inflate
    //      the bbox if measured after).
    const bbox = computeBboxFromObject(THREE, sceneRoot);

    // ── 4. Apply the media-art shader treatment to every Mesh ─────────────
    const treatment = applyMediaArtShaderTreatment(sceneRoot, deps);

    // ── 5. Optional animation mixer (auto-play first clip) ────────────────
    let mixer: unknown = undefined;
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(
        sceneRoot as InstanceType<typeof import('three/webgpu').Object3D>,
      );
      const action = (mixer as { clipAction: (clip: unknown) => { play: () => void } })
        .clipAction(gltf.animations[0]);
      action.play();
    }

    // ── 6. Wire up disposal — close over the resources we own ─────────────
    const dispose = () => {
      if (mixer) {
        (mixer as { stopAllAction: () => void }).stopAllAction();
      }
      disposeObject3DTree(sceneRoot, { extraMaterials: treatment.materials });
    };

    return {
      id: this.id,
      group: sceneRoot,
      ...(mixer ? { mixer } : {}),
      bbox,
      dispose,
      uTime: treatment.uTime,
      uTransition: treatment.uTransition,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async parseGlb(
    deps: {
      THREE: typeof import('three/webgpu');
      tsl: typeof import('three/tsl');
    },
    buffer: ArrayBuffer,
  ): Promise<{
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

    // Register the KTX2 + Draco decoder loaders. Both are infra-level wires
    // for forward compatibility — current curated GLBs are uncompressed and
    // load fine without them, but registering here means a future curator
    // can drop in a Draco-encoded GLB or one with KTX2 textures and the
    // existing pipeline will parse it without any further code changes.
    //
    // Both registrations are non-fatal on failure (try/catch with warn) —
    // the host might serve from a non-default mount, in which case the
    // singletons resolve their decoder paths to a 404. Plain GLBs still
    // parse; only Draco/KTX2-compressed payloads would fail downstream.
    try {
      const dracoLoader = await getDracoLoader();
      (loader as unknown as { setDRACOLoader: (l: unknown) => unknown }).setDRACOLoader(
        dracoLoader,
      );
    } catch (err) {
      console.warn(
        `[GltfMeshSource] DRACOLoader registration failed for ${this.id}`,
        err,
      );
    }
    try {
      const ktx2Loader = await getKtx2Loader(deps);
      (loader as unknown as { setKTX2Loader: (l: unknown) => unknown }).setKTX2Loader(
        ktx2Loader,
      );
    } catch (err) {
      console.warn(
        `[GltfMeshSource] KTX2Loader registration failed for ${this.id}`,
        err,
      );
    }

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
