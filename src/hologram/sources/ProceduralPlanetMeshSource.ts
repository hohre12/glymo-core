// ── Procedural Planet Mesh Source ─────────────────────────────────────────────
//
// Builds a NASA-Public-Domain texture-driven planet (body + clouds + atmosphere)
// with the cyan-tinted Sobel-coastline holographic look. Pattern derived from
// glymo-landing/components/preview/EarthPreview.tsx — the canonical media-art
// quality bar called out in user feedback (2026-04-20).
//
// Geometry layout (matches EarthPreview):
//   body       — SphereGeometry(1.000, 128, 128)  cyan luminance + Sobel coastline
//   clouds     — SphereGeometry(1.008, 96, 96)    transparent, opacity-masked
//   atmosphere — SphereGeometry(1.070, 64, 64)    BackSide, fresnel halo
//
// Animation:
//   Self-driven via the `update(elapsed, dt)` hook returned in MediaArtMeshState.
//   body rotates at rotationRate.body (default 0.10 rad/s — Earth)
//   clouds rotate at rotationRate.clouds (default 0.13 rad/s — Earth)
//   The renderer drives elapsed seconds, so spin is wall-clock anchored.
//
// Tilt:
//   A wrapper Group carries axialTiltDeg z-rotation (Earth: 23.4°). The renderer
//   adds this group to charContainer, so user gesture rotation/zoom/spread
//   compose with the axial tilt naturally.
//
// Cache contract:
//   Three textures fetched in parallel — each cached under
//   `${id}:${slot}` so the abstract base's per-suffix cache key keeps slots
//   distinct without subclass effort.
//
// Error codes:
//   - 'media-art/fetch-failed'  — any of the three textures fail to download.
//   - 'media-art/parse-failed'  — createImageBitmap rejection on any slot.
//
// No HDRI dependency — the planet is fully self-lit via emissive (Sobel
// coastline + fresnel rim + atmosphere halo) plus the renderer's existing
// scene lights. attachToScene is intentionally not implemented.

import { GlymoError } from '../../types.js';
import type {
  MediaArtMeshState,
  MeshSourceLoadContext,
  ProceduralPlanetMeshSourceDescriptor,
} from '../types.js';
import { BaseMeshSource, type BaseMeshSourceOptions } from './BaseMeshSource.js';
import { getKtx2Loader } from './loaders.js';
import {
  assertDescriptorField,
  assertDescriptorType,
  computeBboxFromObject,
  disposeObject3DTree,
} from './common.js';

const DEFAULT_AXIAL_TILT_DEG = 23.4;
const DEFAULT_ROTATION_BODY = 0.10;
const DEFAULT_ROTATION_CLOUDS = 0.13;

interface TextureSlots {
  daymap: string;
  clouds: string;
  normal: string;
}

interface RotationRates {
  body: number;
  clouds: number;
}

export class ProceduralPlanetMeshSource extends BaseMeshSource {
  private readonly textures: TextureSlots;
  private readonly textureSize: { width: number; height: number };
  private readonly axialTiltDeg: number;
  private readonly rotationRate: RotationRates;

  constructor(
    descriptor: ProceduralPlanetMeshSourceDescriptor,
    options: BaseMeshSourceOptions = {},
  ) {
    assertDescriptorType(descriptor, 'procedural-planet', 'ProceduralPlanetMeshSource');
    assertDescriptorField(
      descriptor.textures?.daymap,
      'textures.daymap',
      'ProceduralPlanetMeshSource',
    );
    assertDescriptorField(
      descriptor.textures?.clouds,
      'textures.clouds',
      'ProceduralPlanetMeshSource',
    );
    assertDescriptorField(
      descriptor.textures?.normal,
      'textures.normal',
      'ProceduralPlanetMeshSource',
    );
    if (
      !descriptor.textureSize ||
      !(descriptor.textureSize.width > 0) ||
      !(descriptor.textureSize.height > 0)
    ) {
      throw new GlymoError(
        'media-art/invalid-descriptor',
        `ProceduralPlanetMeshSource requires positive textureSize.{width,height}`,
        { recoverable: false },
      );
    }
    super(descriptor, options);
    this.textures = descriptor.textures;
    this.textureSize = descriptor.textureSize;
    this.axialTiltDeg = descriptor.axialTiltDeg ?? DEFAULT_AXIAL_TILT_DEG;
    this.rotationRate = {
      body: descriptor.rotationRate?.body ?? DEFAULT_ROTATION_BODY,
      clouds: descriptor.rotationRate?.clouds ?? DEFAULT_ROTATION_CLOUDS,
    };
  }

