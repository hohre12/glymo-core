// PostProcessLayer — Phase 6 sub-slice 6a-4b (native TSL post-process
// chain). Replaces the 6a-4a CanvasMirrorLayer subclass that mirrored
// the legacy `useWebGPUPostProcess` WebGPU canvas. Per
// `docs/plans/render-v2-6a-4b-postprocess-tsl.md`.
//
// **What changed vs 6a-4a**
//
// Before (6a-4a): PostProcessLayer extended CanvasMirrorLayer and uploaded
// the legacy `useWebGPUPostProcess` hook's WebGPU canvas as a CanvasTexture
// quad each frame. The bloom + chromatic aberration + scanlines effects
// were produced by 646 LOC of hand-rolled WGSL inside that hook on a
// dedicated overlay canvas.
//
// After (6a-4b): PostProcessLayer implements `Layer` directly and constructs
// a Three.js TSL post-processing chain on the SceneGraph's existing
// `WebGPURenderer`:
//
//   pass(scene, camera).getTextureNode('output')
//     │
//     ├─ chromaticAberration (custom Fn — radial RGB shift)
//     ├─ bloom               (three/addons/tsl/display/BloomNode)
//     └─ scanlines           (custom Fn — per-row dim + glitch)
//     ▼
//   vec4(rgb, sceneColor.a)  →  postProcessing.outputNode
//
// The chain is injected into the SceneGraph via
// `ctx.sceneGraph.setPostProcessingChain(this.postProcessing)`. From that
// point, `SceneGraph.render()` calls `postProcessing.render()` instead of
// the default `renderer.render(scene, camera)` path; the post-process
// chain internally renders the scene through its node tree.
//
// **Why the rewrite**
//
// 1. Eliminates 646 LOC of hand-rolled WGSL + a dedicated overlay canvas
//    + a per-frame `copyExternalImageToTexture` round-trip. Single render
//    target, single pipeline compile.
// 2. WebGL2 fallback parity becomes free — TSL's dual-target codegen
//    emits both WGSL (WebGPU) and GLSL (WebGL2) automatically; the legacy
//    WGSL path was WebGPU-only.
// 3. Removes the `webGPUAvailable` capability flag from the public
//    surface — the chain works on whichever backend `WebGPURenderer`
//    picked (Three.js's automatic WebGL2 fallback since r170).
//
// **Pattern reference**
//
// Mirrors `Hologram3DRenderer.ts:1641-1665` (the proven TSL+PostProcessing
// shape in this codebase). That site uses bloom only; we extend with two
// additional Fn nodes for the legacy CA + scanlines behaviour.
//
// **Lifecycle invariants** (Phase 6 §3 invariant I9):
//   - `init` lazy-loads `three/tsl` + `three/addons/tsl/display/BloomNode.js`
//     via the SceneGraph's shared `loadPostProcessModules()` cache. Concurrent
//     init calls share one in-flight promise (Strict Mode safe).
//   - `dispose` is idempotent and detaches the chain from SceneGraph
//     BEFORE disposing it, preventing the SceneGraph from rendering through
//     a half-disposed chain.
//   - `setEffectIntensity` / `setBloomStrength` / etc. mutate the existing
//     uniform values — no recompile, allocation-free hot path (Phase 2/3).
//
// Per §1.5.4 R-A — public surface (constructor opts + setter signatures)
// is plain TypeScript / DOM types only. Three.js types stay internal.

import type {
  PostProcessing as ThreePostProcessing,
  WebGPURenderer as ThreeWebGPURenderer,
} from 'three/webgpu';
import type {
  Scene as ThreeScene,
  OrthographicCamera as ThreeOrthographicCamera,
} from 'three';

import type { Layer, LayerInitContext, SceneGraphHandle } from '../Layer.js';
import { LAYER_DEFAULTS } from '../constants.js';
import {
  loadPostProcessModules,
  getLoadedTSL,
  getLoadedBloom,
} from '../SceneGraph.js';

// ── Public options ──────────────────────────────────────────────────────────

