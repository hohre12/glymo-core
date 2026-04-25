// TextOverlayLayer — Phase 6 sub-slice 6a-3 first cut.
//
// Per `docs/plans/rendering-pipeline-v2.md` §5 Package role realignment:
//
//   `@glymo/ui/canvas/components/TextOverlayCanvas.tsx`
//     → render logic → `@glymo/core/src/render/layers/TextOverlayLayer.ts`
//        (InstancedMesh, GPU particles); UI shell stays (no RAF)
//
// AND per §9 R2 mitigation:
//
//   "If divergent, keep CPU physics and only replace the render call
//    (still a major win — no per-frame ctx.beginPath)."
//
// This sub-slice (6a-3a) takes the §9 R2 conservative path — the
// substantial CPU physics in `TextOverlayCanvas.tsx` (1097 LOC, ~290 of
// per-particle physics, layout transitions, hand-repulsion, eraser
// masks, transit sparkles, morph particles, etc.) STAYS in place.
// Migrating it to TSL InstancedMesh while simultaneously moving the
// renderer architecturally would create exactly the divergence risk
// §9 R2 names. Instead, this layer mirrors the existing TextOverlayCanvas
// output canvas onto the SceneGraph as a `CanvasTexture` quad — same
// proven pattern as `StrokeLayer` (6a-2) — at a higher Z so it
// composites ON TOP of strokes.
//
// The TSL InstancedMesh upgrade is an explicitly separate sub-slice
// (6a-3b, deferred) that lands AFTER:
//   1. A glyph-centroid parity fixture exists in glymo-ui Browser Mode.
//   2. The fixture proves the CPU physics output is reproducible
//      bit-for-bit across two consecutive runs of the existing canvas.
//   3. The TSL implementation can then be parity-checked against that
//      fixture per §9 R2 ("glyph centroid position match within 1 px MSE
//      against the CPU reference").
// Until those land, the conservative R2 path is the canonical Phase 6
// shape for the text overlay surface.
//
// ── Composition contract ───────────────────────────────────────────────
//
// TextOverlayLayer's default `z = 1` is ABOVE `StrokeLayer`'s default
// `z = 0`. Both layers run with `transparent: true` + `depthTest: false`,
// so Three.js's renderer sorts them back-to-front by Z (lower Z first,
// higher Z drawn over). This matches the legacy Compositor stacking
// order in `@glymo/ui/canvas/lib/Compositor.ts` where `addLayer({ id:
// 'drawing' })` runs before `addLayer({ id: 'overlay' })`.
//
// Future layers should set their default Z relative to this baseline:
//   - AmbientGlowLayer        z = -1   (background)
//   - StrokeLayer             z =  0   (drawing surface)
//   - TextOverlayLayer        z =  1   (text composites on top)
//   - HandLayer / Hologram    z >= 2   (UI overlays)
//   - PostProcessLayer        N/A      (post-process pass, not Z-stacked)
//
// ── Why not extract a shared `CanvasMirrorLayer` base class ───────────
//
// 6a-2 (StrokeLayer) and 6a-3 (this) both wrap an HTMLCanvasElement as
// a CanvasTexture quad. The implementations are nearly identical, only
// the defaults (name + z) differ. Premature extraction (a base class,
// or a generic `CanvasQuadLayer`) would lock us into a shape we don't
// yet fully understand:
//   - 6a-3b will replace this layer's INTERNALS with InstancedMesh + TSL
//     (no longer a CanvasTexture quad). A shared base would make that
//     migration painful.
//   - 6a-4 AmbientGlowLayer is a post-process pass, not a quad.
//   - 6a-5 Hologram / MediaArt are 3D mesh layers.
//   - 6a-6 HandLayer is a Line2 mesh.
// None of these share the StrokeLayer/TextOverlayLayer pattern wholesale.
// Each layer being a small, self-contained class with explicit named
// responsibility reads better than a single generic base + N
// subclasses. Refactor when the duplication actively hurts; not before.
//
// Per §1.5.4 R-A — public surface deals only in plain types
// (`HTMLCanvasElement`, primitives, the `Layer` interface from
// `../Layer.js`). Three.js types appear inside the implementation only.
// Static `from 'three'` imports are SSR-safe (vanilla three has no
// module-load global access) — same justification as StrokeLayer.
//
// Per §3 invariant I9 — `init`/`dispose` form a balanced pair;
// `dispose()` is idempotent (Strict Mode double-cleanup safety).

