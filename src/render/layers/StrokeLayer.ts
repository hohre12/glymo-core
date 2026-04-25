// StrokeLayer — Phase 6 sub-slice 6a-2 first-pass concrete layer.
//
// Per `docs/plans/rendering-pipeline-v2.md` §6 Phase 6 / Sub-task 6a Scope:
//
//   "StrokeLayer first pass: render the existing 2D stroke canvas content
//    into an OrthographicCamera quad via CanvasTexture. This preserves the
//    existing CanvasRenderer output bit-for-bit — the stroke pixels are
//    identical; only the compositing path changes."
//
// Architecture intent: the legacy `CanvasRenderer` (a 2D Canvas renderer
// that owns the actual stroke pixel work — Capture → Stabilize → Pressure
// → Segment → Smooth → Effect from the 6-stage pipeline) keeps producing
// pixels onto its existing offscreen 2D `<canvas>`. StrokeLayer wraps that
// canvas as a Three.js `CanvasTexture`, mounts it on a fullscreen quad
// inside the SceneGraph, and the per-frame `render()` invalidates the
// texture so the GPU re-uploads the latest 2D content.
//
// This is a deliberately narrow first cut — it does NOT replace the 2D
// stroke renderer. It moves the COMPOSITING from a CPU-side `drawImage`
// in `@glymo/ui/canvas/lib/Compositor.ts` into a GPU-side single
// fullscreen quad inside the master scene graph. Future sub-slices may
// migrate stroke rendering itself onto a TSL shader (R1 in §9 risks),
// but the contract today is "no pixel change".
//
// Why a fullscreen plane (not a screen-space sprite, not raw shader pass):
//   - The orthographic camera convention in `SceneGraph` is "1 world unit
//     = 1 CSS pixel" with the frustum centred at origin. A `PlaneGeometry`
//     sized to (widthCss, heightCss) at z=0 covers the full viewport
//     exactly. Texture coordinates default to (0,0)–(1,1) over the plane;
//     `CanvasTexture` defaults to `flipY: true` (correct for canvas →
//     texture). No shader required — `MeshBasicMaterial` with `map: tex`
//     is the canonical Three.js pattern.
//   - Future PostProcess passes (6a-4) compose over this layer's output;
//     keeping the stroke quad as a regular scene child means it
//     participates in any RenderTarget chain Three.js sets up.
//
// Per §1.5.4 R-A — public surface deals only in plain types
// (`HTMLCanvasElement`, the `Layer` interface from `./Layer.js`). Three.js
// types appear inside the implementation only. Static `from 'three'`
// imports are SSR-safe because vanilla three (NOT three/webgpu) does not
// touch globals at module load; consumers wrap any call into this layer
// inside a `'use client'` React boundary anyway.
//
// Per §3 invariant I9 — every resource allocated in `init()` (texture,
// geometry, material, mesh) is released in `dispose()`. `dispose()` is
// idempotent; calling it after the layer is already removed from the
// scene is a no-op on the second call. Strict Mode double-mount safety
// is the responsibility of the consumer (the React effect's cleanup must
// call `removeLayer(name)` once per mount); this layer trusts that
// contract — same as every other Layer.

import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene as ThreeScene,
} from 'three';

import type { Layer, LayerInitContext } from '../Layer.js';

export interface StrokeLayerOptions {
  /** The 2D `<canvas>` whose contents this layer mirrors onto the SceneGraph.
   *  Owned by the consumer (typically the legacy `CanvasRenderer` from
   *  `@glymo/core/src/render/CanvasRenderer.ts`); StrokeLayer holds a
   *  reference but never mutates the source. */
  source: HTMLCanvasElement;
  /** Optional name override for the Layer registry (default `'stroke'`).
   *  Useful if a future scene-graph composition needs more than one
   *  stroke-style layer (e.g. preview vs committed). */
  name?: string;
  /** Z position of the quad inside the orthographic frustum. Default
   *  `0`. Layers stacked above the stroke layer (TextOverlay /
   *  AmbientGlow / Hologram / MediaArt / Hand) use larger Z so they
   *  composite ON TOP of the stroke output without depth-test fights. */
  z?: number;
}

