// Web Worker for ONNX model inference — dual-mode.
//
// Loading mode is chosen at init time via the main-thread `init` message:
//   - 'all'          — loads type-classifier + drawing-classifier +
//                       text-classifier and (if published in the manifest)
//                       symbol-classifier. Runs the TYPE router cascade on
//                       every classify() call and returns the routed winner
//                       along with TYPE probabilities. Used by the landing
//                       game page ("AI thought" UX requires the 3-way signal).
//   - 'drawing-only' — loads only drawing-classifier. Every classify() call
//                       runs the single head and the response synthesises
//                       `detectedType = 'drawing'` / `typeProbs = { drawing:1,
//                       text:0, symbol:0 }` so the wire shape stays uniform
//                       for consumers that don't care about routing (Studio
//                       drawing mode). ~30MB → ~8MB bundle, ~150ms → ~50ms
//                       per classify call.
//
// Uses onnxruntime-web WASM backend (not WebGL) to avoid GPU contention
// with MediaPipe.
//
// Message protocol:
// Main -> Worker:
//   { type: 'init', models?: 'all' | 'drawing-only' }   (default: 'all')
//   { type: 'classify', imageData: Float32Array, width, height, requestId }
// Worker -> Main:
//   { type: 'init-progress', progress: number, model: string }
//   { type: 'init-complete' }
//   { type: 'init-error', error: string }
//   { type: 'result', predictions, typeProbs, detectedType, requestId }
//   { type: 'error', error: string, requestId: string }

import * as ortRuntime from 'onnxruntime-web';
import { fetchManifest, loadModel } from './model-cache.js';
import {
  TYPE_CATEGORIES,
  DRAWING_CATEGORIES,
  TEXT_CATEGORIES,
  SYMBOL_CATEGORIES,
} from './categories.js';

// ---- Types ----

type HeadType = 'text' | 'drawing' | 'symbol';

interface Prediction {
  label: string;
  confidence: number;
  category: HeadType;
}

interface TypeProbs {
  text: number;
  drawing: number;
  symbol: number;
}

type LoadMode = 'all' | 'drawing-only';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrtModule = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InferenceSession = any;

// ---- State ----

let ort: OrtModule | null = null;
let mode: LoadMode = 'all';
let typeSession: InferenceSession | null = null;
let drawingSession: InferenceSession | null = null;
let textSession: InferenceSession | null = null;
let symbolSession: InferenceSession | null = null;

// ---- Helpers ----

function softmax(logits: Float32Array): Float32Array {
  const max = logits.reduce((a, b) => Math.max(a, b), -Infinity);
  const exps = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    exps[i] = Math.exp((logits[i] ?? 0) - max);
    sum += exps[i]!;
  }
  for (let i = 0; i < exps.length; i++) {
    exps[i] = exps[i]! / sum;
  }
  return exps;
}

function topK(
  probs: Float32Array,
  labels: readonly string[],
  k: number,
  category: HeadType,
): Prediction[] {
  const indexed = Array.from(probs).map((confidence, i) => ({
    label: labels[i] ?? `unknown_${i}`,
    confidence,
    category,
  }));
  indexed.sort((a, b) => b.confidence - a.confidence);
  return indexed.slice(0, k);
}

// ---- Model loading ----

async function loadOrt(): Promise<OrtModule> {
  ortRuntime.env.wasm.wasmPaths = '/onnx/';
  return ortRuntime;
}

async function loadSession(
  ortModule: OrtModule,
  modelName: string,
  manifest: Awaited<ReturnType<typeof fetchManifest>>,
): Promise<InferenceSession> {
  const buffer = await loadModel(modelName, manifest);
  return ortModule.InferenceSession.create(buffer, {
    executionProviders: ['wasm'],
  });
}

// ---- Init ----

