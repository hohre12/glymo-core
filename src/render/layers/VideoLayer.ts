// VideoLayer — Phase 6 sub-slice 6b-5+6b-6+6b-6b first cut.
//
// Camera background — wraps an `HTMLVideoElement` (the live MediaPipe /
// `getUserMedia()` video stream that backs the legacy Compositor's
// `'video'` layer per `CanvasEngine.tsx` 2315-2330) onto the SceneGraph.
//
// ── Architecture: internal preprocess canvas (post-6b-6b) ──────────────
//
// The initial 6b-5 cut wrapped the raw `HTMLVideoElement` directly as a
// Three.js `VideoTexture`. That cut hit two visible regressions reported
// by the user on first inspection:
//
//   1. **No mirror.** Setting `mesh.scale.x = -1` on a `PlaneGeometry`
//      mesh flips the winding order from CCW to CW. `MeshBasicMaterial`
//      defaults to `side: FrontSide`, which then culls the (now
//      back-facing) front. Naively flipping mesh scale produced an
//      invisible mirror.
//
//   2. **Visible webcam noise.** The legacy Compositor smoothed the
//      camera feed with `ctx.filter = 'blur(6px)'` + 30% opacity. Without
//      blur, the webcam's per-frame sensor noise is sharp and read as
//      jitter at the user-visible alpha level. The legacy pipeline
//      hides this; the raw `VideoTexture` path exposes it.
//
// The canonical fix is to mirror the legacy Compositor's preprocess
// step verbatim, but inside the layer instead of inside the global
// composite pass:
//
//   * VideoLayer creates a private offscreen `<canvas>` sized to the
//     SceneGraph viewport (CSS pixels × DPR for crispness).
//   * On every `render()` tick the layer draws the source video into
//     that canvas with `ctx.filter = 'blur(6px)'` + a horizontal flip
//     (`ctx.scale(-1, 1)` after `ctx.translate(w, 0)`) + an
//     object-cover crop (`scale = max(w/vw, h/vh)`).
//   * The internal canvas is the texture source — not the raw video.
//     A regular `CanvasTexture` (with the same flipY=true / SRGB
//     defaults as the rest of the CanvasMirrorLayer family) wraps it.
//
// This is the SAME `videoPreprocess` chain that
// `glymo-ui/src/canvas/lib/Compositor.ts:262-285` runs in the legacy
// path; the layer just owns its own copy of the preprocess output
// canvas and binds it to a Three.js mesh. Performance cost is one
// CPU `drawImage` per frame — same as the legacy compositor pays for
// the same layer.
//
// ── Composition contract ───────────────────────────────────────────────
//
// VideoLayer's default `z = -2` is BELOW AmbientGlowLayer's `z = -1` —
// the camera feed is the absolute background of the SceneGraph stack.
// `transparent: true` (because opacity defaults < 1 are common) and
// `depthTest: false` so Three.js's transparent Z-sort composes the
// layers above (ambient/stroke/etc.) on top of the ghosted video.
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
import { LAYER_DEFAULTS, VIDEO_LAYER_DEFAULTS } from '../constants.js';

export interface VideoLayerOptions {
  /** The `<video>` element whose frames this layer mirrors onto the
   *  SceneGraph. In production this is the element returned by
   *  `glymo.getCameraVideoElement()` once `camera:ready` fires. */
  source: HTMLVideoElement;
  /** Optional name override (default `'video'`). */
  name?: string;
  /** Z position (default `-2`). */
  z?: number;
  /** Per-layer opacity 0..1 (default `1`; legacy parity = `0.3`). */
  opacity?: number;
  /** Horizontal flip (selfie-view convention; default `true`). */
  mirror?: boolean;
  /** Gaussian blur radius in CSS pixels applied per-frame to the
   *  preprocess canvas (default `0` — sharp; legacy parity = `6`). */
  blur?: number;
  /** When `true` (default), scale the source video with object-cover
   *  semantics: `scale = max(w/vw, h/vh)` and crop the excess to fill
   *  the canvas while preserving the source AR. When `false`, the
   *  source is stretched to fill the canvas (potentially distorting
   *  the AR — useful only for fixed-AR test fixtures). Legacy
   *  Compositor parity = `true`. */
  cover?: boolean;
}

