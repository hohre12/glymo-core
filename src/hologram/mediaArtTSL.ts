// ── Media Art TSL Shader Node Pack ────────────────────────────────────────────
//
// Reusable Three Shader Language (TSL) nodes for the Glymo media-art
// holographic treatment. Applied as MeshStandardNodeMaterial overrides on top
// of a loaded GLB's geometry — the geometry is preserved verbatim, only the
// material is replaced. This honours HR1 (preserve the shape) from
// docs/plans/media-art-mvp.md §4.
//
// Visual signature (locked 2026-04-19, see §13.4):
//   - 4-stop cyan luminance gradient (#041425 → #0a4a8c → #6fd8ff → #c8efff)
//     interpolated by view-fresnel value; deep-navy at facing surfaces,
//     near-white at grazing edges.
//   - Fresnel rim glow boosts emissive on edges so bloom lights up silhouettes.
//   - Subtle scrolling scanline + flicker matches the existing text-mode
//     hologram material so text and mesh holograms feel like the same effect.
//
// API (intentionally tiny — three uniforms + three nodes):
//   createMediaArtShaderNodes({ THREE, tsl }) → {
//     uTime, uTransition,
//     colorNode, opacityNode, emissiveNode,
//   }
//
// Caller wires nodes into a MeshStandardNodeMaterial:
//   const m = new THREE.MeshStandardNodeMaterial();
//   const s = createMediaArtShaderNodes({ THREE, tsl });
//   m.colorNode = s.colorNode;
//   m.opacityNode = s.opacityNode;
//   m.emissiveNode = s.emissiveNode;
//   m.transparent = true;
//   m.depthWrite = false;
//
// Then drives uniforms each frame:
//   s.uTime.value = elapsedSeconds;
//   s.uTransition.value = 0..1;
//
// THREE / tsl are passed in (not imported) so this file stays free of the
// heavy three/webgpu graph and can sit in the same lazy-loaded chunk as the
// renderer that uses it.

import type { GltfMeshSourceDescriptor } from './types.js';

/** 4-stop cyan luminance gradient (deep navy → cyan → near-white). */
export const MEDIA_ART_LUMINANCE_STOPS = [
  { t: 0.0, hex: 0x041425 },
  { t: 0.33, hex: 0x0a4a8c },
  { t: 0.66, hex: 0x6fd8ff },
  { t: 1.0, hex: 0xc8efff },
] as const;

/** Output of createMediaArtShaderNodes — wire each *Node into a NodeMaterial. */
export interface MediaArtShaderNodes {
  /** Drive with elapsed seconds each frame. */
  uTime: ReturnType<typeof import('three/tsl').uniform>;
  /** Drive with 0..1 (matches Hologram3DRenderer transition). */
  uTransition: ReturnType<typeof import('three/tsl').uniform>;
  /** Feed into MeshStandardNodeMaterial.colorNode. */
  colorNode: unknown;
  /** Feed into MeshStandardNodeMaterial.opacityNode. */
  opacityNode: unknown;
  /** Feed into MeshStandardNodeMaterial.emissiveNode. */
  emissiveNode: unknown;
}

/**
 * Build the cyan-luminance + fresnel-rim shader nodes for a media-art mesh.
 *
 * Returns three TSL nodes (color/opacity/emissive) and two uniforms (time,
 * transition). The caller owns the returned uniforms — drive them every frame
 * and dispose the parent material when the mesh is removed.
 */
