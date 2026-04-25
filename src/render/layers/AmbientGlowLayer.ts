// AmbientGlowLayer — Phase 6 sub-slice 6a-4a first cut.
//
// Per `docs/plans/rendering-pipeline-v2.md` §5 Package role realignment:
//
//   `@glymo/ui/canvas/hooks/useAmbientGlow.ts` (RAF)
//     → `@glymo/core/src/render/layers/AmbientGlowLayer.ts`
//        — Glow is a render pass, not a React hook.
//
// AND per §9 R2 mitigation. Same R2 conservative-path rationale as
// `TextOverlayLayer.ts` applies here: `useAmbientGlow.ts` (213 LOC)
// implements per-character radial-gradient glows with fade tracking on a
// dedicated 2D canvas (`ambientCanvasRef` in `CanvasEngine.tsx`). The
// existing 2D path produces the user-tested glow look; migrating it to a
// GPU TSL post-process while simultaneously moving the renderer
// architecturally would create exactly the divergence risk §9 R2 names.
//
// Instead, this layer mirrors the existing ambient canvas onto the
// SceneGraph as a `CanvasTexture` quad — same proven pattern as
// `StrokeLayer` (6a-2) and `TextOverlayLayer` (6a-3a) — at a LOWER Z
// (`-1` by default) so it composites BEHIND the stroke surface, matching
// the legacy `Compositor` order in `@glymo/ui/canvas/lib/Compositor.ts`
// where `addLayer({ id: 'ambient' })` runs FIRST.
//
// A future TSL upgrade (no current sub-slice number — likely 6a-4c or
// later, once 6a-4b PostProcessLayer's TSL plumbing is proven) may
// migrate the ambient glow into a vertex-shader radial pass on the
// SceneGraph itself, eliminating the offscreen 2D canvas. Until then,
// the conservative R2 path is canonical.
//
// ── Composition contract (from TextOverlayLayer.ts) ─────────────────────
// AmbientGlowLayer's default `z = -1` is BELOW StrokeLayer's `0` and
// TextOverlayLayer's `1`. Three.js's transparent-Z sort (sortObjects
// default) renders lowest-Z first, so ambient draws first, stroke next,
// text last. Matches the legacy Compositor stacking exactly.
//
// Per §1.5.4 R-A — public surface is plain TS / DOM types only. Per §3
// invariant I9 — `dispose()` is idempotent.
//
// ── Why not extract a shared `CanvasMirrorLayer` base class ─────────────
// Same answer as in TextOverlayLayer.ts — premature; the layers will
// diverge as 6a-4b PostProcessLayer (TSL pass), 6a-5 Hologram/MediaArt
// (3D meshes), and 6a-6 HandLayer (Line2) take different shapes. After
// 6a-6 lands, if three of the five layers still share this CanvasTexture
// quad pattern, a focused refactor commit can extract a shared utility.
// Until then, parallel implementations read better.

import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene as ThreeScene,
} from 'three';

import type { Layer, LayerInitContext } from '../Layer.js';

export interface AmbientGlowLayerOptions {
  /** The 2D `<canvas>` whose contents this layer mirrors onto the
   *  SceneGraph. In production this is the canvas owned by
   *  `useAmbientGlow` (rendered behind characters via radial gradient
   *  + per-char fade tracking). The layer holds a reference but never
   *  mutates the source. */
  source: HTMLCanvasElement;
  /** Optional name override (default `'ambient-glow'`). */
  name?: string;
  /** Z position (default `-1`, BELOW StrokeLayer's `0`). See the
   *  Composition contract section in the module header. */
  z?: number;
}

/**
 * AmbientGlowLayer — fullscreen quad that mirrors the legacy
 * `useAmbientGlow` output canvas onto the SceneGraph via `CanvasTexture`.
 * See module-level comment for the design rationale and the §9 R2
 * conservative path justification.
 */
export class AmbientGlowLayer implements Layer {
  // ── Layer interface ─────────────────────────────────────────────────────