export interface PostProcessLayerOptions {
  /**
   * Initial overall effect intensity, 0–1. Drives bloom strength,
   * chromatic-aberration scale, and scanline opacity in lock-step (the
   * legacy `useWebGPUPostProcess.intensity` semantics). Default `0.7`.
   */
  initialIntensity?: number;
  /**
   * Initial scanlines on/off. Set `true` for the hologram / aurora
   * presets; `false` for the default neon / bloom-only path. Default
   * `false`.
   */
  scanlinesEnabled?: boolean;
  /** Layer registry name. Default `LAYER_DEFAULTS.postProcess.name`. */
  name?: string;
  /**
   * Z position. Unused by the post-process chain (the chain replaces the
   * default present pass entirely; there is no scene mesh to Z-sort), but
   * accepted for API symmetry with sibling Layer subclasses. Default
   * `LAYER_DEFAULTS.postProcess.z`.
   */
  z?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const clamp01 = (n: number, fallback = 0): number => {
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
};

const clampNonNeg = (n: number, fallback = 0): number => {
  if (!Number.isFinite(n)) return fallback;
  return n < 0 ? 0 : n;
};

// ── Layer implementation ────────────────────────────────────────────────────

export class PostProcessLayer implements Layer {
  // ── Public Layer interface ────────────────────────────────────────────

  readonly name: string;
  readonly z: number;

  // ── Construction-time configuration ───────────────────────────────────

  private readonly initialIntensity: number;
  private readonly initialScanlinesEnabled: boolean;

  // ── Internal state (lazily allocated in `init`) ───────────────────────

  /**
   * Owning SceneGraph handle, captured in `init` for the symmetric
   * `setPostProcessingChain(null)` detach in `dispose`.
   */
  private sceneGraphHandle: SceneGraphHandle | null = null;
  private renderer: ThreeWebGPURenderer | null = null;
  private postProcessing: ThreePostProcessing | null = null;

  /**
   * Per-uniform handles. Setters mutate `.value` in place — no rebuild,
   * no recompile. Held as `unknown` so the public surface of this file
   * does not leak the `UniformNode<'float', number>` type from
   * `three/webgpu`.
   */
  private uIntensity: { value: number } | null = null;
  private uScanlinesEnabled: { value: number } | null = null;
  private uBloomStrength: { value: number } | null = null;
  private uBloomThreshold: { value: number } | null = null;
  private uChromaticAberration: { value: number } | null = null;
  private uScanlineOpacity: { value: number } | null = null;

  /**
   * Bloom node — kept so `setBloomStrength` / `setBloomThreshold` can
   * also mutate the BloomNode's own uniform handles. The legacy
   * pixel-equivalence is driven by both the standalone `uBloomStrength`
   * (final composite multiplier) AND the BloomNode's `.strength`
   * (internal pass amplitude). Mirroring both keeps tuning predictable.
   */
  private bloomNode: {
    strength: { value: number };
    threshold: { value: number };
    radius: { value: number };
  } | null = null;

  /** Idempotency gate for `dispose`. */
  private disposed = false;
  /** Set the moment `init` resolves successfully. */
  private initialized = false;
  /** In-flight init promise — concurrent init() callers share one chain. */
  private initPromise: Promise<void> | null = null;

  // ── Construction ──────────────────────────────────────────────────────

  constructor(opts: PostProcessLayerOptions = {}) {
    this.name = opts.name ?? LAYER_DEFAULTS.postProcess.name;
    this.z = opts.z ?? LAYER_DEFAULTS.postProcess.z;
    // Defensive defaults — invalid initial values would otherwise break
    // the post-process chain at first compile (NaN propagates through
    // every Fn node and Three.js's TSL doesn't surface it cleanly).
    this.initialIntensity = clamp01(opts.initialIntensity ?? 0.7, 0.7);
    this.initialScanlinesEnabled = opts.scanlinesEnabled === true;
  }

  // ── Layer lifecycle ───────────────────────────────────────────────────

  init(ctx: LayerInitContext): Promise<void> {
    if (this.disposed) {
      return Promise.reject(
        new Error('[PostProcessLayer] cannot init after dispose'),
      );
    }
    if (this.initialized) {
      // Strict Mode dev double-mount safe — second `init` is a no-op.
      return Promise.resolve();
    }
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init(ctx);
    return this.initPromise;
  }