export function createMediaArtShaderNodes(deps: {
  THREE: typeof import('three/webgpu');
  tsl: typeof import('three/tsl');
}): MediaArtShaderNodes {
  const { THREE, tsl } = deps;
  const {
    Fn,
    float,
    vec3,
    uniform,
    color,
    mix,
    positionWorld,
    normalWorld,
    cameraPosition,
    sin,
    smoothstep,
    abs,
    dot,
    pow,
    clamp,
  } = tsl;

  const uTime = uniform(0.0);
  const uTransition = uniform(0.0);

  // Pre-construct THREE.Color instances once — TSL color() wraps these into
  // immutable color nodes; constructing per-frame would leak GPU buffers.
  const c0 = new THREE.Color(MEDIA_ART_LUMINANCE_STOPS[0].hex);
  const c1 = new THREE.Color(MEDIA_ART_LUMINANCE_STOPS[1].hex);
  const c2 = new THREE.Color(MEDIA_ART_LUMINANCE_STOPS[2].hex);
  const c3 = new THREE.Color(MEDIA_ART_LUMINANCE_STOPS[3].hex);
  const rimColor = new THREE.Color(0xc8efff);

  // Fresnel: 1 at grazing edges (silhouette), 0 at facing surfaces.
  // Uses cube falloff so the rim is sharp instead of a soft halo, which
  // would muddle bloom output.
  const fresnel = Fn(() => {
    const viewDir = cameraPosition.sub(positionWorld).normalize();
    const nDotV = abs(dot(normalWorld, viewDir));
    return pow(float(1.0).sub(nDotV), float(3.0));
  });

  // 4-stop luminance gradient mixed by fresnel value.
  // Stops at 0, 0.33, 0.66, 1.0 — three smoothstep windows so each stop
  // blends smoothly into the next without banding.
  const luminance = Fn(() => {
    const t = fresnel();
    const m1 = smoothstep(float(0.0), float(MEDIA_ART_LUMINANCE_STOPS[1].t), t);
    const m2 = smoothstep(
      float(MEDIA_ART_LUMINANCE_STOPS[1].t),
      float(MEDIA_ART_LUMINANCE_STOPS[2].t),
      t,
    );
    const m3 = smoothstep(
      float(MEDIA_ART_LUMINANCE_STOPS[2].t),
      float(MEDIA_ART_LUMINANCE_STOPS[3].t),
      t,
    );
    const a = mix(color(c0), color(c1), m1);
    const b = mix(a, color(c2), m2);
    return mix(b, color(c3), m3);
  });

  // Scrolling scanline (matches Hologram3DRenderer text material at lines
  // 571–574 — keeping cadence identical so text and mesh holograms read as
  // the same effect when a user toggles between modes).
  const scanline = Fn(() => {
    const raw = sin(positionWorld.y.mul(60.0).sub(uTime.mul(4.0))).mul(0.5).add(0.5);
    return smoothstep(float(0.2), float(0.8), raw).mul(0.18);
  });

  // Flicker — small brightness pulse at irrational frequencies so it never
  // resolves into a beat pattern.
  const flicker = Fn(() => {
    return sin(uTime.mul(6.0)).mul(0.05).add(sin(uTime.mul(11.3)).mul(0.035));
  });

  // colorNode: full 4-stop luminance — relies on PBR diffuse from scene
  // lights to show. Hologram3DRenderer.init() adds DirectionalLight +
  // AmbientLight matching the landing /preview/media-art reference, so
  // the cyan gradient becomes the dominant visible signal at facing
  // surfaces. Earlier revisions added a fresnel-rim additive here, but
  // that doubled with emissiveNode and pushed the silhouette into bloom
  // saturation — the rim now lives in emissiveNode only.
  const colorNode = luminance();

  // opacityNode: high base opacity, fresnel boost on edges for crisp
  // silhouette, scanline subtraction, flicker, scaled by transition.
  const opacityNode = clamp(
    float(0.88)
      .add(fresnel().mul(0.12))
      .sub(scanline())
      .add(flicker())
      .mul(uTransition),
    float(0.0),
    float(1.0),
  );

  // emissiveNode: edge-ONLY emission — facing surfaces have zero emissive
  // so PBR diffuse (driven by the cyan gradient + scene lights) reads as
  // the body, while the fresnel rim alone pushes through the bloom
  // threshold (0.7 in Hologram3DRenderer). This matches EarthPreview.tsx
  // lines 191-192 (`cyanGlow.mul(coastline.mul(1.3)).add(cyanGlow.mul(
  // fresnelEdge().mul(0.55)))`) — silhouette glows, body doesn't.
  // Removing the +0.3 baseline that earlier revisions carried fixes the
  // "every mesh looks like a uniform glowing white blob" regression
  // surfaced during 2026-04-20 UAT.
  const emissiveNode = color(rimColor).mul(fresnel().mul(1.5));

  return {
    uTime,
    uTransition,
    colorNode,
    opacityNode,
    emissiveNode,
  };
}

