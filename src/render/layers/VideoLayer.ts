// VideoLayer — Phase 6 sub-slice 6b-5 first cut.
//
// Camera background — wraps an `HTMLVideoElement` (the live MediaPipe /
// `getUserMedia()` video stream that backs the legacy Compositor's
// `'video'` layer per `CanvasEngine.tsx` 2315-2330) as a Three.js
// `VideoTexture` mounted on a fullscreen quad inside the SceneGraph.
//
// Phase 6 6b-1+6b-2 wired the 5 CanvasMirrorLayer subclasses (Stroke /
// TextOverlay / AmbientGlow / Hologram3D / Hand) to the SceneGraph but
// missed the camera background — the legacy Compositor adds a 'video'
// layer when `camera:ready` fires, but the renderV2 path did not have
// an equivalent. Visible regression: camera mode renders with a black
// background instead of the live camera feed. This file is the fix.
//
// `VideoTexture` differs from `CanvasTexture` in one key way: the
// browser auto-uploads the latest video frame on every render call —
// no explicit `needsUpdate = true` is required. The render() method
// is therefore a no-op (the Layer interface still requires it for
// uniformity).
//
// ── Composition contract ───────────────────────────────────────────────
//
// VideoLayer's default `z = -2` is BELOW AmbientGlowLayer's `z = -1` —
// the camera feed is the absolute background of the SceneGraph stack.
// Both `transparent: false` (the video frame is fully opaque) and
// `depthTest: false`. Three.js's renderer sorts transparent objects by
// Z (back-to-front) when sortObjects:true (default), so this layer at
// z=-2 draws BEFORE every CanvasMirrorLayer subclass.
//
// Per §1.5.4 R-A — public surface is plain TS / DOM types only. Per §3
// invariant I9 — `dispose()` is idempotent.

import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  VideoTexture,
  type Scene as ThreeScene,
} from 'three';

import type { Layer, LayerInitContext } from '../Layer.js';

export interface VideoLayerOptions {
  /** The `<video>` element whose frames this layer mirrors onto the
   *  SceneGraph. In production this is the element returned by
   *  `glymo.getCameraVideoElement()` once `camera:ready` fires. The
   *  Layer holds a reference but never mutates the source — the video
   *  element's `srcObject` is owned by the camera capture pipeline. */
  source: HTMLVideoElement;
  /** Optional name override (default `'video'`). */
  name?: string;
  /** Z position (default `-2` — BELOW AmbientGlowLayer's `z = -1`;
   *  the absolute background of the SceneGraph stack). */
  z?: number;
  /** Per-layer opacity 0..1 (default `1`). Used to mirror the legacy
   *  Compositor's `opacity: 0.3` for the camera background — the soft
   *  ghosted feel that lets strokes/text/glow read on top of the live
   *  feed. Setting < 1 forces `transparent: true` on the underlying
   *  material so blending works correctly. */
  opacity?: number;
  /** When `true`, horizontally flips the video frame (default `true`).
   *  Mirrors the legacy Compositor's `videoPreprocess.mirror: true` —
   *  selfie-view convention so the user's right hand appears on
   *  screen-right. Achieved via `mesh.scale.x = -1` (free; no shader). */
  mirror?: boolean;
  /**
   * Deferred features (legacy Compositor parity gaps tracked for a
   * follow-up sub-slice; not yet supported by VideoLayer):
   *   - `blur: 6` (legacy `videoPreprocess.blur`) — soft defocus that
   *     puts strokes/text in front. Requires a TSL blur shader pass.
   *     Tracked alongside 6a-4b PostProcessLayer.
   *   - `object-cover` crop scaling (legacy
   *     `Compositor.ts:276-282`'s `scale = max(w/vw, h/vh)` + crop
   *     fill). Requires UV remap on the PlaneGeometry. Tracked as
   *     6b-6b VideoLayer enhancements.
   * Until both ship, the camera feed renders pin-sharp at the
   * texture's native AR (potential horizontal stretch / vertical
   * letterbox on mismatched canvas/webcam aspect ratios). The legacy
   * Compositor codepath is unaffected — `renderV2 = false` (default)
   * keeps the soft + cropped behaviour.
   */
}

