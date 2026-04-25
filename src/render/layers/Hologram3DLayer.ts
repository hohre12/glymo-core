// Hologram3DLayer — Phase 6 sub-slice 6a-5a first cut.
//
// Per `docs/plans/rendering-pipeline-v2.md` §5 Package role realignment:
//
//   `@glymo/ui/canvas/hooks/useHologram3D.ts` (RAF + getBoundingClientRect)
//     → `@glymo/core/src/render/layers/HologramLayer.ts`
//        — Promotes hologram from "one-off layer" to the master scene's
//          child. Removes per-frame `getBoundingClientRect`. Phase 6
//          ALSO splits out `layers/MediaArtLayer.ts` from the mesh-slot
//          half of `Hologram3DRenderer` — required by invariant I10
//          (Issue #3 coexistence gate).
//
// AND per §3 invariant I10 ("MediaArt + text-mode hologram coexistence
// is restored"). The invariant's MUST clause requires splitting
// `Hologram3DRenderer` into a HologramLayer (text-mode chars) + a
// MediaArtLayer (mesh slots) so the I10 early-return disappears.
//
// ── 6a-5a vs 6a-5b — the literal split deferral ─────────────────────────
//
// I10's user-visible promise — "the typed glyph DOES lift into 3D after
// MediaArt is applied" — is delivered IN FULL by sub-slice 6a-5a's
// dropping of the early-return inside `Hologram3DRenderer.renderFrame`
// (see the in-place rewrite in that file's `renderFrame` body).
//
// I10's structural promise — TWO layers (HologramLayer + MediaArtLayer)
// with their own renderers / scene contexts — is genuinely a from-
// scratch architectural job:
//   - `Hologram3DRenderer` owns ONE `WebGPURenderer` + ONE `Scene` + ONE
//     `PerspectiveCamera`. The two prospective sublayers would each need
//     their own renderer, OR a single renderer with two `RenderTarget`s
//     captured separately, OR a complete migration to SceneGraph's
//     `OrthographicCamera` (rewriting the perspective-frustum math the
//     existing renderer leans on for 3D char extrusion + mesh
//     placement). All three are multi-day jobs; the §9 R2 fallback
//     ("keep CPU physics and only replace the render call") applies
//     directly here.
//
// 6a-5a (this slice): the user-visible I10 fix lands AND a single
// `Hologram3DLayer` wraps the entire `Hologram3DRenderer` output canvas
// onto the SceneGraph as a `CanvasTexture` quad — same proven pattern
// as `StrokeLayer` (6a-2), `TextOverlayLayer` (6a-3a), `AmbientGlowLayer`
// (6a-4a). The wrapper is intentionally named after the source class
// (`Hologram3DRenderer` → `Hologram3DLayer`) so its R2-conservative
// nature is unambiguous in the consumer call-site.
//
// 6a-5b (deferred, scope-locked): true `HologramLayer` + `MediaArtLayer`
// split per I10's literal text. Acceptance prerequisites:
//   1. Decision on camera ownership (per-layer renderers vs shared
//      OrthographicCamera with rewritten frustum math vs RenderTarget
//      multi-pass). Each option has a multi-day cost profile —
//      `glymo-architect` review required before kickoff.
//   2. Parity gate: the new split must produce visually equivalent
//      output to the post-6a-5a unified renderer for the canonical
//      scenarios (text-only, mesh-only, mesh+text coexistence). Browser
//      Mode regression goldens for each scenario provide the diff
//      surface.
//   3. Migration of `useHologram3D.ts`, `useHologramController.ts`, and
//      every consumer of `Hologram3DRenderer` to the split surfaces.
//
// Until 6a-5b lands, `Hologram3DLayer` is the canonical Phase 6 entry
// for hologram + mediaArt content composition into the SceneGraph.
//
// ── Composition contract ───────────────────────────────────────────────
//
// `Hologram3DLayer`'s default `z = 2` is ABOVE `TextOverlayLayer`'s
// default `z = 1`, matching the legacy Compositor stacking order in
// `@glymo/ui/canvas/lib/Compositor.ts` where `addLayer({ id: 'webgpu' })`
// (the hologram WebGPU canvas) is added AFTER the drawing + overlay
// layers. Both `transparent: true` + `depthTest: false` so the SceneGraph
// renderer sorts back-to-front by Z.
//
// Per §1.5.4 R-A — public surface deals only in plain types
// (`HTMLCanvasElement`, primitives, the `Layer` interface). Three.js
// types appear inside the implementation only.
//
// Per §3 invariant I9 — `dispose()` is idempotent.