/** Result returned by every applyMediaArt*Treatment helper. */
export interface MediaArtTreatmentResult {
  /** Every fresh material attached during the traversal — caller disposes. */
  materials: unknown[];
  /** Aggregate time uniform — drive each frame; fans out to per-material uniforms. */
  uTime: ReturnType<typeof import('three/tsl').uniform>;
  /** Aggregate transition uniform — drive 0..1; fans out to per-material uniforms. */
  uTransition: ReturnType<typeof import('three/tsl').uniform>;
}

/** Original PBR material shape — the subset of fields treatment helpers consume. */
type SourcePbrMaterialShape = {
  map?: unknown;
  normalMap?: unknown;
  roughnessMap?: unknown;
  color?: { r: number; g: number; b: number };
  side?: number;
  transparent?: boolean;
  alphaTest?: number;
};

/**
 * Apply the simple media-art shader treatment to every Mesh under the given
 * root group. Replaces each Mesh.material with a fresh MeshStandardNodeMaterial
 * carrying the cyan luminance gradient + fresnel rim emissive (no texture
 * dependency). Returns the list of materials AND the aggregate uniform pair
 * so the caller can dispose / drive them.
 *
 * Use this for plain GLBs whose original materials carry no useful textures
 * (most CC0 low-poly catalogs — Kenney, Quaternius). For texture-rich PBR
 * GLBs (Khronos demo assets, hero models) prefer
 * applyTexturedMediaArtShaderTreatment which derives the cyan tint from the
 * GLB's diffuse map for richer surface detail.
 *
 * Implementation note: each mesh gets ITS OWN material instance (not shared)
 * so per-mesh transition fades work independently if needed later. Uniforms
 * across all materials are kept in sync by driving the returned aggregate
 * uTime/uTransition pair, so the visual output is identical to a shared
 * material today.
 */
export function applyMediaArtShaderTreatment(
  root: unknown,
  deps: {
    THREE: typeof import('three/webgpu');
    tsl: typeof import('three/tsl');
  },
): MediaArtTreatmentResult {
  const { THREE } = deps;
  const materials: unknown[] = [];
  const allUTimes: ReturnType<typeof import('three/tsl').uniform>[] = [];
  const allUTransitions: ReturnType<typeof import('three/tsl').uniform>[] = [];

  // Treat root as a Three.js Object3D — only methods used: traverse,
  // isMesh discriminant via instanceof THREE.Mesh.
  (root as { traverse: (cb: (obj: unknown) => void) => void }).traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      // Dispose any geometry-bound material the GLB shipped with — we own
      // the visual treatment now.
      const original = (obj as { material: unknown }).material;
      if (original) {
        const list = Array.isArray(original) ? original : [original];
        for (const m of list) {
          if (m && typeof (m as { dispose?: () => void }).dispose === 'function') {
            (m as { dispose: () => void }).dispose();
          }
        }
      }

      const nodes = createMediaArtShaderNodes(deps);
      const mat = new THREE.MeshStandardNodeMaterial();
      mat.transparent = true;
      mat.depthWrite = false;
      // FrontSide is the canonical PBR default. The previous DoubleSide
      // double-rendered every fragment (front + back face), which doubled
      // the emissive rim contribution and pushed silhouettes into bloom
      // saturation. EarthPreview uses FrontSide for the body and BackSide
      // only for an atmosphere shell — that two-pass pattern is left for
      // a future media-art-mvp Phase if a halo is needed; for now the
      // single FrontSide pass gives a clean silhouette.
      mat.side = THREE.FrontSide;
      // The TSL nodes are typed as `unknown` in the public surface so the
      // types module does not pull three/webgpu into every consumer; the
      // assignments below are safe because we constructed them above.
      (mat as unknown as { colorNode: unknown }).colorNode = nodes.colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = nodes.opacityNode;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = nodes.emissiveNode;
      // Explicit PBR params — high roughness + zero metalness mirrors
      // EarthPreview's earthMat (matte cyan body, no specular hot spots
      // that would confuse the bloom pass).
      (mat as unknown as { roughnessNode: unknown }).roughnessNode = (deps.tsl as { float: (v: number) => unknown }).float(0.85);
      (mat as unknown as { metalnessNode: unknown }).metalnessNode = (deps.tsl as { float: (v: number) => unknown }).float(0.0);

      (obj as { material: unknown }).material = mat;
      materials.push(mat);
      allUTimes.push(nodes.uTime);
      allUTransitions.push(nodes.uTransition);
    }
  });

  return {
    materials,
    uTime: aggregateUniform(allUTimes),
    uTransition: aggregateUniform(allUTransitions),
  };
}

