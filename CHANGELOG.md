# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
