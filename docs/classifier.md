# Classifier — `@glymo/core/classifier`

A separate npm subpath export for ONNX-based hand-drawing recognition. Kept out of the main bundle so apps that don't need ML inference don't pay the bundle cost (~30 MB in `'all'` mode, ~8 MB in `'drawing-only'` mode).

## Install

The classifier reaches `onnxruntime-web` through an **optional peer dependency**. Install it alongside `@glymo/core` if you use this subpath:

```bash
npm install @glymo/core onnxruntime-web
```

`onnxruntime-web` ships its own WebAssembly binaries. The worker expects them to be served at `/onnx/` — the consumer app must copy `node_modules/onnxruntime-web/dist/*.wasm` to its `public/onnx/` (or equivalent) directory at build time.

## Quickstart

```typescript
import { ClassifierClient, strokesToImage } from '@glymo/core/classifier';

const classifier = new ClassifierClient({
  // The `new URL(..., import.meta.url)` idiom is the only pattern recognised by
  // webpack / Next.js Turbopack / Vite for Web Worker URL resolution. The URL
  // MUST be constructed at the consumer call site so the bundler emits a
  // hashed asset for the worker bundle.
  workerUrl: new URL(
    '@glymo/core/classifier/classifier.worker.js',
    import.meta.url,
  ),
  models: 'all', // or 'drawing-only'
});

await classifier.init();

const image = strokesToImage(strokes); // Float32Array(64*64)
const result = await classifier.classify(image);

console.log(result.predictions[0]);   // { label: 'sun', confidence: 0.94, category: 'drawing' }
console.log(result.detectedType);     // 'drawing' | 'text' | 'symbol'
console.log(result.typeProbs);        // { text: 0.02, drawing: 0.96, symbol: 0.02 }
```

## `ClassifierClient`

```typescript
new ClassifierClient(options?: ClassifierClientOptions)
```

| Option | Type | Default | Notes |
|--------|------|---------|-------|
| `workerUrl` | `URL` | `new URL('./classifier.worker.js', import.meta.url)` | Override required for downstream bundlers — see Quickstart |
| `models` | `'all' \| 'drawing-only'` | `'all'` | Selects which ONNX heads the worker loads |

### Methods

| Method | Returns | Notes |
|--------|---------|-------|
| `init()` | `Promise<void>` | Spawns the worker and loads models. Idempotent — repeated calls return the same promise. |
| `classify(imageData: Float32Array)` | `Promise<ClassifyResponse>` | Expects a 64×64 grayscale image. Times out after 5000 ms. |
| `onStatusChange(listener)` | `() => void` (unsubscribe) | Listener fires immediately with the current status, then on every change. |
| `getStatus()` | `ClassifierStatus` | `{ ready, loading, error, progress }` snapshot. |
| `destroy()` | `void` | Terminates the worker, rejects pending requests, resets state. |

## Load modes

| Mode | Loads | `classify()` runs | `detectedType` | `typeProbs` | Used by |
|------|-------|-------------------|----------------|-------------|---------|
| `'all'` | type-classifier + drawing/text/symbol heads (symbol optional in manifest) | TYPE router → routed specialist head | routed winner | router output | Landing game page (3-way "AI thought" UX) |
| `'drawing-only'` | drawing-classifier only | drawing head only | always `'drawing'` | synthesised `{ drawing: 1, text: 0, symbol: 0 }` | Studio drawing mode |

`'drawing-only'` reduces bundle from ~30 MB to ~8 MB and per-call latency from ~150 ms to ~50 ms. The wire shape is identical so callers can read either mode without branching.

## `ClassifyResponse`

```typescript
interface ClassifyResponse {
  predictions: Prediction[];           // top-5 from the routed winner head
  typeProbs: TypeProbs;                // { text, drawing, symbol } — sums to ~1
  detectedType: 'text' | 'drawing' | 'symbol';
}

interface Prediction {
  label: string;                       // English label (e.g. 'sun', 'A', 'heart')
  confidence: number;                  // 0..1 softmax probability
  category: 'text' | 'drawing' | 'symbol';
}
```

## Models + manifest

Models are loaded over HTTP from the consumer app's static assets:

| URL | Purpose |
|-----|---------|
| `/models/manifest.json` | Lists available models with version + filename + class count |
| `/models/<file>` | Each ONNX model (one HTTP request per head) |
| `/onnx/*.wasm` | onnxruntime-web WASM binaries (consumer-served) |

`ModelManifest`:

```typescript
interface ModelManifest {
  version: string;
  models: Record<string, { file: string; version: string; categories: number }>;
}
```

The manifest is the source of truth — adding a head means adding an entry there, not changing client code.

## IndexedDB model cache

Models are version-keyed in IndexedDB so subsequent visits skip the download:

| | |
|---|---|
| DB | `glymo-classifier` |
| Object store | `models` (key path: `name`) |
| Cache key | `(name, version)` from the manifest |

Helpers exposed for advanced use (clearing the cache, pre-warming, debug panels):

```typescript
import { openModelDB, fetchManifest, loadModel } from '@glymo/core/classifier';

const db = await openModelDB();
const manifest = await fetchManifest();
const buffer = await loadModel('drawing-classifier', manifest);
```

`loadModel` checks the cache first, falls back to fetching `/models/<file>`, then writes back. Cache write failure is non-fatal (logs `console.warn` and proceeds).

## Categories

