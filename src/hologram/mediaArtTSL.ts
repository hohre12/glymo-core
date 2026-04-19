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

  // colorNode: full 4-stop luminance plus a subtle rim color additive.
  const colorNode = luminance().add(color(rimColor).mul(fresnel().mul(0.35)));

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

  // emissiveNode: cyan rim emission so the bloom postprocess lights up
  // silhouettes (matches text material at line 603).
  const emissiveNode = color(rimColor).mul(fresnel().mul(0.7).add(0.3));

  return {
    uTime,
    uTransition,
    colorNode,
    opacityNode,
    emissiveNode,
  };
}

/**
 * Apply the media-art shader treatment to every Mesh under the given root
 * group. Replaces each Mesh.material with a fresh MeshStandardNodeMaterial
 * carrying the shader nodes. Returns the list of materials AND the list of
 * uniform pairs so the caller can dispose / drive them.
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
): {
  materials: unknown[];
  uTime: ReturnType<typeof import('three/tsl').uniform>;
  uTransition: ReturnType<typeof import('three/tsl').uniform>;
} {
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
      mat.side = THREE.DoubleSide;
      // The TSL nodes are typed as `unknown` in the public surface so the
      // types module does not pull three/webgpu into every consumer; the
      // assignments below are safe because we constructed them above.
      (mat as unknown as { colorNode: unknown }).colorNode = nodes.colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = nodes.opacityNode;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = nodes.emissiveNode;

      (obj as { material: unknown }).material = mat;
      materials.push(mat);
      allUTimes.push(nodes.uTime);
      allUTransitions.push(nodes.uTransition);
    }
  });

  // Aggregate uniform: a single uniform whose .value setter writes through
  // to every per-material uniform. This keeps the renderer's per-frame loop
  // a single assignment regardless of mesh count.
  const aggregate = (list: ReturnType<typeof import('three/tsl').uniform>[]) => {
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
  };

  return {
    materials,
    uTime: aggregate(allUTimes),
    uTransition: aggregate(allUTransitions),
  };
}

// Re-export the descriptor type so consumers of this shader pack can resolve
// it without an extra import line — keeps the public API ergonomic for
// downstream packages (glymo-app catalog code).
export type { GltfMeshSourceDescriptor };
