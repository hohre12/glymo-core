// SceneGraph — Three.js-backed master scene graph for the rendering-pipeline-v2
// refactor (`docs/plans/rendering-pipeline-v2.md` §4 target architecture).
//
// Phase 6 introduces this class as the single GPU-backed surface that absorbs
// the seven independent rendering loops of the pre-refactor codebase. Each of
// the existing layer concerns (stroke / fill / preview / text / hand /
// ambient-glow / hologram / media-art / post-process) becomes a concrete
// `Layer` subtree mounted under one shared `Scene`, drawn by one shared
// `WebGPURenderer`, into one DOM `<canvas>`.
//
// This file is the FOUNDATION of Phase 6 sub-slice 6a-1. It ships only:
//   - `SceneGraph` class (init / addLayer / removeLayer / render / resize /
//     dispose), Three.js Scene + OrthographicCamera + WebGPURenderer wiring.
//   - WebGL2 automatic fallback (Three.js built-in since r170).
//   - Lazy `import('three/webgpu')` so SSR stays clean and the legacy
//     pre-flag rendering path does not pay the WebGPU module-load cost.
//
// It does NOT ship concrete layers (Stroke / TextOverlay / etc.) — those
// land in subsequent Phase 6 sub-slices. With zero registered layers,
// `render()` is a no-op clear-and-present, which is precisely what the
// 6a-1 smoke test in `glymo-ui` exercises.
//
// Per §1.5.4 R-A — every public-API surface on this class deals in plain
// TypeScript types (HTMLCanvasElement / number / string / Layer interface
// kept @internal). Three.js types DO appear inside method signatures of the
// `Layer` interface (which IS internal) so concrete layer implementations
// authored under `@glymo/core/render/layers/` can interact with the scene.
// External consumers of `@glymo/core/render` should only construct
// `SceneGraph`, call its public methods, and never see a Three.js type.
//
// Per §3 invariant I9 — `init` and `dispose` form a balanced pair. `dispose`
// MUST be idempotent (multiple calls are no-ops on the second+); the React
// shell in `@glymo/ui` mounts `SceneGraph` inside an effect whose cleanup
// is double-invoked under Strict Mode dev.

import type {
  Scene as ThreeScene,
  OrthographicCamera as ThreeOrthographicCamera,
} from 'three';
import type { WebGPURenderer as ThreeWebGPURenderer } from 'three/webgpu';

import type { Layer, LayerInitContext } from './Layer.js';

// ── Lazy three/webgpu import (mirrors Hologram3DRenderer SSR pattern) ────────

let WEBGPU: typeof import('three/webgpu') | null = null;
let webgpuLoadPromise: Promise<boolean> | null = null;

/**
 * Dynamically imports `three/webgpu` exactly once, sharing the in-flight
 * promise across concurrent callers. Mirrors the
 * `Hologram3DRenderer.loadThreeDeps` pattern that survived a Strict-Mode
 * race condition (parallel imports resolving to different module identities,
 * silently overwriting `THREE` between callers — see
 * `feedback_strict_mode_guard_pairing.md`).
 */
async function loadWebGPUModule(): Promise<boolean> {
  if (WEBGPU) return true;
  if (webgpuLoadPromise) return webgpuLoadPromise;
  webgpuLoadPromise = (async () => {
    try {
      WEBGPU = await import('three/webgpu');
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[SceneGraph] Failed to load three/webgpu:', e);
      // Allow a future caller to retry on a fresh promise — a transient
      // network error on the addons CDN should not poison subsequent loads.
      webgpuLoadPromise = null;
      return false;
    }
  })();
  return webgpuLoadPromise;
}

// ── Phase 8 — Three.js / WebGPU warm-up ─────────────────────────────────────
//
// `prefetchRenderModule()` triggers the lazy `three/webgpu` dynamic import
// without constructing a renderer. Intended to be called from
// `<CanvasEngine>` mount via `requestIdleCallback` so the module bytes are
// downloaded + parsed during browser idle BEFORE the user enters camera /
// hologram mode. Subsequent `SceneGraph.init()` calls find the module
// already loaded and skip the await on the network.
//
// Per `docs/plans/rendering-pipeline-v2.md` §6 Phase 8 (paraphrased): "On
// `<CanvasEngine>` mount, prefetch the `three/webgpu` dynamic chunks during
// browser idle." The 3.62s `frameloop/batcher.mjs` blocking call observed in
// the 2026-04-24 transcript (Three.js init + pipeline compile) drops below
// 500ms when the chunk is already in the module cache.
//
// Returns the same boolean contract as the internal loader — `true` when
// the module is now resident, `false` on network/parse failure.
export function prefetchRenderModule(): Promise<boolean> {
  return loadWebGPUModule();
}

