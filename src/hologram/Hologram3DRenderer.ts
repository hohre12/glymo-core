// ── Hologram 3D Renderer ──────────────────────────────────────────────────────
//
// Extracted from landing/hooks/useHologram3DMesh.ts.
// Self-contained Three.js WebGPU renderer for holographic 3D text.
// No React dependency — operates on a plain HTMLCanvasElement.
//
// v0.7.0 added media-art meshes (per docs/plans/media-art-mvp.md §5 D5): the
// same renderer can show one or more GLB / procedural scenes alongside the
// per-character text. Presence of any entry in `this.meshes` routes the frame
// loop through the mesh path; bloom + holo color + rotation/zoom/spread
// effects are shared so text and media-art holograms feel like one product.
// Multi-mesh is canonical since 0.16.0 — the original `setModel` single-mesh
// shim was removed in Task 1.7 of docs/plans/media-art-multi-mesh.md.

import type {
  HologramChar,
  Hologram3DRendererOptions,
  HitTestResult,
  MediaArtMeshState,
  MeshHandle,
  MeshSource,
  MeshSourceDescriptor,
  MeshSourceLoadContext,
} from './types.js';
import { createMeshSource } from './sources/createMeshSource.js';

// ── Internal per-objectId mesh slot ───────────────────────────────────────────
//
// One entry in `Hologram3DRenderer.meshes` per loaded/loading mesh. Added in
// Task 1.3 of the multi-mesh refactor (docs/plans/media-art-multi-mesh.md); the
// prior single-mesh state was nine renderer-wide fields, now one slot per
// objectId here.
//
// `loadToken` is the race-detection token for the SAME slot — a second
// addMesh(objectId, ...) call overwrites the slot's token so any still-in-flight
// first load recognises itself as superseded on return and disposes instead of
// attaching.
//
// `handle` caches the MeshHandle object so `getMesh(objectId)` returns a stable
// reference that can be identity-compared against the handle returned by
// `addMesh` (tests rely on `.toBe(handle)`).
//
// `loaded` is true once the source.load() has resolved and the slot has been
// committed (uniforms wired, group attached). Until then `getMesh` returns null
// — a pending slot is internal state, not a visible mesh.
//
// `animationPaused` is per-slot so each mesh can pause independently (Studio
// convention: every freshly-loaded mesh is frozen until the user's air-magic
// pinch resumes it). `isMeshAnimationPaused(objectId)` /
// `toggleMeshAnimation(objectId)` address a specific slot.
interface InternalMeshSlot {
  objectId: string;
  modelId: string;
  descriptor: MeshSourceDescriptor;
  /** Resolved state; meaningful only when `loaded === true`. */
  state: MediaArtMeshState | null;
  /** Uniform driven per frame with elapsed seconds. Null until load commits. */
  uTime: { value: number } | null;
  /** Uniform driven per frame with transition. Null until load commits. */
  uTransition: { value: number } | null;
  /** Per-frame update hook surfaced by the source (e.g. axial spin). */
  update: ((elapsed: number, dt: number) => void) | null;
  /** Cleanup returned by state.attachToScene (restores scene.environment etc.). */
  attachCleanup: (() => void) | null;
  /** Paused flag — true freezes mixer + update hook. */
  animationPaused: boolean;
  /** Token for race detection on repeated addMesh(objectId, ...) calls. */
  loadToken: number;
  /** False while loading; true once the slot is committed and renderable. */
  loaded: boolean;
  /**
   * Stable handle — returned by both addMesh and getMesh so callers can
   * identity-compare. Null while loading; populated atomically at commit.
   */
  handle: MeshHandle | null;
}

// ── Lazy Three.js WebGPU imports ──────────────────────────────────────────────
// Dynamically imported to keep initial bundle small and avoid SSR issues.

let THREE: typeof import('three/webgpu') | null = null;
let TextGeometry: typeof import('three/examples/jsm/geometries/TextGeometry.js').TextGeometry | null = null;
let FontClass: typeof import('three/examples/jsm/loaders/FontLoader.js').Font | null = null;
let tsl: typeof import('three/tsl') | null = null;
let bloomFn: typeof import('three/addons/tsl/display/BloomNode.js').bloom | null = null;

// Single in-flight promise — guarantees concurrent callers share one
// dynamic-import chain instead of racing parallel imports (which under
// Strict Mode dev OR vitest mocks can resolve to different module identities,
// silently overwriting THREE between callers).
let loadPromise: Promise<boolean> | null = null;

function loadThreeDeps(): Promise<boolean> {
  if (THREE) return Promise.resolve(true);
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const [
        threeModule,
        textGeoModule,
        fontLoaderModule,
        tslModule,
        bloomModule,
      ] = await Promise.all([
        import('three/webgpu'),
        import('three/examples/jsm/geometries/TextGeometry.js'),
        import('three/examples/jsm/loaders/FontLoader.js'),
        import('three/tsl'),
        import('three/addons/tsl/display/BloomNode.js'),
      ]);
      THREE = threeModule;
      TextGeometry = textGeoModule.TextGeometry;
      FontClass = fontLoaderModule.Font;
      tsl = tslModule;
      bloomFn = bloomModule.bloom;
      return true;
    } catch (e) {
      console.error('[Hologram3DRenderer] Failed to load Three.js WebGPU:', e);
      // Allow a future caller to retry on a fresh promise — a transient
      // network error on the addons CDN should not poison subsequent loads.
      loadPromise = null;
      return false;
    }
  })();
  return loadPromise;
}

// ── Font loading URLs ─────────────────────────────────────────────────────────

const DEFAULT_FONT_URLS = [
  '/fonts/helvetiker_bold.typeface.json',
  'https://cdn.jsdelivr.net/npm/three@0.183.2/examples/fonts/helvetiker_bold.typeface.json',
];

// Korean font stack used for canvas texture fallback
const KOREAN_FONT_STACK = '"Apple SD Gothic Neo", "Nanum Gothic", "Malgun Gothic", "Noto Sans KR", sans-serif';

/** Check if a character requires CJK rendering (no glyph in helvetiker) */
function needsTextureFallback(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  // Hangul Syllables (AC00-D7AF), Jamo (1100-11FF, 3130-318F),
  // CJK Unified (4E00-9FFF), Hiragana/Katakana (3040-30FF)
  return (code >= 0xAC00 && code <= 0xD7AF)
      || (code >= 0x1100 && code <= 0x11FF)
      || (code >= 0x3130 && code <= 0x318F)
      || (code >= 0x4E00 && code <= 0x9FFF)
      || (code >= 0x3040 && code <= 0x30FF);
}

// ── Renderer Class ────────────────────────────────────────────────────────────

export class Hologram3DRenderer {
  private canvas: HTMLCanvasElement;
  private destroyed = false;

  // Three.js objects (initialized asynchronously)
  private renderer: InstanceType<typeof import('three/webgpu').WebGPURenderer> | null = null;
  private postProcessing: InstanceType<typeof import('three/webgpu').PostProcessing> | null = null;
  private scene: InstanceType<typeof import('three/webgpu').Scene> | null = null;
  private camera: InstanceType<typeof import('three/webgpu').PerspectiveCamera> | null = null;
  private charContainer: InstanceType<typeof import('three/webgpu').Group> | null = null;
  private pivotGroup: InstanceType<typeof import('three/webgpu').Group> | null = null;
  private loadedFont: InstanceType<typeof import('three/examples/jsm/loaders/FontLoader.js').Font> | null = null;