/**
 * Aggregate uniform: a single uniform whose .value setter writes through to
 * every per-material uniform. Keeps the renderer's per-frame loop a single
 * assignment regardless of mesh count, and works identically for the simple
 * and textured treatments.
 */
function aggregateUniform(
  list: ReturnType<typeof import('three/tsl').uniform>[],
): ReturnType<typeof import('three/tsl').uniform> {
  return new Proxy({ value: 0 } as { value: number }, {
    set(target, prop, value): boolean {
      if (prop === 'value') {
        target.value = value as number;
        for (const u of list) {
          (u as unknown as { value: number }).value = value as number;
        }
      }
      return true;
    },
    get(target, prop): unknown {
      if (prop === 'value') return target.value;
      return undefined;
    },
  }) as unknown as ReturnType<typeof import('three/tsl').uniform>;
}

/**
 * Apply the textured media-art shader treatment — derives the cyan tint from
 * the GLB's diffuse map (if present) so surface detail (fur patterns, panel
 * lines, label text) bleeds through into the holographic look.
 *
 * Per-mesh material build (matches DogPBRPreview.tsx.ref pattern):
 *   - Sample original `material.map` → compute luminance → 4-tier cyan
 *     mapping (deep navy → cyan-mid → cyan-bright → cyan-white).
 *   - Preserve original normalMap (slightly attenuated) and roughnessMap for
 *     PBR response under HDR environment lighting.
 *   - Add fresnel-rim emissive (silhouette glow for bloom).
 *   - Inherit transparency / alpha-test from the original (foliage cards etc).
 *
 * Meshes without a diffuse map fall back to the simple gradient (their
 * colorNode reduces to the base color sampled as a single luminance value).
 *
 * Use this for high-fidelity GLBs sourced via Khronos / Sketchfab / hero
 * Quaternius assets where the original PBR maps carry information worth
 * preserving. Pair with HDRI environment lighting via
 * GlbPbrMeshSource for the full DogPBRPreview look.
 */
