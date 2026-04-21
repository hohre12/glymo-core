// Web Worker for ONNX model inference — DRAWING ONLY.
//
// The drawing mode always produces drawings. The 3-way TYPE router
// (drawing / text / symbol) and the text / symbol specialist heads were
// removed in @glymo/core 0.11.0 because:
//   1. Text mode runs Gemini on its own path, not this worker.
//   2. Symbol classifier was beta-disabled at 20 % accuracy.
//   3. Running the router + 3 heads cost ~150 ms per call AND mis-routed
//      clean drawings to the text head (e.g. heart → "0" at 100 %), which
//      silently dropped to FALLBACK_PROFILE in `useDrawingClassifier`.
//
// Uses onnxruntime-web WASM backend (not WebGL) to avoid GPU contention
// with MediaPipe.
//
// Message protocol:
// Main -> Worker:
//   { type: 'init' }
//   { type: 'classify', imageData: Float32Array, width, height, requestId }
// Worker -> Main:
//   { type: 'init-progress', progress: number, model: string }
//   { type: 'init-complete' }
//   { type: 'init-error', error: string }
//   { type: 'result', predictions: Prediction[], requestId: string }
//   { type: 'error', error: string, requestId: string }

import * as ortRuntime from 'onnxruntime-web';
import { fetchManifest, loadModel } from './model-cache.js';
import { DRAWING_CATEGORIES } from './categories.js';

// ---- Types ----

interface Prediction {
  label: string;
  confidence: number;
  category: 'drawing';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrtModule = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InferenceSession = any;

// ---- State ----

let ort: OrtModule | null = null;
let drawingSession: InferenceSession | null = null;

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
): Prediction[] {
  const indexed = Array.from(probs).map((confidence, i) => ({
    label: labels[i] ?? `unknown_${i}`,
    confidence,
    category: 'drawing' as const,
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

async function handleInit() {
  try {
    console.log('[classifier.worker] init: loading onnxruntime-web…');
    // Any failure here is fatal — there is NO mock fallback.
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

    // Drawing classifier is the only model loaded. If the manifest is missing
    // it, fail hard rather than silently degrading to mock behaviour.
    const manifestKeys = Object.keys(manifest.models ?? {});
    if (!manifestKeys.includes('drawing-classifier')) {
      self.postMessage({
        type: 'init-error',
        error: `Manifest missing required model "drawing-classifier"`,
      });
      return;
    }

    self.postMessage({
      type: 'init-progress',
      progress: 0,
      model: 'drawing-classifier',
    });

    try {
      console.log('[classifier.worker] loading drawing-classifier…');
      drawingSession = await loadSession(ort!, 'drawing-classifier', manifest);
      console.log('[classifier.worker] drawing-classifier ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({
        type: 'init-error',
        error: `Failed to load drawing-classifier: ${message}`,
      });
      return;
    }

    console.log('[classifier.worker] drawing classifier ready — READY');

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

async function handleClassify(imageData: Float32Array, requestId: string) {
  try {
    if (!drawingSession) {
      throw new Error('Drawing classifier not loaded');
    }

    const probs = await runInference(drawingSession, imageData);
    const predictions = topK(probs, DRAWING_CATEGORIES, 5);

    console.log(
      `[classifier] drawing:${predictions[0]?.label} ` +
      `${(predictions[0]?.confidence ?? 0).toFixed(2)}`,
    );

    self.postMessage({
      type: 'result',
      predictions,
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
      handleInit();
      break;
    case 'classify':
      handleClassify(data.imageData, data.requestId);
      break;
    default:
      console.warn('Unknown message type:', data.type);
  }
};