  // Per-char mesh tracking
  private charMeshes = new Map<string, {
    group: InstanceType<typeof import('three/webgpu').Group>;
    frontMat: InstanceType<typeof import('three/webgpu').MeshStandardNodeMaterial>;
    sideMat: InstanceType<typeof import('three/webgpu').MeshStandardNodeMaterial>;
    uTime: ReturnType<typeof import('three/tsl').uniform>;
    uTransition: ReturnType<typeof import('three/tsl').uniform>;
    sideUTime: ReturnType<typeof import('three/tsl').uniform>;
    sideUTransition: ReturnType<typeof import('three/tsl').uniform>;
  }>();

  // Mutable state
  private chars: HologramChar[] = [];
  private rotX = 0;
  private rotY = 0;
  private rotZ = 0;
  private zoom = 1;
  private transition = 0;
  private spread = 1;
  private handActive = false;
  private enabled = true;

  /**
   * Map of loaded/loading meshes keyed by caller-assigned `objectId`.
   *
   * Replaces the nine single-mesh fields that lived here before Task 1.3
   * (meshState, loadToken, meshUTime, meshUTransition, meshUpdate,
   * meshAttachCleanup, mixerClock, meshFrameClock, meshAnimationPaused).
   *
   * Since Task 1.7 (0.16.0) the multi-mesh API is canonical — the legacy
   * single-mesh `setModel` shim and its `mode` flag are gone. Presence of any
   * entry here is the only signal that a media-art mesh is active; consumers
   * call `addMesh(objectId, …)` and `removeMesh(objectId)` directly.
   */
  private meshes = new Map<string, InternalMeshSlot>();

  /**
   * Monotonic counter feeding each slot's `loadToken`. Shared across all
   * objectIds so even a later addMesh for a DIFFERENT objectId bumps the
   * counter — simpler than a per-objectId counter and still correct for the
   * same-objectId race case (the only case that matters).
   */
  private nextLoadToken = 0;

  /**
   * Animation mixer clock — separate from startTime so mixer pauses on dispose.
   * Renderer-wide (per the multi-mesh plan: one clock drives all meshes); the
   * frame-loop tick is gated per-slot by `animationPaused`.
   */
  private mixerClock: InstanceType<typeof import('three/webgpu').Clock> | null = null;

  /**
   * Frame-delta clock for the mesh sources' update hooks. Independent from
   * mixerClock so the two advance in step but neither resets the other on
   * read (Clock.getDelta is destructive). Renderer-wide like mixerClock.
   */
  private meshFrameClock: InstanceType<typeof import('three/webgpu').Clock> | null = null;
  // Note: color and font were removed — the renderer uses hardcoded hologram
  // color (0x00bbff) and loads its own 3D font file. If per-instance color/font
  // customization is needed later, add setter methods instead of constructor args.

  /** Per-char position overrides (persists after release): charId -> {x, y} in CSS coords */
  private movedChars = new Map<string, { x: number; y: number }>();
  /** Which char is currently being actively dragged (null = none) */
  private activeDragId: string | null = null;
  /**
   * Mesh single-hand pinch-grab state. `activeMeshDrag` fades the pivot
   * indicator in during translate (same channel as two-hand `handActive`);
   * `meshGrabPosition` records the last committed charContainer position in
   * world units so tests and future commit paths can inspect the release
   * value without reaching into Three.js internals. Both fields are
   * renderer-wide — drag is inherently a single-hand affordance, so even
   * with multi-mesh only one mesh is being dragged at a time.
   */
  private activeMeshDrag = false;
  private meshGrabPosition: { x: number; y: number } | null = null;

  /** Last committed mesh-mode grab position in world units (read by tests and future commit paths). */
  getLastMeshGrabPosition(): { x: number; y: number } | null {
    return this.meshGrabPosition;
  }

  private startTime = performance.now();

  /** Whether the renderer has been successfully initialized */
  private _isAvailable = false;
  get isAvailable(): boolean { return this._isAvailable; }

  /** Initialization promise — resolves to true if WebGPU + font loaded OK */
  readonly ready: Promise<boolean>;

