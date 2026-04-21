// Main thread client for the ONNX classifier Web Worker.
// Handles worker lifecycle, message passing, and provides a Promise-based API.

/**
 * Which ONNX sessions the worker should load, and how `classify()` dispatches.
 *
 *  - `'all'`          — loads type-classifier + drawing / text / symbol
 *                        specialist heads (symbol is optional in the
 *                        manifest). Every classify() runs the TYPE router
 *                        cascade. Used by the landing game page where the
 *                        3-way TYPE signal drives the "AI thought" UX.
 *  - `'drawing-only'` — loads only the drawing-classifier head. Every
 *                        classify() runs the single head and the response
 *                        synthesises `detectedType='drawing'` and
 *                        `typeProbs={drawing:1,text:0,symbol:0}` so callers
 *                        read the same shape as 'all' mode. ~30MB → ~8MB
 *                        bundle, ~150ms → ~50ms per classify call. Used by
 *                        Studio drawing mode via `@glymo/ui`'s
 *                        `useDrawingClassifier`.
 */
export type ClassifierLoadMode = 'all' | 'drawing-only';

export interface Prediction {
  label: string;
  confidence: number;
  category: 'drawing' | 'text' | 'symbol';
}

export interface ClassifierStatus {
  ready: boolean;
  loading: boolean;
  error: string | null;
  progress: number; // 0-100
}

/**
 * TYPE router probabilities (from the `type-classifier` ONNX head).
 * Always sums to ~1. Exposed for consumers (landing's AI Personality UX)
 * that need to react to router indecision or type flips without re-running
 * inference.
 *
 * In `'drawing-only'` mode the router is not actually executed — the worker
 * synthesises `{ drawing: 1, text: 0, symbol: 0 }` so the wire shape stays
 * uniform across modes.
 */
export interface TypeProbs {
  text: number;
  drawing: number;
  symbol: number;
}

/**
 * Result returned by {@link ClassifierClient.classify}.
 *
 *  - `predictions`   — top-5 from the routed winner head ('all' mode) or
 *                       from the drawing head ('drawing-only' mode).
 *  - `typeProbs`     — TYPE router output; synthesised in 'drawing-only' mode.
 *  - `detectedType`  — routed category for this call; always `'drawing'` in
 *                       'drawing-only' mode.
 */
export interface ClassifyResponse {
  predictions: Prediction[];
  typeProbs: TypeProbs;
  detectedType: 'text' | 'drawing' | 'symbol';
}

