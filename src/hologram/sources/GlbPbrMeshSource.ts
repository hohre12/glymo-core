// ── GLB-PBR Mesh Source ───────────────────────────────────────────────────────
//
// Loads a GLB binary plus an HDR environment map and wires both into a
// MediaArtMeshState. The textured holographic treatment is applied to every
// Mesh so surface detail (fur patterns, panel lines) feeds the cyan tint,
// while the HDR environment drives image-based lighting via
// `scene.environment` (set by the attachToScene hook).
//
// This is the production-grade source for higher-fidelity catalog entries —
// animals, hero objects — that ship with native PBR maps worth preserving.
// The simple GltfMeshSource is appropriate for low-poly Kenney/Quaternius
// shapes where the diffuse map is a flat color.
//
// Visual signature (matches .media-art-staging/DogPBRPreview.tsx.ref):
//   - Texture-luminance-driven 4-tier cyan tint (deep navy → cyan-white).
//   - Native normalMap (slightly attenuated) + roughnessMap preserved.
//   - Fresnel rim emissive (silhouette glow into bloom).
//   - Scene-level environment map at intensity 0.6 (configurable).
//
// Cache contract:
//   - GLB and HDR are cached separately under `${id}` and `${id}:hdri` keys.
//   - HDR cache write failure is non-fatal (rendering proceeds without IBL).
//
// Error codes (all GlymoError-wrapped, recoverable):
//   - 'media-art/fetch-failed'  — GLB or HDR network error / non-OK.
//   - 'media-art/parse-failed'  — GLTFLoader or RGBELoader failure.
//   - 'media-art/empty-gltf'    — GLB has no scenes.

import { GlymoError } from '../../types.js';
import type {
  GltfPbrMeshSourceDescriptor,
  MediaArtMeshState,
  MeshSourceLoadContext,
} from '../types.js';
import { applyTexturedMediaArtShaderTreatment } from '../mediaArtTSL.js';
import { BaseMeshSource, type BaseMeshSourceOptions } from './BaseMeshSource.js';
import { getDracoLoader, getKtx2Loader } from './loaders.js';
import {
  assertDescriptorField,
  assertDescriptorType,
  computeBboxFromObject,
  disposeObject3DTree,
} from './common.js';

const DEFAULT_ENVIRONMENT_INTENSITY = 0.6;

export class GlbPbrMeshSource extends BaseMeshSource {
  private readonly url: string;
  private readonly hdriUrl: string;
  private readonly environmentIntensity: number;

  constructor(descriptor: GltfPbrMeshSourceDescriptor, options: BaseMeshSourceOptions = {}) {
    assertDescriptorType(descriptor, 'gltf-pbr', 'GlbPbrMeshSource');
    assertDescriptorField(descriptor.url, 'url', 'GlbPbrMeshSource');
    assertDescriptorField(descriptor.hdriUrl, 'hdriUrl', 'GlbPbrMeshSource');
    super(descriptor, options);
    this.url = descriptor.url;
    this.hdriUrl = descriptor.hdriUrl;
    this.environmentIntensity = descriptor.environmentIntensity ?? DEFAULT_ENVIRONMENT_INTENSITY;
  }