  constructor(options: Hologram3DRendererOptions) {
    this.canvas = options.canvas;
    this.ready = this.init();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Update the set of characters to display */
  setText(chars: HologramChar[]): void {
    this.chars = chars;
  }

  /** Set X/Y/Z rotation in radians */
  setRotation(rotX: number, rotY: number, rotZ?: number): void {
    this.rotX = rotX;
    this.rotY = rotY;
    if (rotZ !== undefined) this.rotZ = rotZ;
  }

  /** Set zoom level (clamped to 0.3 - 3.0) */
  setZoom(zoom: number): void {
    this.zoom = Math.max(0.3, Math.min(3.0, zoom));
  }

  /** Set transition progress (0 = hidden, 1 = fully visible) */
  setTransition(t: number): void {
    this.transition = Math.max(0, Math.min(1, t));
  }

  /** Set spread multiplier: 0 = flat, 1 = normal, 6 = max spread */
  setSpread(spread: number): void {
    this.spread = Math.max(0, Math.min(6.0, spread));
  }

  /** Set whether hands are actively controlling the hologram */
  setHandActive(active: boolean): void {
    this.handActive = active;
  }

  /** Enable/disable the renderer */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Resize the renderer's backbuffer + camera frustum to match a CSS box.
   *
   * Canonical pattern: this is the SOLE writer of `canvas.width` /
   * `canvas.height` for the hologram canvas. The host (React) must NOT
   * pass `width` / `height` props to the canvas element — CSS sizes the
   * box, a ResizeObserver in the host calls into here, and Three.js
   * (`renderer.setSize` → `CanvasTarget.setSize`) writes the bitmap
   * attribute as `cssWidth × pixelRatio`.
   *
   * Without this single-writer guarantee the React render → Three.js
   * setSize race causes the WebGPU swap chain to drift from the cached
   * MSAA color buffer, producing the "resolve target size does not match
   * the size of the other attachments" validation failure.
   *
   * `false` for `updateStyle` — we do not want Three.js writing inline
   * `style.width` on the canvas element; CSS owns that channel.
   *
   * Skipped if zero-sized (pre-layout) — layout will deliver a non-zero
   * size shortly and the next observer tick will route through.
   */
  setSize(cssWidth: number, cssHeight: number): void {
    if (this.destroyed) return;
    if (cssWidth <= 0 || cssHeight <= 0) return;
    if (!this.renderer || !this.camera) return;

    this.renderer.setSize(cssWidth, cssHeight, false);
    this.camera.aspect = cssWidth / cssHeight;
    this.camera.updateProjectionMatrix();
    // PassNode.updateBefore() and BloomNode.updateBefore() will pick up
    // the new renderer.getSize() / getDrawingBufferSize() on the next
    // postProcessing.render() — no manual setSize needed on the passes.
  }

  /** Start dragging a char to a CSS position */
  grabChar(charId: string, x: number, y: number): void {
    this.movedChars.set(charId, { x, y });
    this.activeDragId = charId;
  }

  /** Stop dragging — char stays at last position */
  releaseChar(_charId: string): void {
    this.activeDragId = null;
  }

  /** Reset all transforms to initial state */
  resetTransform(): void {
    this.rotX = 0;
    this.rotY = 0;
    this.rotZ = 0;
    this.zoom = 1;
    this.spread = 1;
    this.movedChars.clear();
    this.activeDragId = null;
    this.activeMeshDrag = false;
    this.meshGrabPosition = null;
    if (this.charContainer) {
      this.charContainer.position.set(0, 0, 0);
    }
  }

  // ── Mesh mode API (v0.7.0 / canonical multi-mesh since 0.16.0) ──────────────

  /**
   * Load a mesh and register it under `objectId`. Resolves with the
   * `MeshHandle`, or `null` when the renderer is destroyed or the load is
   * superseded by a newer `addMesh(objectId, ...)` call for the SAME id
   * (late replacement race — we keep the winner).
   *
   * Errors from the underlying MeshSource (network, parse, validation)
   * propagate to the caller as a typed `GlymoError` unless the load was
   * superseded — superseded failures are swallowed because the winner owns
   * the slot.
   *
   * `ctx` is optional; progress / cache-hit callbacks are wrapped so
   * signals that fire AFTER the load is superseded are suppressed.
   */
  async addMesh(
    objectId: string,
    modelId: string,
    descriptor: MeshSourceDescriptor,
    ctx?: MeshSourceLoadContext,
  ): Promise<MeshHandle | null> {
    if (this.destroyed) return null;
    const token = ++this.nextLoadToken;

    // Tear down any existing slot for this objectId so a replacement
    // (e.g. user picked a different asset for the same object) releases GPU
    // resources before the new one attaches.
    const existing = this.meshes.get(objectId);
    if (existing) {
      this.disposeMeshSlot(existing);
      this.meshes.delete(objectId);
    }

    // Prime the slot BEFORE the async load so a later addMesh for the same
    // id can race-detect us (its ++this.nextLoadToken will overwrite the
    // slot's loadToken, so when our await resumes we'll see we lost).
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
    };
    this.meshes.set(objectId, slot);

    // ── Wait for renderer init (Three.js modules + WebGPU) ────────────────
    const ready = await this.ready;
    // After the await another call may have superseded us or disposed the
    // renderer — check both before continuing.
    if (!ready || this.destroyed) {
      const current = this.meshes.get(objectId);
      if (current && current.loadToken === token) this.meshes.delete(objectId);
      return null;
    }
    {
      const current = this.meshes.get(objectId);
      if (!current || current.loadToken !== token) return null;
    }
    if (!THREE || !tsl) return null;

    // ── Construct + load the mesh source ──────────────────────────────────
    const source = this.createMeshSource(descriptor);
    let state: MediaArtMeshState;
    try {
      // Wrap onProgress + onCacheHit so callbacks firing after this load is
      // superseded (or the renderer disposed) do not leak stale signals into
      // the consumer's UI. Only attach wrappers when the consumer supplied
      // the corresponding hook.
      const isStillCurrent = (): boolean => {
        if (this.destroyed) return false;
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
      state = await source.load({ THREE, tsl }, sourceCtx);
    } catch (err) {
      // If we were superseded mid-load or the renderer was disposed, swallow
      // the error — the winning load (or dispose) owns the slot. Otherwise
      // propagate so the caller can surface the failure.
      const current = this.meshes.get(objectId);
      if (!current || current.loadToken !== token || this.destroyed) return null;
      this.meshes.delete(objectId);
      throw err;
    }

    // ── Re-check token: a newer call may have raced ahead ─────────────────
    const winner = this.meshes.get(objectId);
    if (!winner || winner.loadToken !== token || this.destroyed) {
      // Dispose the just-loaded resources we will not be attaching.
      try {
        state.dispose();
      } catch {
        /* noop */
      }
      return null;
    }

    // ── Commit: wire uniforms, attach to scene graph ──────────────────────
    winner.state = state;
    winner.uTime = state.uTime ?? null;
    winner.uTransition = state.uTransition ?? null;
    winner.update = state.update ? state.update.bind(state) : null;

    // Attach the group under charContainer so the existing rotation / zoom /
    // spread pipeline applies untouched.
    if (this.charContainer) {
      this.charContainer.add(
        state.group as InstanceType<typeof import('three/webgpu').Object3D>,
      );
    }

    // Scene-level attach (e.g. HDR environment for PBR sources). The cleanup
    // fires on dispose so even a throwing state.dispose() can't strand
    // scene.environment / fog state.
    if (state.attachToScene && this.scene) {
      const cleanup = state.attachToScene(this.scene);
      winner.attachCleanup = typeof cleanup === 'function' ? cleanup : null;
    }

    // Initialize renderer-wide clocks on first need. mixerClock only spins up
    // when a loaded mesh ships animations; meshFrameClock only when some
    // source surfaces an update() hook. The clocks stay renderer-wide — one
    // tick drives every slot in `renderMeshFrame` in lock-step (Task 1.5).
    if (THREE) {
      if (state.mixer && !this.mixerClock) this.mixerClock = new THREE.Clock();
      if (winner.update && !this.meshFrameClock) this.meshFrameClock = new THREE.Clock();
    }

    // Freshly loaded meshes are always paused. Consumers wake the animation
    // via toggleMeshAnimation() in response to an explicit user action (the
    // air-magic pinch) — matches the 2026-04-21 Studio convention.
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

  /**
   * Read-only handle for the mesh registered under `objectId`. Returns
   * `null` when no mesh is registered, or when the mesh's load is still in
   * flight. The returned handle is stable across calls — identity-comparable
   * with the value returned by `addMesh`.
   */
  getMesh(objectId: string): MeshHandle | null {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded || !slot.handle) return null;
    return slot.handle;
  }

  /**
   * Enumerate every registered objectId. Includes slots whose load is still
   * in flight — callers that need "fully loaded only" should filter through
   * `getMesh(id) !== null`. Readonly so consumers can't mutate internal
   * state via the returned array.
   */
  getAllMeshIds(): readonly string[] {
    return [...this.meshes.keys()];
  }

  /**
   * True when at least one mesh slot (loading or loaded) exists. Used by
   * hosts as a cheap "any mesh present?" probe without walking the map.
   */
  hasAnyMesh(): boolean {
    return this.meshes.size > 0;
  }

  /**
   * Tear down the mesh registered under `objectId` and release its GPU /
   * scene-graph resources. Returns `true` when a slot existed and was
   * disposed, `false` when no slot was registered — idempotent for the
   * second call on the same id. Sibling meshes under different `objectId`s
   * are not touched.
   *
   * The async signature is reserved: Task 1.3 `disposeMeshSlot` is sync, but
   * keeping `Promise<boolean>` here matches the multi-mesh plan and lets
   * future variants (e.g. awaiting scene-graph transitions) land without a
   * call-site migration.
   */
  async removeMesh(objectId: string): Promise<boolean> {
    const slot = this.meshes.get(objectId);
    if (!slot) return false;
    this.disposeMeshSlot(slot);
    this.meshes.delete(objectId);
    return true;
  }

  /**
   * Whether the mesh registered under `objectId` is currently paused. Returns
   * `true` when the slot doesn't exist or hasn't finished loading — defensive
   * for hosts that poll the API before `addMesh` resolves, and a sane default
   * for "no mesh, nothing to play".
   */
  isMeshAnimationPaused(objectId: string): boolean {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded) return true;
    return slot.animationPaused;
  }