  async load(
    deps: {
      THREE: typeof import('three/webgpu');
      tsl: typeof import('three/tsl');
    },
    ctx?: MeshSourceLoadContext,
  ): Promise<MediaArtMeshState> {
    const { THREE, tsl } = deps;

    // ── 1. Fetch all three textures in parallel ─────────────────────────────
    //
    // Three-fetch source weighting: each texture contributes 1/3 of the bar.
    // We track per-slot last-known ratios (clamped at 0.95 when Content-Length
    // is missing) and emit the sum on every chunk so the consumer gets a
    // monotonic 0 → 1 sweep across the whole load. Slots are accumulated
    // independently, so the user sees parallel-load progress instead of a
    // step-function.
    const reportProgress = ctx?.onProgress;
    const slotRatios: Record<'daymap' | 'clouds' | 'normal', number> = {
      daymap: 0,
      clouds: 0,
      normal: 0,
    };
    const emitAggregate = (): void => {
      if (!reportProgress) return;
      const aggregate =
        (slotRatios.daymap + slotRatios.clouds + slotRatios.normal) / 3;
      try {
        reportProgress(Math.min(aggregate, 1));
      } catch {
        /* swallow consumer throws */
      }
    };
    const makeSlotProgress = (slot: 'daymap' | 'clouds' | 'normal') =>
      (loaded: number, total: number | null): void => {
        const ratio = total && total > 0 ? loaded / total : 0.95;
        slotRatios[slot] = Math.min(ratio, 1);
        emitAggregate();
      };
    const [dayBuf, cloudBuf, normalBuf] = await Promise.all([
      this.fetchBuffer({
        url: this.textures.daymap,
        errorCode: 'media-art/fetch-failed',
        cacheKeySuffix: 'daymap',
        ...(reportProgress ? { onProgress: makeSlotProgress('daymap') } : {}),
      }),
      this.fetchBuffer({
        url: this.textures.clouds,
        errorCode: 'media-art/fetch-failed',
        cacheKeySuffix: 'clouds',
        ...(reportProgress ? { onProgress: makeSlotProgress('clouds') } : {}),
      }),
      this.fetchBuffer({
        url: this.textures.normal,
        errorCode: 'media-art/fetch-failed',
        cacheKeySuffix: 'normal',
        ...(reportProgress ? { onProgress: makeSlotProgress('normal') } : {}),
      }),
    ]);
    // Final monotonic 100% — covers the parse + scene-assembly tail that
    // happens after the last fetch chunk arrives.
    if (reportProgress) {
      try {
        reportProgress(1);
      } catch {
        /* swallow consumer throws */
      }
    }
    // Reference imported helper to silence unused-import lint when KTX2 wiring
    // remains a TODO (see bufferToTexture below). This is a non-functional
    // anchor; treeshaking removes it from production builds.
    void getKtx2Loader;

    // ── 2. Decode each buffer into a Three.Texture ──────────────────────────
    const [dayTex, cloudTex, normalTex] = await Promise.all([
      this.bufferToTexture(THREE, dayBuf, 'daymap', { srgb: true }),
      this.bufferToTexture(THREE, cloudBuf, 'clouds', { srgb: true }),
      this.bufferToTexture(THREE, normalBuf, 'normal', { srgb: false }),
    ]);

    // ── 3. Build TSL nodes (cyan luminance + Sobel coastline + fresnel) ────
    const {
      Fn,
      float,
      vec2,
      vec3,
      uniform,
      color,
      mix,
      smoothstep,
      abs,
      dot,
      pow,
      max,
      clamp,
      texture: tslSampleTexture,
      uv,
      normalMap: tslNormalMap,
      positionWorld,
      normalWorld,
      cameraPosition,
    } = tsl;

    const uTime = uniform(0.0);
    const uTransition = uniform(0.0);

    // Palette — matches EarthPreview cyan deep/mid/bright + glow.
    const cyanDeep = color(new THREE.Color(0x051a3a));
    const cyanMid = color(new THREE.Color(0x0a4a8c));
    const cyanBright = color(new THREE.Color(0x6fd8ff));
    const cyanGlow = color(new THREE.Color(0x00bbff));
    const lumW = vec3(0.299, 0.587, 0.114);

    // ── 3a. Sobel coastline (3x3 luminance gradient on the daymap) ─────────
    const dayUV = uv();
    const dayCenter = tslSampleTexture(dayTex, dayUV).rgb;
    const lumCenter = dot(dayCenter, lumW);

    const dx = float(1.0 / this.textureSize.width);
    const dy = float(1.0 / this.textureSize.height);
    const lumLeft = dot(tslSampleTexture(dayTex, dayUV.sub(vec2(dx, float(0)))).rgb, lumW);
    const lumRight = dot(tslSampleTexture(dayTex, dayUV.add(vec2(dx, float(0)))).rgb, lumW);
    const lumUp = dot(tslSampleTexture(dayTex, dayUV.add(vec2(float(0), dy))).rgb, lumW);
    const lumDown = dot(tslSampleTexture(dayTex, dayUV.sub(vec2(float(0), dy))).rgb, lumW);
    const gx = abs(lumRight.sub(lumLeft));
    const gy = abs(lumUp.sub(lumDown));
    const edgeRaw = max(gx, gy);
    const coastline = smoothstep(float(0.04), float(0.18), edgeRaw);

    // ── 3b. Two fresnel falloff shapes ──────────────────────────────────────
    const fresnelEdge = Fn(() => {
      const viewDir = cameraPosition.sub(positionWorld).normalize();
      const nDotV = abs(dot(normalWorld, viewDir));
      return pow(float(1.0).sub(nDotV), float(4.5));
    });
    const fresnelSoft = Fn(() => {
      const viewDir = cameraPosition.sub(positionWorld).normalize();
      const nDotV = abs(dot(normalWorld, viewDir));
      return pow(float(1.0).sub(nDotV), float(2.2));
    });

    // ── 3c. Cyan tint (deep → mid → bright by daymap luminance) ────────────
    const tinted = mix(cyanDeep, cyanMid, smoothstep(float(0.06), float(0.32), lumCenter));
    const tintedHi = mix(tinted, cyanBright, smoothstep(float(0.32), float(0.7), lumCenter));

    // ── 4. Body material ────────────────────────────────────────────────────
    const earthMat = new THREE.MeshStandardNodeMaterial();
    (earthMat as unknown as { colorNode: unknown }).colorNode = tintedHi;
    (earthMat as unknown as { emissiveNode: unknown }).emissiveNode = cyanGlow
      .mul(coastline.mul(1.3))
      .add(cyanGlow.mul(fresnelEdge().mul(0.55)))
      .mul(uTransition);
    (earthMat as unknown as { roughnessNode: unknown }).roughnessNode = float(0.9);
    (earthMat as unknown as { metalnessNode: unknown }).metalnessNode = float(0.0);
    try {
      (earthMat as unknown as { normalNode: unknown }).normalNode = tslNormalMap(
        tslSampleTexture(normalTex, uv()),
        float(0.6),
      );
    } catch {
      // normalMap node unavailable on this build — fall back to face normals.
    }

    // ── 5. Cloud material ───────────────────────────────────────────────────
    const cloudSample = tslSampleTexture(cloudTex, uv()).r;
    const cloudAlphaThreshold = smoothstep(float(0.15), float(0.5), cloudSample);
    const cloudMat = new THREE.MeshStandardNodeMaterial();
    cloudMat.transparent = true;
    cloudMat.depthWrite = false;
    (cloudMat as unknown as { colorNode: unknown }).colorNode = vec3(
      float(0.85),
      float(0.92),
      float(1.0),
    );
    (cloudMat as unknown as { emissiveNode: unknown }).emissiveNode = cyanGlow.mul(
      cloudAlphaThreshold.mul(0.35),
    );
    (cloudMat as unknown as { opacityNode: unknown }).opacityNode = clamp(
      cloudAlphaThreshold.mul(0.55).mul(uTransition),
      float(0.0),
      float(0.7),
    );
    (cloudMat as unknown as { roughnessNode: unknown }).roughnessNode = float(1.0);

    // ── 6. Atmosphere shell (BackSide, fresnel halo) ────────────────────────
    const atmoMat = new THREE.MeshStandardNodeMaterial();
    atmoMat.transparent = true;
    atmoMat.depthWrite = false;
    atmoMat.side = THREE.BackSide;
    (atmoMat as unknown as { colorNode: unknown }).colorNode = cyanGlow;
    (atmoMat as unknown as { emissiveNode: unknown }).emissiveNode = cyanGlow
      .mul(1.6)
      .mul(uTransition);
    (atmoMat as unknown as { opacityNode: unknown }).opacityNode = clamp(
      pow(fresnelSoft(), float(1.2)).mul(0.95).mul(uTransition),
      float(0.0),
      float(1.0),
    );

    // ── 7. Geometry + meshes ────────────────────────────────────────────────
    const earthGeo = new THREE.SphereGeometry(1, 128, 128);
    const earth = new THREE.Mesh(earthGeo, earthMat);

    const cloudGeo = new THREE.SphereGeometry(1.008, 96, 96);
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);