async function handleInit(opts: { models?: LoadMode } = {}) {
  try {
    mode = opts.models ?? 'all';
    console.log(`[classifier.worker] init: mode=${mode}, loading onnxruntime-web…`);

    // Any failure loading ONNX Runtime is fatal — there is NO mock fallback.
    // A silent mock would flip status.ready=true on the main thread and
    // cause downstream UI to persist fabricated predictions.
    try {
      ort = await loadOrt();
      console.log('[classifier.worker] onnxruntime-web loaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'init-error', error: `Failed to load onnxruntime-web: ${message}` });
      return;
    }

    let manifest: Awaited<ReturnType<typeof fetchManifest>>;
    try {
      manifest = await fetchManifest();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'init-error', error: `Failed to fetch model manifest: ${message}` });
      return;
    }

    const manifestKeys = Object.keys(manifest.models ?? {});

    // Decide which models to load based on mode.
    //   - 'all':           type + drawing + text required; symbol optional.
    //   - 'drawing-only':  drawing required; all others skipped entirely.
    const requiredModels: string[] =
      mode === 'drawing-only'
        ? ['drawing-classifier']
        : ['type-classifier', 'drawing-classifier', 'text-classifier'];
    const optionalModels: string[] =
      mode === 'drawing-only' ? [] : ['symbol-classifier'];
    const toLoad = [
      ...requiredModels,
      ...optionalModels.filter((name) => manifestKeys.includes(name)),
    ];

    // Verify every required model is in the manifest before starting.
    for (const name of requiredModels) {
      if (!manifestKeys.includes(name)) {
        self.postMessage({
          type: 'init-error',
          error: `Manifest missing required model "${name}" for mode "${mode}"`,
        });
        return;
      }
    }

    const totalModels = toLoad.length;
    console.log(
      `[classifier.worker] manifest loaded, models to load (${mode}): ${toLoad.join(', ')}`,
    );

    for (let i = 0; i < toLoad.length; i++) {
      const name = toLoad[i]!;
      const isOptional = optionalModels.includes(name);
      self.postMessage({
        type: 'init-progress',
        progress: Math.round((i / totalModels) * 100),
        model: name,
      });

      try {
        console.log(`[classifier.worker] loading ${name}…`);
        const session = await loadSession(ort!, name, manifest);
        switch (name) {
          case 'type-classifier': typeSession = session; break;
          case 'drawing-classifier': drawingSession = session; break;
          case 'text-classifier': textSession = session; break;
          case 'symbol-classifier': symbolSession = session; break;
        }
        console.log(`[classifier.worker] ${name} ready`);
      } catch (err) {
        if (isOptional) {
          console.warn(`Optional model "${name}" unavailable, continuing:`, err);
          continue;
        }
        const message = err instanceof Error ? err.message : String(err);
        self.postMessage({
          type: 'init-error',
          error: `Failed to load required model "${name}": ${message}`,
        });
        return;
      }
    }

    console.log(`[classifier.worker] all models loaded (${mode}) — classifier is READY`);

    self.postMessage({
      type: 'init-progress',
      progress: 100,
      model: 'done',
    });
    self.postMessage({ type: 'init-complete' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'init-error', error: message });
  }
}

// ---- Inference ----

async function runInference(
  session: InferenceSession,
  imageData: Float32Array,
): Promise<Float32Array> {
  if (!ort) throw new Error('ONNX Runtime not loaded');

  const inputTensor = new ort.Tensor('float32', imageData, [1, 1, 64, 64]);

  const inputName = session.inputNames[0] ?? 'input';
  const feeds: Record<string, unknown> = { [inputName]: inputTensor };

  const results = await session.run(feeds);
  const outputName = session.outputNames[0] ?? 'output';
  const output = results[outputName];

  return softmax(new Float32Array(output.data as ArrayBufferLike));
}

// TYPE-router cascade simplification: TYPE is advisory, not gatekeeper.
// Every specialist whose session is loaded runs per classify() call; the
// winner is chosen by max(joint_score, override_score) where
//   joint_score    = P(type=C) × specialist_C.top1
//   override_score = max(0, specialist_C.top1 − OVERRIDE_MARGIN)
// The override branch allows a highly confident specialist to win even when
// TYPE bet against it; the margin (0.20) is the "cost" of overriding TYPE.
// Trade-off: 3× inference cost (~150 ms vs ~50 ms) — acceptable given the
// 500 ms main-thread polling cadence.
const OVERRIDE_MARGIN = 0.2;

interface HeadSpec {
  type: HeadType;
  pType: number;
  session: InferenceSession | null;
  categories: readonly string[];
}

async function classifyDrawingOnly(
  imageData: Float32Array,
): Promise<{
  predictions: Prediction[];
  typeProbs: TypeProbs;
  detectedType: HeadType;
}> {
  if (!drawingSession) {
    throw new Error('Drawing classifier not loaded');
  }
  const probs = await runInference(drawingSession, imageData);
  const predictions = topK(probs, DRAWING_CATEGORIES, 5, 'drawing');
  // Synthesize TYPE-router fields so the wire shape matches 'all' mode.
  // Consumers that branch on detectedType will simply always hit 'drawing'.
  return {
    predictions,
    typeProbs: { text: 0, drawing: 1, symbol: 0 },
    detectedType: 'drawing',
  };
}

