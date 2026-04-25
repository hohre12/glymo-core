// CanvasMirrorLayer — shared base for the 5 CanvasTexture-quad layers
// (`StrokeLayer` 6a-2, `TextOverlayLayer` 6a-3a, `AmbientGlowLayer` 6a-4a,
// `Hologram3DLayer` 6a-5a, `HandLayer` 6a-6).
//
// Per the 0.27.1 CHANGELOG note (and the prior in-file comments in
// TextOverlayLayer.ts / AmbientGlowLayer.ts that named the extraction
// condition): "if ≥3 of the ≥5 final layers still share this pattern
// after 6a-6, a focused refactor commit will extract a shared
// CanvasMirrorLayer utility." After 6a-6 ALL FIVE layers shared the
// pattern verbatim modulo defaults (name + z + mesh-name-prefix). This
// file is that focused refactor commit's artefact.
//
// Shipped as a separate sub-slice (6b-pre) so the diff is reviewable in
// isolation — bundling it into 6b-1 (the user-visible flag work) would
// mix two concerns. The 5 subclasses' Browser Mode goldens
// (`mirror-A`, `mirror-B`, `text-mirror-magenta`, `text-mirror-yellow`,
// `ambient-mirror-amber`, `ambient-mirror-teal`,
// `hologram-mirror-diamond`, `hologram-mirror-orange`,
// `hand-mirror-skeleton`, `hand-mirror-dot`, plus the 4 step-down
// composite goldens) are the bit-for-bit regression gate — the
// extraction MUST keep them passing unchanged.
//
// Design contract:
//   - Base class `CanvasMirrorLayer` is CONCRETE (not abstract) so it
//     is unit-testable in isolation. Subclasses (`StrokeLayer` etc.)
//     are thin constructor-delegation wrappers that apply class-specific
//     defaults for `name` and `z` and pass through a `logName` for
//     error messages and the diagnostic mesh name.
//   - Each subclass keeps its own `Options` interface so external
//     consumers see the same `import { StrokeLayerOptions } from
//     '@glymo/core/render'` API as before. Public surface is unchanged.
//   - All Three.js wiring (CanvasTexture / MeshBasicMaterial /
//     PlaneGeometry / Mesh / scene add+remove / dispose chain) lives
//     here exactly once.
//
// Per §1.5.4 R-A — public surface is plain TS / DOM types only.
// Per §3 invariant I9 — `dispose()` is idempotent.

import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene as ThreeScene,
} from 'three';

import type { Layer, LayerInitContext } from '../Layer.js';

/**
 * Required init shape for `CanvasMirrorLayer` and every subclass.
 * Subclasses fill in `name`, `z`, and `logName` defaults from their own
 * Options interface (which keeps `name` / `z` optional for ergonomics).
 *
 * `logName` is the bracketed prefix used in error messages and the
 * diagnostic Three.js mesh name (`<logName>:<name>`). Subclasses pass
 * their own class name verbatim; CanvasMirrorLayer never inspects it
 * beyond formatting.
 */
export interface CanvasMirrorLayerInit {
  source: HTMLCanvasElement;
  name: string;
  z: number;
  logName: string;
}

/**
 * Concrete base for any layer that wants to mirror an HTMLCanvasElement
 * onto the SceneGraph as a fullscreen `CanvasTexture` quad. See the
 * module-level comment for the §6b-pre extraction rationale.
 */
export class CanvasMirrorLayer implements Layer {
  // ── Layer interface ─────────────────────────────────────────────────────

  readonly name: string;

  // ── Configuration (immutable once constructed) ──────────────────────────

  protected readonly source: HTMLCanvasElement;
  protected readonly z: number;
  protected readonly logName: string;

  // ── Internal state (lazily allocated in init) ───────────────────────────

  protected parentScene: ThreeScene | null = null;
  protected texture: CanvasTexture | null = null;
  protected material: MeshBasicMaterial | null = null;
  protected geometry: PlaneGeometry | null = null;
  protected mesh: Mesh | null = null;

  /** Idempotency gate. */
  protected disposed = false;

  /** Set the moment `init()` completes. */
  protected initialized = false;

  // ── Construction ────────────────────────────────────────────────────────

  constructor(opts: CanvasMirrorLayerInit) {
    if (!opts.source) {
      throw new Error(`[${opts.logName}] \`opts.source\` is required`);
    }
    this.source = opts.source;
    this.name = opts.name;
    this.z = opts.z;
    this.logName = opts.logName;
  }

  // ── Layer lifecycle ─────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error(`[${this.logName}] cannot init after dispose`);
    }
    if (this.initialized) {
      throw new Error(`[${this.logName}] init has already run`);
    }

    this.parentScene = ctx.scene;

    // CanvasTexture defaults: flipY=true (correct for 2D / WebGPU canvas
    // → GPU axis), colorSpace=SRGBColorSpace, premultiplyAlpha=false.
    // These are the right values for sRGB browser canvases regardless
    // of the source canvas's underlying context type.
    this.texture = new CanvasTexture(this.source);
    this.texture.needsUpdate = true;

    this.material = new MeshBasicMaterial({
      map: this.texture,
      // Transparent: the source canvas leaves alpha=0 wherever its
      // own renderer (CanvasRenderer / TextOverlayCanvas /
      // useAmbientGlow / Hologram3DRenderer / HandVisualizer) did not
      // draw. The SceneGraph clear color and lower-Z layers must show
      // through those regions.
      transparent: true,
      // depthTest/depthWrite disabled: Three.js's renderer sorts
      // transparent objects by Z (back-to-front) when sortObjects:true
      // (default), so insertion-order + Z determines the composite
      // order; depth comparison would fight the Z sort on coplanar
      // fullscreen quads.
      depthTest: false,
      depthWrite: false,
    });

    this.geometry = new PlaneGeometry(ctx.widthCss, ctx.heightCss);

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, this.z);
    this.mesh.frustumCulled = false; // always in view by definition
    this.mesh.name = `${this.logName}:${this.name}`;

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

  /** Re-sized viewport: rebuild the quad geometry. PlaneGeometry has no
   *  runtime resize; dispose + reallocate is the canonical pattern. */
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
