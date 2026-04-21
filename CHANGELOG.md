# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.11.2] - 2026-04-21

### Fixed
- **Hologram3DRenderer — CJK glyph volumetric stack.** `createTextureCharMesh`
  (the CJK fallback path used when Latin `TextGeometry` is unavailable)
  previously built a single `PlaneGeometry` with `DoubleSide`, which read
  as a flat sheet that "popped" visibly whenever the hologram controller
  rotated the group past 90°. It now builds a 6-layer parallel stack
  spanning `depth: 0.35`, matching the Latin `TextGeometry depth: 0.35`
  so mixed-script phrases (e.g. 한국어 + Latin) have comparable visual
  weight in the scene. All layers share a single `MeshStandardNodeMaterial`
  (one shader compile, identical edge-emissive fresnel), and `depthWrite`
  stays `false` so the layered alpha blending remains stable under
  rotation. No API change.

## [0.11.1] - 2026-04-21

### Fixed
- **Modulation primitives now produce visible stroke motion.** Before this
  release, the `'glow'`, `'shine'`, and `'sparkle'` modulation primitives in
  `StrokeAnimator` only drove `glowIntensity`, which the renderer applies
  exclusively to the outer glow pass (`shadowBlur` + `globalAlpha` of the
  cached glow stroke). On effect presets with a minimal glow style — or when
  the glow pass is culled — the main stroke pass rendered flat and the
  stroke looked frozen. This was the root cause of the "classifier
  recognises `house` at 98 % but the stroke does not animate" class of bug
  reported on 2026-04-21: house's animation profile is `{ locomotion:
  'static', modulation: 'glow' }`, which delegated everything to the glow
  channel.
  
  The three modulation cases now additionally modulate `scale` and
  `opacity` alongside `glowIntensity` — the renderer applies all three to
  the main stroke pass (`ctx.scale()` + `ctx.globalAlpha`), so the stroke
  itself breathes with the glow. Amplitudes are locked by
  `tests/StrokeAnimator.test.ts`:
    - `'glow'` — scale ±4 %, opacity 0.85 → 1.0, glowIntensity 0.8 → 1.8.
    - `'shine'` — scale ±3 %, opacity 0.8 → 1.0, glowIntensity 1.0 → 2.2.
    - `'sparkle'` — scale ±3 %, opacity 0.8 → 1.0, glowIntensity 0.6 → 1.4.
  `'pulse'` is unchanged (already modulated scale + opacity pre-0.11.1).
  Colour / hue is intentionally untouched — colour is owned by the effect
  preset.
- `DEFAULT_AMPLITUDE` entries for `shine` / `glow` updated from `0` to the
  scale amplitude each case reads when `params.amplitude` is not provided
  (`0.03` and `0.04` respectively). Callers that pass an explicit
  `amplitude` override the default as before.

## [0.11.0] - 2026-04-21

### Changed
- **Breaking — drawing-only classifier pipeline.** The `@glymo/core/classifier`
  Web Worker now loads ONLY the `drawing-classifier` ONNX model and runs a
  single head per `classify()` call. The 3-way TYPE router
  (`type-classifier`) and the `text-classifier` / `symbol-classifier`
  specialist heads were removed. Drawing mode always produces drawings, so
  the router was structurally unnecessary; in production it routinely
  mis-routed clean drawings (e.g. heart) into the text head at high
  confidence ("0" at 100%), which `useDrawingClassifier` then silently
  dropped via its `category === 'drawing'` filter, producing the
  "I draw but nothing happens" class of bug. Text mode has its own
  Gemini-backed recognition path and never used this worker.
- **Breaking — `ClassifyResponse` shape.** The response is now
  `{ predictions: Prediction[] }`. The `typeProbs`, `detectedType`, and
  `heads` fields were removed. `Prediction.category` is now the single
  literal `'drawing'`.
- **Breaking — `TypeProbs`, `TypeHeadSnapshot`, `HeadSnapshot` type
  exports removed** from `@glymo/core/classifier`. No consumer code in
  the monorepo read these fields (grep across .ts/.tsx found only doc
  references); callers that stored the multi-head snapshot should
  migrate to logging `predictions[0]` directly.

### Fixed
- Worker init cost drops from 4-model download (~30 MB) to 1-model
  (~8 MB). Per-`classify()` latency drops from ~150 ms (router + 3
  heads, for-await serialised) to ~50 ms (one head).

## [0.10.1] - 2026-04-21

### Fixed
- `./classifier/classifier.worker.js` subpath export now resolves to
  the ESM worker bundle (`dist/classifier/classifier.worker.mjs`) via a
  single-string mapping, replacing the `import` / `require` / `default`
  conditional export from 0.10.0. The previous conditional shape let
  webpack's worker URL resolver fall through to the CJS `default` target
  in Next.js `--webpack` consumers, producing
  `Uncaught ReferenceError: require is not defined` inside a
  `type: 'module'` Web Worker at runtime. The CJS worker bundle is a
  dead path in browser contexts (a module worker cannot execute CommonJS
  `require()`), so the export is now ESM-only. Node-side CJS consumers
  of the worker file never existed and are not a supported use case.

## [0.10.0] - 2026-04-20

### Added
- `./classifier` subpath export — the on-device drawing classifier
  (Phase 1.8 v003-B3.5, 347 categories) is now part of the public
  `@glymo/core` surface. Re-exports `ClassifierClient`,
  `DRAWING_CATEGORIES`, `TEXT_CATEGORIES`, `SYMBOL_CATEGORIES`,
  `TYPE_CATEGORIES`, the matching literal-union types, plus
  `strokesToImage`, `loadModel`, `fetchManifest`, `openModelDB`,
  `translateLabel`, `LABEL_TRANSLATIONS`, `ALL_CLASSIFIER_LABELS`,
  `DEFAULT_CLASSIFIER_LOCALE`, and `TypeStabilizer`. Migrated from
  `glymo-landing/lib/classifier/` so that `glymo-app`, `glymo-landing`,
  and any future consumer can share a single ONNX classifier
  implementation.
- `./classifier/classifier.worker.js` worker subpath export — the
  Web Worker that owns ONNX Runtime sessions for `type`, `drawing`,
  `text`, and `symbol` heads. Consumers construct it with the canonical
  `new Worker(new URL('@glymo/core/classifier/classifier.worker.js',
  import.meta.url), { type: 'module' })` idiom; webpack / Next.js
  Turbopack / Vite all resolve that pattern into a hashed asset URL at
  build time.
- `peerDependencies.onnxruntime-web ^1.24.0` — declared optional
  (`peerDependenciesMeta.onnxruntime-web.optional = true`). Required
  only when consumers import the new `./classifier` subpath.

### Changed
- Build pipeline is now multi-pass under a single Vite config. Pass 1
  (`BUILD_TARGET=library`) emits the historical `dist/glymo.{mjs,js}`
  root bundle plus `dist/classifier/classifier.{mjs,js}` for the new
  classifier subpath. Pass 2 (`BUILD_TARGET=worker`) emits a
  self-contained `dist/classifier/classifier.worker.{mjs,js}` bundle.
  `npm run build` runs both passes in sequence; consumers see no
  workflow change.

### Fixed
- Worker bundle no longer references parent-directory chunks. Rollup's
  default chunk-hoisting splits shared imports (e.g. `model-cache`)
  into a sibling `../model-cache-*.js` chunk that lives outside the
  published worker file. Bundlers like webpack / Next.js do not
  recursively follow worker imports through `node_modules`, so any
  hoisted chunk would 404 at runtime. The worker pass is now configured
  with `output.codeSplitting: false` and `external: ['onnxruntime-web']`,
  guaranteeing the published worker file is self-contained except for
  the externalised ONNX Runtime peer.

## [0.5.0] - 2026-04-19

### Added
- `Glymo.exportSession(): Promise<SessionDoc>` and
  `Glymo.loadSession(payload: SessionDoc | StrokeDoc[]): Promise<void>` —
  full-session persistence API that round-trips strokes, animated objects,
  fills, canvas size, and the active effect preset through a single wire
  payload. Replaces the stroke-only `loadStrokes` path for project save /
  load in consumer apps while keeping `loadStrokes` available for v1
  call-sites (see Notes).
- `SessionDoc`, `ObjectDoc`, `FillDoc`, `AnimationDoc` type exports —
  v2 wire contract covering the studio surface. `SessionDoc` is tagged
  `version: 2` and carries `canvas { w, h }`, `effect { name }`,
  `strokes[]`, `objects[]`, `fills[]`. Fill bitmaps are referenced by
  `bitmap_url` (not inlined) so the wire payload stays small and the
  bitmap can live on object storage.
- `BitmapUploader` and `BitmapLoader` constructor options on `Glymo` —
  host-provided transports for fill bitmaps. Required only when the
  active session actually contains fills: `exportSession` rejects with
  `GlymoError('session.export.missing_uploader')` if fills exist without
  an uploader, and `loadSession` rejects with
  `GlymoError('session.load.missing_loader')` if a `SessionDoc` carries
  fills without a loader. Plain strokes-only sessions do not require
  either hook.
- `CanvasSession` and `SessionState` type exports — internal-shape
  aliases surfaced for consumers that need to type their own persistence
  helpers without reaching into the runtime.
- `ObjectDoc` referential integrity — `loadSession` drops any object
  whose `strokeIds` reference missing strokes or whose `fillId`
  references a missing fill, with a single `console.warn` per drop
  naming the dangling id. The rest of the session hydrates normally.

### Notes
- `Glymo.loadStrokes(docs: StrokeDoc[])` (added in 0.4.0) remains the
  preferred entry point for strokes-only hydration. `loadSession`
  dispatches on `Array.isArray(payload)` and delegates a `StrokeDoc[]`
  payload straight to `loadStrokes`, so v1 wire payloads round-trip
  without forcing callers to wrap them in a `SessionDoc`.
- Animation parameters use different shapes on the wire versus at
  runtime: `AnimationDoc` stores `durationMs: number` and
  `loop: boolean`, while the runtime `AnimationParams` uses `duration`
  (seconds) and `repeat`. `loadSession` / `exportSession` translate
  between the two representations; hosts should persist the wire shape
  only.
- Loaded strokes retain their source `id` when one is present on the
  wire (previously `loadStrokes` always re-synthesized ids). Object
  `strokeIds` therefore remain resolvable across a full save → load
  round-trip.

## [0.4.1] - 2026-04-19

### Fixed
- `Hologram3DRenderer` no longer throws `TypeError: Cannot read
  properties of null (reading 'dispose')` when an external `dispose()`
  fires during the `await renderer.init()` window (reproducible under
  React Strict Mode mount → cleanup → remount). Root cause: the post-init
  `if (this.destroyed) { this.renderer.dispose(); return false; }`
  re-entered a cleanup that the external `dispose()` had already
  completed, after it had nulled `this.renderer`. The defensive branch
  now simply returns — `dispose()` is idempotent and has already freed
  the WebGPU renderer it saw. Reported during internal UAT on the app
  Studio page on 2026-04-19.

## [0.4.0] - 2026-04-18

### Added
- `Glymo.loadStrokes(docs: StrokeDoc[]): void` — public hydration API that replaces the current stroke list from a wire-format payload. Used by project-load flows in consumer apps (e.g. `@glymo/ui` `<CanvasEngine initialStrokes>`) so saved work can round-trip through the server without exposing the internal `StrokePoint` shape.
- `StrokeDoc` and `StrokeDocPoint` type exports — slim persistence/wire shape (`{ points: [{ x, y, pressure? }] }`) distinct from the richer runtime `StrokePoint` which carries `t` and `pressure` as required fields. `pressure` defaults to `1.0` when omitted; `t` is synthesized monotonically per-stroke on load.

### Notes
- Loaded strokes are marked `state: 'effected'` with `smoothed === raw` — we do not re-run the smoothing pipeline on hydration to avoid drift from the originally exported geometry.
- Loaded strokes are not re-wrapped into `GlymoObject`s; the object store is only populated by live drawing sessions. Consumers that need object-level operations after hydration should re-run their own segmentation pass.

## [0.2.0] - 2026-04-07

### Added
- 6-stage drawing pipeline (Capture → Stabilize → Pressure → Segment → Smooth → Effect)
- 5 Canvas 2D effect presets (`neon`, `aurora`, `gold`, `calligraphy`, `fire`)
- 5 WebGPU effect presets (`liquid`, `hologram`, `bloom`, `gpu-particles`, `dissolve`)
- Mouse and touch input via PointerEvent API (`MouseCapture`)
- Camera hand tracking via MediaPipe HandLandmarker (`CameraCapture`)
- Gesture recognition DSL with 6 built-in gestures (`pinch`, `fist`, `point`, `open-palm`, `peace-sign`, `thumbs-up`)
- 5 artistic hand rendering styles (`NeonSkeleton`, `Aurora`, `Crystal`, `Flame`, `ParticleCloud`)
- Two-hand simultaneous drawing support
- Always-draw mode (point to draw, fist to pause)
- Text recognition via Google Input Tools handwriting API (`HandwritingRecognizer`)
- Cascading text recognition with fallback strategies (`CascadingRecognizer`)
- Glyph extraction and caching (`GlyphExtractor`, `GlyphCache`)
- Font morphing animation with point matching (`FontMorphAnimator`, `PointMatcher`)
- Kinetic typography engine (`KineticEngine`)
- Text pipeline controller for end-to-end text mode
- Pretext-based text layout integration (`PretextLayout`)
- `MorphAnimator` with easeOutElastic easing
- PNG and GIF export (`PNGExporter`, `GIFExporter`)
- Canvas 2D renderer with automatic effect application
- WebGPU renderer with compute shader particle system
- Automatic renderer fallback (WebGPU → Canvas 2D)
- `ParticleSystem` for GPU-accelerated visual effects
- `StrokeRenderer` for raw input visualization
- `OneEuroFilter` for pointer stabilization
- `EventBus` with typed event payloads
- `SessionStateMachine` for lifecycle management (idle → ready → drawing → morphing → ...)
- `PerformanceMonitor` for frame timing and degradation detection
- Math utilities (Catmull-Rom interpolation, distance calculations)
- `Glymo` facade class with `create()` convenience factory
- TypeScript strict mode with full type coverage
- ESM and CJS dual output via Vite build
- Vitest test suite with 32 test files

### Fixed
- Use dynamic language parameter in Google Handwriting API URL

### Changed
- Added `package-lock.json` to `.gitignore`

## [0.1.0] - 2026-04-07

### Added
- Initial project scaffolding and repository setup

[0.4.0]: https://github.com/hohre12/glymo-core/compare/v0.3.0...v0.4.0
[0.2.0]: https://github.com/hohre12/glymo-core/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hohre12/glymo-core/releases/tag/v0.1.0