/**
 * VideoLayer — fullscreen quad that mirrors a live `<video>` element
 * (the camera stream) onto the SceneGraph via `VideoTexture`. The
 * camera background of the renderV2 codepath.
 */
export class VideoLayer implements Layer {
  // ── Layer interface ─────────────────────────────────────────────────────

  readonly name: string;

  // ── Configuration ───────────────────────────────────────────────────────

  private readonly source: HTMLVideoElement;
  private readonly z: number;
  private readonly opacity: number;
  private readonly mirror: boolean;

  // ── Internal state (lazily allocated in init) ───────────────────────────

  private parentScene: ThreeScene | null = null;
  private texture: VideoTexture | null = null;
  private material: MeshBasicMaterial | null = null;
  private geometry: PlaneGeometry | null = null;
  private mesh: Mesh | null = null;

  /** Idempotency gate. */
  private disposed = false;

  /** Set the moment `init()` completes. */
  private initialized = false;

  // ── Construction ────────────────────────────────────────────────────────

  constructor(opts: VideoLayerOptions) {
    if (!opts.source) {
      throw new Error('[VideoLayer] `opts.source` is required');
    }
    this.source = opts.source;
    this.name = opts.name ?? 'video';
    this.z = opts.z ?? -2;
    this.opacity = opts.opacity ?? 1;
    this.mirror = opts.mirror ?? true;
  }

  // ── Layer lifecycle ─────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error('[VideoLayer] cannot init after dispose');
    }
    if (this.initialized) {
      throw new Error('[VideoLayer] init has already run');
    }

    this.parentScene = ctx.scene;

    // VideoTexture defaults: flipY=true, colorSpace=SRGBColorSpace,
    // premultiplyAlpha=false. The browser auto-uploads the latest video
    // frame on every render call — no explicit `needsUpdate = true` is
    // required (unlike CanvasTexture).
    this.texture = new VideoTexture(this.source);

    this.material = new MeshBasicMaterial({
      map: this.texture,
      // Opacity < 1 forces transparent=true so Three.js's blending pass
      // composites the layers above (ambient/stroke/etc.) on top of the
      // ghosted video. Legacy Compositor parity: `opacity: 0.3`.
      opacity: this.opacity,
      transparent: this.opacity < 1,
      // depthTest/depthWrite disabled: same rationale as the
      // CanvasMirrorLayer subclasses.
      depthTest: false,
      depthWrite: false,
    });

    this.geometry = new PlaneGeometry(ctx.widthCss, ctx.heightCss);

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, this.z);
    // Mirror: horizontally flip the video frame (selfie-view
    // convention). Free — Three.js applies the negative scale on the
    // GPU during the vertex transform.
    this.mesh.scale.x = this.mirror ? -1 : 1;
    this.mesh.frustumCulled = false;
    this.mesh.name = `VideoLayer:${this.name}`;
    // Render order: Three.js sorts opaque objects front-to-back by
    // default. We want the video to render FIRST (at the back) so
    // explicitly bias renderOrder negative.
    this.mesh.renderOrder = -1000;

    this.parentScene.add(this.mesh);

    this.initialized = true;
  }

  /** Per-frame: no-op. `VideoTexture` auto-uploads the latest video
   *  frame on every renderer pass; we do not need to invalidate
   *  manually. The Layer interface still requires this method for
   *  uniformity with the CanvasTexture layers. */
  render(_deltaMs: number): void {
    // intentional no-op — see method docstring.
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

  /** Source video element reference (read-only — consumers MUST NOT
   *  mutate). */
  getSource(): HTMLVideoElement {
    return this.source;
  }
}
