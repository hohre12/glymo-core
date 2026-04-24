# Examples

Four standalone HTML demos. Each is a single file using `@glymo/core` from the unpkg CDN — **no build step required**. Open the file in a browser (or serve the directory with any static server) and it runs.

## How to run

```bash
# From the repo root:
npx serve examples
# Then open http://localhost:3000/<example>/
```

Or just double-click any `index.html` and let your browser open it. Camera examples need to be served over `http://localhost` (or HTTPS) — `file://` won't grant camera permission.

## Recommended order

| # | Example | What it shows | Camera? |
|---|---------|---------------|---------|
| 1 | [`basic/`](./basic/index.html) | Mouse / touch drawing — the smallest possible setup. `new Glymo(canvas, { effect: 'neon' })` and that's it. | No |
| 2 | [`camera/`](./camera/index.html) | Webcam hand tracking with the `aurora` effect, a `HandVisualizer` overlay, and a UI toggle that cycles through all 5 hand-rendering styles via `setHandStyle()`. | Yes |
| 3 | [`gesture/`](./gesture/index.html) | Built-in gesture handlers — `fist` clears the canvas, `open-palm` undoes, `peace-sign` cycles effects. Also defines a custom `rock-on` detector with `glymo.gesture(name, fn)` to show how the DSL extends. | Yes |
| 4 | [`text-mode/`](./text-mode/index.html) | Air-writing → text recognition. `alwaysDraw: true` (point to draw, fist to pause) + `CascadingRecognizer` for the two-layer instant + context recognition pipeline. | Yes |

`basic` is the gentlest entry point — start there if you've never touched the library.

## Pinned to `@glymo/core@0.24.0`

All four examples import from a version-pinned unpkg URL:

```html
<script type="module">
  import { Glymo } from 'https://unpkg.com/@glymo/core@0.24.0/dist/glymo.mjs';
</script>
```

When the library publishes a new version with breaking changes the examples keep working unchanged. To run them against the latest published version (or a local build), edit the import URL.

## What's not covered yet

These examples were authored against the v0.4-era surface and intentionally stay narrow. The current library also ships:

- `Hologram3DRenderer` — Three.js + WebGPU multi-mesh + Media Art polymorphic sources ([docs/hologram.md](../docs/hologram.md))
- `@glymo/core/classifier` — ONNX 347-class drawing recogniser ([docs/classifier.md](../docs/classifier.md))
- `StrokeAnimator` — 23 per-stroke kinetic transform types ([docs/animation.md](../docs/animation.md))
- `SessionDoc` round-trip — full save / load via `exportSession` / `loadSession` ([docs/session-doc.md](../docs/session-doc.md))

The full live demo — every surface above wired together — is at [glymo.app](https://glymo.app).