export function applyTexturedMediaArtShaderTreatment(
  root: unknown,
  deps: {
    THREE: typeof import('three/webgpu');
    tsl: typeof import('three/tsl');
  },
): MediaArtTreatmentResult {
  const { THREE, tsl } = deps;
  const {
    Fn, float, vec3, mix,
    abs, dot, pow, smoothstep, clamp,
    color, uniform,
    positionWorld, normalWorld, cameraPosition,
    sin,
    texture: tslSampleTexture,
    uv,
    normalMap: tslNormalMap,
  } = tsl;

  const materials: unknown[] = [];
  const allUTimes: ReturnType<typeof import('three/tsl').uniform>[] = [];
  const allUTransitions: ReturnType<typeof import('three/tsl').uniform>[] = [];

  // Pre-construct THREE.Color instances per the DogPBRPreview palette.
  const c0 = new THREE.Color(0x041425);
  const c1 = new THREE.Color(0x0a4a8c);
  const c2 = new THREE.Color(0x6fd8ff);
  const c3 = new THREE.Color(0xc8efff);
  const cGlow = new THREE.Color(0x00bbff);
  const lumW = vec3(0.299, 0.587, 0.114);

  (root as { traverse: (cb: (obj: unknown) => void) => void }).traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;

    const original = (obj as { material: unknown }).material as
      | SourcePbrMaterialShape
      | SourcePbrMaterialShape[];
    const first = Array.isArray(original) ? original[0] : original;
    if (!first) return;

    // Per-mesh uniforms — keep transition fades independent if needed later.
    const uTime = uniform(0.0);
    const uTransition = uniform(0.0);

    const mat = new THREE.MeshStandardNodeMaterial();

    // Per-mesh fresnel — same shape as the simple treatment, slightly softer
    // for the textured variant so the surface detail isn't washed out by
    // edge bloom.
    const fresnel = Fn(() => {
      const viewDir = cameraPosition.sub(positionWorld).normalize();
      const nDotV = abs(dot(normalWorld, viewDir));
      return pow(float(1.0).sub(nDotV), float(3.2));
    });

    // ── Color: cyan-tinted texture luminance OR fallback gradient ─────────
    if (first.map) {
      const sample = tslSampleTexture(
        first.map as InstanceType<typeof import('three/webgpu').Texture>,
        uv(),
      );
      const baseRGB = sample.rgb;
      const lum = dot(baseRGB, lumW);
      const t1 = mix(color(c0), color(c1), smoothstep(float(0.05), float(0.35), lum));
      const t2 = mix(t1, color(c2), smoothstep(float(0.35), float(0.75), lum));
      const tFinal = mix(t2, color(c3), smoothstep(float(0.75), float(0.95), lum));
      (mat as unknown as { colorNode: unknown }).colorNode = tFinal;

      // Inherit alpha-test / transparent if the original used cutout textures.
      if ((first.alphaTest ?? 0) > 0 || first.transparent) {
        (mat as unknown as { opacityNode: unknown }).opacityNode = sample.a;
        mat.transparent = !!first.transparent;
        mat.alphaTest = first.alphaTest ?? 0.5;
      }
    } else {
      const c = first.color ?? { r: 0.55, g: 0.8, b: 1.0 };
      const baseLum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
      const lumNode = float(baseLum);
      const t1 = mix(color(c0), color(c1), smoothstep(float(0.05), float(0.35), lumNode));
      const t2 = mix(t1, color(c2), smoothstep(float(0.35), float(0.75), lumNode));
      (mat as unknown as { colorNode: unknown }).colorNode = mix(
        t2,
        color(c3),
        smoothstep(float(0.75), float(0.95), lumNode),
      );
    }

    // ── Normal: preserve original normalMap (softened) ─────────────────────
    if (first.normalMap) {
      try {
        (mat as unknown as { normalNode: unknown }).normalNode = tslNormalMap(
          tslSampleTexture(
            first.normalMap as InstanceType<typeof import('three/webgpu').Texture>,
            uv(),
          ),
          float(0.85),
        );
      } catch {
        // normalMap node unavailable on this build — skip silently.
      }
    }

    // ── Roughness: from original roughnessMap.g if present ─────────────────
    if (first.roughnessMap) {
      (mat as unknown as { roughnessNode: unknown }).roughnessNode = tslSampleTexture(
        first.roughnessMap as InstanceType<typeof import('three/webgpu').Texture>,
        uv(),
      ).g;
    } else {
      (mat as unknown as { roughnessNode: unknown }).roughnessNode = float(0.55);
    }

    // ── Metalness: zero (matches DogPBRPreview canonical) ──────────────────
    (mat as unknown as { metalnessNode: unknown }).metalnessNode = float(0.0);

    // ── Opacity: high base + fresnel boost + transition gate ──────────────
    if (!(first.alphaTest ?? 0) && !first.transparent) {
      (mat as unknown as { opacityNode: unknown }).opacityNode = clamp(
        float(0.92).add(fresnel().mul(0.08)).mul(uTransition),
        float(0.0),
        float(1.0),
      );
      mat.transparent = true;
      mat.depthWrite = false;
    }

    // ── Emissive: cyan rim (silhouette glow into bloom) ────────────────────
    (mat as unknown as { emissiveNode: unknown }).emissiveNode = color(cGlow).mul(
      fresnel().mul(0.65),
    );

    // ── Side: preserve original (foliage often DoubleSide) ────────────────
    if (first.side !== undefined) mat.side = first.side as typeof mat.side;

    // Dispose the original material — we own the visual treatment now.
    if (Array.isArray(original)) {
      for (const m of original) {
        if (m && typeof (m as { dispose?: () => void }).dispose === 'function') {
          (m as { dispose: () => void }).dispose();
        }
      }
    } else {
      if (original && typeof (original as { dispose?: () => void }).dispose === 'function') {
        (original as { dispose: () => void }).dispose();
      }
    }

    (obj as { material: unknown }).material = mat;
    materials.push(mat);
    allUTimes.push(uTime);
    allUTransitions.push(uTransition);

    // Suppress unused-variable warnings for tsl helpers we imported but
    // don't reference in every code path (sin/clamp may go unused under
    // some compiler flags).
    void sin;
  });

  return {
    materials,
    uTime: aggregateUniform(allUTimes),
    uTransition: aggregateUniform(allUTransitions),
  };
}

// Re-export the descriptor type so consumers of this shader pack can resolve
// it without an extra import line — keeps the public API ergonomic for
// downstream packages (glymo-app catalog code).
export type { GltfMeshSourceDescriptor };