/**
 * VideoLayer — fullscreen quad that mirrors a live `<video>` element
 * (the camera stream) onto the SceneGraph via an internal preprocess
 * canvas + `CanvasTexture`. The internal canvas applies the legacy
 * `videoPreprocess` chain (mirror + blur + object-cover crop) so the
 * SceneGraph composite reads pixel-equivalent output to the legacy
 * `Compositor` 'video' layer.
 */
export class VideoLayer implements Layer {
  // ── Layer interface ─────────────────────────────────────────────────────

  readonly name: string;

  // ── Configuration ───────────────────────────────────────────────────────

  private readonly source: HTMLVideoElement;
  private readonly z: number;
  private readonly opacity: number;
  private readonly mirror: boolean;
  private readonly blur: number;
  private readonly cover: boolean;

  // ── Internal preprocess canvas + Three.js wiring ────────────────────────

  /** Offscreen 2D canvas the preprocess pipeline writes into. Sized in
   *  device pixels (CSS × DPR) so the `CanvasTexture` upload is
   *  crisp regardless of viewport DPR. Owned by this layer; disposed
   *  with the layer. */
  private preprocessCanvas: HTMLCanvasElement | null = null;
  private preprocessCtx: CanvasRenderingContext2D | null = null;
  private widthCss = 0;
  private heightCss = 0;
  private dpr = 1;

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

  constructor(opts: VideoLayerOptions) {
    if (!opts.source) {
      throw new Error(`[${LAYER_DEFAULTS.video.logName}] \`opts.source\` is required`);
    }
    this.source = opts.source;
    this.name = opts.name ?? LAYER_DEFAULTS.video.name;
    this.z = opts.z ?? LAYER_DEFAULTS.video.z;
    this.opacity = opts.opacity ?? VIDEO_LAYER_DEFAULTS.OPACITY;
    this.mirror = opts.mirror ?? VIDEO_LAYER_DEFAULTS.MIRROR;
    this.blur = opts.blur ?? VIDEO_LAYER_DEFAULTS.BLUR_PX;
    this.cover = opts.cover ?? VIDEO_LAYER_DEFAULTS.COVER;
  }