| Export | Length | Source of truth |
|--------|-------:|-----------------|
| `TYPE_CATEGORIES` | 3 (`['text', 'symbol', 'drawing']`) | Hard-coded — TYPE router output order |
| `DRAWING_CATEGORIES` | 347 | `glymo-server/ml/training/common/config.py::DRAWING_CATEGORIES` (Phase 1.8 v003: QuickDraw 345 + heart + robot) |
| `TEXT_CATEGORIES` | — | `categories.ts` (alphanumerics + Korean Jamo) |
| `SYMBOL_CATEGORIES` | — | `categories.ts` |

**Order is load-bearing.** The trained ONNX models emit logits at fixed indices — if the trainer's class order changes, `categories.ts` MUST be regenerated. A mismatched order produces confidently wrong predictions because the model returns index N and the client reads a different label at index N.

`ALL_CLASSIFIER_LABELS` is the union of all three lists — useful for tests, logging, and debug panels that need to iterate every possible label.

## `strokesToImage` — preprocessing parity

```typescript
function strokesToImage(
  strokes: StrokePoint[][],
  canvasSize?: number,        // default 64
): Float32Array;              // length canvasSize * canvasSize
```

Renders strokes to a square Float32 grayscale image (0.0 = black, 1.0 = white) suitable as direct input to `classify()`.

Critical preprocessing invariants — these MUST mirror the training pipeline. Drift here is the root cause of the **"Sun → ㅋ"** class of bug:

| Setting | Value | Why |
|---------|-------|-----|
| Padding | `0` | Training maps normalised x/y to the full `0..size-1` range. A 4 px padding mismatch caused Sun → ㅋ at 100 % confidence. |
| Line cap | `butt` | Training uses `cv2.line` / `cv2.polylines` (square ends). Round caps introduce bulbs the model never saw. |
| Line join | `miter` | Same reason. |
| Line width | `2` px | |
| Background | black, fill `'black'` | |
| Stroke | white, fill `'white'` | |
| Bbox normalisation | square-bbox (max of rangeX, rangeY) | Preserves aspect ratio while filling the larger dimension — matches `01_download_quickdraw.py` lines 106–124 + 156–159. |
| Anti-aliasing | **preserved** (no post-binarisation) | 3 of 4 TYPE training sources use anti-aliased gradients (synthetic vector strokes, AI-Hub Korean grayscale PNGs, EMNIST bilinear upscale); only QuickDraw is hard-binary. Forcing inference to binary biases TYPE strongly toward DRAWING / QuickDraw-symbol classes. |

If you ever change `strokesToImage` you must re-run the preprocessing-parity golden test in `tests/` and confirm the trained heads still classify the golden set correctly.

## `TypeStabilizer` — hysteresis on noisy TYPE router

The TYPE router emits a fresh `detectedType` every ~500 ms. Around category boundaries (a slowly-drawn 'L' briefly registers as drawing, a serif on a letter briefly registers as symbol) the raw signal flips repeatedly. Driving UX off the raw signal feels jittery and confidently wrong.

`TypeStabilizer` requires the new type to persist for `windowMs` AND appear in at least `minConsecutive` back-to-back observations before confirming the flip. Pure synchronous observer — no timers, no React.

```typescript
import { TypeStabilizer } from '@glymo/core/classifier';

const stabilizer = new TypeStabilizer(); // windowMs=1500, minConsecutive=2 (defaults)

const { stableType, changed } = stabilizer.observe(result.detectedType, performance.now());
if (changed) {
  // run the flip animation / update copy
}
```

`reset()` clears history — call it when the drawing phase restarts so the next round's first observation isn't compared against a stale type.

## `translateLabel` — locale-aware label display

```typescript
import { translateLabel } from '@glymo/core/classifier';

translateLabel('sun', 'ko');  // '태양'
translateLabel('sun', 'en');  // 'sun'  — default locale returns raw label
translateLabel('unknown', 'ko'); // 'unknown' — graceful fallback for missing labels
```

Supported locales: `'en'` (default) and `'ko'`. Adding a locale to the `ClassifierLocale` union flags every entry of `LABEL_TRANSLATIONS` that's missing the new key — the `NonDefaultLocale` type guarantees compile-time completeness.

`label-translations.ts` is **generated**. Source: `glymo-server/app/ml/drawing_metadata.py` for drawing labels and embedded tables in `glymo-server/ml/scripts/generate_landing_translations.py` for text/symbol. Regenerate with `python -m ml.scripts.generate_landing_translations --write`.

## Note on `StrokePoint`

The classifier subpath defines its own `StrokePoint` shape (`{ x, y, pressure, timestamp }`) that diverges from the main pipeline's `StrokePoint` (`{ x, y, t, pressure }`). The names match the layer they originated in:

- `@glymo/core` `StrokePoint` — pipeline / capture invariants, `t` for `performance.now()` timestamps.
- `@glymo/core/classifier` `StrokePoint` — game / drawing layer, `timestamp` for the same conceptual value.

Unifying the two would require touching the renderer, pipeline, exporter, and every classifier consumer — out of scope for the classifier extraction. Both shapes are stable contracts at their respective layers.

## Worker message protocol

Internal contract — documented for tooling and debugging. The `ClassifierClient` is the only supported way to talk to the worker.

```
Main → Worker
  { type: 'init', models?: 'all' | 'drawing-only' }
  { type: 'classify', imageData: Float32Array, width: 64, height: 64, requestId: string }

Worker → Main
  { type: 'init-progress', progress: number, model: string }
  { type: 'init-complete' }
  { type: 'init-error', error: string }
  { type: 'result', predictions, typeProbs, detectedType, requestId }
  { type: 'error', error: string, requestId: string }
```

Backend choice: WASM (not WebGL) to avoid GPU contention with MediaPipe hand tracking running on the same page.

## See also

- [architecture.md](./architecture.md) — overall module map
- `glymo-server/ml/` — training pipeline + ONNX export (in the server repo)