    const atmoGeo = new THREE.SphereGeometry(1.07, 64, 64);
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);

    // ── 8. Tilt group (axial inclination) ───────────────────────────────────
    const tilt = new THREE.Group();
    tilt.add(earth);
    tilt.add(clouds);
    tilt.add(atmosphere);
    tilt.rotation.z = (this.axialTiltDeg * Math.PI) / 180;

    // ── 9. Bbox (sphere bounds invariant under rotation) ────────────────────
    const bbox = computeBboxFromObject(THREE, tilt);

    // ── 10. Update hook — drive axial spin ──────────────────────────────────
    const bodyRate = this.rotationRate.body;
    const cloudsRate = this.rotationRate.clouds;
    const update = (elapsed: number, _dt: number): void => {
      earth.rotation.y = elapsed * bodyRate;
      clouds.rotation.y = elapsed * cloudsRate;
    };

    // ── 11. Disposer ────────────────────────────────────────────────────────
    const dispose = (): void => {
      disposeObject3DTree(tilt, {
        extraMaterials: [earthMat, cloudMat, atmoMat],
        extraTextures: [dayTex, cloudTex, normalTex],
      });
    };

    // Plain enumerable properties — preserves the spread-drops-non-enumerable
    // fix from 2026-04-20 so consumers that destructure work correctly.
    return {
      id: this.id,
      group: tilt,
      bbox,
      dispose,
      uTime,
      uTransition,
      update,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /**
   * Decode a fetched image buffer into a Three.Texture wired with the colour
   * space + sampling convention EarthPreview uses for each slot.
   *
   * createImageBitmap is preferred over Blob URL + TextureLoader — it skips
   * the DOM round-trip and works in workers if we ever move there.
   *
   * TODO(KTX2 textures): When a slot URL ends in `.ktx2`, the canonical wire
   * is to call `getKtx2Loader(deps).then(l => l.parse(buffer))`. KTX2Loader
   * needs a one-time `detectSupport(renderer)` call against the WebGPU
   * renderer instance, which the source does not have a reference to here
   * (the renderer lives in `Hologram3DRenderer`). Resolving this requires
   * either threading the renderer through `MeshSourceLoadContext` or moving
   * KTX2 parse into the renderer itself. Current curated planet textures
   * (NASA-PD daymap / clouds / normal) are JPEG, so this stays a TODO until
   * a curator ships the first .ktx2-encoded planet asset. See
   * `docs/plans/media-art-mvp.md` §D11.4 for the limitation.
   */
  private async bufferToTexture(
    THREE: typeof import('three/webgpu'),
    buffer: ArrayBuffer,
    label: string,
    opts: { srgb: boolean },
  ): Promise<InstanceType<typeof import('three/webgpu').Texture>> {
    const blob = new Blob([buffer]);
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch (err) {
      throw new GlymoError(
        'media-art/parse-failed',
        `Failed to decode ${this.id} ${label} texture`,
        { recoverable: true, originalError: err as Error },
      );
    }
    const tex = new THREE.Texture(bitmap as unknown as HTMLImageElement);
    tex.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    // Both axes RepeatWrapping — matches EarthPreview canonical.
    // ClampToEdge on T causes pole-row banding AND poisons the Sobel
    // coastline filter near the poles (lumUp/lumDown sample boundary).
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }
}
