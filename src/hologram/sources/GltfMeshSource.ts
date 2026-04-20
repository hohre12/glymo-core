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
} from '../types.js';
import { applyMediaArtShaderTreatment } from '../mediaArtTSL.js';
import { BaseMeshSource, type BaseMeshSourceOptions } from './BaseMeshSource.js';
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

  async load(deps: {
    THREE: typeof import('three/webgpu');
    tsl: typeof import('three/tsl');
  }): Promise<MediaArtMeshState> {
    const { THREE } = deps;

    // ── 1. Acquire the GLB binary (cache or network) ──────────────────────
    const buffer = await this.fetchBuffer({
      url: this.url,
      errorCode: 'media-art/fetch-failed',
    });

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
