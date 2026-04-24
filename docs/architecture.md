# Architecture

This document describes how `@glymo/core` is organised internally. For day-to-day usage see the [README](../README.md); for module-specific deep-dives follow the links at the bottom of each section.

## The 6-stage pipeline

Every stroke flows through six ordered stages. The first five are owned by `PipelineEngine`; the sixth is applied by the renderer at paint time.

```
                    ┌───────────────────── PipelineEngine ─────────────────────┐
input source        │                                                           │     renderer
──────────────►     │  Capture → Stabilize → Pressure → Segment → Smooth        │ ──► Effect → canvas
(mouse | touch |    │  ─real-time per point─►   ──batch on penUp()──►          │
 camera)            └───────────────────────────────────────────────────────────┘
```

| Stage | Where | Mode | What it does |
|-------|-------|------|--------------|
| **Capture** | `pipeline/stages/CaptureStage.ts` | per-point | Wraps a `RawInputPoint` into a typed `StrokePoint`. |
| **Stabilize** | `pipeline/stages/StabilizeStage.ts` | per-point | OneEuroFilter — removes jitter while preserving responsiveness. Source-aware (mouse vs camera presets). |
| **Pressure** | `pipeline/stages/PressureStage.ts` | per-point + batch taper | Velocity → pressure conversion (slow = thick, fast = thin). |
| **Segment** | `pipeline/stages/SegmentStage.ts` | accumulator | Buffers stage-3 points until `penUp()`. Drops short strokes. |
| **Smooth** | `pipeline/stages/SmoothStage.ts` | batch on penUp | Chaikin's corner cutting (4 iterations). |
| **Effect** | `render/CanvasRenderer.ts` / `render/WebGPURenderer.ts` | paint time | Glow, gradient, particles, variable-width rendering. |

Stages 1–3 run synchronously per input point (`processPoint`). Stage 4 buffers until pen-up. Stages 5 + the pressure taper run as batch operations inside `penUp()`, returning `{ raw, smoothed }` to the facade. The renderer composites layers (`render/layers/`) on every animation frame.

## Module map

```
src/
├── Glymo.ts                # Main facade — wires every module together
├── types.ts                 # Single source of truth for public types
├── index.ts                 # Public API barrel — `@glymo/core`
│
├── pipeline/                # 6-stage engine + per-stage modules
├── render/                  # Canvas 2D + WebGPU renderers, layers, FloodFill
├── input/                   # MouseCapture, CameraCapture, HandVisualizer, hand-styles
├── gesture/                 # GestureEngine + DSL (HandStateImpl, builtins, HologramGesture)
├── filter/                  # OneEuroFilter (used by StabilizeStage)
│
├── state/                   # EventBus, SessionStateMachine
├── store/                   # ObjectStore, CharacterStore (pure data layer)
├── selection/               # SelectionManager (object selection + events)
│
├── animate/                 # MorphAnimator   — point-to-point morph easing
├── animation/               # StrokeAnimator  — per-stroke kinetic transforms
├── correction/              # snapEndpoints, trimOvershoot, StrokeCorrector
├── grouping/                # SpatialGrouper  — proximity-based stroke grouping
├── effects/                 # Runtime EffectRegistry — register/resolve effects
├── diag/                    # DiagBus — opt-in pipeline diagnostics
│
├── text/                    # Text-mode pipeline (recognition, glyph extract, kinetic typography)
├── classifier/              # `@glymo/core/classifier` subpath — ONNX drawing classifier
├── hologram/                # Three.js multi-mesh renderer + Media Art polymorphic sources
│
├── export/                  # PNG, GIF exporters
└── util/                    # Math utilities, PerformanceMonitor
```

Each module is independently importable from the public barrel. The facade (`Glymo`) only owns the *orchestration* of these modules — most surfaces are usable standalone.

## Subpackages

`@glymo/core` ships two npm subpath exports:

| Subpath | Entry | Purpose |
|---|---|---|
| `@glymo/core` | `dist/glymo.mjs` | Main library — pipeline, renderers, gestures, hologram, text |
| `@glymo/core/classifier` | `dist/classifier/classifier.mjs` | ONNX drawing/text/symbol classifier (lazy-loadable) |
| `@glymo/core/classifier/classifier.worker.js` | `dist/classifier/classifier.worker.mjs` | Worker bundle the client spawns at runtime |

