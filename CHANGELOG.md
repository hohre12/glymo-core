# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.15.1] - 2026-04-21

### Fixed — English text-mode spatial grouping regression

The recognition-aware early-finalize in `CascadingRecognizer.notifyStrokeStart`
used a per-language factor (`0.5` for English, `0.7` for Korean) on top of
`LANG_PARAMS.finalizeDelay`, giving English a 600 ms inter-stroke cutoff.
Air-writing hand movement naturally takes 800-1200 ms between strokes
regardless of script, so every English stroke was finalizing individually —
multi-stroke letters (A / H / T / K / X / Y) never grouped.

- **`src/text/CascadingRecognizer.ts`** — unified `earlyFactor` to `0.7`
  for all languages, raising the English threshold from 600 ms to 840 ms.
  The language-specific `stableCount` / `minStrokes` split is preserved so
  the Korean syllable-vs-English letter complexity difference still drives
  different confidence-based early-commit behaviour.

## [0.15.0] - 2026-04-21

### Added — Media-art mesh animation pause API

The 2026-04-21 Studio ADR removes drawing-mode auto-animation entirely —
classifier success no longer auto-plays an AnimationProfile, and media-art
meshes no longer auto-spin on `setModel`. Animation only plays when the
user explicitly selects an object and pinches with the air-magic tool. To
support the mesh half of that contract, `Hologram3DRenderer` now exposes a
pause/resume surface that the UI kit drives from `useGestureDispatcher`.

- **`src/hologram/Hologram3DRenderer.ts`** — new private field
  `meshAnimationPaused: boolean` defaults to `true`. `setModel()` sets it
  to `true` again after clock init, so every freshly loaded mesh arrives
  frozen (no auto-play, even if a prior mesh was playing when swapped).
  `renderMeshFrame` now gates the mixer tick and the mesh update hook on
  `!meshAnimationPaused`; while paused the clocks' deltas are drained
  (`mixerClock.getDelta()` / `meshFrameClock.getDelta()`) so a resume
  never fast-forwards by the paused interval — playback picks up from the
  exact frozen pose. Two new public methods:
  - `isMeshAnimationPaused(): boolean` — always `true` in text mode.
  - `toggleMeshAnimation(): boolean` — flips the flag and returns the new
    paused state (`true` if now paused, `false` if now playing); no-op +
    returns `true` in text mode or before `setModel` resolves.

### Fixed — Spurious self-dependency

- **`package.json`** — removed an erroneous `"@glymo/core": "^0.13.0"`
  entry that had been introduced into the `dependencies` block during
  the 0.13.0 bump. The package was self-declaring as its own runtime
  dependency, which under `npm install` would pull an older 0.13.x
  tarball into `node_modules/@glymo/core/node_modules/` and risk a
  bundler resolving duplicate copies. No source file inside `src/`
  imports from `@glymo/core` (verified by grep), so the line was pure
  noise; removing it is behaviour-neutral for consumers.

### Tests

- **`tests/hologram-mesh-mode.test.ts`** — 6 new tests under the
  "Hologram3DRenderer mesh-animation pause" describe block:
  paused-by-default in text mode, paused-on-setModel, toggle flip
  flops, no-op in text mode, re-pause on subsequent `setModel`, and
  `renderFrame` safety while paused. Brings the file to 23/23 tests.

### Semver

Minor bump — only additive API surface (`isMeshAnimationPaused`,
`toggleMeshAnimation`). Existing renderers upgrading from 0.14.0 see
meshes pause by default, which is the intended behaviour change; the
paired UI kit (`@glymo/ui@0.22.0`) drives the resume path. Hosts that
load `@glymo/core@0.15.0` with `@glymo/ui@<0.22.0` will see frozen
media-art meshes with no way to wake them — hence the peer-dep floor
bump in the UI kit.

## [0.14.0] - 2026-04-21

### Changed — Drawing-mode selection halo unified with text-mode

Studio QA sweep (2026-04-21) flagged that the selection indicator differed
between the two modes — text mode drew a breathing cyan halo, drawing mode
drew a marching-ants dashed bbox plus four corner handles. Glymo is a
gesture-driven surface (no pointer resize affordance), so the handles and
the dash animation were decorative legacy from an earlier mouse-first
prototype. The two indicators are now visually identical; drawing mode
matches the text-overlay halo language in `@glymo/ui`
(`TextOverlayCanvas.tsx:866-887`).

