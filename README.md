<p align="center">
  <h1 align="center">@glymo/core</h1>
  <p align="center"><strong>Hand-powered creative toolkit for the browser</strong></p>
  <p align="center">Hand tracking, drawing pipeline, gesture DSL, ONNX recognition, and a WebGPU hologram — all in one TypeScript library.</p>
</p>

<p align="center">
  <a href="https://github.com/hohre12/glymo/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@glymo/core"><img src="https://img.shields.io/npm/v/@glymo/core.svg" alt="npm" /></a>
  <a href="./README.ko.md">한국어</a>
</p>

---

```typescript
import { Glymo } from '@glymo/core';

const glymo = await Glymo.create(canvas, {
  camera: true,
  effect: 'neon',
  handStyle: 'aurora',
});
```

That's the hello-world. Read on for what else is inside.

## Install

```bash
npm install @glymo/core
```

Optional peer dependencies — install only the ones you actually use:

| Module | Peer dependency | Used by |
|--------|-----------------|---------|
| Camera + hand tracking | `@mediapipe/tasks-vision >= 0.10` | `Glymo.create({ camera: true })`, `HandVisualizer` |
| Hologram 3D | `three >= 0.160` | `Hologram3DRenderer` |
| ONNX classifier | `onnxruntime-web ^1.24` | `@glymo/core/classifier` subpath |
| Tesseract OCR fallback | `tesseract.js ^5.0` | Text-mode fallback recogniser |

## What's inside

| Area | Highlights | Deep dive |
|------|-----------|-----------|
| **6-stage drawing pipeline** | Capture → Stabilize → Pressure → Segment → Smooth → Effect. OneEuroFilter stabilisation, velocity-driven pressure taper, Chaikin smoothing. | [docs/architecture.md](./docs/architecture.md) |
| **Renderers** | Canvas 2D + WebGPU with auto-fallback, runtime-extensible effect registry, fill tool, layered compositor. | [docs/architecture.md](./docs/architecture.md#rendering-modes) |
| **Hand input** | MediaPipe-driven `CameraCapture`, mouse/touch via `MouseCapture`, 5 artistic hand-rendering styles (`neon-skeleton` / `crystal` / `flame` / `aurora` / `particle-cloud`). | [docs/architecture.md](./docs/architecture.md#extension-points) |
| **Gesture DSL** | `GestureEngine` + 6 built-in gestures (pinch / fist / point / open-palm / peace-sign / thumbs-up); register your own with a `(hand) => boolean` detector. | [docs/architecture.md](./docs/architecture.md#extension-points) |
| **Text mode** | `CascadingRecognizer` — instant per-stroke + context re-recognition with anti-cycling. Glyph extraction + kinetic typography (`KineticEngine`). | [docs/architecture.md](./docs/architecture.md#public-api-surface) |
| **ONNX classifier** | Separate `@glymo/core/classifier` subpath. 347-class drawing recogniser + TYPE router (text / drawing / symbol). IndexedDB model cache, hysteresis stabiliser. | [docs/classifier.md](./docs/classifier.md) |
| **Hologram 3D + Media Art** | `Hologram3DRenderer` (Three.js + WebGPU) — multi-mesh scene with bloom, polymorphic mesh sources (`gltf` / `gltf-pbr` / `procedural-planet`). | [docs/hologram.md](./docs/hologram.md) |
| **Per-stroke animations** | `StrokeAnimator` with 23 built-in types (locomotion + modulation + legacy), composable per-channel. | [docs/animation.md](./docs/animation.md) |
| **Session round-trip** | `exportSession()` / `loadSession()` — strokes, objects, fills, animations, characters, media-art mesh metadata. | [docs/session-doc.md](./docs/session-doc.md) |
| **Diagnostics** | Opt-in `DiagBus` for per-stage timing + drop accounting (text-mode debugging). | [docs/architecture.md](./docs/architecture.md#diagnostics) |

## The 6-stage pipeline at a glance

```
input ──► Capture ──► Stabilize ──► Pressure ──► Segment ──► Smooth ──► Effect ──► canvas
            (per point — real-time)              (accumulator)   (batch on penUp)   (paint time)
```

- **Capture**: Wraps a raw input point into a typed `StrokePoint`.
- **Stabilize**: OneEuroFilter — removes jitter while preserving responsiveness. Source-aware mouse/camera presets.
- **Pressure**: Velocity → pressure (slow = thick, fast = thin) + per-stroke taper.
- **Segment**: Buffers points until `penUp()`. Drops short strokes.
- **Smooth**: Chaikin's corner cutting (4 iterations).
- **Effect**: Glow, gradient, particles, variable-width — applied by the renderer at paint time.

## Subpackages

| Subpath | Purpose |
|---------|---------|
| `@glymo/core` | Main library — everything in the table above except the classifier. |
| `@glymo/core/classifier` | ONNX inference (drawing / text / symbol). Lazy-loadable — apps that don't need ML don't pay the bundle. |
| `@glymo/core/classifier/classifier.worker.js` | Worker entry the client spawns at runtime. |

## Built-in effect presets

| Preset | Style |
|--------|-------|
| `calligraphy` | Warm ink, variable width |
| `neon` | Electric glow, intense bloom |
| `gold` | Metallic shimmer, warm particles |
| `aurora` | Pastel gradient flow |
| `fire` | Hot gradient, rising sparks |
| `liquid` / `hologram` / `bloom` / `dissolve` / `gpu-particles` | WebGPU-only — renderer auto-falls back to Canvas 2D when WebGPU is unavailable, emitting `renderer:fallback` |

Register your own with `registerEffect(id, definition)` — see [docs/architecture.md#extension-points](./docs/architecture.md#extension-points).

## Browser support

- Chrome 90+ (recommended)
- Edge 90+
- Safari 16.4+
- Firefox 100+

WebGPU features (`gpu-particles` preset, `Hologram3DRenderer`) require Chrome 113+ or Edge 113+. `Hologram3DRenderer.ready` resolves `false` and emits `renderer:fallback` on unsupported browsers.

## Examples

Working HTML demos live under [`examples/`](./examples). Each is a single file you can open in a browser without a build step.

## License

[MIT](./LICENSE) © Glymo contributors

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, and [CHANGELOG.md](./CHANGELOG.md) for the version history.