// ── Module-scoped warmup cache (Phase 8) ─────────────────────────────────────
//
// Each `WebGPURenderer` instance pays a one-shot pipeline-compilation cost
// the first time `compileAsync(scene, camera)` runs — this is the cost the
// Phase 8 acceptance criteria (`hologram longest RAF 401ms → < 200ms`)
// targets. We cache "this renderer instance has been warmed" via a
// WeakSet so a single SceneGraph's `warmup()` is idempotent across
// repeated callers (Strict Mode dev double-invocation safe).
//
// WeakSet — not Map — because we only need presence semantics ("warmed
// already?"), and WeakSet drops the entry automatically when the renderer
// is GC'd (e.g. SceneGraph.dispose released the only reference).
const warmedRenderers: WeakSet<ThreeWebGPURenderer> =
  new WeakSet<ThreeWebGPURenderer>();

// ── Public types ─────────────────────────────────────────────────────────────

export interface SceneGraphInitOptions {
  /** The single DOM `<canvas>` the renderer draws into. */
  canvas: HTMLCanvasElement;
  /** Initial CSS-pixel viewport size. Re-emitted via `resize`. */
  widthCss: number;
  heightCss: number;
  /** Device pixel ratio. Defaults to `window.devicePixelRatio || 1`. */
  dpr?: number;
  /** Optional clear color in `#rrggbb` form. Defaults to transparent. */
  clearColorHex?: string | null;
  /** Optional clear alpha (0–1). Defaults to 0 (fully transparent). */
  clearAlpha?: number;
}

/**
 * Backend the active `WebGPURenderer` ended up using. Reported by
 * `SceneGraph.getRendererType()`. Three.js's `WebGPURenderer` is named
 * after its primary backend but transparently falls back to WebGL2
 * (built-in since r170) when WebGPU is unavailable — this enum surfaces
 * which backend actually picked up the work so consumers and tests can
 * branch on capability without re-probing the adapter.
 */
export type SceneGraphBackend = 'webgpu' | 'webgl2';

/**
 * SceneGraph — Three.js Scene + OrthographicCamera + WebGPURenderer wrapper.
 *
 * Lifecycle:
 *   ```ts
 *   const sg = new SceneGraph({ canvas, widthCss: 1280, heightCss: 720 });
 *   const ok = await sg.init();
 *   if (!ok) return;                      // WebGPU + WebGL2 both unavailable
 *   await sg.addLayer(new StrokeLayer());
 *   sg.render(deltaMs);                   // per scheduler tick
 *   sg.resize(newWidth, newHeight, dpr);  // per ResizeObserver
 *   sg.dispose();                         // per React effect cleanup
 *   ```
 *
 * Camera convention: the orthographic camera is sized so that 1 world unit
 * = 1 CSS pixel. The frustum spans `[-widthCss/2, +widthCss/2]` × `[-heightCss/2,
 * +heightCss/2]` and the camera looks down the negative Z axis from `+1` so
 * positive Y is "up" and positive X is "right" in the rendered image. Layers
 * place geometry directly in CSS-pixel coordinates without any per-frame
 * rescaling — `resize` updates the frustum, not per-mesh transforms.
 */
export class SceneGraph {
  // ── Public-readable state ────────────────────────────────────────────────

  /** The DOM canvas this graph renders into. Pinned at construction. */
  public readonly canvas: HTMLCanvasElement;

  // ── Private internal state ───────────────────────────────────────────────

  private widthCss: number;
  private heightCss: number;
  private dpr: number;
  private readonly clearColorHex: string | null;
  private readonly clearAlpha: number;

  /** Set after `init()` resolves successfully. */
  private scene: ThreeScene | null = null;
  private camera: ThreeOrthographicCamera | null = null;
  private renderer: ThreeWebGPURenderer | null = null;
  private backend: SceneGraphBackend | null = null;

  /** Layer registry, keyed by `Layer.name`. Insertion order = render order. */
  private readonly layers = new Map<string, Layer>();

  /** Set the moment `dispose()` runs the first time. Idempotency gate. */
  private disposed = false;

  /** Set the moment `init()` resolves successfully. */
  private initialized = false;