/**
 * StrokeLayer — fullscreen quad that mirrors a 2D source canvas onto the
 * SceneGraph via `CanvasTexture`. See module-level comment for the design
 * rationale.
 */
export class StrokeLayer implements Layer {
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

  /** Set the moment `init()` completes. Guards `render`/`resize` from
   *  acting before the scene subtree exists. */
  private initialized = false;

  // ── Construction ────────────────────────────────────────────────────────

  constructor(opts: StrokeLayerOptions) {
    if (!opts.source) {
      throw new Error('[StrokeLayer] `opts.source` is required');
    }
    this.source = opts.source;
    this.name = opts.name ?? 'stroke';
    this.z = opts.z ?? 0;
  }

  // ── Layer lifecycle ─────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error('[StrokeLayer] cannot init after dispose');
    }
    if (this.initialized) {
      // Re-init is not supported — the SceneGraph contract is one-init per
      // layer instance, mirroring how `Hologram3DRenderer.init` is gated.
      throw new Error('[StrokeLayer] init has already run');
    }

    this.parentScene = ctx.scene;

    // CanvasTexture defaults: flipY=true (correct for canvas → GPU texture
    // axis), colorSpace=SRGBColorSpace, premultiplyAlpha=false. These are
    // the right values for an sRGB 2D canvas source — DO NOT override
    // unless the source canvas uses a different color space.
    this.texture = new CanvasTexture(this.source);
    // Mark dirty immediately so the first render() upload picks up the
    // current source contents — the texture constructor schedules an
    // initial upload but in some browsers the source canvas may not have
    // been painted yet at construction time.
    this.texture.needsUpdate = true;

    this.material = new MeshBasicMaterial({
      map: this.texture,
      // The stroke layer is the BOTTOM of the scene; transparent pixels
      // in the source canvas (everywhere strokes haven't been drawn) must
      // let the SceneGraph clear color show through. Without `transparent:
      // true` Three.js draws fully opaque alpha=1 even for source alpha=0.
      transparent: true,
      // Disable depth test/write — fullscreen quads at z=0 don't need to
      // compete with each other; layers above set higher Z and write to
      // depth themselves if needed (e.g. Hologram3D meshes).
      depthTest: false,
      depthWrite: false,
    });

    this.geometry = new PlaneGeometry(ctx.widthCss, ctx.heightCss);

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, this.z);
    this.mesh.frustumCulled = false; // we know it's always in view
    this.mesh.name = `StrokeLayer:${this.name}`;

    this.parentScene.add(this.mesh);

    this.initialized = true;
  }

  /** Per-frame: tell Three.js to re-upload the source canvas contents to
   *  the GPU texture. Cheap (a flag flip); the upload itself happens once
   *  per frame inside `WebGPURenderer.render` when the texture is bound.
   *  No allocations — Phase 2 hot-path invariant satisfied. */
  render(_deltaMs: number): void {
    if (!this.initialized || this.disposed) return;
    if (!this.texture) return;
    this.texture.needsUpdate = true;
  }

  /** Re-sized viewport: rebuild the quad geometry to the new CSS-pixel
   *  bounds. `PlaneGeometry` does not expose a runtime resize, so we
   *  dispose the old geometry and allocate a new one. This runs O(once
   *  per ResizeObserver event), not per-frame. */
  resize(widthCss: number, heightCss: number, _dpr: number): void {
    if (!this.initialized || this.disposed) return;
    if (!this.mesh || !this.geometry) return;
    if (!Number.isFinite(widthCss) || widthCss <= 0) return;
    if (!Number.isFinite(heightCss) || heightCss <= 0) return;

    this.geometry.dispose();
    this.geometry = new PlaneGeometry(widthCss, heightCss);
    this.mesh.geometry = this.geometry;
  }

  /** Idempotent — releases every Three.js resource the layer allocated.
   *  Removes the mesh from the parent scene first so subsequent renders
   *  do not see a stale child reference. */
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

  /** Source canvas reference (read-only — consumers MUST NOT mutate this
   *  through the getter; mutate the source they own instead). */
  getSource(): HTMLCanvasElement {
    return this.source;
  }
}