  async load(
    deps: {
      THREE: typeof import('three/webgpu');
      tsl: typeof import('three/tsl');
    },
    ctx?: MeshSourceLoadContext,
  ): Promise<MediaArtMeshState> {
    const { THREE } = deps;

    // ── 1. Acquire GLB (cache or network) ─────────────────────────────────
    //
    // Two-fetch source weighting: GLB takes 60% of the bar (typically the
    // larger payload), HDR takes the remaining 40%. The HDR is also
    // non-fatal — its progress is still reported even if the texture fetch
    // ends up failing (the consumer gets a clean 0 → 1 sweep regardless).
    //
    // Cache-hit aggregation: rollup fires only when BOTH the GLB and HDR
    // resolved from cache. A `cacheHits` counter tracks per-slot hits; when
    // it reaches the expected total of 2 we fire the rollup once and null
    // the local ref so a second slot signal can never re-fire. If HDR
    // failed (network 404, parse error) the counter stays below 2 and the
    // rollup is suppressed — the user saw network activity even if it
    // produced no IBL, so the chip should have flashed.
    const reportProgress = ctx?.onProgress;
    const reportCacheHit = ctx?.onCacheHit;
    let cacheHits = 0;
    const expectedCacheHits = 2;
    const noteCacheHit = (): void => {
      if (!reportCacheHit) return;
      cacheHits += 1;
      if (cacheHits >= expectedCacheHits) {
        try {
          reportCacheHit();
        } catch {
          /* swallow consumer throws */
        }
      }
    };
    const glbBuffer = await this.fetchBuffer({
      url: this.url,
      errorCode: 'media-art/fetch-failed',
      ...(reportProgress
        ? {
            onProgress: (loaded: number, total: number | null) => {
              const ratio = total && total > 0 ? loaded / total : 0.95;
              try {
                reportProgress(Math.min(ratio, 1) * 0.6);
              } catch {
                /* swallow consumer throws */
              }
            },
          }
        : {}),
      ...(reportCacheHit ? { onCacheHit: noteCacheHit } : {}),
    });

    // ── 2. Parse GLB ──────────────────────────────────────────────────────
    const gltf = await this.parseGlb(deps, glbBuffer);
    if (!gltf.scene && (!gltf.scenes || gltf.scenes.length === 0)) {
      throw new GlymoError(
        'media-art/empty-gltf',
        `GLB ${this.id} contains no scenes`,
        { recoverable: true },
      );
    }
    const sceneRoot = gltf.scene ?? gltf.scenes[0];

    // ── 3. Compute bbox before swapping materials ─────────────────────────
    const bbox = computeBboxFromObject(THREE, sceneRoot);

    // ── 4. Apply textured holographic treatment ───────────────────────────
    const treatment = applyTexturedMediaArtShaderTreatment(sceneRoot, deps);

    // ── 5. Acquire HDR environment (cache or network — non-fatal on fail) ─
    //
    // Progress weighting: HDR contributes the remaining 40% of the bar after
    // the GLB's 60%. Total stays monotonic because `0.6 + Math.min(ratio, 1) * 0.4`
    // peaks at exactly 1.0 even when Content-Length is missing (the inner
    // ratio is clamped at 0.95 in that case).
    const hdrTexture = await this.tryLoadHdri(deps, reportProgress, noteCacheHit).catch((err) => {
      // Image-based lighting is a quality-add, not a correctness gate. Log
      // and continue; the asset still renders against scene lights.
      console.warn(`[GlbPbrMeshSource] HDRI load failed for ${this.id} — continuing without IBL`, err);
      return null;
    });

    // Final monotonic 100% — clean signal to consumers regardless of whether
    // the HDR succeeded, failed, or skipped (no Content-Length means the bar
    // never quite reached 1.0 from byte progress alone).
    if (reportProgress) {
      try {
        reportProgress(1);
      } catch {
        /* swallow consumer throws */
      }
    }

    // ── 6. Optional animation mixer ───────────────────────────────────────
    let mixer: unknown = undefined;
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(
        sceneRoot as InstanceType<typeof import('three/webgpu').Object3D>,
      );
      // Prefer "idle" / "walk" clips by name (DogPBRPreview convention),
      // fall back to first clip otherwise.
      const animations = gltf.animations as Array<{ name?: string }>;
      const preferred =
        animations.find((c) => c.name && /idle/i.test(c.name)) ??
        animations.find((c) => c.name && /walk/i.test(c.name)) ??
        animations[0];
      if (preferred) {
        const action = (mixer as { clipAction: (clip: unknown) => { play: () => void } })
          .clipAction(preferred);
        action.play();
      }
    }

    // ── 7. attachToScene: set scene.environment (collected for cleanup) ──
    let attachedScene: { environment?: unknown; environmentIntensity?: number } | null = null;
    let priorEnvironment: unknown = undefined;
    let priorIntensity: number | undefined = undefined;
    const attachToScene = hdrTexture
      ? (scene: unknown): (() => void) => {
          const s = scene as {
            environment?: unknown;
            environmentIntensity?: number;
          };
          (hdrTexture as { mapping: number }).mapping = THREE.EquirectangularReflectionMapping;
          priorEnvironment = s.environment;
          priorIntensity = s.environmentIntensity;
          s.environment = hdrTexture;
          s.environmentIntensity = this.environmentIntensity;
          attachedScene = s;
          return () => {
            // Restore prior scene.environment (usually null) so a subsequent
            // text-mode session does not inherit our HDR.
            s.environment = priorEnvironment;
            s.environmentIntensity = priorIntensity;
          };
        }
      : undefined;