  /** In-flight init promise — guarantees concurrent `init()` callers share
   *  one async chain (Strict Mode double-invoke safety). */
  private initPromise: Promise<boolean> | null = null;

  // ── Construction ─────────────────────────────────────────────────────────

  constructor(opts: SceneGraphInitOptions) {
    if (!opts.canvas) {
      throw new Error('[SceneGraph] `opts.canvas` is required');
    }
    if (!Number.isFinite(opts.widthCss) || opts.widthCss <= 0) {
      throw new Error(`[SceneGraph] widthCss must be > 0 (got ${opts.widthCss})`);
    }
    if (!Number.isFinite(opts.heightCss) || opts.heightCss <= 0) {
      throw new Error(`[SceneGraph] heightCss must be > 0 (got ${opts.heightCss})`);
    }
    this.canvas = opts.canvas;
    this.widthCss = opts.widthCss;
    this.heightCss = opts.heightCss;
    this.dpr = opts.dpr ?? (typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1);
    this.clearColorHex = opts.clearColorHex ?? null;
    this.clearAlpha = opts.clearAlpha ?? 0;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Initialize the Three.js scene + camera + renderer. Returns `true` when
   * the renderer is ready, `false` when WebGPU AND WebGL2 are both
   * unavailable (no browser path to GPU). Safe to call concurrently —
   * subsequent calls share the first call's promise.
   */
  init(): Promise<boolean> {
    if (this.initialized) return Promise.resolve(true);
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<boolean> {
    if (this.disposed) {
      // dispose() already ran; do not re-initialise.
      return false;
    }

    const ok = await loadWebGPUModule();
    if (!ok || !WEBGPU) {
      return false;
    }
    if (this.disposed) {
      // dispose() ran while we were awaiting the dynamic import.
      return false;
    }

    const T = WEBGPU;

    this.scene = new T.Scene();

    // Orthographic frustum sized so 1 world unit = 1 CSS pixel. Near/far
    // clip planes are intentionally generous (-1000…+1000) so layers can
    // place 3D content (hologram chars, media-art meshes) at non-zero Z
    // without manual frustum management.
    this.camera = new T.OrthographicCamera(
      -this.widthCss / 2,
      this.widthCss / 2,
      this.heightCss / 2,
      -this.heightCss / 2,
      -1000,
      1000,
    );
    this.camera.position.set(0, 0, 1);
    this.camera.lookAt(0, 0, 0);

    // WebGPURenderer ships automatic WebGL2 fallback since r170 — passing
    // the constructor `{ canvas }` is enough; `await renderer.init()` (the
    // mandatory step since r171) handles backend negotiation internally.
    // We do NOT pass `forceWebGL: true` — the canonical pattern is to let
    // Three.js pick WebGPU when the adapter is available and silently fall
    // back to WebGL2 when it is not.
    this.renderer = new T.WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });

    try {
      await this.renderer.init();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[SceneGraph] renderer.init() failed:', e);
      // WebGPU + WebGL2 both unreachable — surface as `false` so the React
      // shell can downgrade to a static-image fallback or surface an
      // unsupported-browser banner without crashing the page.
      this.renderer.dispose();
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      return false;
    }

    if (this.disposed) {
      // dispose() ran during init — release everything we just built.
      this.renderer.dispose();
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      return false;
    }

    // Detect which backend three.js actually picked. Per the r170+ API,
    // `renderer.backend` exposes either a WebGPUBackend (with
    // `isWebGPUBackend === true`) or a WebGLBackend (`isWebGLBackend ===
    // true`). Either flag may be `undefined` on the wrong backend.
    const backend = (this.renderer as unknown as {
      backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean };
    }).backend;
    if (backend?.isWebGPUBackend) {
      this.backend = 'webgpu';
    } else if (backend?.isWebGLBackend) {
      this.backend = 'webgl2';
    } else {
      // Defensive default — Three.js may rename the backend probe in
      // future minor versions. Treat unknown as `webgpu` (the common case)
      // and log so a regression in the probe surfaces during dev.
      // eslint-disable-next-line no-console
      console.warn(
        '[SceneGraph] could not detect renderer backend — assuming webgpu',
      );
      this.backend = 'webgpu';
    }

