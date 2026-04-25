// Layer — abstract interface every SceneGraph child implements.
//
// Phase 6 of `docs/plans/rendering-pipeline-v2.md` introduces a Three.js-
// backed master scene graph that absorbs the seven independent rendering
// surfaces of the pre-refactor codebase (stroke / fill / preview / text /
// hand / ambient-glow / hologram / media-art / post-process). Each
// surface becomes a concrete `Layer` subtree under one `SceneGraph`.
//
// Per §1.5.4 R-A — Three.js types stay INTERNAL to `@glymo/core`. Layer
// implementations may freely import from `three` / `three/webgpu`; the
// public Glymo surface (Glymo.ts, the SessionDoc shape, MeshSourceDescriptor)
// MUST NOT leak Three.js types. This file is `@internal` — external
// consumers do not author Layer subclasses; they consume `SceneGraph`'s
// public API only.
//
// Per §3 invariant I9 — every Layer's lifecycle methods MUST be safe under
// React Strict Mode double-mount; `init`/`dispose` form a balanced pair
// and `dispose` must idempotently release every resource the Layer
// allocated (textures, buffers, geometry, materials, scene children).

import type { Scene, OrthographicCamera } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

/**
 * Init context handed to every Layer when it is added to a SceneGraph.
 * Holds the parent scene + the active orthographic camera + the live
 * renderer so layers can mount their own scene subtrees, register
 * post-process passes, or query the renderer's capabilities.
 *
 * @internal — Three.js types intentionally exposed here. See R-A above.
 */
export interface LayerInitContext {
  /** Parent Three.js scene. Layers append their own subtree to it. */
  readonly scene: Scene;
  /** Shared orthographic camera. Layers MUST NOT replace it. */
  readonly camera: OrthographicCamera;
  /** Active renderer (WebGPU primary, WebGL2 fallback automatic). */
  readonly renderer: WebGPURenderer;
  /** CSS-pixel viewport at init time. Re-emitted via `Layer.resize`. */
  readonly widthCss: number;
  readonly heightCss: number;
  /** Device pixel ratio in effect at init time. */
  readonly dpr: number;
}

/**
 * Layer — every concrete renderer surface (stroke / text / hologram / etc.)
 * implements this interface and is added to a `SceneGraph` via
 * `sceneGraph.addLayer(name, layer)`.
 *
 * Lifecycle:
 *   `addLayer` → `Layer.init(ctx)`               — mount scene subtree
 *   `SceneGraph.render(deltaMs)` → `Layer.render(deltaMs)`  — per-frame work
 *   `ResizeObserver` → `SceneGraph.resize(w,h,dpr)` → `Layer.resize(w,h,dpr)`
 *   `removeLayer` OR `SceneGraph.dispose()` → `Layer.dispose()` — release all
 *
 * Layers MAY:
 *   - allocate Three.js geometry / material / texture in `init`
 *   - mutate scene children in `render`
 *   - subscribe to engine events (CharacterStore, Glymo, etc.) in `init`
 *
 * Layers MUST NOT:
 *   - call `requestAnimationFrame` directly — Phase 1 RafScheduler is the
 *     sole rAF consumer; `render` is invoked once per scheduler tick
 *   - mutate the shared `camera` (replace projection matrix or position)
 *   - retain references to disposed resources after `dispose` returns
 *
 * @internal — see R-A.
 */
export interface Layer {
  /** Stable identifier — used for diagnostics, ordering, removal. */
  readonly name: string;

  /** Mount scene subtree, allocate GPU resources, subscribe to events.
   *  May be async (e.g. shader compile, async texture load). */
  init(ctx: LayerInitContext): void | Promise<void>;

  /** Per-frame work. `deltaMs` = elapsed since previous frame in ms.
   *  MUST be allocation-light on the hot path (Phase 2 / 3 invariant). */
  render(deltaMs: number): void;

  /** Viewport changed. CSS pixels + DPR. The shared camera and renderer
   *  are already re-sized by `SceneGraph` before this fires. */
  resize(widthCss: number, heightCss: number, dpr: number): void;

  /** Release every resource the Layer allocated. Idempotent — calling
   *  `dispose` twice is a no-op on the second call. */
  dispose(): void;

  /**
   * Toggle the layer's visibility without unmounting it. Phase 6 6b-6d
   * — replaces the legacy `Compositor.setLayerVisible(id, bool)`
   * surface that callers like `useHologramController.ts:300-303` (hide
   * 2D overlay during hologram lift to avoid double-image) and the
   * `showSkeleton` settings toggle relied on.
   *
   * Implementations MUST flip the underlying scene primitive's
   * `visible` field synchronously (no animation). When `false`, the
   * Three.js renderer skips drawing the layer's mesh entirely; on
   * the next frame it returns to its previous visibility level.
   *
   * Default `true` after `init()` returns. Calling before `init()` or
   * after `dispose()` is a silent no-op.
   */
  setVisible(visible: boolean): void;
}