- **`src/render/layers/selection.ts`** — rewritten. No more `setLineDash`,
  no `arc()` corner handles. Instead: a rounded-rect path drawn with
  `moveTo + lineTo + arcTo` (headless-canvas compatible), filled with a
  translucent `rgba(0, 255, 204, 0.18)` ambient pass under `'lighter'`
  composite, then stroked in solid `#00ffcc`. A breath animation
  (`breath = 0.5 + 0.5 * Math.sin(timestamp * 0.004)`) modulates alpha and
  shadow blur; same timestamp + dpr inputs produce deterministic output so
  the gate tests in `tests/selection.test.ts` can pin the math.
- **Constants** extracted inline at the top of the file for quick visual
  tuning: `HALO_PAD = 10`, `HALO_STROKE = '#00ffcc'`,
  `HALO_FILL = 'rgba(0, 255, 204, 0.18)'`, `HALO_RADIUS = 12`,
  `BREATH_RATE = 0.004 rad/ms` (≈ 1.57 s period). The breath rate is
  shared with the text-mode char halo so both surfaces pulse in lockstep
  when the user is toggling between modes.
- **Brand-neon lock** — the `effectColor` parameter is preserved in the
  public signature for backward compat with call sites
  (`CanvasRenderer.ts:352`) but no longer influences the stroke. The
  selection halo now stays `#00ffcc` regardless of the active paint
  effect, matching the text-mode halo. Internally the parameter is
  renamed `_effectColor` to satisfy `noUnusedParameters: true`.

### Migration

- Call sites that previously relied on the dashed marching-ants visual
  (none in this repo; the landing preview and the app Studio both consume
  this layer only through `CanvasRenderer`) will see a solid neon outline
  instead. The public function signature of `renderSelection(ctx,
  selectedIds, store, effectColor, timestamp, dpr)` is unchanged, so no
  caller-side edits are required.
- Gate tests pinning the new behaviour land in `tests/selection.test.ts`
  (9 tests) — forks that re-introduce `setLineDash` or bbox corner
  `arc()` calls will regress.

## [0.13.0] - 2026-04-21

### Added — Media Art production-by-default rendering (HR5)

See `docs/plans/media-art-production-catalog.md` (Glymo root) for the full
design. Summary: every `gltf` asset now inherits Earth/Dog-grade rendering
quality without per-asset HDRI authoring by bundling a neutral environment
texture + 3-point light rig directly into `GltfMeshSource`. The constants
driving the look are extracted from the source classes into a shared module
so gltf / gltf-pbr / procedural-planet variants stay visually coherent and
future variants plug in without re-discovering the values.

- **`src/hologram/sources/mediaArtDefaults.ts`** — pure-data module exporting
  shared rendering constants: `DEFAULT_ENVIRONMENT_INTENSITY` (0.6),
  `DEFAULT_LIGHT_RIG_INTENSITY` (`{ key: 1.6, fill: 0.4, ambient: 0.2 }`),
  `DEFAULT_KEY_LIGHT_POSITION` / `DEFAULT_FILL_LIGHT_POSITION`,
  `DEFAULT_AXIAL_TILT_DEG` (23.4), `DEFAULT_ROTATION_BODY` (0.10),
  `DEFAULT_ROTATION_CLOUDS` (0.13), `DEFAULT_ATMOSPHERE_COLOR_HEX` (0x00ccff),
  and the `BUNDLED_NEUTRAL_ENVIRONMENT` marker (`kind: 'room-environment'`).
- **`src/hologram/sources/variantDefaults.ts`** — `VARIANT_DEFAULTS` registry
  exposing per-variant default config (`gltf` / `gltf-pbr` /
  `procedural-planet`) + `getVariantDefaults(variant)` helper with generic
  narrowing. Adding a fourth variant forces a compile-time exhaustiveness
  update.
- **`src/hologram/sources/neutralEnvironment.ts`** —
  `createNeutralEnvironmentTexture(THREE)` generates a 128×64 equirectangular
  float DataTexture with a 3-tone vertical gradient (warm floor → bright
  horizon → cool ceiling). Assigned to `scene.environment` with
  `EquirectangularReflectionMapping`; three.js generates the PMREM internally
  on first use, so no binary HDR asset ships with the package.
- **`src/hologram/sources/neutralLightRig.ts`** —
  `createNeutralLightRig(THREE, config?)` builds a Group containing a
  key/fill DirectionalLight pair + AmbientLight. Consumer closes over the
  `NeutralLightRigConfig` optional intensity overrides.
- **`GltfMeshSource.load()`** now creates the neutral environment + rig after
  parsing the GLB and returns an `attachToScene` hook that (1) stashes the
  prior `scene.environment` + `environmentIntensity`, (2) installs the new
  environment + intensity, (3) adds the rig group to the scene, and (4)
  returns a cleanup closure restoring the prior state. Dispose disposes both
  the environment texture and the rig.