The classifier subpath is intentionally separate so apps that don't need ML inference don't pay the bundle cost. See [classifier.md](./classifier.md).

## Public API surface

The `index.ts` barrel groups exports by feature area:

| Area | Key exports |
|---|---|
| **Facade** | `Glymo`, `CreateOptions`, `GlymoOptions`, `GlymoError` |
| **Pipeline types** | `StrokePoint`, `Stroke`, `RawInputPoint`, `PipelineStage`, `BatchPipelineStage` |
| **Effects** | `EFFECT_PRESETS`, `EffectPresetName`, `registerEffect`, `unregisterEffect`, `getEffect`, `resolveEffect`, `listEffects` |
| **Input + camera** | `HandVisualizer`, `HAND_CONNECTIONS`, `PINCH_THRESHOLD`, `computePinchDistance`, `computeSpeed`, `zToPressure` |
| **Hand styles** | `HandStyleName`, `HandStyleBase`, `createHandStyle` |
| **Gestures** | `GestureEngine`, `HandStateImpl`, `BUILTIN_GESTURES`, `HologramGesture` |
| **Text mode** | `TextRecognizer`, `CascadingRecognizer`, `GlyphExtractor`, `KineticEngine`, `recognizeHandwriting`, `layoutTextAlongCurve`, `layoutTextInCircle`, `layoutTextInShape` |
| **Spatial grouping** | `SpatialGrouper`, `combineBbox`, `bboxNear` |
| **Animation** | `StrokeAnimator`, `AnimationType`, `AnimationParams`, `StrokeAnimation`, `AnimationTransform` |
| **Selection + store** | `SelectionManager`, `ObjectStore` |
| **Correction** | `StrokeCorrector`, `snapEndpoints`, `trimOvershoot` |
| **Fill tool** | `executeFill` |
| **Hologram 3D** | `Hologram3DRenderer`, `MeshHandle`, `createMeshSource`, `BaseMeshSource`, `GltfMeshSource`, `GlbPbrMeshSource`, `ProceduralPlanetMeshSource`, plus `createNeutralLightRig`, `BUNDLED_NEUTRAL_ENVIRONMENT`, `VARIANT_DEFAULTS` |
| **Export** | `GIF_FPS`, `GIF_DURATION_MS`, `GIF_MAX_FRAMES`, `GIF_SIZE_WARN_BYTES` |
| **Diagnostics** | `DiagBus`, `DiagEvent`, `DiagStage` |
| **Performance** | `PerformanceMonitor`, `PERF_WINDOW_SIZE`, `PERF_DEGRADED_THRESHOLD_MS`, `PERF_DEGRADED_CONSECUTIVE` |

Persistence types (`SessionDoc`, `ObjectDoc`, `StrokeDoc`, `FillDoc`, `CharacterDoc`, `AnimationDoc`, `BitmapUploader`, `BitmapLoader`) are documented in [session-doc.md](./session-doc.md).

## Event system

`Glymo` exposes a typed event bus through `glymo.on(event, handler)`. The full map lives in `GlymoEventMap` (`src/types.ts`). Events fall into categories:

| Category | Events |
|---|---|
| Stroke lifecycle | `stroke:start`, `stroke:end`, `stroke:complete` |
| Morph | `morph:start`, `morph:progress`, `morph:complete` |
| Effect / state | `effect:change`, `state:change`, `performance:degraded`, `renderer:fallback`, `error` |
| Camera + hand | `camera:ready`, `camera:denied`, `hand:found`, `hand:lost` |
| Text mode | `text:recognized`, `text:overlay`, `text:matched`, `text:error`, `glyph:extracted`, `character:change` |
| Selection | `object:selected`, `object:deselected`, `selection:changed`, `object:translated` |
| Correction | `correction:applied`, `correction:reverted` |
| Persistence | `session:restore`, `media-art:restore` |
| Gestures | `gesture:<name>` (template literal — fires for every registered or built-in gesture) |