  // ── Layer lifecycle ─────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error(`[${LAYER_DEFAULTS.video.logName}] cannot init after dispose`);
    }
    if (this.initialized) {
      throw new Error(`[${LAYER_DEFAULTS.video.logName}] init has already run`);
    }

    this.parentScene = ctx.scene;
    this.widthCss = ctx.widthCss;
    this.heightCss = ctx.heightCss;
    this.dpr = ctx.dpr;

    // Allocate the offscreen preprocess canvas at device-pixel size for
    // crisp upload. The Three.js texture is sampled with the canvas's
    // intrinsic resolution; sizing the canvas at CSS-pixel-only would
    // upscale on retina.
    this.preprocessCanvas = document.createElement('canvas');
    this.preprocessCanvas.width = Math.max(
      1,
      Math.round(this.widthCss * this.dpr),
    );
    this.preprocessCanvas.height = Math.max(
      1,
      Math.round(this.heightCss * this.dpr),
    );
    const c2d = this.preprocessCanvas.getContext('2d');
    if (!c2d) {
      throw new Error(`[${LAYER_DEFAULTS.video.logName}] 2D context unavailable on preprocess canvas`);
    }
    this.preprocessCtx = c2d;

    // CanvasTexture defaults: flipY=true, colorSpace=SRGBColorSpace,
    // premultiplyAlpha=false. The preprocess canvas is sRGB 2D output.
    this.texture = new CanvasTexture(this.preprocessCanvas);

    this.material = new MeshBasicMaterial({
      map: this.texture,
      // Opacity < 1 forces transparent=true so the layers above
      // composite over the ghosted video.
      opacity: this.opacity,
      transparent: this.opacity < 1,
      // depthTest/depthWrite disabled (CanvasMirrorLayer parity).
      depthTest: false,
      depthWrite: false,
    });

    this.geometry = new PlaneGeometry(this.widthCss, this.heightCss);

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 0, this.z);
    this.mesh.frustumCulled = false;
    this.mesh.name = `${LAYER_DEFAULTS.video.logName}:${this.name}`;
    this.mesh.renderOrder = -1000;

    this.parentScene.add(this.mesh);

    this.initialized = true;
  }

  /** Per-frame: draw the source video into the preprocess canvas with
   *  blur + mirror + object-cover; mark the texture dirty so the GPU
   *  re-uploads on the next renderer pass. */
  render(_deltaMs: number): void {
    if (!this.initialized || this.disposed) return;
    const c2d = this.preprocessCtx;
    const cnv = this.preprocessCanvas;
    const tex = this.texture;
    const src = this.source;
    if (!c2d || !cnv || !tex) return;

    const w = cnv.width;
    const h = cnv.height;

    // Skip frame entirely if the source video has not produced a frame
    // yet (`videoWidth === 0`). Drawing a 0×0 source throws on some
    // browsers; the next render() will retry once the stream is live.
    const vw = src.videoWidth || 0;
    const vh = src.videoHeight || 0;
    if (vw === 0 || vh === 0) return;

    c2d.save();

    // Reset transform first then clear — prevents the blur halo from
    // the previous frame accumulating at the rect edges (each frame's
    // `drawImage` with `filter: blur(N)` paints into approximately
    // (-N..w+N) due to the kernel; without clearRect those edge pixels
    // compound across frames, producing visible banding / sparkle
    // along the top/bottom/left/right margins of the canvas — read by
    // the user as "noise"). Clear in identity-transform space so the
    // full canvas is wiped regardless of the mirror/scale we apply
    // below.
    c2d.setTransform(1, 0, 0, 1, 0, 0);
    c2d.clearRect(0, 0, w, h);

    // Apply blur first — applies to subsequent draw calls per spec.
    // Blur radius is in CANVAS pixels (the preprocess canvas is sized
    // at viewport CSS × DPR, so multiplying by DPR keeps the visual
    // blur radius constant in CSS-pixel space — same effect on retina
    // and non-retina). Legacy Compositor used non-DPR-multiplied blur
    // because it ran on the visible compositor canvas which is sized
    // in CSS pixels; here we run on a higher-DPI buffer.
    c2d.filter = this.blur > 0 ? `blur(${this.blur * this.dpr}px)` : 'none';

    if (this.mirror) {
      // Translate origin to right edge then flip X. Result: source
      // pixels at U=0 land at canvas X=w (rightmost), U=1 lands at
      // X=0 (leftmost) — horizontal mirror.
      c2d.translate(w, 0);
      c2d.scale(-1, 1);
    }

    if (this.cover) {
      // object-cover: pick the larger of (w/vw, h/vh) so the source
      // FILLS the canvas, then crop the excess. Same math as
      // `Compositor.ts:276-282`.
      const scale = Math.max(w / vw, h / vh);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      c2d.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
    } else {
      c2d.drawImage(src, 0, 0, w, h);
    }

    c2d.restore();

    tex.needsUpdate = true;
  }

  /** Phase 6 6b-6d — toggle visibility without unmounting. Mirrors the
   *  legacy `Compositor.setLayerVisible(id, bool)` surface so callers
   *  like the `backgroundMode === 'camera'` toggle in CanvasEngine can
   *  hide the camera feed during white/dark mode. */
  setVisible(visible: boolean): void {
    if (!this.initialized || this.disposed) return;
    if (!this.mesh) return;
    this.mesh.visible = visible;
  }

  /** Re-sized viewport: rebuild the preprocess canvas + quad geometry. */
  resize(widthCss: number, heightCss: number, dpr: number): void {
    if (!this.initialized || this.disposed) return;
    if (!this.mesh || !this.geometry) return;
    if (!Number.isFinite(widthCss) || widthCss <= 0) return;
    if (!Number.isFinite(heightCss) || heightCss <= 0) return;

    this.widthCss = widthCss;
    this.heightCss = heightCss;
    this.dpr = dpr;

    if (this.preprocessCanvas) {
      this.preprocessCanvas.width = Math.max(1, Math.round(widthCss * dpr));
      this.preprocessCanvas.height = Math.max(1, Math.round(heightCss * dpr));
    }

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
    this.preprocessCanvas = null;
    this.preprocessCtx = null;
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