  private async _init(ctx: LayerInitContext): Promise<void> {
    // 1. Lazy-load TSL + BloomNode modules. Shared promise across
    //    PostProcessLayer / Hologram3DRenderer / future post-process
    //    consumers via the SceneGraph cache; concurrent calls coalesce.
    const ok = await loadPostProcessModules();
    if (!ok) {
      throw new Error(
        '[PostProcessLayer] failed to load TSL post-process modules',
      );
    }
    if (this.disposed) return; // dispose() ran during the await

    const tsl = getLoadedTSL();
    const bloomMod = getLoadedBloom();
    if (!tsl || !bloomMod) {
      throw new Error(
        '[PostProcessLayer] post-process module accessors returned null after load',
      );
    }

    // 2. Lazy-load three/webgpu through the renderer instance — we already
    //    have a constructed `WebGPURenderer` in `ctx.renderer`, so the
    //    `PostProcessing` constructor is reachable via the renderer's
    //    module identity. We import the namespace separately to get the
    //    `PostProcessing` class itself.
    const THREE = await import('three/webgpu');
    if (this.disposed) return;

    this.renderer = ctx.renderer;
    this.sceneGraphHandle = ctx.sceneGraph;

    // 3. Build the TSL chain. Mirrors §3 of the plan doc:
    //    sceneColor → bloom → chromaticAberration → scanlines → vec4(rgb,a)
    // Destructure only what we use — TSL surface is huge; keeping the
    // bag tight makes future refactors easier to audit.
    const {
      pass,
      vec4,
      vec3,
      vec2,
      uniform,
      time,
      screenUV,
      screenSize,
      Fn,
      length: tslLength,
      normalize,
      fract,
      step,
      sin,
      mix,
      float,
      clamp: tslClamp,
    } = tsl;

    // Scene texture node — `pass()` wraps the existing scene+camera in a
    // Three.js render-target; `getTextureNode('output')` exposes the
    // resulting RGBA texture so downstream Fn nodes can sample it.
    const scenePass = pass(ctx.scene as ThreeScene, ctx.camera as ThreeOrthographicCamera);
    const sceneColor = scenePass.getTextureNode('output');

    // ── Uniform handles (per-frame mutable knobs) ────────────────────
    //
    // Each `uniform()` returns a UniformNode whose `.value` is writable;
    // mutating it does NOT trigger a recompile, just a per-frame uniform
    // upload. This is the canonical TSL pattern for tunable post-process
    // chains (see Hologram3DRenderer's `uTransition`/`uTime` setters).
    const uIntensity = uniform(this.initialIntensity);
    const uScanlinesEnabled = uniform(this.initialScanlinesEnabled ? 1.0 : 0.0);
    const uBloomStrength = uniform(2.0);
    const uBloomThreshold = uniform(0.15);
    const uChromaticAberration = uniform(3.0);
    const uScanlineOpacity = uniform(0.12);

    // ── Bloom pass ───────────────────────────────────────────────────
    //
    // Constructor signature: `bloom(node, strength, radius, threshold)`.
    // We pass conservative defaults; per-frame tuning happens via the
    // BloomNode's own uniform handles (strength / radius / threshold).
    // `radius` is in NORMALISED UV space [0..1]; the legacy WGSL
    // `bloomRadius = 5 + intensity*8` (px) was an inner gather radius
    // that doesn't translate 1:1 to BloomNode's blur kernel. We use a
    // moderate normalised value and rely on `setBloomStrength` for the
    // actual visual amplitude.
    const bloomNode = bloomMod.bloom(sceneColor, 1.0, 0.4, 0.15);
    bloomNode.threshold.value = 0.15;
    bloomNode.strength.value = 1.0;
    bloomNode.radius.value = 0.4;
    this.bloomNode = bloomNode as unknown as {
      strength: { value: number };
      threshold: { value: number };
      radius: { value: number };
    };

    // ── Custom Fn: chromatic aberration ──────────────────────────────
    //
    // Mirrors WGSL `useWebGPUPostProcess.ts:117–138`. Samples the input
    // texture three times at radial-from-center offsets (R outward,
    // G centred, B inward) and recombines per channel.
    //
    // TSL's `Fn` signature: `Fn(([arg1, arg2, ...]) => returnNode)` —
    // arguments are TSL nodes, the body returns a node. The resulting
    // function is callable via `myFn(arg1, arg2)` returning a Node.
    const chromaticAberrationFn = Fn(
      ([uvNode, scaleNode]: [ReturnType<typeof vec2>, ReturnType<typeof float>]) => {
        const center = vec2(0.5, 0.5);
        // dirRaw with a tiny epsilon avoids `normalize(vec2(0))` →
        // NaN at the exact screen centre.
        const dirRaw = uvNode.sub(center).add(vec2(0.0001, 0.0001));
        const dir = normalize(dirRaw);
        const dist = tslLength(uvNode.sub(center));
        // offset in UV space — divide by screen pixel size so the
        // `scale` value is measured in pixels (same units as the
        // legacy WGSL constant).
        const offset = dir.mul(dist).mul(scaleNode).div(screenSize);

        const rUV = uvNode.add(offset);
        const bUV = uvNode.sub(offset);

        // `texture(node, uv)` samples the upstream node at `uv`. We use
        // it on `sceneColor` indirectly — the way TSL's pass-texture
        // resampling works is via `sceneColor.uv(uv)` which returns a
        // Node sampling the same texture at the new UV. That is the
        // canonical pattern (see three.js TSL examples).
        const r = (sceneColor as unknown as { uv: (u: ReturnType<typeof vec2>) => { r: ReturnType<typeof float> } }).uv(rUV).r;
        const g = (sceneColor as unknown as { uv: (u: ReturnType<typeof vec2>) => { g: ReturnType<typeof float> } }).uv(uvNode).g;
        const b = (sceneColor as unknown as { uv: (u: ReturnType<typeof vec2>) => { b: ReturnType<typeof float> } }).uv(bUV).b;
        return vec3(r, g, b);
      },
    );

    // ── Custom Fn: scanlines + glitch ────────────────────────────────
    //
    // Mirrors WGSL `useWebGPUPostProcess.ts:156–172`. Per-pixel-row dim
    // band every 4 pixels, with an occasional time-driven RGB shift
    // glitch. Mixes with the input by `enable` so disabling produces a
    // bit-exact passthrough.
    const scanlinesFn = Fn(
      (
        [
          rgbNode,
          uvNode,
          enableNode,
          intensityNode,
          opacityNode,
        ]: [
          ReturnType<typeof vec3>,
          ReturnType<typeof vec2>,
          ReturnType<typeof float>,
          ReturnType<typeof float>,
          ReturnType<typeof float>,
        ],
      ) => {
        // pixelY = uv.y * screenHeight (matches WGSL `in.pos.y`).
        const pixelY = uvNode.y.mul(screenSize.y);
        const scanBand = step(0.6, fract(pixelY.div(4.0)));
        const scanDim = float(1.0).sub(scanBand.mul(opacityNode).mul(intensityNode));
        const dimmed = rgbNode.mul(scanDim);

        // Glitch: triggered by `step(0.96, fract(time*0.4 + 0.13))`,
        // pure port. Amplitude scaled by intensity.
        const glitchTrig = step(0.96, fract(time.mul(0.4).add(0.13)));
        const glitchAmp = glitchTrig
          .mul(sin(pixelY.mul(38.0).add(time.mul(120.0))))
          .mul(0.04)
          .mul(intensityNode);

        const shifted = vec3(
          dimmed.r.add(glitchAmp),
          dimmed.g,
          dimmed.b.sub(glitchAmp),
        );
        // Mix with the un-modified input by `enable` so enable=0 →
        // pure passthrough, enable=1 → full scanline+glitch.
        return mix(rgbNode, shifted, enableNode);
      },
    );

    // ── Compose the chain ────────────────────────────────────────────
    //
    // 1. Chromatic aberration runs FIRST against the raw scene texture
    //    (bloom should see the post-CA colour so its luma threshold
    //    operates on the user-perceived image). Scale = intensity * 3
    //    pixels (matches the legacy `intensity * 3.0` constant).
    const caScale = uIntensity.mul(uChromaticAberration);
    const caRGB = chromaticAberrationFn(screenUV, caScale);

    // 2. Bloom contribution — additive, scaled by intensity * strength.
    //    The BloomNode itself outputs a pre-blurred RGBA contribution;
    //    we take its `.rgb` and multiply by the intensity master.
    const bloomContribution = bloomNode.rgb.mul(uIntensity.mul(uBloomStrength));
    const bloomedRGB = caRGB.add(bloomContribution);

    // 3. Scanlines run last. Driven by the master intensity uniform so
    //    `setEffectIntensity(0)` zeros out the entire post-process
    //    contribution (matches legacy semantics).
    const scannedRGB = scanlinesFn(
      bloomedRGB,
      screenUV,
      uScanlinesEnabled,
      uIntensity,
      uScanlineOpacity,
    );

    // 4. Final composite — clamp to [0,1] (bloom can push channels
    //    above 1; legacy WGSL clamped at line 175) and preserve the
    //    scene's original alpha so the canvas can sit on top of the
    //    React-DOM 2D drawing layer without clobbering it.
    //    Mirrors `Hologram3DRenderer.ts:1662`.
    const clampedRGB = tslClamp(scannedRGB, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));
    const final = vec4(clampedRGB, sceneColor.a);