  readonly name: string;

  // ── Configuration ───────────────────────────────────────────────────────

  private readonly source: HTMLCanvasElement;
  private readonly z: number;

  // ── Internal state (lazily allocated in init) ───────────────────────────

  private parentScene: ThreeScene | null = null;
  private texture: CanvasTexture | null = null;
  private material: MeshBasicMaterial | null = null;
  private geometry: PlaneGeometry | null = null;
  private mesh: Mesh | null = null;

  /** Idempotency gate. */
  private disposed = false;

  /** Set the moment `init()` completes. */
  private initialized = false;

  // ── Construction ────────────────────────────────────────────────────────

  constructor(opts: AmbientGlowLayerOptions) {
    if (!opts.source) {
      throw new Error('[AmbientGlowLayer] `opts.source` is required');
    }
    this.source = opts.source;
    this.name = opts.name ?? 'ambient-glow';
    this.z = opts.z ?? -1;
  }

  // ── Layer lifecycle ─────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error('[AmbientGlowLayer] cannot init after dispose');
    }
    if (this.initialized) {
      throw new Error('[AmbientGlowLayer] init has already run');
    }

    this.parentScene = ctx.scene;

    // CanvasTexture defaults: flipY=true, colorSpace=SRGB,
    // premultiplyAlpha=false. The ambient source is also an sRGB 2D
    // canvas with a transparent background and pre-multiplied glow
    // pixels, same shape as the stroke / text overlay sources.
    this.texture = new CanvasTexture(this.source);
    this.texture.needsUpdate = true;

    this.material = new MeshBasicMaterial({
      map: this.texture,
      // Transparent: the ambient canvas is mostly empty pixels — only
      // the radial glow regions have non-zero alpha. The SceneGraph
      // clear color shows through the empty regions.
      transparent: true,
      // depthTest/depthWrite disabled: same rationale as the sibling
      // CanvasTexture-quad layers. Three.js's renderer sorts transparent
      // objects by Z (back-to-front) when sortObjects:true (default),
      // so this layer at z=-1 draws BEFORE StrokeLayer at z=0.
      depthTest: false,
      depthWrite: false,
    });

    this.geometry = new PlaneGeometry(ctx.widthCss, ctx.heightCss);

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, this.z);
    this.mesh.frustumCulled = false;
    this.mesh.name = `AmbientGlowLayer:${this.name}`;

    this.parentScene.add(this.mesh);

    this.initialized = true;
  }

  /** Per-frame: invalidate the texture so the GPU re-uploads the source
   *  canvas's latest pixels. Allocation-free (Phase 2 invariant). */
  render(_deltaMs: number): void {
    if (!this.initialized || this.disposed) return;
    if (!this.texture) return;
    this.texture.needsUpdate = true;
  }

  /** Re-sized viewport: rebuild the quad geometry. */
  resize(widthCss: number, heightCss: number, _dpr: number): void {
    if (!this.initialized || this.disposed) return;
    if (!this.mesh || !this.geometry) return;
    if (!Number.isFinite(widthCss) || widthCss <= 0) return;
    if (!Number.isFinite(heightCss) || heightCss <= 0) return;

    this.geometry.dispose();
    this.geometry = new PlaneGeometry(widthCss, heightCss);
    this.mesh.geometry = this.geometry;
  }

  /** Idempotent — releases every Three.js resource the layer allocated. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.parentScene && this.mesh) {
      this.parentScene.remove(this.mesh);
    }
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    this.mesh = null;
    this.parentScene = null;
    this.initialized = false;
  }

  // ── Public diagnostics ──────────────────────────────────────────────────

  /** True after `init()` returns and before `dispose()` runs. */
  isInitialized(): boolean {
    return this.initialized && !this.disposed;
  }

  /** Source canvas reference (read-only — consumers MUST NOT mutate). */
  getSource(): HTMLCanvasElement {
    return this.source;
  }
}