interface PendingRequest {
  resolve: (response: ClassifyResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Construction options for {@link ClassifierClient}.
 *
 * `workerUrl` is the canonical injection point for downstream consumers
 * (e.g. `glymo-ui`'s `useDrawingClassifier` hook) to pass a hashed worker
 * URL that their bundler resolves at build time. The `new URL(...,
 * import.meta.url)` idiom is the only pattern recognised by webpack /
 * Next.js Turbopack / Vite for Web Worker URL resolution; the URL must be
 * constructed at the consumer's call site so the bundler sees it.
 *
 * `models` selects which ONNX heads the worker loads. Defaults to `'all'`
 * — pass `'drawing-only'` from Studio-style consumers that only need the
 * drawing head.
 */
export interface ClassifierClientOptions {
  /**
   * URL of the classifier Web Worker entry. Construct with
   * `new URL('@glymo/core/classifier/classifier.worker.js', import.meta.url)`
   * from the consumer call site so the bundler emits a hashed asset.
   */
  workerUrl?: URL;
  /**
   * Which sessions to load / how `classify()` should behave.
   * Defaults to `'all'` — loads the full 3-way cascade.
   */
  models?: ClassifierLoadMode;
}

export class ClassifierClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private status: ClassifierStatus = {
    ready: false,
    loading: false,
    error: null,
    progress: 0,
  };
  private statusListeners = new Set<(status: ClassifierStatus) => void>();
  private initPromise: Promise<void> | null = null;
  private readonly workerUrl: URL;
  private readonly models: ClassifierLoadMode;

  /**
   * Construct a classifier client.
   *
   * Pass `workerUrl` to override the bundled worker location — required for
   * downstream consumer bundlers that need to see the URL literal at the
   * call site (webpack / Turbopack / Vite). Without it, the in-package
   * default points at `./classifier.worker.js` next to this file.
   *
   * Pass `models: 'drawing-only'` to load only the drawing-classifier head
   * and skip the TYPE router + text / symbol specialists entirely.
   */
  constructor(options: ClassifierClientOptions = {}) {
    this.workerUrl =
      options.workerUrl ??
      new URL('./classifier.worker.js', import.meta.url);
    this.models = options.models ?? 'all';
  }

  /**
   * Initialize the classifier by spawning the worker and loading models.
   * Safe to call multiple times; subsequent calls return the same promise.
   */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.updateStatus({ loading: true, error: null, progress: 0 });

      try {
        this.worker = new Worker(this.workerUrl, { type: 'module' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.updateStatus({ loading: false, error: message });
        reject(new Error(`Failed to create classifier worker: ${message}`));
        return;
      }

      this.worker.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      this.worker.onerror = (event: ErrorEvent) => {
        const message = event.message || 'Unknown worker error';
        this.updateStatus({ loading: false, error: message });
      };

      // Listen for init completion
      const onInitMessage = (data: Record<string, unknown>) => {
        if (data.type === 'init-complete') {
          this.updateStatus({ ready: true, loading: false, progress: 100 });
          resolve();
          return true;
        }
        if (data.type === 'init-error') {
          const error = data.error as string;
          this.updateStatus({ loading: false, error });
          reject(new Error(error));
          return true;
        }
        return false;
      };

      // Temporarily intercept messages for init
      this.worker.onmessage = (event: MessageEvent) => {
        const handled = onInitMessage(event.data);
        if (!handled) {
          // Forward non-init messages (e.g. init-progress) to the normal handler
          this.handleMessage(event.data);
        }
        if (handled) {
          // Restore normal handler after init completes
          if (this.worker) {
            this.worker.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
          }
        }
      };

      // Send init command with the configured load mode. Omitting `models`
      // would make the worker fall back to its own default ('all') which is
      // still correct, but sending it explicitly makes the protocol
      // self-describing in network traces.
      this.worker.postMessage({ type: 'init', models: this.models });
    });
  }

  /**
   * Classify a 64x64 grayscale image.
   *
   * Returns the top-5 predictions alongside the TYPE router signal. In
   * `'drawing-only'` mode the router fields are synthesised so downstream
   * code can read the same shape regardless of load mode.
   */
  async classify(imageData: Float32Array): Promise<ClassifyResponse> {
    if (!this.worker) {
      throw new Error('Classifier not initialized. Call init() first.');
    }

    const requestId = crypto.randomUUID();

    return new Promise<ClassifyResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Classification request timed out'));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      this.worker!.postMessage({
        type: 'classify',
        imageData,
        width: 64,
        height: 64,
        requestId,
      });
    });
  }

  /**
   * Subscribe to status changes. Returns an unsubscribe function.
   */
  onStatusChange(listener: (status: ClassifierStatus) => void): () => void {
    this.statusListeners.add(listener);
    // Immediately notify with current status
    listener({ ...this.status });
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Get the current classifier status.
   */
  getStatus(): ClassifierStatus {
    return { ...this.status };
  }

  /**
   * Terminate the worker and reject all pending requests.
   */
  destroy(): void {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Classifier destroyed'));
      this.pendingRequests.delete(id);
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.initPromise = null;
    this.updateStatus({
      ready: false,
      loading: false,
      error: null,
      progress: 0,
    });
  }

  // ---- Private ----

  private handleMessage(data: Record<string, unknown>): void {
    switch (data.type) {
      case 'init-progress': {
        this.updateStatus({ progress: data.progress as number });
        break;
      }

      case 'result': {
        const requestId = data.requestId as string;
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(requestId);
          const response: ClassifyResponse = {
            predictions: data.predictions as Prediction[],
            typeProbs: data.typeProbs as TypeProbs,
            detectedType: data.detectedType as ClassifyResponse['detectedType'],
          };
          pending.resolve(response);
        }
        break;
      }

      case 'error': {
        const requestId = data.requestId as string;
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(requestId);
          pending.reject(new Error(data.error as string));
        }
        break;
      }
    }
  }

  private updateStatus(partial: Partial<ClassifierStatus>): void {
    this.status = { ...this.status, ...partial };
    const snapshot = { ...this.status };
    for (const listener of this.statusListeners) {
      listener(snapshot);
    }
  }
}