    // 5. Construct the PostProcessing instance + assign the output node.
    //    `outputNode` is a write-once-then-mutable field; setting it
    //    triggers the chain compile on the next render() call.
    this.postProcessing = new THREE.PostProcessing(this.renderer);
    this.postProcessing.outputNode = final;

    // Stash uniform handles for the public setters.
    this.uIntensity = uIntensity as unknown as { value: number };
    this.uScanlinesEnabled = uScanlinesEnabled as unknown as { value: number };
    this.uBloomStrength = uBloomStrength as unknown as { value: number };
    this.uBloomThreshold = uBloomThreshold as unknown as { value: number };
    this.uChromaticAberration = uChromaticAberration as unknown as { value: number };
    this.uScanlineOpacity = uScanlineOpacity as unknown as { value: number };

    // 6. Inject into SceneGraph. From this point, SceneGraph.render()
    //    drives `postProcessing.render()` instead of the default
    //    `renderer.render(scene, camera)` path.
    this.sceneGraphHandle.setPostProcessingChain(this.postProcessing);

    this.initialized = true;
  }

  /**
   * Per-frame work — no-op. The post-process chain runs INSIDE
   * `SceneGraph.render()` via the `postProcessing.render()` call (see
   * `setPostProcessingChain` in SceneGraph.ts). This method exists to
   * satisfy the `Layer` interface contract; PostProcessLayer has no
   * scene mesh to mutate per frame.
   */
  render(_deltaMs: number): void {
    // intentionally empty — see method docstring.
  }

