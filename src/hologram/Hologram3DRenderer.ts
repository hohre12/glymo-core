// ── Hologram 3D Renderer ──────────────────────────────────────────────────────
//
// Extracted from landing/hooks/useHologram3DMesh.ts.
// Self-contained Three.js WebGPU renderer for holographic 3D text.
// No React dependency — operates on a plain HTMLCanvasElement.
//
// v0.7.0 added mesh mode (per docs/plans/media-art-mvp.md §5 D5): the same
// renderer can show a single GLB mesh instead of per-character text. Mode
// flag routes geometry construction; bloom + holo color + rotation/zoom/spread
// effects are shared so text and media-art holograms feel like one product.

import type {
  HologramChar,
  Hologram3DRendererOptions,
  HitTestResult,
  MediaArtMeshState,
  MeshSource,
  MeshSourceDescriptor,
} from './types.js';
import { createMeshSource } from './sources/createMeshSource.js';

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

  // ── Mesh mode (v0.7.0) ──
  // 'text' (default) renders per-char meshes from the chars[] array.
  // 'mesh' renders a single GLB scene loaded via setModel(). Mode is
  // exclusive — switching disposes the prior mode's resources.
  private mode: 'text' | 'mesh' = 'text';
  private meshState: MediaArtMeshState | null = null;
  /**
   * Token for the most recent setModel() call. setModel awaits an async
   * load; if the user picks a different model mid-load (or calls
   * setModel(null), or the renderer is disposed) the in-flight load must
   * not "win" by attaching its result. We compare loadToken before commit.
   */
  private loadToken = 0;
  /** Per-frame uniform driver for the currently loaded mesh's media-art shader. */
  private meshUTime: { value: number } | null = null;
  private meshUTransition: { value: number } | null = null;
  /**
   * Optional per-frame update hook surfaced by the mesh source (e.g. procedural
   * planet axial spin). Called inside renderMeshFrame after uniform writes;
   * source-owned animation lives here so the renderer's loop stays one-line.
   */
  private meshUpdate: ((elapsed: number, dt: number) => void) | null = null;
  /**
   * Cleanup function returned by the source's attachToScene hook (e.g. restore
   * scene.environment after an HDR-driven source detaches). Invoked from
   * disposeMeshState before the source's own dispose() so scene-level state is
   * always restored even if dispose() throws.
   */
  private meshAttachCleanup: (() => void) | null = null;
  /** Animation mixer clock — separate from startTime so mixer pauses on dispose. */
  private mixerClock: InstanceType<typeof import('three/webgpu').Clock> | null = null;
  /**
   * Frame-delta clock for the mesh source's update hook. Independent from
   * mixerClock so the two advance in step but neither resets the other on
   * read (Clock.getDelta is destructive).
   */
  private meshFrameClock: InstanceType<typeof import('three/webgpu').Clock> | null = null;
  // Note: color and font were removed — the renderer uses hardcoded hologram
  // color (0x00bbff) and loads its own 3D font file. If per-instance color/font
  // customization is needed later, add setter methods instead of constructor args.

  /** Per-char position overrides (persists after release): charId -> {x, y} in CSS coords */
  private movedChars = new Map<string, { x: number; y: number }>();
  /** Which char is currently being actively dragged (null = none) */
  private activeDragId: string | null = null;

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
  }

  // ── Mesh mode API (v0.7.0) ──────────────────────────────────────────────────

  /**
   * Switch the renderer to mesh mode and load a GLB asset. Pass `null` to
   * return to text mode. Disposes the prior model (or text mesh map) before
   * the new one is committed.
   *
   * Resolves with the loaded mesh state (for inspection — bbox useful for
   * placement) or `null` if the load was superseded by a later setModel call,
   * or if the renderer was disposed mid-load.
   *
   * Errors from the underlying MeshSource (network, parse, validation) reject
   * the promise as a typed `GlymoError` — callers should fall back to text
   * mode and surface a user-visible error.
   */
  async setModel(descriptor: MeshSourceDescriptor | null): Promise<MediaArtMeshState | null> {
    if (this.destroyed) {
      throw new Error('[Hologram3DRenderer] setModel called on disposed renderer');
    }

    const myToken = ++this.loadToken;

    // ── Switch to text mode ────────────────────────────────────────────────
    if (descriptor === null) {
      this.disposeMeshState();
      this.mode = 'text';
      return null;
    }

    // ── Wait for renderer init (Three.js modules + WebGPU) ────────────────
    const ready = await this.ready;
    if (!ready || this.destroyed || myToken !== this.loadToken) return null;
    if (!THREE || !tsl) return null;

    // ── Construct + load the mesh source ──────────────────────────────────
    const source = this.createMeshSource(descriptor);
    let state: MediaArtMeshState;
    try {
      state = await source.load({ THREE, tsl });
    } catch (err) {
      // If we were superseded mid-load, swallow the error — the new load
      // owns the slot. Otherwise propagate.
      if (myToken !== this.loadToken || this.destroyed) return null;
      throw err;
    }

    // ── Re-check token: a newer setModel() may have raced ahead ───────────
    if (myToken !== this.loadToken || this.destroyed) {
      // Dispose the just-loaded resources we will not be attaching.
      try {
        state.dispose();
      } catch {
        /* noop */
      }
      return null;
    }

    // ── Commit: dispose prior mesh, attach new one ────────────────────────
    this.disposeMeshState();
    this.meshState = state;
    this.mode = 'mesh';

    // Mesh sources surface aggregate uniforms via plain enumerable props (see
    // sources/*.ts); they're our handle to drive the media-art shader
    // treatment per frame. update() and attachToScene() are likewise opt-in —
    // sources that don't need them omit the hook.
    this.meshUTime = state.uTime ?? null;
    this.meshUTransition = state.uTransition ?? null;
    this.meshUpdate = state.update ? state.update.bind(state) : null;

    // Attach to scene under charContainer so the existing rotation/zoom
    // pipeline applies untouched.
    if (this.charContainer) {
      this.charContainer.add(state.group as InstanceType<typeof import('three/webgpu').Object3D>);
    }

    // Scene-level attach (e.g. HDR environment for PBR sources). The hook
    // returns an optional cleanup that disposeMeshState fires on teardown.
    if (state.attachToScene && this.scene) {
      const cleanup = state.attachToScene(this.scene);
      this.meshAttachCleanup = typeof cleanup === 'function' ? cleanup : null;
    }

    // Initialize clocks. mixerClock only spins up if the source ships an
    // animation mixer; meshFrameClock is needed whenever the source surfaces
    // an update() hook so we can hand it a sensible dt.
    if (THREE) {
      if (state.mixer) this.mixerClock = new THREE.Clock();
      if (this.meshUpdate) this.meshFrameClock = new THREE.Clock();
    }

    return state;
  }

  /** Current rendering mode — useful for tools that adapt picker UI. */
  getMode(): 'text' | 'mesh' {
    return this.mode;
  }

  /** Read-only handle to the current mesh state. Null in text mode. */
  getMeshState(): MediaArtMeshState | null {
    return this.meshState;
  }

  // ── Internal: mesh-mode helpers ─────────────────────────────────────────────

  private createMeshSource(descriptor: MeshSourceDescriptor): MeshSource {
    // Delegate to the factory so this class never sees concrete source types.
    // Adding a new variant only touches sources/createMeshSource.ts.
    return createMeshSource(descriptor);
  }

  private disposeMeshState(): void {
    if (!this.meshState) return;
    // Scene-level cleanup BEFORE the source's dispose() so even a throwing
    // dispose can't strand HDR environment / fog state on the scene.
    if (this.meshAttachCleanup) {
      try {
        this.meshAttachCleanup();
      } catch (err) {
        console.error('[Hologram3DRenderer] Mesh attach cleanup threw:', err);
      }
    }
    if (this.charContainer) {
      this.charContainer.remove(
        this.meshState.group as InstanceType<typeof import('three/webgpu').Object3D>,
      );
    }
    try {
      this.meshState.dispose();
    } catch (err) {
      console.error('[Hologram3DRenderer] Mesh dispose threw:', err);
    }
    this.meshState = null;
    this.meshUTime = null;
    this.meshUTransition = null;
    this.meshUpdate = null;
    this.meshAttachCleanup = null;
    this.mixerClock = null;
    this.meshFrameClock = null;
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

    // ── Mesh mode (v0.7.0) — render single GLB ────────────────────────────
    // Branches BEFORE the per-char loop so text-mode resources are not
    // touched while mesh mode is active. Container rotation / zoom / pivot
    // indicator at the end of this method run for both modes.
    if (this.mode === 'mesh') {
      this.renderMeshFrame(elapsed, transition);
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

  /** Mesh-mode per-frame update — transforms one GLB scene. */
  private renderMeshFrame(elapsed: number, transition: number): void {
    if (!this.meshState || !THREE) return;
    const group = this.meshState.group as InstanceType<typeof import('three/webgpu').Object3D>;

    // Drive the media-art shader uniforms.
    if (this.meshUTime) this.meshUTime.value = elapsed;
    if (this.meshUTransition) this.meshUTransition.value = transition;

    // Tick the animation mixer if this GLB shipped clips.
    if (this.meshState.mixer && this.mixerClock) {
      const dt = this.mixerClock.getDelta();
      (this.meshState.mixer as { update: (dt: number) => void }).update(dt);
    }

    // Source-driven update hook (e.g. procedural planet axial spin). Runs
    // AFTER mixer + uniform writes so the source can read coherent state.
    if (this.meshUpdate && this.meshFrameClock) {
      const dt = this.meshFrameClock.getDelta();
      try {
        this.meshUpdate(elapsed, dt);
      } catch (err) {
        console.error('[Hologram3DRenderer] Mesh update hook threw:', err);
      }
    }

    // Normalize scale so the largest bbox dimension maps to ~2 world units.
    // Then `transition` fades the scale from 0 → 1 for entry. The picker /
    // orchestrator (P4 MediaArtTransition) drives the eased transition curve.
    const bb = this.meshState.bbox;
    const maxDim = Math.max(
      bb.max.x - bb.min.x,
      bb.max.y - bb.min.y,
      bb.max.z - bb.min.z,
    );
    const normalize = maxDim > 0 ? 2.0 / maxDim : 1.0;
    const baseScale = normalize * transition;
    group.scale.set(baseScale, baseScale, baseScale);

    // Center the mesh on its bbox so rotation pivots through the visual middle.
    const cx = (bb.max.x + bb.min.x) * 0.5;
    const cy = (bb.max.y + bb.min.y) * 0.5;
    const cz = (bb.max.z + bb.min.z) * 0.5;
    group.position.set(-cx * baseScale, -cy * baseScale, -cz * baseScale);
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
      const targetPivotOpacity = this.handActive ? 0.25 : 0;
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
    // Bump token so any in-flight setModel() loads recognise themselves as
    // superseded and dispose their just-loaded resources instead of attaching.
    this.loadToken++;
    // Dispose mesh-mode resources first so the GLB scene graph is cleaned
    // before the WebGPU device tears down.
    this.disposeMeshState();
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

    const front = this.createHologramMaterial(true);
    const side = this.createHologramMaterial(false);
    if (!front || !side) return null;

    // Korean / CJK characters: use canvas texture on extruded plane
    // (helvetiker font has no CJK glyphs)
    if (needsTextureFallback(char)) {
      return this.createTextureCharMesh(char, front, side);
    }

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
  private createTextureCharMesh(
    char: string,
    front: { material: any; uTime: any; uTransition: any },
    side: { material: any; uTime: any; uTransition: any },
  ) {
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
    // DoubleSide stays here because the CJK plane is single-sided geometry
    // (createPlaneGeometry has no back face); without DoubleSide the back
    // of the plane is invisible and the user sees through the glyph.
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

    // Single plane with DoubleSide — the texture alpha masks the character shape.
    // No side/back geometry needed; DoubleSide renders both faces, and slight
    // depth perception comes from the 3D rotation applied by the controller.
    const planeGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const frontMesh = new THREE.Mesh(planeGeo, frontMat);

    const group = new THREE.Group();
    group.add(frontMesh);

    return {
      group,
      frontMat: front.material,
      sideMat: side.material,
      uTime,
      uTransition,
      sideUTime: side.uTime,
      sideUTransition: side.uTransition,
    };
  }
}