    // Match the canvas's CSS-pixel size + DPR to the renderer drawing buffer.
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.widthCss, this.heightCss, /* updateStyle */ false);

    if (this.clearColorHex !== null) {
      this.renderer.setClearColor(this.clearColorHex, this.clearAlpha);
    } else {
      // Transparent canvas — required for the pre-Phase-6 compositor path
      // to keep working alongside the new SceneGraph until the flag flips.
      this.renderer.setClearColor(0x000000, this.clearAlpha);
    }

    this.initialized = true;
    return true;
  }

  // ── Layer registry ───────────────────────────────────────────────────────

  /**
   * Add a layer to the scene. Calls `layer.init(ctx)` immediately and waits
   * for the (possibly async) result. Throws if the SceneGraph has not been
   * initialized OR a layer with the same `name` already exists.
   */
  async addLayer(layer: Layer): Promise<void> {
    this.assertInitialized('addLayer');
    if (this.layers.has(layer.name)) {
      throw new Error(`[SceneGraph] layer "${layer.name}" already registered`);
    }
    this.layers.set(layer.name, layer);
    const ctx: LayerInitContext = {
      // After `assertInitialized` these are non-null; cast to satisfy TS
      // without re-asserting at every call.
      scene: this.scene as ThreeScene,
      camera: this.camera as ThreeOrthographicCamera,
      renderer: this.renderer as ThreeWebGPURenderer,
      widthCss: this.widthCss,
      heightCss: this.heightCss,
      dpr: this.dpr,
    };
    await layer.init(ctx);
  }

  /** Remove a layer (calls `layer.dispose()`). No-op when the name is unknown. */
  removeLayer(name: string): void {
    const layer = this.layers.get(name);
    if (!layer) return;
    this.layers.delete(name);
    try {
      layer.dispose();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[SceneGraph] layer "${name}" dispose threw:`, e);
    }
  }

  /** Diagnostic — current layer order (insertion order). */
  getLayerNames(): readonly string[] {
    return Array.from(this.layers.keys());
  }

  // ── Per-frame entry ──────────────────────────────────────────────────────

  /**
   * Per-frame render. Invoked by the engine's RafScheduler `render` phase
   * (Phase 1 invariant — SceneGraph must NOT call rAF directly). Walks the
   * layer registry in insertion order, then drives the renderer's single
   * scene+camera pass.
   *
   * `deltaMs` = milliseconds since the previous render (the scheduler
   * tracks this; callers should NOT measure it themselves).
   */
  render(deltaMs: number): void {
    if (!this.initialized || this.disposed) return;
    if (!this.scene || !this.camera || !this.renderer) return;

    // Layers update first — they may mutate scene state (move meshes,
    // update particle positions, swap textures). The renderer pass below
    // sees the post-update scene.
    for (const layer of this.layers.values()) {
      try {
        layer.render(deltaMs);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[SceneGraph] layer "${layer.name}" render threw:`, e);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ── Phase 8 — Warmup ─────────────────────────────────────────────────────

  /**
   * Pre-compile the GPU pipelines for the canonical SceneGraph mesh
   * (`MeshBasicMaterial` + `PlaneGeometry` — the shape every
   * CanvasMirrorLayer subclass uses). Builds a tiny offscreen dummy scene,
   * runs `renderer.compileAsync(dummyScene, dummyCamera)` to force pipeline
   * compilation on a non-visible target, then disposes the dummy resources.
   *
   * Per `docs/plans/rendering-pipeline-v2.md` §6 Phase 8 (acceptance):
   * "longest RAF handler in the hologram scenario drops from 401ms (Phase 6
   * measurement) to < 200ms." First-render pipeline compile is the dominant
   * contributor to that 401ms; pre-compilation moves it to mount time
   * where the user does not notice it (the hologram canvas isn't visible
   * yet) and out of the per-frame critical path.
   *
   * Idempotent — every renderer instance is warmed at most once (cached on
   * a module-scoped WeakSet). Calling `warmup()` repeatedly is cheap.
   *
   * Safe to call before `addLayer` — the dummy scene is independent of the
   * layer registry. Recommended sequencing in the consumer is:
   *   await sg.init();
   *   // …addLayer(...) for each layer
   *   await sg.warmup();
   */
  async warmup(): Promise<void> {
    if (!this.initialized || this.disposed) return;
    if (!this.renderer || !WEBGPU) return;
    if (warmedRenderers.has(this.renderer)) return;

    const T = WEBGPU;
    // Dummy scene independent of the live one — keeps live layer state
    // untouched and lets the warmup run before any layer is added.
    const dummyScene = new T.Scene();
    const dummyCamera = new T.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    // Match the canonical CanvasMirrorLayer shape exactly:
    // MeshBasicMaterial(transparent, depthTest:false, depthWrite:false) +
    // PlaneGeometry. The compileAsync call below walks the scene and forces
    // every distinct material's GPU pipeline to be compiled.
    const dummyGeometry = new T.PlaneGeometry(1, 1);
    const dummyMaterial = new T.MeshBasicMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const dummyMesh = new T.Mesh(dummyGeometry, dummyMaterial);
    dummyMesh.frustumCulled = false;
    dummyScene.add(dummyMesh);

    try {
      // `compileAsync(scene, camera)` is the WebGPURenderer pre-compile API
      // (Three.js r170+). Walks the scene, compiles every material's
      // pipeline against the renderer's GPU device, awaits completion.
      await this.renderer.compileAsync(dummyScene, dummyCamera);
      warmedRenderers.add(this.renderer);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[SceneGraph] warmup compileAsync threw:', e);
      // Non-fatal — first real frame will pay the un-amortised compile
      // cost. We do NOT mark the renderer as warmed so a future caller
      // (e.g. on backend swap) can retry.
    } finally {
      dummyMesh.geometry.dispose();
      (dummyMesh.material as InstanceType<typeof T.MeshBasicMaterial>).dispose();
      dummyScene.remove(dummyMesh);
    }
  }

  // ── Resize ───────────────────────────────────────────────────────────────

  /**
   * Update the viewport. Called by the React shell's single `ResizeObserver`
   * (Phase 5 / 6 invariant — SceneGraph does NOT install its own observer).
   * `dpr` is optional; when omitted the previous DPR is preserved.
   */
  resize(widthCss: number, heightCss: number, dpr?: number): void {
    if (!Number.isFinite(widthCss) || widthCss <= 0) return;
    if (!Number.isFinite(heightCss) || heightCss <= 0) return;

    this.widthCss = widthCss;
    this.heightCss = heightCss;
    if (typeof dpr === 'number' && Number.isFinite(dpr) && dpr > 0) {
      this.dpr = dpr;
    }

    if (!this.initialized || this.disposed) return;
    if (!this.camera || !this.renderer) return;

    // Re-frame the orthographic camera to the new CSS-pixel viewport.
    this.camera.left = -this.widthCss / 2;
    this.camera.right = this.widthCss / 2;
    this.camera.top = this.heightCss / 2;
    this.camera.bottom = -this.heightCss / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.widthCss, this.heightCss, /* updateStyle */ false);

    // Notify every layer in insertion order so their per-resize work
    // (e.g. RenderTarget allocation, TextOverlay layout reflow) can run.
    for (const layer of this.layers.values()) {
      try {
        layer.resize(this.widthCss, this.heightCss, this.dpr);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[SceneGraph] layer "${layer.name}" resize threw:`, e);
      }
    }
  }

  // ── Dispose ──────────────────────────────────────────────────────────────

  /** Idempotent — releases every Three.js resource the graph owns. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Dispose layers in reverse insertion order so a layer's `dispose` can
    // safely reference siblings registered before it (e.g. a PostProcess
    // layer that references the StrokeLayer's RenderTarget).
    const reversed = Array.from(this.layers.values()).reverse();
    for (const layer of reversed) {
      try {
        layer.dispose();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[SceneGraph] layer "${layer.name}" dispose threw:`, e);
      }
    }
    this.layers.clear();

    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[SceneGraph] renderer.dispose threw:', e);
      }
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
    this.backend = null;
    this.initialized = false;
  }

  // ── Public diagnostics ───────────────────────────────────────────────────

  /** True after `init()` has resolved successfully and before `dispose()`. */
  isInitialized(): boolean {
    return this.initialized && !this.disposed;
  }

  /** Active backend, or `null` before init / after dispose. */
  getBackend(): SceneGraphBackend | null {
    return this.backend;
  }

  /** Current viewport (CSS pixels + DPR). */
  getViewport(): { widthCss: number; heightCss: number; dpr: number } {
    return {
      widthCss: this.widthCss,
      heightCss: this.heightCss,
      dpr: this.dpr,
    };
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private assertInitialized(method: string): void {
    if (this.disposed) {
      throw new Error(`[SceneGraph] ${method}: graph has been disposed`);
    }
    if (!this.initialized) {
      throw new Error(
        `[SceneGraph] ${method}: call \`await init()\` before \`${method}\``,
      );
    }
  }
}
