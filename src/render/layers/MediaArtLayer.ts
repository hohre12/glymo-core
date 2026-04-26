// MediaArtLayer — Phase 6 sub-slice 6a-5b: native media-art mesh-slot
// producer for the SceneGraph. Scaffold landed (additive); the
// legacy `Hologram3DRenderer` slot management (also in
// `glymo-core/src/hologram/Hologram3DRenderer.ts`) stays live during
// migration. See `docs/plans/render-v2-6a-5b-hologram-split.md` for the full
// strategy + remaining work + risks.
//
// THIS COMMIT — MVP scope only:
//   - Layer interface (init / render / resize / dispose / setVisible) wired
//     against the SceneGraph's shared scene + camera.
//   - Multi-mesh slot lifecycle: `addMesh` / `removeMesh` / `getMesh` /
//     `getAllMeshIds` / `hasAnyMesh` ported from `Hologram3DRenderer`,
//     including the load-token race detection and per-slot HDR-environment
//     attach cleanup.
//   - Per-slot transforms: `translateMeshTo` / `translateMeshBy` /
//     `setMeshSizeCss` / `getMeshSizeCss` / `getMeshOffsetCss` (state
//     stored per slot; per-frame rendering reads it).
//   - Per-slot animation control: `isMeshAnimationPaused` /
//     `toggleMeshAnimation`.
//   - Selection raycast: `hitTestMeshForSelection` against `ctx.camera`.
//   - Pinch-grab indicator: `grabMesh` / `releaseMesh` (flag only — pivot
//     fade visual lands with the shared pivot module port).
//   - Shared gesture inputs: `setRotation` / `setZoom` / `setTransition` /
//     `setHandActive` / `setEnabled` / `resetTransform`.
//   - Per-frame render of every loaded slot: writes scale (using the
//     `computeMeshNormalize` helper) + position (CSS offset → ortho world)
//     + rotation onto each mesh group, advances mixer + source `update()`
//     hooks with shared clocks, drains-or-takes the deltas based on
//     "all paused?" — same paused-drain semantics as the legacy renderer.
//   - Adds the canonical scene lights (`DirectionalLight` + `AmbientLight`)
//     to `ctx.scene` once per scene, guarded by a userData flag so adding
//     two MediaArtLayer instances (or a co-mounted TextHologramLayer that
//     also wants lights) does not double-light.
//   - Idempotent `dispose` (Strict Mode dev safe).
//
// Per §1.5.4 R-A — public surface is plain TS / Glymo-owned types only;
// `MeshHandle` / `MeshSourceDescriptor` / `MeshSourceLoadContext` already
// live in `@glymo/core/hologram`. Three.js types are confined to the
// implementation.

import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Group,
  Raycaster,
  Vector2,
  type Object3D,
  type OrthographicCamera as ThreeOrthographicCamera,
  type Scene as ThreeScene,
} from 'three';

import type { Layer, LayerInitContext } from '../Layer.js';
import { LAYER_DEFAULTS } from '../constants.js';
import {
  computeMeshNormalize,
  type MeshNormalizeInput,
} from '../../hologram/Hologram3DRenderer.js';
import { createMeshSource } from '../../hologram/sources/createMeshSource.js';
import type {
  MediaArtMeshState,
  MeshHandle,
  MeshSource,
  MeshSourceDescriptor,
  MeshSourceLoadContext,
} from '../../hologram/types.js';

// ── Public types ────────────────────────────────────────────────────────────

export interface MediaArtLayerOptions {
  /** Stable layer id. Defaults to `'media-art'`. */
  name?: string;
  /** Z position. Defaults to `LAYER_DEFAULTS.hologram3d.z` (=2). */
  z?: number;
  /**
   * When true (default), the layer adds the canonical scene lights
   * (DirectionalLight + AmbientLight, EarthPreview-matched) to the shared
   * scene on first init. Set false if another layer already owns scene
   * lighting — the userData flag guards against double-add either way.
   */
  manageSceneLights?: boolean;
}

// ── Internal per-objectId mesh slot ─────────────────────────────────────────
//
// Field-for-field port of `InternalMeshSlot` from `Hologram3DRenderer.ts`.
// See the legacy file's slot-comment for the per-field rationale; this
// scaffold intentionally mirrors the shape so tests / consumers behave
// identically across the two implementations during migration.