import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene as ThreeScene,
} from 'three';

import type { Layer, LayerInitContext } from '../Layer.js';

export interface TextOverlayLayerOptions {
  /** The 2D `<canvas>` whose contents this layer mirrors onto the SceneGraph.
   *  In production this is the canvas owned by
   *  `@glymo/ui/canvas/components/TextOverlayCanvas.tsx` exposed via its
   *  `onCanvasReady(canvas)` callback (see CanvasEngine.tsx:2659).
   *  TextOverlayLayer holds a reference but never mutates the source. */
  source: HTMLCanvasElement;
  /** Optional name override for the Layer registry (default
   *  `'text-overlay'`). Useful if a future composition needs more than
   *  one text-style layer (e.g. ko + en split, or selected halo
   *  separated from glyph body). */
  name?: string;
  /** Z position of the quad inside the orthographic frustum. Default
   *  `1` — ABOVE `StrokeLayer`'s default `0`, so text composites on top.
   *  See "Composition contract" section in the module header for the
   *  full Z stack. */
  z?: number;
}

/**
 * TextOverlayLayer — fullscreen quad that mirrors the legacy
 * `TextOverlayCanvas` output (CPU physics + 2D draw) onto the SceneGraph
 * via `CanvasTexture`. See module-level comment for the full design
 * rationale, the §9 R2 conservative path justification, and the deferred
 * TSL InstancedMesh upgrade contract (sub-slice 6a-3b).
 */
export class TextOverlayLayer implements Layer {
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

  /** Set the moment `dispose()` runs the first time. Idempotency gate. */
  private disposed = false;

  /** Set the moment `init()` completes. */
  private initialized = false;

  // ── Construction ────────────────────────────────────────────────────────

  constructor(opts: TextOverlayLayerOptions) {
    if (!opts.source) {
      throw new Error('[TextOverlayLayer] `opts.source` is required');
    }
    this.source = opts.source;
    this.name = opts.name ?? 'text-overlay';
    this.z = opts.z ?? 1;
  }

  // ── Layer lifecycle ─────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error('[TextOverlayLayer] cannot init after dispose');
    }
    if (this.initialized) {
      throw new Error('[TextOverlayLayer] init has already run');
    }

    this.parentScene = ctx.scene;

    // Same CanvasTexture defaults as StrokeLayer — flipY=true (correct
    // for 2D canvas → GPU axis), colorSpace=SRGBColorSpace,
    // premultiplyAlpha=false. The TextOverlay source is also an sRGB 2D
    // canvas so the same defaults apply.
    this.texture = new CanvasTexture(this.source);
    this.texture.needsUpdate = true;

    this.material = new MeshBasicMaterial({
      map: this.texture,
      // Transparent: the text overlay canvas is mostly empty pixels —
      // only the rendered glyphs and particles have non-zero alpha. The
      // StrokeLayer (z=0) below MUST show through in those empty regions.
      transparent: true,
      // depthTest/depthWrite disabled: same rationale as StrokeLayer.
      // Three.js's renderer sorts transparent objects by Z (back-to-front)
      // when sortObjects:true (default), so this layer at z=1 draws AFTER
      // StrokeLayer at z=0 and composites on top.
      depthTest: false,
      depthWrite: false,
    });

    this.geometry = new PlaneGeometry(ctx.widthCss, ctx.heightCss);

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, this.z);
    this.mesh.frustumCulled = false;
    this.mesh.name = `TextOverlayLayer:${this.name}`;

    this.parentScene.add(this.mesh);

    this.initialized = true;
  }

  /** Per-frame: mark the texture as dirty so the GPU re-uploads the
   *  source canvas's latest pixels. Cheap (a flag flip); the upload
   *  happens once per frame inside `WebGPURenderer.render`. */
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