  /**
   * Viewport changed. The `BloomNode` caches a screen-sized buffer for
   * its multi-pass blur; calling `setSize` rebuilds it for the new
   * dimensions. The post-process chain itself reacts to renderer size
   * automatically (PostProcessing reads from the live renderer).
   */
  resize(widthCss: number, heightCss: number, _dpr: number): void {
    if (!this.initialized || this.disposed) return;
    if (!Number.isFinite(widthCss) || widthCss <= 0) return;
    if (!Number.isFinite(heightCss) || heightCss <= 0) return;
    if (this.bloomNode) {
      const bn = this.bloomNode as unknown as {
        setSize?: (w: number, h: number) => void;
      };
      // BloomNode exposes setSize per `@types/three/.../BloomNode.d.ts`;
      // call defensively so a future Three.js version that drops the
      // method does not crash the resize path.
      bn.setSize?.(widthCss, heightCss);
    }
  }

  /**
   * `Layer.setVisible` — when `false`, detaches the chain from
   * SceneGraph so it falls back to the default present path. When
   * `true`, re-attaches.
   *
   * Per the legacy hook semantics, "post-process invisible" means the
   * scene composes through the default renderer (StrokeLayer +
   * TextOverlayLayer + Hologram3DLayer rendered raw). This matches the
   * Phase 6 6b-6d setVisible contract — visibility toggles WITHOUT
   * unmounting the layer or freeing GPU resources.
   */
  setVisible(visible: boolean): void {
    if (!this.initialized || this.disposed) return;
    if (!this.sceneGraphHandle || !this.postProcessing) return;
    if (visible) {
      this.sceneGraphHandle.setPostProcessingChain(this.postProcessing);
    } else {
      this.sceneGraphHandle.setPostProcessingChain(null);
    }
  }