Gesture events fire as `gesture:fist`, `gesture:fist:end`, etc. — see [README](../README.md#gestures).

## Extension points

`@glymo/core` is designed to be extended without forking. The supported seams:

| Seam | Interface | Where to add |
|------|-----------|--------------|
| New pipeline stage | `PipelineStage` (per-point) or `BatchPipelineStage` (on penUp) | `pipeline/stages/`, then wire into `PipelineEngine` |
| New renderer backend | `IRenderer` (`render/IRenderer.ts`) | Mirror `CanvasRenderer` / `WebGPURenderer` |
| New effect preset | `EffectStyle` + `registerEffect(id, definition)` | Either `types.ts` `EFFECT_PRESETS` (built-in) or runtime via the effects registry |
| New hand-rendering style | `HandStyleBase` (`input/hand-styles/types.ts`) | `input/hand-styles/`, then register in `createHandStyle` |
| New gesture | `(hand: HandState) => boolean` detector | `gesture.define(name, fn)` or `Glymo#gesture(name, fn)` |
| New mesh source | `BaseMeshSource` subclass + descriptor variant | `hologram/sources/`, register in `createMeshSource` factory |
| New animation type | `AnimationType` + a `StrokeAnimation` reducer | `animation/StrokeAnimator.ts` |
| Custom render layer | `RenderLayer` (`types.ts`) | `render/layers/`, then attach to the renderer |

The runtime effect registry (`effects/registry.ts`) and the polymorphic mesh source factory (`hologram/sources/`) are the two seams designed to be extended at consumer-app load time without a `@glymo/core` release. See [hologram.md](./hologram.md#mesh-source-factory) for the polymorphic source pack pattern.

## Rendering modes

| Mode | Class | When it runs |
|------|-------|--------------|
| Canvas 2D | `CanvasRenderer` | Default. All `CANVAS_EFFECT_NAMES` presets. |
| WebGPU | `WebGPURenderer` | When `renderer: 'webgpu'` or `renderer: 'auto'` and the browser supports it. Required for `GPU_EFFECT_NAMES` (`liquid`, `hologram`, `bloom`, `gpu-particles`, `dissolve`). |

`Glymo` constructs a Canvas 2D renderer eagerly. Switching to WebGPU happens lazily when the user selects a GPU-only effect or explicitly requests it. On WebGPU init failure the renderer falls back to Canvas 2D and emits `renderer:fallback`.

The Three.js–based `Hologram3DRenderer` is **not** an `IRenderer` implementation — it is a separate 3D layer instantiated by the consumer app on its own canvas, and wired to `Glymo` via the `setMeshHitTestFn` / `setMeshTranslator` injection seams. See [hologram.md](./hologram.md).

## Persistence

`Glymo#exportSession()` returns a `SessionDoc` (v2 wire format) containing strokes, objects, fills, animations, and recognised characters. `Glymo#loadSession(doc, options?)` round-trips it back, emitting `session:restore` and (per restored 3D mesh) `media-art:restore`.

The wire format is a stable contract — diverged fields (e.g. `durationMs` vs runtime `duration`) are intentional unit-explicit names. v1 payloads (`StrokeDoc[]` only) continue to load. Full schema and round-trip rules in [session-doc.md](./session-doc.md).

`Fill` bitmaps are pluggable: the consumer injects a `BitmapUploader` / `BitmapLoader` at construction time so `core` stays HTTP-agnostic.

## Diagnostics

`DiagBus` is an opt-in event channel disabled by default. Enabling it (`DiagBus.enable()`) makes `PipelineEngine` emit per-stage timing and point-count events, used by the landing-page `?diag=1` overlay to debug stroke drops (e.g. Korean diacritic ticks being dropped at the Segment stage). Production builds with `DiagBus.enabled` statically false tree-shake the diag code paths.

## See also

- [classifier.md](./classifier.md) — `@glymo/core/classifier` ONNX inference subpath
- [hologram.md](./hologram.md) — Three.js multi-mesh + Media Art polymorphic sources
- [animation.md](./animation.md) — `MorphAnimator` vs `StrokeAnimator`
- [session-doc.md](./session-doc.md) — `SessionDoc` wire format + persistence round-trip