- **`GltfMeshSourceDescriptor`** gains optional `environmentIntensity?`
  (default 0.6) and `lightRigIntensity?: { key?; fill?; ambient? }` fields.
- **`ProceduralPlanetMeshSourceDescriptor`** gains optional
  `atmosphereColorHex?: number` override (default 0x00ccff — cyan for
  Earth; set warm hex for Sun corona or Mars dust without forking the
  shader).

### Changed

- **`GlbPbrMeshSource`** local `DEFAULT_ENVIRONMENT_INTENSITY = 0.6` removed;
  imported from `mediaArtDefaults` instead. Behaviour identical.
- **`ProceduralPlanetMeshSource`** local `DEFAULT_AXIAL_TILT_DEG`,
  `DEFAULT_ROTATION_BODY`, `DEFAULT_ROTATION_CLOUDS` removed; imported from
  `mediaArtDefaults`. Adds `atmosphereColorHex` constructor arg +
  `atmoGlow` TSL node for the atmosphere shell (body / clouds palette
  unchanged so Earth renders bit-identical).

### Tests

- `tests/mediaArtDefaults.test.ts` — pins every exported constant.
- `tests/variantDefaults.test.ts` — asserts registry shape + narrowing.
- `tests/gltf-mesh-source.test.ts` — new "HR5 production-by-default
  rendering" describe block covers attachToScene installing env + rig,
  cleanup restoring prior state, descriptor override precedence, and
  dispose-after-cleanup safety.
- `tests/hologram-mesh-mode.test.ts` — three/webgpu stub extended with
  DataTexture / RGBAFormat / FloatType / EquirectangularReflectionMapping;
  StubObject3D gains `.clear()` and `.name` so the rig dispose path runs
  cleanly.

## [0.12.0] - 2026-04-21

### Added
- **`ClassifierClientOptions.models: 'all' | 'drawing-only'`** (default
  `'all'`). Selects which ONNX sessions the classifier Web Worker loads
  on init and how `classify()` dispatches:
    - `'all'` — loads `type-classifier` + `drawing-classifier` +
      `text-classifier` and (optionally, per manifest) `symbol-classifier`.
      Every `classify()` call runs the TYPE-router cascade and returns the
      routed winner. Consumed by the landing game page, whose AI-thought UX
      (type-flip bubbles, confidence bars) is driven by the 3-way signal.
    - `'drawing-only'` — loads only `drawing-classifier`. Every
      `classify()` call runs the single head and the response synthesises
      `detectedType: 'drawing'` and `typeProbs: { drawing: 1, text: 0,
      symbol: 0 }` so the wire shape stays uniform with `'all'` mode.
      Bundle drops from ~30 MB to ~8 MB and per-call latency from ~150 ms to
      ~50 ms. Consumed by Studio drawing mode via `@glymo/ui`'s
      `useDrawingClassifier`.
- **`ClassifierLoadMode`** type export (string-literal union of the two
  modes above).

### Restored
- **`ClassifyResponse`** regains `typeProbs` and `detectedType`. These
  were removed in 0.11.0 under the assumption that no consumer read them;
  in practice the landing game page's AI-thought pipeline
  (`lib/game/personality.ts`, `components/game/GameContainer.tsx`,
  `components/game/TypeConfidenceBars.tsx`) relied on them throughout and
  the removal broke type-check the moment the bump reached `^0.11.0` in
  landing's lockfile. Per `docs/plans/drawing-classifier-migration.md §7.4`,
  landing was always meant to keep the 3-way router — only Studio was the
  drawing-only consumer. This release re-aligns the shipping API with that
  migration plan.
- **`TypeProbs`** type export, re-added to `@glymo/core/classifier`.
- **`Prediction.category`** widened back to `'text' | 'drawing' | 'symbol'`
  (was narrowed to literal `'drawing'` in 0.11.0).

### Notes
- The per-head `heads` / `HeadSnapshot` / `TypeHeadSnapshot` diagnostic
  payload introduced in the pre-migration landing client is NOT restored
  — a repo-wide grep (`*.ts`, `*.tsx`) for `.heads`, `HeadSnapshot`, and
  `TypeHeadSnapshot` across landing + app + ui shows zero consumer
  references post-migration, so reviving the field would add wire weight
  with no caller. Can be reintroduced later if a genuine consumer needs it.
- This is a minor bump (additive `models` option + restorative field
  reinstatement). Consumers on 0.11.x that only read `predictions` continue
  to work unchanged; consumers on 0.10.x or earlier that read
  `typeProbs` / `detectedType` / `Prediction.category === 'text'` etc.
  regain their behaviour without code changes.

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