interface InternalMeshSlot {
  objectId: string;
  modelId: string;
  descriptor: MeshSourceDescriptor;
  state: MediaArtMeshState | null;
  uTime: { value: number } | null;
  uTransition: { value: number } | null;
  update: ((elapsed: number, dt: number) => void) | null;
  attachCleanup: (() => void) | null;
  animationPaused: boolean;
  loadToken: number;
  loaded: boolean;
  handle: MeshHandle | null;
  offsetCss: { x: number; y: number } | null;
  sizeCss: { width: number; height: number } | null;
}

// ── Scene-light userData key ────────────────────────────────────────────────
//
// Both `MediaArtLayer` and (eventually) `TextHologramLayer` need PBR scene
// lights — without them `MeshStandardNodeMaterial.colorNode` reads as black
// and bloom-over-emissive saturates the silhouette to white (root-caused
// 2026-04-20; see `feedback_pbr_needs_lights.md`). The scene's `userData`
// is the canonical Three.js channel for "did some sibling already provide
// X?" cross-layer coordination — keeps both layers self-contained without a
// shared module dependency.
const SCENE_LIGHTS_FLAG = '__hologramSharedLights';

// ── Implementation ──────────────────────────────────────────────────────────

export class MediaArtLayer implements Layer {
  readonly name: string;
  private readonly z: number;
  private readonly manageSceneLights: boolean;

  // Shared SceneGraph references (populated in `init`).
  private parentScene: ThreeScene | null = null;
  private camera: ThreeOrthographicCamera | null = null;
  private widthCss = 0;
  private heightCss = 0;

  /** Container group — direct child of `ctx.scene`, sibling of the optional
   *  TextHologramLayer's container. Equivalent to the legacy renderer's
   *  `meshRoot` — non-rotating, holds every loaded mesh slot's group. */
  private meshRoot: Group | null = null;

  /** Lights this layer added — kept so dispose can remove them. Empty when
   *  `manageSceneLights === false` or another layer already added them. */
  private addedLights: Object3D[] = [];

  /** Slot registry keyed by caller-assigned objectId. */
  private readonly meshes = new Map<string, InternalMeshSlot>();

  /** Monotonic load-token counter — every addMesh bumps it. */
  private nextLoadToken = 0;

  /** Shared per-render delta clocks (one per layer, one tick per frame). */
  private mixerClock: Clock | null = null;
  private meshFrameClock: Clock | null = null;

  // Caller-driven state
  private rotX = 0;
  private rotY = 0;
  private rotZ = 0;
  private zoom = 1;
  private transition = 1;
  // `_handActive` + `_activeMeshDrag` are reserved for the full-port pivot
  // crosshair fade — `applyContainerRotationAndZoom` reads them in the
  // legacy renderer to drive the indicator opacity. The setters / mutators
  // are public surface today (matched against the legacy API) so consumers
  // can wire without waiting for the visual to land. Underscore prefix so
  // TS noUnusedLocals doesn't flag them while no read-site exists yet.
  private _handActive = false;
  private enabled = true;
  private _activeMeshDrag = false;

  /** Wall-clock elapsed seconds since `init` resolved. Drives `uTime`. */
  private startTimeMs = 0;

  // Lifecycle gates
  private initialized = false;
  private disposed = false;
  private visible = true;

  // ── Construction ──────────────────────────────────────────────────────────

  constructor(opts: MediaArtLayerOptions = {}) {
    this.name = opts.name ?? 'media-art';
    this.z = opts.z ?? LAYER_DEFAULTS.hologram3d.z;
    this.manageSceneLights = opts.manageSceneLights ?? true;
  }