    // ── 8. Disposer — close over GLB + HDR + treatment ────────────────────
    const dispose = () => {
      if (mixer) {
        (mixer as { stopAllAction: () => void }).stopAllAction();
      }
      disposeObject3DTree(sceneRoot, {
        extraMaterials: treatment.materials,
      });
      // HDR texture is owned by this source regardless of attach state. The
      // attachToScene cleanup callback restores scene.environment (typically
      // to null) BEFORE the renderer calls dispose, so disposing the GPU
      // resource here is safe AND required (no double-free path).
      if (hdrTexture) {
        (hdrTexture as { dispose?: () => void }).dispose?.();
      }
    };

    return {
      id: this.id,
      group: sceneRoot,
      ...(mixer ? { mixer } : {}),
      bbox,
      dispose,
      uTime: treatment.uTime,
      uTransition: treatment.uTransition,
      ...(attachToScene ? { attachToScene } : {}),
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async tryLoadHdri(
    deps: {
      THREE: typeof import('three/webgpu');
    },
    reportProgress?: (p: number) => void,
    noteCacheHit?: () => void,
  ): Promise<InstanceType<typeof import('three/webgpu').DataTexture>> {
    const buffer = await this.fetchBuffer({
      url: this.hdriUrl,
      errorCode: 'media-art/fetch-failed',
      cacheKeySuffix: 'hdri',
      ...(reportProgress
        ? {
            onProgress: (loaded: number, total: number | null) => {
              const ratio = total && total > 0 ? loaded / total : 0.95;
              try {
                reportProgress(0.6 + Math.min(ratio, 1) * 0.4);
              } catch {
                /* swallow consumer throws */
              }
            },
          }
        : {}),
      ...(noteCacheHit ? { onCacheHit: noteCacheHit } : {}),
    });

    let RGBELoaderClass: typeof import('three/examples/jsm/loaders/RGBELoader.js').RGBELoader;
    try {
      const mod = await import('three/examples/jsm/loaders/RGBELoader.js');
      RGBELoaderClass = mod.RGBELoader;
    } catch (err) {
      throw new GlymoError(
        'media-art/parse-failed',
        `Failed to load RGBELoader for ${this.id} HDRI`,
        { recoverable: false, originalError: err as Error },
      );
    }

    const loader = new RGBELoaderClass();
    // RGBELoader.parse → DataTexture synchronously.
    const dataTex = (loader as unknown as {
      parse: (buf: ArrayBuffer) => unknown;
    }).parse(buffer);
    if (!dataTex) {
      throw new GlymoError(
        'media-art/parse-failed',
        `RGBELoader returned no texture for ${this.id} HDRI`,
        { recoverable: true },
      );
    }
    // RGBELoader.parse returns a raw ImageData-like object on some versions;
    // wrap with DataTexture if necessary. Three.js r0.183's RGBELoader.parse
    // returns the texture directly via .data fields — defer to runtime.
    const tex = dataTex as InstanceType<typeof import('three/webgpu').DataTexture>;
    deps.THREE; // silence unused import lint when this lands
    return tex;
  }

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

    // Register Draco + KTX2 decoder loaders. See GltfMeshSource.parseGlb for
    // rationale — the same forward-compat infrastructure applies here, so a
    // future PBR catalog entry shipped with KTX2 textures or Draco-encoded
    // primitives parses without code changes. Both registrations are
    // non-fatal so missing decoder binaries do not break uncompressed loads.
    try {
      const dracoLoader = await getDracoLoader();
      (loader as unknown as { setDRACOLoader: (l: unknown) => unknown }).setDRACOLoader(
        dracoLoader,
      );
    } catch (err) {
      console.warn(
        `[GlbPbrMeshSource] DRACOLoader registration failed for ${this.id}`,
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
        `[GlbPbrMeshSource] KTX2Loader registration failed for ${this.id}`,
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