  /** Idempotent — releases the post-process chain and detaches from
   *  SceneGraph. Safe to call before `init` resolves; the in-flight
   *  init detects `disposed` and bails out before allocating GPU state. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Detach from SceneGraph FIRST so a concurrent render() does not
    // try to drive a chain we are about to dispose. SceneGraph falls
    // back to the default `renderer.render(scene, camera)` path on the
    // next frame.
    if (this.sceneGraphHandle) {
      try {
        this.sceneGraphHandle.setPostProcessingChain(null);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[PostProcessLayer] detach setPostProcessingChain threw:', e);
      }
      this.sceneGraphHandle = null;
    }

    if (this.postProcessing) {
      try {
        this.postProcessing.dispose();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[PostProcessLayer] postProcessing.dispose threw:', e);
      }
      this.postProcessing = null;
    }

    this.bloomNode = null;
    this.uIntensity = null;
    this.uScanlinesEnabled = null;
    this.uBloomStrength = null;
    this.uBloomThreshold = null;
    this.uChromaticAberration = null;
    this.uScanlineOpacity = null;
    this.renderer = null;
    this.initialized = false;
  }

  // ── Public knobs ──────────────────────────────────────────────────────
  //
  // All setters mutate uniform `.value` in place — no rebuild, no
  // recompile. Safe to call on the per-frame path. Pre-init / post-
  // dispose calls are silent no-ops (matches the Layer.setVisible
  // contract and the prior `useWebGPUPostProcess.setIntensity` semantics).

  /**
   * Master effect intensity (0–1). Drives bloom contribution, chromatic
   * aberration scale, and scanline opacity in lock-step. Mirrors the
   * legacy `useWebGPUPostProcess.setIntensity(n)` behaviour.
   */
  setEffectIntensity(n: number): void {
    if (!this.uIntensity) return;
    this.uIntensity.value = clamp01(n, this.initialIntensity);
  }

  /**
   * Toggle scanlines on/off. `true` enables the per-row dim band +
   * glitch shift; `false` produces a bit-exact passthrough through the
   * scanlines node. Mirrors the legacy `enableScanlines` option.
   */
  setScanlinesEnabled(on: boolean): void {
    if (!this.uScanlinesEnabled) return;
    this.uScanlinesEnabled.value = on ? 1.0 : 0.0;
  }

  /**
   * Bloom strength multiplier (default 2.0). The final bloom
   * contribution is `bloomNode.rgb * uIntensity * uBloomStrength`, so
   * setting this to 0 zeros bloom entirely while leaving CA + scanlines
   * intact.
   */
  setBloomStrength(n: number): void {
    if (!this.uBloomStrength) return;
    const v = clampNonNeg(n, 2.0);
    this.uBloomStrength.value = v;
    // Also mirror to the BloomNode's own strength uniform — keeps the
    // internal pass amplitude in sync with the composite multiplier.
    if (this.bloomNode) this.bloomNode.strength.value = v;
  }

  /**
   * Bloom luminance threshold (0–1, default 0.15). Pixels below this
   * luminance do not contribute to bloom — lower values produce a
   * softer, more diffuse glow; higher values restrict bloom to bright
   * highlights only.
   */
  setBloomThreshold(n: number): void {
    if (!this.uBloomThreshold) return;
    const v = clamp01(n, 0.15);
    this.uBloomThreshold.value = v;
    if (this.bloomNode) this.bloomNode.threshold.value = v;
  }

  /**
   * Chromatic aberration scale, in pixels at full intensity. The
   * effective shift is `uIntensity * uChromaticAberration` pixels.
   * Default 3.0 (matches the legacy WGSL `intensity * 3.0` constant).
   */
  setChromaticAberration(n: number): void {
    if (!this.uChromaticAberration) return;
    this.uChromaticAberration.value = clampNonNeg(n, 3.0);
  }

  /**
   * Scanline opacity at full intensity (0–1, default 0.12). The visible
   * dim factor is `1 - scanBand * opacity * intensity`, so opacity=0
   * disables the dim bands while leaving the glitch shift intact.
   */
  setScanlineOpacity(n: number): void {
    if (!this.uScanlineOpacity) return;
    this.uScanlineOpacity.value = clamp01(n, 0.12);
  }

  // ── Diagnostics ───────────────────────────────────────────────────────

  /** True after `init` resolves and before `dispose` runs. */
  isInitialized(): boolean {
    return this.initialized && !this.disposed;
  }
}