import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene as ThreeScene,
} from 'three';

import type { Layer, LayerInitContext } from '../Layer.js';

export interface Hologram3DLayerOptions {
  /** The output `<canvas>` of an existing `Hologram3DRenderer`
   *  instance. The Layer holds a reference but never mutates the source.
   *  In production this canvas is the same one passed to
   *  `new Hologram3DRenderer({ canvas, ... })` — `Hologram3DLayer`
   *  composites its WebGPU output onto the SceneGraph by reading from
   *  the same DOM canvas. */
  source: HTMLCanvasElement;
  /** Optional name override (default `'hologram-3d'`). */
  name?: string;
  /** Z position (default `2`, ABOVE TextOverlayLayer's `1`). */
  z?: number;
}

/**
 * Hologram3DLayer — fullscreen quad that mirrors the legacy
 * `Hologram3DRenderer` output (post-6a-5a unified mesh + char
 * coexistence) onto the SceneGraph via `CanvasTexture`. See module-level
 * comment for the design rationale and the 6a-5b literal-split deferral.
 */
export class Hologram3DLayer implements Layer {
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

  constructor(opts: Hologram3DLayerOptions) {
    if (!opts.source) {
      throw new Error('[Hologram3DLayer] `opts.source` is required');
    }
    this.source = opts.source;
    this.name = opts.name ?? 'hologram-3d';
    this.z = opts.z ?? 2;
  }

  // ── Layer lifecycle ─────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error('[Hologram3DLayer] cannot init after dispose');
    }
    if (this.initialized) {
      throw new Error('[Hologram3DLayer] init has already run');
    }

    this.parentScene = ctx.scene;

    // CanvasTexture defaults: flipY=true, colorSpace=SRGB,
    // premultiplyAlpha=false. The Hologram3DRenderer source IS a WebGPU
    // canvas (not a plain 2D canvas like Stroke / TextOverlay / Ambient
    // sources), but `CanvasTexture` accepts `HTMLCanvasElement` regardless
    // of the canvas's underlying context type. The browser handles the
    // pixel readback via the canvas's drawing buffer.
    this.texture = new CanvasTexture(this.source);
    this.texture.needsUpdate = true;

    this.material = new MeshBasicMaterial({
      map: this.texture,
      // Transparent: the Hologram3DRenderer fills only the regions
      // occupied by 3D char meshes + mesh-slot meshes; the rest of its
      // canvas stays at clearColor alpha=0 (set explicitly via
      // `renderer.setClearColor(0x000000, 0)` inside Hologram3DRenderer).
      // The TextOverlayLayer (z=1) and below show through transparent
      // pixels.
      transparent: true,
      // depthTest/depthWrite disabled: same rationale as the sibling
      // CanvasTexture-quad layers. Three.js's renderer sorts transparent
      // objects by Z (back-to-front) when sortObjects:true (default),
      // so this layer at z=2 draws AFTER TextOverlayLayer at z=1.
      depthTest: false,
      depthWrite: false,
    });

    this.geometry = new PlaneGeometry(ctx.widthCss, ctx.heightCss);

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, this.z);
    this.mesh.frustumCulled = false;
    this.mesh.name = `Hologram3DLayer:${this.name}`;

    this.parentScene.add(this.mesh);

    this.initialized = true;
  }

  /** Per-frame: mark the texture as dirty so the GPU re-uploads the
   *  source canvas's latest pixels. The Hologram3DRenderer should run
   *  its `renderFrame()` BEFORE this layer's `render()` so the texture
   *  picks up the latest 3D content; the SceneGraph's render-phase
   *  ordering (insertion order = render order across `addLayer`) handles
   *  that when the consumer sequences correctly. */
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
