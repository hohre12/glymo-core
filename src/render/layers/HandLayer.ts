// HandLayer — Phase 6 sub-slice 6a-6 first cut.
//
// Per `docs/plans/rendering-pipeline-v2.md` §4.1 Target architecture
// diagram:
//
//   ├─ HandLayer        (Line2 from mediapipe landmarks)
//
// AND per §6 Phase 6 sub-task 6a Scope ("Add `layers/HandLayer.ts`").
//
// AND per §9 R2 mitigation. Same R2 conservative-path rationale as the
// previous 6a layer slices applies here: `HandVisualizer`
// (`@glymo/core/src/input/HandVisualizer.ts`) draws hand-skeleton
// landmarks onto a dedicated 2D canvas (`skeletonCanvasRef` in
// `CanvasEngine.tsx`). The plan envisions migrating this rendering to
// Three.js's `Line2` from `examples/jsm/lines/` (GPU-resident line
// geometry with per-vertex thickness), but doing the migration WHILE
// architecturally moving the renderer would create exactly the
// divergence risk §9 R2 names.
//
// Instead, this layer mirrors the existing skeleton canvas onto the
// SceneGraph as a `CanvasTexture` quad — same proven pattern as
// `StrokeLayer` (6a-2), `TextOverlayLayer` (6a-3a), `AmbientGlowLayer`
// (6a-4a), `Hologram3DLayer` (6a-5a) — at z=3 so it composites above
// `Hologram3DLayer`'s z=2.
//
// Sub-slice 6a-6b (deferred): true `Line2`-based hand rendering.
// Acceptance prerequisites:
//   1. Reference fixture: `HandVisualizer` output for a known set of
//      MediaPipe landmark coordinates; capture as the parity baseline.
//   2. New `HandLayer` implementation using `Line2` +
//      `LineSegments2` from `three/examples/jsm/lines/`.
//   3. Side-by-side run on the fixture; assert
//      `maxDiffPixelRatio: 0.005` against the legacy 2D output. Per
//      §9 R2 the fallback is "keep the 2D canvas chain and only
//      replace the render call" — i.e. this very slice's shape — if
//      the parity gate is impractical to satisfy. The `Line2` upgrade
//      is opt-in.
//
// ── Composition contract ───────────────────────────────────────────────
//
// `HandLayer`'s default `z = 3` is ABOVE `Hologram3DLayer`'s default
// `z = 2`. Hand visualisation is a UI overlay — it must remain visible
// on top of every content surface (strokes, text, hologram chars,
// MediaArt meshes) so the user always sees where their hand is. Both
// `transparent: true` + `depthTest: false` so the SceneGraph renderer
// sorts back-to-front by Z.
//
// Per §1.5.4 R-A — public surface is plain TS / DOM types only. Per §3
// invariant I9 — `dispose()` is idempotent.

import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene as ThreeScene,
} from 'three';

import type { Layer, LayerInitContext } from '../Layer.js';

export interface HandLayerOptions {
  /** The 2D `<canvas>` whose contents this layer mirrors onto the
   *  SceneGraph. In production this is the canvas owned by
   *  `HandVisualizer` (drawing MediaPipe Hands landmarks +
   *  inter-landmark connectors via 2D Canvas calls). The layer holds
   *  a reference but never mutates the source. */
  source: HTMLCanvasElement;
  /** Optional name override (default `'hand'`). */
  name?: string;
  /** Z position (default `3`, ABOVE Hologram3DLayer's `2`). See the
   *  Composition contract section in the module header. */
  z?: number;
}

/**
 * HandLayer — fullscreen quad that mirrors the legacy `HandVisualizer`
 * output (MediaPipe Hands landmarks rendered on a 2D canvas) onto the
 * SceneGraph via `CanvasTexture`. See module-level comment for the §9
 * R2 conservative path justification and the deferred `Line2` upgrade
 * (sub-slice 6a-6b).
 */
export class HandLayer implements Layer {
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

  constructor(opts: HandLayerOptions) {
    if (!opts.source) {
      throw new Error('[HandLayer] `opts.source` is required');
    }
    this.source = opts.source;
    this.name = opts.name ?? 'hand';
    this.z = opts.z ?? 3;
  }

  // ── Layer lifecycle ─────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error('[HandLayer] cannot init after dispose');
    }
    if (this.initialized) {
      throw new Error('[HandLayer] init has already run');
    }

    this.parentScene = ctx.scene;

    // CanvasTexture defaults: flipY=true, colorSpace=SRGB,
    // premultiplyAlpha=false. The skeleton source is also an sRGB 2D
    // canvas with a transparent background and pre-multiplied skeleton
    // pixels (HandVisualizer.draw uses `clearRect` then strokes/fills).
    this.texture = new CanvasTexture(this.source);
    this.texture.needsUpdate = true;

    this.material = new MeshBasicMaterial({
      map: this.texture,
      // Transparent: the skeleton canvas is mostly empty pixels — only
      // the rendered landmarks + connectors have non-zero alpha. Every
      // layer below this z=3 must show through everywhere the hand
      // skeleton is absent.
      transparent: true,
      // depthTest/depthWrite disabled: same rationale as the sibling
      // CanvasTexture-quad layers. Three.js's renderer sorts transparent
      // objects by Z (back-to-front) when sortObjects:true (default),
      // so this layer at z=3 draws AFTER Hologram3DLayer at z=2.
      depthTest: false,
      depthWrite: false,
    });

    this.geometry = new PlaneGeometry(ctx.widthCss, ctx.heightCss);

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, this.z);
    this.mesh.frustumCulled = false;
    this.mesh.name = `HandLayer:${this.name}`;

    this.parentScene.add(this.mesh);

    this.initialized = true;
  }

  /** Per-frame: mark the texture as dirty so the GPU re-uploads the
   *  source canvas's latest pixels (the new MediaPipe landmark frame).
   *  Allocation-free (Phase 2 invariant). */
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
