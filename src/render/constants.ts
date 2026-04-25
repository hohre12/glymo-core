// `@glymo/core/render` shared constants — centralised so layer Z values,
// names, and per-layer defaults live in ONE place. Pre-Batch-A, every
// CanvasMirrorLayer subclass hard-coded its own defaults
// (`name = 'stroke', z = 0` inside StrokeLayer; `name = 'video', z = -2`
// inside VideoLayer; etc.) and the Compositor's `setLayerOrder([...])`
// in `glymo-ui/CanvasEngine.tsx` listed the same names again. Three
// independent literals had to stay in sync — a known maintenance
// hazard when adding a new layer.
//
// This module is the single source of truth. Each layer subclass reads
// its default `name` and `z` from `LAYER_DEFAULTS`; the consumer
// (CanvasEngine) reads `LAYER_RENDER_ORDER` for the canonical Z stack
// when iterating layers. New-layer additions touch one constants entry
// instead of N call-sites.
//
// Per §1.5.4 R-A — every export here is a plain TS literal / type. No
// Three.js type leaks.

// ── Layer names (single source of truth) ────────────────────────────────
//
// One symbol per renderer surface. Subclass defaults pull from here;
// the legacy Compositor's `addLayer({ id: ... })` calls in
// `glymo-ui/CanvasEngine.tsx` and the `setLayerOrder([...])` line use
// the same string literal namespace — keeping them aligned by import
// would require a circular dep (ui imports core), so the legacy
// Compositor path keeps its own copies until Phase 9 deletes it.

export const LAYER_NAMES = {
  /** Live `<video>` element — camera background. Default z=-2. */
  video: 'video',
  /** Per-character radial halo — soft "atmospheric glow". Default z=-1. */
  ambientGlow: 'ambient-glow',
  /** Strokes + fills + objects — the primary drawing surface. Default z=0. */
  stroke: 'stroke',
  /** Recognised text glyphs (text-mode CharacterStore output). Default z=1. */
  textOverlay: 'text-overlay',
  /** WebGPU post-process output (bloom + chromatic + scanlines).
   *  Replacement for Stroke + TextOverlay when WebGPU is available
   *  AND the active effect is bloom-driven (aurora / hologram). Sits
   *  at z=1.5 between TextOverlay (z=1) and Hologram3D (z=2). The
   *  setVisible toggles in CanvasEngine swap between (Stroke + Text)
   *  and PostProcess based on `webGPUAvailable`. */
  postProcess: 'post-process',
  /** Hologram3DRenderer's WebGPU output (text 3D-lift + media-art
   *  meshes). Default z=2. */
  hologram3d: 'hologram-3d',
  /** MediaPipe Hands skeleton landmarks + connectors. Default z=3. */
  hand: 'hand',
  /** Synthetic Glymo watermark tile — recording-stable top mark.
   *  Default z=4. */
  watermark: 'watermark',
} as const;

/** Discriminated union of valid layer names. Compile-time enforcement
 *  — passing `'unknown-layer'` to a setter that takes `LayerName` is
 *  a type error. */
export type LayerName = (typeof LAYER_NAMES)[keyof typeof LAYER_NAMES];

// ── Z stack (single source of truth) ────────────────────────────────────
//
// Three.js's renderer sorts transparent objects back-to-front by Z when
// `sortObjects: true` (default). Layer subclasses use these constants
// as their default `z` so the documented stack order is enforced
// without duplicate magic numbers. Consumers that want to override a
// specific layer's Z still can via the layer constructor's `z?` option.

export const LAYER_Z = {
  /** Camera video — absolute background. */
  video: -2,
  /** Ambient halo behind everything. */
  ambientGlow: -1,
  /** Drawing surface — base of the content stack. */
  stroke: 0,
  /** Text overlay — composites above strokes. */
  textOverlay: 1,
  /** WebGPU post-process — between TextOverlay and Hologram3D. The
   *  half-step Z lets it sit ABOVE the layers it replaces (Stroke,
   *  TextOverlay) when toggled visible, but BELOW the layers above. */
  postProcess: 1.5,
  /** Hologram + media-art content — above text. */
  hologram3d: 2,
  /** Hand skeleton — UI overlay above content. */
  hand: 3,
  /** Watermark — topmost; survives recording / screenshot / export. */
  watermark: 4,
} as const;