  // ── Layer interface ───────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error('[MediaArtLayer] cannot init after dispose');
    }
    if (this.initialized) {
      throw new Error('[MediaArtLayer] init has already run');
    }

    this.parentScene = ctx.scene;
    this.camera = ctx.camera;
    this.widthCss = ctx.widthCss;
    this.heightCss = ctx.heightCss;

    this.meshRoot = new Group();
    this.meshRoot.name = `MediaArtLayer:${this.name}:meshRoot`;
    this.meshRoot.position.set(0, 0, this.z);
    this.meshRoot.frustumCulled = false;
    ctx.scene.add(this.meshRoot);

    // Scene lights — only this layer (or the first MediaArtLayer instance
    // if there are multiple) actually adds them; the userData flag rides
    // along with the scene so a co-mounted TextHologramLayer can reuse the
    // same lights without coordination.
    if (this.manageSceneLights) {
      const userData = (ctx.scene as unknown as { userData: Record<string, unknown> }).userData;
      if (!userData[SCENE_LIGHTS_FLAG]) {
        const sun = new DirectionalLight(0xeaf6ff, 1.4);
        sun.position.set(3, 1.0, 2.5);
        ctx.scene.add(sun);
        const ambient = new AmbientLight(0x102036, 0.45);
        ctx.scene.add(ambient);
        this.addedLights.push(sun, ambient);
        userData[SCENE_LIGHTS_FLAG] = true;
      }
    }

    this.startTimeMs = performance.now();
    this.initialized = true;
  }

  render(_deltaMs: number): void {
    if (!this.initialized || this.disposed) return;
    if (!this.meshRoot) return;
    if (!this.enabled || this.transition < 0.001) {
      this.meshRoot.visible = false;
      return;
    }
    this.meshRoot.visible = this.visible;

    const elapsed = (performance.now() - this.startTimeMs) * 0.001;
    this.renderMeshFrame(elapsed);
  }

  resize(widthCss: number, heightCss: number, _dpr: number): void {
    this.widthCss = widthCss;
    this.heightCss = heightCss;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // Bump the token so any in-flight load recognises itself as superseded.
    this.nextLoadToken++;

    for (const slot of this.meshes.values()) {
      this.disposeMeshSlot(slot);
    }
    this.meshes.clear();

    if (this.meshRoot && this.parentScene) {
      this.parentScene.remove(this.meshRoot);
    }
    this.meshRoot = null;

    if (this.parentScene && this.addedLights.length > 0) {
      for (const light of this.addedLights) {
        this.parentScene.remove(light);
        // Three.js Light has no GPU-side resources beyond uniforms; no
        // dispose() needed. Reset the userData flag so a fresh layer
        // mounted on the same scene reseeds the lights.
      }
      const userData = (this.parentScene as unknown as { userData: Record<string, unknown> }).userData;
      delete userData[SCENE_LIGHTS_FLAG];
      this.addedLights = [];
    }

    this.parentScene = null;
    this.camera = null;
    this.mixerClock = null;
    this.meshFrameClock = null;
    this.initialized = false;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.meshRoot) this.meshRoot.visible = visible;
  }

  // ── Multi-mesh slot API (port of Hologram3DRenderer multi-mesh) ──────────

  async addMesh(
    objectId: string,
    modelId: string,
    descriptor: MeshSourceDescriptor,
    ctx?: MeshSourceLoadContext,
  ): Promise<MeshHandle | null> {
    if (this.disposed) return null;
    const token = ++this.nextLoadToken;

    const existing = this.meshes.get(objectId);
    if (existing) {
      this.disposeMeshSlot(existing);
      this.meshes.delete(objectId);
    }

    const slot: InternalMeshSlot = {
      objectId,
      modelId,
      descriptor,
      state: null,
      uTime: null,
      uTransition: null,
      update: null,
      attachCleanup: null,
      animationPaused: true,
      loadToken: token,
      loaded: false,
      handle: null,
      offsetCss: null,
      sizeCss: null,
    };
    this.meshes.set(objectId, slot);

    // The mesh source needs the lazy `three/webgpu` + `three/tsl` modules.
    // Import them on demand rather than at module top — this keeps the SSR
    // story and matches the legacy renderer's `loadThreeDeps` pattern.
    let THREE: typeof import('three/webgpu');
    let tsl: typeof import('three/tsl');
    try {
      [THREE, tsl] = await Promise.all([
        import('three/webgpu'),
        import('three/tsl'),
      ]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[MediaArtLayer] failed to load three/webgpu+tsl:', e);
      const cur = this.meshes.get(objectId);
      if (cur && cur.loadToken === token) this.meshes.delete(objectId);
      return null;
    }

    if (this.disposed) {
      const cur = this.meshes.get(objectId);
      if (cur && cur.loadToken === token) this.meshes.delete(objectId);
      return null;
    }
    {
      const cur = this.meshes.get(objectId);
      if (!cur || cur.loadToken !== token) return null;
    }

    // Construct + load the source. Wrapping ctx callbacks so signals firing
    // after this load is superseded do not leak into the consumer's UI.
    const source: MeshSource = createMeshSource(descriptor);
    const isStillCurrent = (): boolean => {
      if (this.disposed) return false;
      const s = this.meshes.get(objectId);
      return !!s && s.loadToken === token;
    };
    const wrappedProgress = ctx?.onProgress
      ? (p: number): void => {
          if (!isStillCurrent()) return;
          ctx.onProgress?.(p);
        }
      : undefined;
    const wrappedCacheHit = ctx?.onCacheHit
      ? (): void => {
          if (!isStillCurrent()) return;
          ctx.onCacheHit?.();
        }
      : undefined;
    const sourceCtx: MeshSourceLoadContext | undefined =
      wrappedProgress || wrappedCacheHit
        ? {
            ...(wrappedProgress ? { onProgress: wrappedProgress } : {}),
            ...(wrappedCacheHit ? { onCacheHit: wrappedCacheHit } : {}),
          }
        : undefined;

    let state: MediaArtMeshState;
    try {
      state = await source.load({ THREE, tsl }, sourceCtx);
    } catch (err) {
      const cur = this.meshes.get(objectId);
      if (!cur || cur.loadToken !== token || this.disposed) return null;
      this.meshes.delete(objectId);
      throw err;
    }

    const winner = this.meshes.get(objectId);
    if (!winner || winner.loadToken !== token || this.disposed) {
      try {
        state.dispose();
      } catch {
        /* noop */
      }
      return null;
    }

    // Commit
    winner.state = state;
    winner.uTime = state.uTime ?? null;
    winner.uTransition = state.uTransition ?? null;
    winner.update = state.update ? state.update.bind(state) : null;

    if (this.meshRoot) {
      this.meshRoot.add(state.group as Object3D);
    }

    if (state.attachToScene && this.parentScene) {
      const cleanup = state.attachToScene(this.parentScene);
      winner.attachCleanup = typeof cleanup === 'function' ? cleanup : null;
    }

    if (state.mixer && !this.mixerClock) this.mixerClock = new Clock();
    if (winner.update && !this.meshFrameClock) this.meshFrameClock = new Clock();

    winner.animationPaused = true;
    winner.loaded = true;
    winner.handle = {
      objectId: winner.objectId,
      modelId: winner.modelId,
      descriptor: winner.descriptor,
      state,
    };

    return winner.handle;
  }

  async removeMesh(objectId: string): Promise<boolean> {
    const slot = this.meshes.get(objectId);
    if (!slot) return false;
    this.disposeMeshSlot(slot);
    this.meshes.delete(objectId);
    return true;
  }

  getMesh(objectId: string): MeshHandle | null {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded || !slot.handle) return null;
    return slot.handle;
  }

  getAllMeshIds(): readonly string[] {
    return [...this.meshes.keys()];
  }

  hasAnyMesh(): boolean {
    return this.meshes.size > 0;
  }

  // ── Per-slot transforms ──────────────────────────────────────────────────

  translateMeshTo(objectId: string, x: number, y: number): void {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded) return;
    if (this.widthCss <= 0 || this.heightCss <= 0) return;
    slot.offsetCss = { x, y };
  }

  translateMeshBy(objectId: string, dx: number, dy: number): void {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded) return;
    if (this.widthCss <= 0 || this.heightCss <= 0) return;
    if (dx === 0 && dy === 0) return;

    // Canvas-pixel → CSS-pixel at the boundary, mirrors legacy renderer
    // (the public `translateObject` API ships canvas-pixel deltas).
    const dpr =
      typeof window !== 'undefined' && window.devicePixelRatio > 0
        ? window.devicePixelRatio
        : 1;
    const dxCss = dx / dpr;
    const dyCss = dy / dpr;

    if (slot.offsetCss) {
      slot.offsetCss.x += dxCss;
      slot.offsetCss.y += dyCss;
    } else {
      slot.offsetCss = { x: dxCss, y: dyCss };
    }
  }

  setMeshSizeCss(objectId: string, width: number, height: number): void {
    const slot = this.meshes.get(objectId);
    if (!slot) return;
    if (!(width > 0) || !(height > 0)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[MediaArtLayer] setMeshSizeCss ignored non-positive dims (objectId: ${objectId}, w: ${width}, h: ${height})`,
      );
      return;
    }
    slot.sizeCss = { width, height };
  }

  getMeshSizeCss(objectId: string): { width: number; height: number } | null {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.sizeCss) return null;
    return { ...slot.sizeCss };
  }

  getMeshOffsetCss(objectId: string): { x: number; y: number } | null {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded) return null;
    return slot.offsetCss ? { ...slot.offsetCss } : null;
  }

  // ── Per-slot animation control ───────────────────────────────────────────

  isMeshAnimationPaused(objectId: string): boolean | null {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded) return null;
    return slot.animationPaused;
  }

  toggleMeshAnimation(objectId: string): boolean | null {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded) return null;
    slot.animationPaused = !slot.animationPaused;
    return slot.animationPaused;
  }

  // ── Selection raycast ────────────────────────────────────────────────────

  hitTestMeshForSelection(cssX: number, cssY: number): string | null {
    if (!this.camera) return null;
    if (this.widthCss <= 0 || this.heightCss <= 0) return null;
    const ndcX = (cssX / this.widthCss) * 2 - 1;
    const ndcY = -((cssY / this.heightCss) * 2 - 1);

    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(ndcX, ndcY), this.camera);

    let nearest: { objectId: string; distance: number } | null = null;
    for (const slot of this.meshes.values()) {
      if (!slot.loaded || !slot.state) continue;
      const group = slot.state.group as Object3D;
      const intersects = raycaster.intersectObjects([group], true);
      if (intersects.length === 0) continue;
      const distance = (intersects[0] as { distance: number } | undefined)?.distance ?? Infinity;
      if (!nearest || distance < nearest.distance) {
        nearest = { objectId: slot.objectId, distance };
      }
    }
    return nearest?.objectId ?? null;
  }

  // ── Pinch-grab indicator ─────────────────────────────────────────────────

  grabMesh(objectId: string): boolean {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded) return false;
    this._activeMeshDrag = true;
    return true;
  }

  releaseMesh(): void {
    this._activeMeshDrag = false;
  }

  /**
   * Diagnostic — true while a single-hand pinch-grab is in flight, OR while
   * the two-hand gesture controller signalled `setHandActive(true)`. Reserved
   * for the pivot-fade port: the legacy renderer reads both flags inside
   * `applyContainerRotationAndZoom` to drive the crosshair's opacity. Until
   * that visual lands, exposing the combined flag here keeps the public API
   * stable and gives callers a probe into the layer's gesture state without
   * reaching into private fields.
   */
  isGestureActive(): boolean {
    return this._handActive || this._activeMeshDrag;
  }

  // ── Shared gesture inputs ────────────────────────────────────────────────

  setRotation(rotX: number, rotY: number, rotZ?: number): void {
    this.rotX = rotX;
    this.rotY = rotY;
    if (rotZ !== undefined) this.rotZ = rotZ;
  }

  setZoom(zoom: number): void {
    this.zoom = Math.max(0.01, zoom);
  }

  setTransition(t: number): void {
    this.transition = Math.max(0, Math.min(1, t));
  }

  setHandActive(active: boolean): void {
    this._handActive = active;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  resetTransform(): void {
    this.rotX = 0;
    this.rotY = 0;
    this.rotZ = 0;
    this.zoom = 1;
    this._activeMeshDrag = false;
    for (const slot of this.meshes.values()) {
      slot.offsetCss = null;
      slot.sizeCss = null;
    }
  }

  // ── Per-frame mesh sync ──────────────────────────────────────────────────

  /**
   * Mesh-mode per-frame update — iterates every loaded slot. Field-for-field
   * port of `Hologram3DRenderer.renderMeshFrame` adapted to the SceneGraph's
   * orthographic camera (1 world unit = 1 CSS pixel; no perspective dolly).
   *
   * Paused-drain semantics: if every loaded slot is paused, the clocks'
   * deltas are discarded so a subsequent resume does not fast-forward; if
   * any slot is unpaused, the deltas are taken once and fanned out.
   */
  private renderMeshFrame(elapsed: number): void {
    const loadedSlots: InternalMeshSlot[] = [];
    for (const slot of this.meshes.values()) {
      if (slot.loaded && slot.state) loadedSlots.push(slot);
    }
    if (loadedSlots.length === 0) return;

    const allPaused = loadedSlots.every((s) => s.animationPaused);
    let mixerDt = 0;
    let frameDt = 0;
    if (allPaused) {
      this.mixerClock?.getDelta();
      this.meshFrameClock?.getDelta();
    } else {
      if (this.mixerClock) mixerDt = this.mixerClock.getDelta();
      if (this.meshFrameClock) frameDt = this.meshFrameClock.getDelta();
    }

    // Orthographic frustum half-extent — 1 world unit = 1 CSS pixel, so the
    // visible half is just half the viewport. `computeMeshNormalize` uses
    // these to convert per-slot `sizeCss` into world scale; in the ortho
    // case `targetWorld = (targetCss / canvasCss) * 2 * visibleHalf`
    // collapses to `targetWorld = targetCss`, which is exactly the
    // identity-scale we want. Passing the math through the helper keeps
    // the same unit-tested code path on both renderers.
    const visibleHalfW = this.widthCss / 2;
    const visibleHalfH = this.heightCss / 2;

    for (const slot of loadedSlots) {
      const state = slot.state!;
      const group = state.group as Object3D;

      // Drive the source's shader uniforms.
      if (slot.uTime) slot.uTime.value = elapsed;
      if (slot.uTransition) slot.uTransition.value = 1;

      if (!slot.animationPaused) {
        if (state.mixer && this.mixerClock) {
          try {
            (state.mixer as { update: (dt: number) => void }).update(mixerDt);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
              `[MediaArtLayer] mixer.update threw (objectId: ${slot.objectId}, modelId: ${slot.modelId}):`,
              err,
            );
          }
        }
        if (slot.update && this.meshFrameClock) {
          try {
            slot.update(elapsed, frameDt);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
              `[MediaArtLayer] update hook threw (objectId: ${slot.objectId}, modelId: ${slot.modelId}):`,
              err,
            );
          }
        }
      }

      const bb = state.bbox;
      const normalizeInput: MeshNormalizeInput = {
        sizeCss: slot.sizeCss,
        canvasCssW: this.widthCss,
        canvasCssH: this.heightCss,
        visibleHalfW,
        visibleHalfH,
        bb: {
          min: { x: bb.min.x, y: bb.min.y, z: bb.min.z },
          max: { x: bb.max.x, y: bb.max.y, z: bb.max.z },
        },
      };
      const normalize = computeMeshNormalize(normalizeInput);
      const baseScale = normalize * this.transition;
      // Same zoom-multiplier rule as the legacy renderer: only multiply by
      // zoom when `sizeCss` is set (the helper's CSS-anchored branch already
      // cancels the perspective camera dolly; in the ortho path with
      // `visibleHalf = widthCss/2`, the normalize is identity-CSS so the
      // user-facing zoom must come from this multiplier).
      const zoomMultiplier = slot.sizeCss ? this.zoom : 1;
      const zoomedScale = baseScale * zoomMultiplier;
      group.scale.set(zoomedScale, zoomedScale, zoomedScale);
      group.rotation.set(this.rotX, this.rotY, this.rotZ);

      const cx = (bb.max.x + bb.min.x) * 0.5;
      const cy = (bb.max.y + bb.min.y) * 0.5;
      const cz = (bb.max.z + bb.min.z) * 0.5;

      // CSS offset → ortho world: 1:1 with a y-flip.
      let offX = 0;
      let offY = 0;
      if (slot.offsetCss && this.widthCss > 0 && this.heightCss > 0) {
        offX = slot.offsetCss.x - this.widthCss / 2;
        offY = -(slot.offsetCss.y - this.heightCss / 2);
      }

      group.position.set(
        -cx * zoomedScale + offX,
        -cy * zoomedScale + offY,
        -cz * zoomedScale,
      );
    }
  }

  // ── Internal: slot teardown ──────────────────────────────────────────────

  /**
   * Tear down a single mesh slot. Mirrors `Hologram3DRenderer.disposeMeshSlot`
   * field-for-field (attach cleanup before state.dispose so HDR env / fog
   * state isn't stranded).
   */
  private disposeMeshSlot(slot: InternalMeshSlot): void {
    if (slot.attachCleanup) {
      try {
        slot.attachCleanup();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[MediaArtLayer] attach cleanup threw:', err);
      }
      slot.attachCleanup = null;
    }
    if (slot.state && this.meshRoot) {
      this.meshRoot.remove(slot.state.group as Object3D);
    }
    if (slot.state) {
      try {
        slot.state.dispose();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[MediaArtLayer] state dispose threw:', err);
      }
    }
    slot.state = null;
    slot.uTime = null;
    slot.uTransition = null;
    slot.update = null;
    slot.handle = null;
    slot.loaded = false;
    slot.sizeCss = null;
  }
}