async function classifyAll(
  imageData: Float32Array,
): Promise<{
  predictions: Prediction[];
  typeProbs: TypeProbs;
  detectedType: HeadType;
}> {
  if (!typeSession) {
    // Reaching this branch means classify() was called before init resolved
    // successfully — programmer error, not a runtime fallback condition.
    throw new Error('Type classifier not loaded');
  }

  // Step 1: TYPE router — softmax probs over { drawing, text, symbol }.
  const typeProbsArr = await runInference(typeSession, imageData);
  let maxIdx = 0;
  for (let i = 1; i < typeProbsArr.length; i++) {
    if ((typeProbsArr[i] ?? 0) > (typeProbsArr[maxIdx] ?? 0)) maxIdx = i;
  }
  const detectedType = (TYPE_CATEGORIES[maxIdx] ?? 'drawing') as HeadType;

  const textIdx = TYPE_CATEGORIES.indexOf('text');
  const symbolIdx = TYPE_CATEGORIES.indexOf('symbol');
  const drawingIdx = TYPE_CATEGORIES.indexOf('drawing');
  const pText = typeProbsArr[textIdx] ?? 0;
  const pSymbol = typeProbsArr[symbolIdx] ?? 0;
  const pDrawing = typeProbsArr[drawingIdx] ?? 0;

  const heads: Record<HeadType, HeadSpec> = {
    text:    { type: 'text',    pType: pText,    session: textSession,    categories: TEXT_CATEGORIES },
    symbol:  { type: 'symbol',  pType: pSymbol,  session: symbolSession,  categories: SYMBOL_CATEGORIES },
    drawing: { type: 'drawing', pType: pDrawing, session: drawingSession, categories: DRAWING_CATEGORIES },
  };

  // Step 2: build candidate set — every head whose session loaded.
  const candidates: HeadSpec[] = [];
  for (const t of ['text', 'symbol', 'drawing'] as const) {
    const h = heads[t];
    if (h.session) candidates.push(h);
  }
  if (candidates.length === 0) throw new Error('No specialist classifier loaded');

  // Step 3: run each candidate sequentially (ORT WASM constraint — concurrent
  // run() calls across sessions trigger "Session already started").
  interface Evaluated {
    head: HeadSpec;
    probs: Float32Array;
    top1: number;
    joint: number;
    override: number;
    score: number;
  }
  const evaluated: Evaluated[] = [];
  for (const h of candidates) {
    const probs = await runInference(h.session!, imageData);
    let top1 = 0;
    for (let i = 0; i < probs.length; i++) {
      if ((probs[i] ?? 0) > top1) top1 = probs[i] ?? 0;
    }
    const joint = h.pType * top1;
    const override = Math.max(0, top1 - OVERRIDE_MARGIN);
    const score = Math.max(joint, override);
    evaluated.push({ head: h, probs, top1, joint, override, score });
  }

  // Step 4: pick winner by max score.
  evaluated.sort((a, b) => b.score - a.score);
  const winner = evaluated[0]!;
  const predictions = topK(winner.probs, winner.head.categories, 5, winner.head.type);

  // Diagnostic: show joint+override per head; `*` marks the head TYPE picked.
  const cands = evaluated
    .map((e) => {
      const star = e.head.type === detectedType ? '*' : '';
      return `${star}${e.head.type}(j=${e.joint.toFixed(2)},o=${e.override.toFixed(2)})`;
    })
    .join(' ');
  console.log(
    `[classifier] type=${detectedType} ` +
    `(t=${pText.toFixed(2)} s=${pSymbol.toFixed(2)} d=${pDrawing.toFixed(2)}) ` +
    `${cands} → ${winner.head.type}:${predictions[0]?.label} ` +
    `${(predictions[0]?.confidence ?? 0).toFixed(2)}`,
  );

  return {
    predictions,
    typeProbs: { text: pText, drawing: pDrawing, symbol: pSymbol },
    detectedType,
  };
}

async function handleClassify(imageData: Float32Array, requestId: string) {
  try {
    const result =
      mode === 'drawing-only'
        ? await classifyDrawingOnly(imageData)
        : await classifyAll(imageData);

    self.postMessage({
      type: 'result',
      predictions: result.predictions,
      typeProbs: result.typeProbs,
      detectedType: result.detectedType,
      requestId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', error: message, requestId });
  }
}

// ---- Message handler ----

self.onmessage = (event: MessageEvent) => {
  const { data } = event;

  switch (data.type) {
    case 'init':
      handleInit({ models: data.models });
      break;
    case 'classify':
      handleClassify(data.imageData, data.requestId);
      break;
    default:
      console.warn('Unknown message type:', data.type);
  }
};