  /**
   * Flip the paused flag for the mesh registered under `objectId`. Returns the
   * new paused state (`true` paused, `false` playing), or `null` when the slot
   * doesn't exist or isn't loaded.
   *
   * Called by the air-magic pinch handler in
   * `glymo-ui/src/canvas/hooks/useGestureDispatcher.ts` when the pinch
   * intersects a media-art mesh bounding box. The underlying clocks' deltas
   * are always drained per frame while every loaded slot is paused (see
   * `renderMeshFrame`) so a resume never fast-forwards — playback always
   * picks up from the paused pose rather than jumping ahead.
   */
  toggleMeshAnimation(objectId: string): boolean | null {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded) return null;
    slot.animationPaused = !slot.animationPaused;
    return slot.animationPaused;
  }

  /**
   * Convert a CSS-space point to NDC coordinates in [-1, 1] using the current
   * canvas dimensions. Returns `null` when the canvas has zero extent (e.g.
   * not attached to the DOM yet).
   */
  private cssToNdc(cssX: number, cssY: number): { x: number; y: number } | null {
    if (!this.canvas) return null;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w <= 0 || h <= 0) return null;
    return { x: (cssX / w) * 2 - 1, y: -(cssY / h) * 2 + 1 };
  }

  /**
   * Fresh Raycaster instance for a single hit-test pass. Returns `null` when
   * Three.js has not finished dynamic import yet.
   */
  private getRaycaster(): InstanceType<typeof import('three/webgpu').Raycaster> | null {
    if (!THREE) return null;
    return new THREE.Raycaster();
  }

  /**
   * Resolve the Object3D group the raycaster should traverse for a given
   * slot, or `null` if the slot has not finished loading.
   */
  private sourceGroupFor(slot: InternalMeshSlot):
    | InstanceType<typeof import('three/webgpu').Object3D>
    | null {
    if (!slot.loaded || !slot.state) return null;
    return slot.state.group as InstanceType<typeof import('three/webgpu').Object3D>;
  }

  /**
   * Pick the top-most mesh under a CSS-space point across ALL loaded slots.
   * Returns the `objectId` of the nearest intersected mesh or `null` when
   * the ray misses every slot. Used by `Glymo.selectObjectAtPoint` to route
   * clicks on a media-art mesh to the underlying GlymoObject.
   */
  hitTestMeshForSelection(cssX: number, cssY: number): string | null {
    if (!this.camera) return null;
    const ndc = this.cssToNdc(cssX, cssY);
    if (!ndc) return null;
    const raycaster = this.getRaycaster();
    if (!raycaster || !THREE) return null;
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);

    let nearest: { objectId: string; distance: number } | null = null;
    for (const slot of this.meshes.values()) {
      const group = this.sourceGroupFor(slot);
      if (!group) continue;
      const intersects = raycaster.intersectObjects([group], true);
      if (intersects.length === 0) continue;
      const distance = (intersects[0] as { distance: number } | undefined)?.distance ?? Infinity;
      if (!nearest || distance < nearest.distance) {
        nearest = { objectId: slot.objectId, distance };
      }
    }
    return nearest?.objectId ?? null;
  }

  /**
   * Begin a single-hand pinch-grab on the mesh registered under `objectId`.
   * Returns `true` on success, or `false` when the slot doesn't exist / isn't
   * loaded yet — callers should not call `translateMeshTo` in that case.
   * Turning the grab flag on fades the pivot indicator in for the duration
   * of the drag, matching the visual affordance used by two-hand rotation.
   *
   * The drag flag is intentionally a single renderer-wide boolean: only one
   * mesh can be dragged at a time by a single hand, so per-slot drag state
   * would be complication without benefit.
   */
  grabMesh(objectId: string): boolean {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded) return false;
    this.activeMeshDrag = true;
    return true;
  }

  /**
   * Translate the mesh registered under `objectId` so its visual center
   * tracks the supplied CSS point. Implemented as a charContainer
   * translation — the mesh group is a child of charContainer and the
   * renderMeshFrame pass keeps the mesh self-centered inside that container,
   * so moving the container moves the mesh without disturbing the rotation
   * pivot.
   *
   * No-op when the slot doesn't exist / isn't loaded, or when the renderer
   * has not finished initialising (camera/canvas/container all need to be
   * live).
   */
  translateMeshTo(objectId: string, x: number, y: number): void {
    const slot = this.meshes.get(objectId);
    if (!slot || !slot.loaded) return;
    if (!this.camera || !this.canvas || !this.charContainer) return;

    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w <= 0 || h <= 0) return;

    // Same CSS → world projection used by the text-mode active-drag path
    // (see renderFrame L607-611 / L636-637).
    const camZ = 6 / this.zoom;
    const fovRad = 35 * Math.PI / 180;
    const visibleHalfH = camZ * Math.tan(fovRad / 2);
    const visibleHalfW = visibleHalfH * this.camera.aspect;
    const ndcX = (x / w) * 2.0 - 1.0;
    const ndcY = -((y / h) * 2.0 - 1.0);
    const worldX = ndcX * visibleHalfW;
    const worldY = ndcY * visibleHalfH;

    this.charContainer.position.set(worldX, worldY, 0);
    this.meshGrabPosition = { x: worldX, y: worldY };
  }

  /**
   * End the pinch-grab gesture. The final container position persists on
   * the Three.js group so the mesh stays where the user released it;
   * `resetTransform()` is the escape hatch that returns it to origin.
   *
   * `objectId` is accepted for symmetry with `grabMesh`/`translateMeshTo`
   * but is advisory — drag state is renderer-wide (a single boolean), so
   * passing an objectId does not change behaviour. Kept in the signature so
   * consumers can wire `releaseMesh(activeId)` without special-casing.
   */
  releaseMesh(_objectId?: string): void {
    this.activeMeshDrag = false;
  }

  // ── Internal: mesh-mode helpers ─────────────────────────────────────────────

  private createMeshSource(descriptor: MeshSourceDescriptor): MeshSource {
    // Delegate to the factory so this class never sees concrete source types.
    // Adding a new variant only touches sources/createMeshSource.ts.
    return createMeshSource(descriptor);
  }

  /**
   * Tear down a single mesh slot's GPU / scene-graph resources. Does NOT
   * remove the slot from `this.meshes` — the caller decides whether to
   * delete the entry (e.g. addMesh replaces the entry in place, removeMesh
   * deletes it outright). Scene-level attach cleanup runs BEFORE the state's
   * own dispose so even a throwing dispose() can't strand HDR environment /
   * fog state on the scene.
   *
   * Idempotent for an unloaded (pending) slot: attach cleanup is skipped,
   * the group is not in the scene yet, and state.dispose() is a no-op.
   */
  private disposeMeshSlot(slot: InternalMeshSlot): void {
    if (slot.attachCleanup) {
      try {
        slot.attachCleanup();
      } catch (err) {
        console.error('[Hologram3DRenderer] Mesh attach cleanup threw:', err);
      }
      slot.attachCleanup = null;
    }
    if (slot.state && this.charContainer) {
      this.charContainer.remove(
        slot.state.group as InstanceType<typeof import('three/webgpu').Object3D>,
      );
    }
    if (slot.state) {
      try {
        slot.state.dispose();
      } catch (err) {
        console.error('[Hologram3DRenderer] Mesh dispose threw:', err);
      }
    }
    slot.state = null;
    slot.uTime = null;
    slot.uTransition = null;
    slot.update = null;
    slot.handle = null;
    slot.loaded = false;
  }

  /** Find the nearest char to a CSS point using 3D raycasting, returns {id, dist} or null */
  hitTestChar(x: number, y: number, maxDist: number): HitTestResult | null {
    if (!THREE || !this.camera || !this.canvas) {
      return this.hitTestCharFallback(x, y, maxDist);
    }

    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    // Convert CSS coords to NDC (-1 to +1)
    const ndcX = (x / w) * 2 - 1;
    const ndcY = -(y / h) * 2 + 1;

    // Use Three.js Raycaster for proper 3D hit testing
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    // Collect all char meshes and their IDs
    const entries: { id: string; group: InstanceType<typeof import('three/webgpu').Group> }[] = [];
    const chars = this.chars.filter(c => !c.isDeleting);
    for (const ch of chars) {
      const entry = this.charMeshes.get(ch.id);
      if (entry) entries.push({ id: ch.id, group: entry.group });
    }

    const objects = entries.map(e => e.group);
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      const hit = intersects[0]!;
      // Find which char group contains the hit object
      for (const { id, group } of entries) {
        let found = false;
        group.traverse((child: any) => {
          if (child === hit.object) found = true;
        });
        if (found) {
          return { id, dist: hit.distance };
        }
      }
    }

    // Fall back to 2D distance check if raycasting missed but CSS coords are close
    return this.hitTestCharFallback(x, y, maxDist);
  }

  /** Fallback 2D hit test using CSS coordinates (used when 3D raycasting is unavailable) */
  private hitTestCharFallback(x: number, y: number, maxDist: number): HitTestResult | null {
    const chars = this.chars.filter(c => !c.isDeleting);
    let nearest: HitTestResult | null = null;
    for (const ch of chars) {
      const moved = this.movedChars.get(ch.id);
      const cx = moved?.x ?? ch.x;
      const cy = moved?.y ?? ch.y;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < maxDist && (!nearest || dist < nearest.dist)) {
        nearest = { id: ch.id, dist };
      }
    }
    return nearest;
  }

  /** Render one frame. Call this from your compositor or animation loop. */
  renderFrame(): void {
    if (this.destroyed) return;
    if (!this.canvas || !this.renderer || !this.postProcessing || !this.scene || !this.camera || !this.charContainer) {
      return;
    }

    const canvas = this.canvas;
    const renderer = this.renderer;
    const camera = this.camera;
    const charContainer = this.charContainer;

    // Sync canvas size
    const dpr = renderer.getPixelRatio();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    if (!this.enabled || this.transition < 0.001) {
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      return;
    }

    const now = performance.now();
    const elapsed = (now - this.startTime) * 0.001;
    const transition = this.transition;

    // ── Mesh path — iterate every slot in `this.meshes` ───────────────────
    // Presence of any mesh slot takes over the frame: text-mode char
    // resources are not touched while meshes are in play. Coexistence with
    // the text-mode char lift below is a three.js-level concern (e.g. a
    // recognition-pending drawing plus a mediaArt-applied object share the
    // same scene graph); for now the mesh path is exclusive and the char
    // loop only runs when no slot is loaded. Container rotation / zoom /
    // pivot indicator at the end of this branch runs for both paths.
    if (this.meshes.size > 0) {
      this.renderMeshFrame(elapsed);
      this.applyContainerRotationAndZoom(elapsed, transition);
      this.postProcessing!.render();
      return;
    }

    const chars = this.chars.filter(c => !c.isDeleting);
    const numChars = Math.min(chars.length, 20);
    const spread = this.spread;

    // ── Sync char meshes with state ──────────────────
    const activeIds = new Set<string>();

    for (let i = 0; i < numChars; i++) {
      const ch = chars[i]!;
      activeIds.add(ch.id);

      let entry = this.charMeshes.get(ch.id);
      if (!entry) {
        const created = this.createCharMesh(ch.char, elapsed, transition);
        if (!created) continue;
        entry = {
          group: created.group,
          frontMat: created.frontMat,
          sideMat: created.sideMat,
          uTime: created.uTime,
          uTransition: created.uTransition,
          sideUTime: created.sideUTime,
          sideUTransition: created.sideUTransition,
        };
        this.charMeshes.set(ch.id, entry);
        charContainer.add(entry.group);
      }

      // Update uniforms for both front and side materials
      (entry.uTime as any).value = elapsed;
      (entry.uTransition as any).value = transition;
      (entry.sideUTime as any).value = elapsed;
      (entry.sideUTransition as any).value = transition;

      // Position: convert CSS coords to 3D world coords
      const camZ = 6 / this.zoom;
      const fovRad = (35 * Math.PI / 180);
      const visibleHalfH = camZ * Math.tan(fovRad / 2);
      const visibleHalfW = visibleHalfH * camera.aspect;
      const cssW = w;
      const cssH = h;

      // Position override: use moved position if char was repositioned
      const moved = this.movedChars.get(ch.id);
      const isActivelyDragged = this.activeDragId === ch.id;
      const charX = moved?.x ?? ch.x;
      const charY = moved?.y ?? ch.y;
      const ndcX = (charX / cssW) * 2.0 - 1.0;
      const ndcY = -((charY / cssH) * 2.0 - 1.0);

      // Scale
      const charWorldH = (ch.height / cssH) * visibleHalfH * 2;
      const baseScale = Math.max(charWorldH, 0.5);
      const age = now - ch.entryTime;
      const entryT = Math.min(age / 600, 1.0);
      // Elastic entrance animation (600ms)
      const elastic = entryT < 1.0
        ? 1.0 + (1.0 - entryT) * 0.35 * Math.sin(entryT * Math.PI * 2.5)
        : 1.0;
      const entryScale = entryT * elastic;

      if (isActivelyDragged) {
        // ── ACTIVELY DRAGGED: screen-aligned, face camera ──
        const targetX = ndcX * visibleHalfW;
        const targetY = ndcY * visibleHalfH;

        // Counteract container rotation so char appears at pinch point
        const crx = charContainer.rotation.x;
        const cry = charContainer.rotation.y;
        const cosY = Math.cos(-cry);
        const sinY = Math.sin(-cry);
        const ix = targetX * cosY;
        const iz = -targetX * sinY;
        const cosX = Math.cos(-crx);
        const sinX = Math.sin(-crx);
        const iy = targetY * cosX - iz * sinX;
        const iz2 = targetY * sinX + iz * cosX;

        entry.group.position.set(ix, iy, iz2);
        entry.group.rotation.set(-crx, -cry, -charContainer.rotation.z);
        entry.group.scale.setScalar(baseScale * 1.2 * transition);
        (entry.uTransition as any).value = transition;
        (entry.sideUTransition as any).value = transition;
      } else {
        // ── NORMAL or REPOSITIONED CHAR: spread + depth ──
        // Compute centroid of all chars
        let cxSum = 0, cySum = 0;
        for (let j = 0; j < numChars; j++) {
          const mj = this.movedChars.get(chars[j]!.id);
          cxSum += ((mj?.x ?? chars[j]!.x) / cssW) * 2.0 - 1.0;
          cySum += -(((mj?.y ?? chars[j]!.y) / cssH) * 2.0 - 1.0);
        }
        const centerX = cxSum / numChars;
        const centerY = cySum / numChars;

        // Scale distance from centroid by spread factor (preserves relative layout)
        const worldX = (centerX + (ndcX - centerX) * spread) * visibleHalfW;
        const worldY = (centerY + (ndcY - centerY) * spread) * visibleHalfH;
        const centerIdx = (numChars - 1) / 2;
        const worldZ = -(i - centerIdx) * 0.6 * spread;

        entry.group.position.set(worldX, worldY, worldZ);
        entry.group.rotation.set(0, 0, 0);
        entry.group.scale.setScalar(baseScale * entryScale * transition);

        const opacity = Math.min(age / 400, 1.0);
        (entry.uTransition as any).value = transition * opacity;
        (entry.sideUTransition as any).value = transition * opacity;
      }
    }

    // Remove meshes for deleted chars
    for (const [id, entry] of this.charMeshes) {
      if (!activeIds.has(id)) {
        charContainer.remove(entry.group);
        entry.group.traverse(obj => {
          if ((obj as any).geometry) (obj as any).geometry.dispose();
          if ((obj as any).material) {
            const mat = (obj as any).material;
            if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
            else mat.dispose();
          }
        });
        this.charMeshes.delete(id);
      }
    }

    this.applyContainerRotationAndZoom(elapsed, transition);

    // ── Render with bloom ──────────────────────────────
    this.postProcessing!.render();
  }

  /**
   * Mesh-mode per-frame update — iterates every loaded slot in `this.meshes`.
   *
   * Clocks are renderer-wide (see the init comment at `addMesh` commit): one
   * `getDelta()` tick per clock per frame drives every slot in lock-step.
   * `Clock.getDelta()` is destructive, so calling it inside the per-slot loop
   * would starve every slot after the first of its animation delta — the
   * canonical pattern is to compute `mixerDt` / `frameDt` ONCE at the top and
   * pass them to every unpaused consumer below.
   *
   * Paused-drain semantics generalise from the single-mesh predecessor: if
   * EVERY loaded slot is paused we still drain the clocks so a subsequent
   * resume does not fast-forward by the entire paused interval. If ANY slot
   * is unpaused we take the single delta here and apply it only to unpaused
   * slots — paused slots skip mixer/update but the clocks have already been
   * consumed by the unpaused branch, so no additional drain is needed.
   *
   * `uTransition` stays at 1 (fully visible) for Phase 1 — transition easing
   * is now the @glymo/ui `runMediaArtTransition` concern, driven at the host
   * level rather than from the renderer.
   */
  private renderMeshFrame(elapsed: number): void {
    if (!THREE) return;

    // Collect only committed slots — pending (still-loading) slots are not
    // yet renderable and `slot.state` / uniforms may be null on them.
    const loadedSlots: InternalMeshSlot[] = [];
    for (const slot of this.meshes.values()) {
      if (slot.loaded && slot.state) loadedSlots.push(slot);
    }
    if (loadedSlots.length === 0) return;

    // One drain decision for the whole frame: if every loaded slot is paused
    // we discard the clocks' pending deltas and skip mixer/update calls
    // entirely. Otherwise we take the deltas here and fan them out to every
    // unpaused slot below. The clocks are created lazily at commit time so
    // either `getDelta()` call may no-op when this renderer has not yet
    // needed a mixer/update tick.
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

    for (const slot of loadedSlots) {
      const state = slot.state!;
      const group = state.group as InstanceType<typeof import('three/webgpu').Object3D>;

      // Drive the media-art shader uniforms. uTime advances even for paused
      // slots because the shader can read elapsed time for static effects
      // like fresnel/scanline. uTransition is pinned to 1 — host-side
      // entry/exit easing runs through @glymo/ui's runMediaArtTransition.
      if (slot.uTime) slot.uTime.value = elapsed;
      if (slot.uTransition) slot.uTransition.value = 1;

      if (!slot.animationPaused) {
        // Tick the animation mixer if this GLB shipped clips. A malformed
        // GLB (NaN timestamps, broken tracks) can make mixer.update() throw;
        // isolate per slot so one bad asset cannot kill the whole frame.
        if (state.mixer && this.mixerClock) {
          try {
            (state.mixer as { update: (dt: number) => void }).update(mixerDt);
          } catch (err) {
            console.error(
              `[Hologram3DRenderer] Mesh mixer.update threw (objectId: ${slot.objectId}, modelId: ${slot.modelId}):`,
              err,
            );
          }
        }

        // Source-driven update hook (e.g. procedural planet axial spin).
        // Runs AFTER mixer + uniform writes so the source can read coherent
        // state. Errors are isolated so one slot's faulty hook cannot kill
        // the whole frame loop.
        if (slot.update && this.meshFrameClock) {
          try {
            slot.update(elapsed, frameDt);
          } catch (err) {
            console.error(
              `[Hologram3DRenderer] Mesh update hook threw (objectId: ${slot.objectId}, modelId: ${slot.modelId}):`,
              err,
            );
          }
        }
      }

      // Per-slot bbox normalise + center. Each mesh owns its own bbox so
      // this runs inside the loop even though the clocks are shared. Scale
      // follows `this.transition` (the renderer-wide entry/exit driver set
      // via setTransition) until task 3.x migrates entry/exit to the
      // per-object media-art transition API.
      const bb = state.bbox;
      const maxDim = Math.max(
        bb.max.x - bb.min.x,
        bb.max.y - bb.min.y,
        bb.max.z - bb.min.z,
      );
      const normalize = maxDim > 0 ? 2.0 / maxDim : 1.0;
      const baseScale = normalize * this.transition;
      group.scale.set(baseScale, baseScale, baseScale);

      const cx = (bb.max.x + bb.min.x) * 0.5;
      const cy = (bb.max.y + bb.min.y) * 0.5;
      const cz = (bb.max.z + bb.min.z) * 0.5;
      group.position.set(-cx * baseScale, -cy * baseScale, -cz * baseScale);
    }
  }

  /** Shared camera + container rotation + pivot indicator (text and mesh modes). */
  private applyContainerRotationAndZoom(elapsed: number, transition: number): void {
    if (!this.charContainer || !this.camera) return;

    const isLocked = !this.enabled && transition > 0;
    const idleRotY = (this.handActive || isLocked) ? 0 : Math.sin(elapsed * 0.5) * 0.3;
    const idleRotX = (this.handActive || isLocked) ? 0 : Math.sin(elapsed * 0.3) * 0.12;

    this.charContainer.rotation.x = this.rotX + idleRotX;
    this.charContainer.rotation.y = this.rotY + idleRotY;
    this.charContainer.rotation.z = this.rotZ;

    if (this.pivotGroup) {
      const pivotMats = (this.pivotGroup as any)._pivotMats as InstanceType<typeof import('three/webgpu').MeshBasicMaterial>[];
      const targetPivotOpacity = (this.handActive || this.activeMeshDrag) ? 0.25 : 0;
      for (const mat of pivotMats) {
        mat.opacity += (targetPivotOpacity - mat.opacity) * 0.1;
      }
      this.pivotGroup.visible = pivotMats[0]!.opacity > 0.01;
    }

    // Zoom
    this.camera.position.z = 6 / this.zoom;
  }

  /** Clean up all GPU/Three.js resources */
  dispose(): void {
    this.destroyed = true;
    // Bump the shared load-token counter so every in-flight addMesh load
    // recognises itself as superseded on return and disposes its just-loaded
    // resources instead of attaching.
    this.nextLoadToken++;
    // Dispose mesh-mode resources first so the GLB scene graph is cleaned
    // before the WebGPU device tears down.
    for (const slot of this.meshes.values()) {
      this.disposeMeshSlot(slot);
    }
    this.meshes.clear();
    this.mixerClock = null;
    this.meshFrameClock = null;
    for (const [, entry] of this.charMeshes) {
      entry.group.traverse(obj => {
        if ((obj as any).geometry) (obj as any).geometry.dispose();
        if ((obj as any).material) {
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else mat.dispose();
        }
      });
    }
    this.charMeshes.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }

  // ── Private initialization ──────────────────────────────────────────────────

  private async init(): Promise<boolean> {
    try {
      const ok = await loadThreeDeps();
      if (!ok || this.destroyed || !THREE || !tsl || !bloomFn) return false;

      // ── Scene setup ──────────────────────────────────
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      this.camera.position.set(0, 0, 6);

      // ── Lights ───────────────────────────────────────
      // PBR materials (MeshStandardNodeMaterial used by both text and mesh
      // mode) need irradiance to display colorNode. Without lights only
      // emissive contributes — which is why mesh-mode media-art looked flat
      // and over-bright when bloom was scaled up to compensate. These match
      // glymo-landing/components/preview/EarthPreview.tsx so mesh-mode
      // holograms render at the same quality bar as the landing preview.
      const sunLight = new THREE.DirectionalLight(0xeaf6ff, 1.4);
      sunLight.position.set(3, 1.0, 2.5);
      this.scene.add(sunLight);
      this.scene.add(new THREE.AmbientLight(0x102036, 0.45));

      // WebGPU Renderer — transparent background so camera feed shows through
      this.renderer = new THREE.WebGPURenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.sortObjects = true;

      // Must await WebGPU initialization
      await this.renderer.init();
      // Re-entrancy guard: external dispose() may have fired during the await
      // and already set `this.renderer = null`. In React Strict Mode (dev)
      // mount → cleanup → remount runs init() and dispose() on overlapping
      // ticks; calling dispose() again here threw
      // "Cannot read properties of null (reading 'dispose')". dispose() is
      // idempotent and already cleaned the renderer it saw, so a plain exit
      // is the correct response.
      if (this.destroyed) return false;

      // ── Post-processing: bloom via TSL ───────────────
      // Bloom params calibrated against EarthPreview.tsx (lines 245-247).
      // The previous threshold=0.1 / strength=2.8 caused full-mesh whiteout
      // because mesh-mode emissive carried no edge structure — every fragment
      // was above the bloom threshold. With proper lights + edge-only
      // emissive (mediaArtTSL.ts), threshold=0.7 means only the bright rim
      // pushes through, strength=1.05 keeps the rim crisp instead of
      // saturating the silhouette.
      const { pass } = tsl;
      const scenePass = pass(this.scene, this.camera);
      const sceneColor = scenePass.getTextureNode('output');
      const bloomPass = bloomFn(sceneColor);
      (bloomPass as any).threshold.value = 0.7;
      (bloomPass as any).strength.value = 1.05;
      (bloomPass as any).radius.value = 0.75;

      this.postProcessing = new THREE.PostProcessing(this.renderer);
      this.postProcessing.outputNode = sceneColor.add(bloomPass);

      // ── Load font ────────────────────────────────────
      for (const url of DEFAULT_FONT_URLS) {
        try {
          const resp = await fetch(url);
          if (!resp.ok) continue;
          const data = await resp.json();
          this.loadedFont = new FontClass!(data);
          break;
        } catch { /* try next */ }
      }

      if (this.destroyed || !this.loadedFont) return false;

      // ── Container group for all chars ────────────────
      this.charContainer = new THREE.Group();
      this.scene.add(this.charContainer);

      // ── Pivot indicator: subtle crosshair at rotation center ──
      this.pivotGroup = new THREE.Group();
      this.scene.add(this.pivotGroup);
      {
        const pivotMat = new THREE.MeshBasicMaterial({
          color: 0x00bbff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const hGeo = new THREE.PlaneGeometry(0.6, 0.008);
        this.pivotGroup.add(new THREE.Mesh(hGeo, pivotMat));
        const vGeo = new THREE.PlaneGeometry(0.008, 0.6);
        this.pivotGroup.add(new THREE.Mesh(vGeo, pivotMat));
        const dotGeo = new THREE.CircleGeometry(0.04, 16);
        const dotMat = new THREE.MeshBasicMaterial({
          color: 0x00bbff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        this.pivotGroup.add(new THREE.Mesh(dotGeo, dotMat));
        (this.pivotGroup as any)._pivotMats = [pivotMat, dotMat];
      }

      this.startTime = performance.now();
      this._isAvailable = true;
      return true;
    } catch (err) {
      console.error('[Hologram3DRenderer] init failed:', err);
      return false;
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Create a TSL hologram material */
  private createHologramMaterial(isFront: boolean) {
    if (!THREE || !tsl) return null;

    const { Fn, float, uniform: tslUniform, color: tslColor,
            positionWorld, normalWorld, cameraPosition, sin, smoothstep, abs, dot, pow, clamp: tslClamp } = tsl;

    const uTime = tslUniform(0.0);
    const uTransition = tslUniform(0.0);
    const holoColor = new THREE.Color(0x00bbff);

    // Fresnel edge glow — strong edge highlight
    const fresnel = Fn(() => {
      const viewDir = cameraPosition.sub(positionWorld).normalize();
      const nDotV = abs(dot(normalWorld, viewDir));
      return pow(float(1.0).sub(nDotV), float(3.0));
    });

    // Scanlines — horizontal, scrolling upward
    const scanline = Fn(() => {
      const raw = sin(positionWorld.y.mul(60.0).sub(uTime.mul(4.0))).mul(0.5).add(0.5);
      return smoothstep(float(0.2), float(0.8), raw).mul(0.25);
    });

    // Flicker — brightness pulse
    const flicker = Fn(() => {
      return sin(uTime.mul(6.0)).mul(0.06).add(sin(uTime.mul(11.3)).mul(0.04));
    });

    const material = new THREE.MeshStandardNodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.side = THREE.FrontSide;
    // Explicit PBR params so the new scene lights (init() lines 802-810)
    // produce a matte cyan body, not a glossy hot-spot that would confuse
    // bloom. Mirrors mediaArtTSL.ts and EarthPreview.tsx.
    (material as unknown as { roughnessNode: unknown }).roughnessNode = float(0.85);
    (material as unknown as { metalnessNode: unknown }).metalnessNode = float(0.0);

    if (isFront) {
      // colorNode: pure cyan, lit by scene lights. Earlier revisions added
      // a vec3(0.1,0.2,0.3) baseline + fresnel*0.8 to compensate for the
      // unlit scene; with lights now in the scene those additives double-
      // counted with the emissive rim and saturated text under the bloom
      // pass. Pure holoColor is the canonical PBR diffuse choice.
      material.colorNode = tslColor(holoColor);
      material.opacityNode = tslClamp(
        float(0.92).add(fresnel().mul(0.08)).sub(scanline()).add(flicker()).mul(uTransition),
        float(0.0),
        float(1.0),
      );
    } else {
      // Side / wall material — half-bright cyan body, slightly more
      // transparent than the front face so the depth gradient reads.
      material.colorNode = tslColor(holoColor).mul(0.45);
      material.opacityNode = tslClamp(
        float(0.7).add(fresnel().mul(0.2)).sub(scanline().mul(0.4)).add(flicker()).mul(uTransition),
        float(0.0),
        float(1.0),
      );
    }

    // emissiveNode: edge-ONLY rim glow. The previous +0.35 baseline made
    // the entire glyph push through the bloom threshold (which was 0.1
    // before the matching change in init()); with bloom threshold now 0.7
    // and emissive zero at facing surfaces, only the silhouette glows —
    // exactly the EarthPreview look.
    material.emissiveNode = tslColor(holoColor).mul(fresnel().mul(1.2));

    return { material, uTime, uTransition };
  }

  /** Create a 3D character mesh with hologram materials */
  private createCharMesh(char: string, _elapsed: number, _transition: number) {
    if (!THREE || !this.loadedFont) return null;

    // Korean / CJK characters: use canvas texture on extruded plane
    // (helvetiker font has no CJK glyphs). The texture path builds its own
    // self-contained material internally (with texAlpha opacity masking),
    // so we skip the Latin-path `createHologramMaterial(true/false)`
    // allocation entirely — otherwise every CJK char would leak two
    // unused NodeMaterial instances (one front, one side).
    if (needsTextureFallback(char)) {
      return this.createTextureCharMesh(char);
    }

    const front = this.createHologramMaterial(true);
    const side = this.createHologramMaterial(false);
    if (!front || !side) return null;

    const geometry = new TextGeometry!(char, {
      font: this.loadedFont,
      size: 1.0,
      depth: 0.35,
      curveSegments: 6,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 3,
    });

    // Center the geometry
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const cx = (bb.max.x + bb.min.x) / 2;
    const cy = (bb.max.y + bb.min.y) / 2;
    const cz = (bb.max.z + bb.min.z) / 2;
    geometry.translate(-cx, -cy, -cz);

    const mesh = new THREE.Mesh(geometry, [front.material, side.material]);
    const group = new THREE.Group();
    group.add(mesh);

    return {
      group,
      frontMat: front.material,
      sideMat: side.material,
      uTime: front.uTime,
      uTransition: front.uTransition,
      sideUTime: side.uTime,
      sideUTransition: side.uTransition,
    };
  }

  /** Fallback: render CJK character to a canvas texture on a plane with TSL alpha */
  private createTextureCharMesh(char: string) {
    if (!THREE || !tsl) return null;

    // Render character to a 2D canvas (white on transparent)
    const texSize = 256;
    const offscreen = document.createElement('canvas');
    offscreen.width = texSize;
    offscreen.height = texSize;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, texSize, texSize);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${texSize * 0.75}px ${KOREAN_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, texSize / 2, texSize / 2);

    // Create Three.js texture from canvas
    const tex = new THREE.CanvasTexture(offscreen);
    tex.needsUpdate = true;

    // Build a TSL-based front material that masks opacity by the texture alpha.
    // We re-derive the hologram look here so the texture alpha integrates
    // directly into the opacityNode (standard alphaMap is ignored by NodeMaterial).
    const { Fn, float, uniform: tslUniform, color: tslColor,
            positionWorld, normalWorld, cameraPosition, sin, smoothstep, abs, dot, pow,
            clamp: tslClamp, texture: tslTexture, uv } = tsl;

    const uTime = tslUniform(0.0);
    const uTransition = tslUniform(0.0);
    const holoColor = new THREE.Color(0x00bbff);

    const fresnel = Fn(() => {
      const viewDir = cameraPosition.sub(positionWorld).normalize();
      const nDotV = abs(dot(normalWorld, viewDir));
      return pow(float(1.0).sub(nDotV), float(3.0));
    });
    const scanline = Fn(() => {
      const raw = sin(positionWorld.y.mul(60.0).sub(uTime.mul(4.0))).mul(0.5).add(0.5);
      return smoothstep(float(0.2), float(0.8), raw).mul(0.25);
    });
    const flicker = Fn(() => {
      return sin(uTime.mul(6.0)).mul(0.06).add(sin(uTime.mul(11.3)).mul(0.04));
    });

    // Sample texture alpha from the canvas
    const texAlpha = tslTexture(tex, uv()).a;

    const frontMat = new THREE.MeshStandardNodeMaterial();
    frontMat.transparent = true;
    frontMat.depthWrite = false;
    // DoubleSide stays here because each layer in the volumetric stack is
    // single-sided geometry; without DoubleSide the back of every layer is
    // invisible and the glyph disappears when the controller rotates the
    // group past 90°.
    frontMat.side = THREE.DoubleSide;
    (frontMat as unknown as { roughnessNode: unknown }).roughnessNode = float(0.85);
    (frontMat as unknown as { metalnessNode: unknown }).metalnessNode = float(0.0);
    // Pure cyan body lit by scene lights (matches createHologramMaterial).
    // The texAlpha mask in opacityNode constrains the visible area to the
    // glyph silhouette, so colorNode being uniform across the whole plane
    // is fine — only the glyph-shaped pixels survive opacity.
    frontMat.colorNode = tslColor(holoColor);
    frontMat.opacityNode = tslClamp(
      float(0.92).add(fresnel().mul(0.08)).sub(scanline()).add(flicker()).mul(uTransition).mul(texAlpha),
      float(0.0),
      float(1.0),
    );
    // Edge-only emissive — same canonical pattern as createHologramMaterial.
    frontMat.emissiveNode = tslColor(holoColor).mul(fresnel().mul(1.2));

    // Volumetric plane stack — same character texture rendered on N parallel
    // planes spaced across `depth`, so the glyph reads as a true 3D solid
    // (not a flat sheet) under the controller's rotation. Mirrors the depth
    // of the Latin TextGeometry path (depth: 0.35) so CJK and Latin glyphs
    // share visual weight in mixed-script phrases. depthWrite is already
    // false on frontMat, which keeps the layered alpha blending stable; one
    // shared material means a single shader compile across all layers.
    const depth = 0.35;
    const layerCount = 6;
    const planeGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const group = new THREE.Group();
    for (let i = 0; i < layerCount; i++) {
      const z = -depth / 2 + (i / (layerCount - 1)) * depth;
      const layer = new THREE.Mesh(planeGeo, frontMat);
      layer.position.z = z;
      group.add(layer);
    }

    // All 6 layers share the single `frontMat` we just built, so the
    // returned `frontMat` MUST be that same local reference — otherwise
    // the `charMeshes` Map would store a stale pointer to a Latin-path
    // material that isn't actually attached to any mesh, breaking any
    // consumer that reads `entry.frontMat` for uniform updates or
    // disposal. The volumetric stack has no separate side material, so
    // `sideMat` + `sideUTime` + `sideUTransition` mirror the front refs.
    return {
      group,
      frontMat,
      sideMat: frontMat,
      uTime,
      uTransition,
      sideUTime: uTime,
      sideUTransition: uTransition,
    };
  }
}