// ── Diagnostic mesh-name prefixes ───────────────────────────────────────
//
// Each subclass's mesh is named `<logName>:<name>` for DevTools / scene
// inspector friendliness. The `logName` is the class name; centralising
// here as constants prevents "VideoLayer" string drift if the class is
// ever renamed.

export const LAYER_LOG_NAMES = {
  video: 'VideoLayer',
  ambientGlow: 'AmbientGlowLayer',
  stroke: 'StrokeLayer',
  textOverlay: 'TextOverlayLayer',
  postProcess: 'PostProcessLayer',
  hologram3d: 'Hologram3DLayer',
  hand: 'HandLayer',
  watermark: 'WatermarkLayer',
} as const;

// ── Bundled defaults — one entry per layer ──────────────────────────────
//
// `LAYER_DEFAULTS[key]` is the canonical {name, z, logName} bundle each
// subclass reads. Adding a new layer requires:
//   1. Add the entry here.
//   2. Create `<NewLayer>.ts` with `super({ ...LAYER_DEFAULTS.foo, ...opts })`.
//   3. Re-export from `index.ts`.
// The Z-stack ordering is automatically correct.

export const LAYER_DEFAULTS = {
  video:        { name: LAYER_NAMES.video,        z: LAYER_Z.video,        logName: LAYER_LOG_NAMES.video },
  ambientGlow:  { name: LAYER_NAMES.ambientGlow,  z: LAYER_Z.ambientGlow,  logName: LAYER_LOG_NAMES.ambientGlow },
  stroke:       { name: LAYER_NAMES.stroke,       z: LAYER_Z.stroke,       logName: LAYER_LOG_NAMES.stroke },
  textOverlay:  { name: LAYER_NAMES.textOverlay,  z: LAYER_Z.textOverlay,  logName: LAYER_LOG_NAMES.textOverlay },
  postProcess:  { name: LAYER_NAMES.postProcess,  z: LAYER_Z.postProcess,  logName: LAYER_LOG_NAMES.postProcess },
  hologram3d:   { name: LAYER_NAMES.hologram3d,   z: LAYER_Z.hologram3d,   logName: LAYER_LOG_NAMES.hologram3d },
  hand:         { name: LAYER_NAMES.hand,         z: LAYER_Z.hand,         logName: LAYER_LOG_NAMES.hand },
  watermark:    { name: LAYER_NAMES.watermark,    z: LAYER_Z.watermark,    logName: LAYER_LOG_NAMES.watermark },
} as const;

// ── Render order (insertion order = Z order, by convention) ─────────────
//
// Documented Z stack from background to foreground. Consumers that want
// to walk the stack in render order should iterate this array. Any new
// layer added to LAYER_DEFAULTS must also be added here (intentional —
// keeps the "what renders where" decision visible in one literal).

export const LAYER_RENDER_ORDER: readonly LayerName[] = [
  LAYER_NAMES.video,
  LAYER_NAMES.ambientGlow,
  LAYER_NAMES.stroke,
  LAYER_NAMES.textOverlay,
  LAYER_NAMES.postProcess,
  LAYER_NAMES.hologram3d,
  LAYER_NAMES.hand,
  LAYER_NAMES.watermark,
] as const;

// ── Video layer preprocess defaults ─────────────────────────────────────
//
// Mirror the legacy `Compositor` `videoPreprocess` per `Compositor.ts:
// 261-285`. Centralised so a change to "what does the camera background
// look like" requires touching ONE constants entry.
//
//   - `OPACITY` matches legacy `addLayer({ id: 'video', opacity: 0.3 })`
//     in CanvasEngine.tsx.
//   - `MIRROR` matches legacy `videoPreprocess.mirror: true`.
//   - `BLUR_PX` matches legacy `videoPreprocess.blur: 6`.
//   - `COVER` matches the legacy object-cover scaling logic
//     (`scale = max(w/vw, h/vh)`).

export const VIDEO_LAYER_DEFAULTS = {
  OPACITY: 0.3,
  MIRROR: true,
  BLUR_PX: 6,
  COVER: true,
} as const;
