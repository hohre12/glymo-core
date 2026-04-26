// TextHologramLayer — Phase 6 sub-slice 6a-5b: native text-mode 3D-character
// producer for the SceneGraph. Scaffold landed (additive); the
// legacy `Hologram3DRenderer` + `Hologram3DLayer` (CanvasMirrorLayer wrapper)
// stay live during migration. See `docs/plans/render-v2-6a-5b-hologram-split.md`
// for the full strategy + remaining work + risks.
//
// THIS COMMIT — MVP scope only:
//   - Layer interface (init / render / resize / dispose / setVisible) wired
//     against the SceneGraph's shared scene + camera.
//   - `updateChars(chars)` data sink — mirrors the legacy `setText`.
//   - `setRotation` / `setZoom` / `setTransition` / `setSpread` /
//     `setHandActive` / `setEnabled` / `resetTransform` shared-gesture API.
//   - Per-frame char-mesh sync: meshes are added to the scene as a basic
//     cyan plane per char (placeholder). The full TextGeometry + TSL
//     `createHologramMaterial` port is deferred per the plan §7 matrix.
//   - 2D-distance hit-test fallback for `hitTestChar` so callers can wire
//     `useHologram3DMesh` against this layer immediately. Full 3D raycast
//     is the next step.
//   - Idempotent `dispose` (Strict Mode dev safe).
//
// Per §1.5.4 R-A — public surface is plain TS / Glymo-owned types only;
// `HologramChar` already lives in `@glymo/core/hologram`. Three.js types are
// confined to the implementation.

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene as ThreeScene,
  type OrthographicCamera as ThreeOrthographicCamera,
} from 'three';

import type { Layer, LayerInitContext } from '../Layer.js';
import { LAYER_DEFAULTS } from '../constants.js';
import type { HologramChar, HitTestResult } from '../../hologram/types.js';

// ── Public types ────────────────────────────────────────────────────────────

export interface TextHologramLayerOptions {
  /** Stable layer id. Defaults to `'text-hologram'`. */
  name?: string;
  /** Z position. Defaults to `LAYER_DEFAULTS.hologram3d.z` (=2). */
  z?: number;
  /**
   * Reserved for the full port: list of font URLs to try in order for
   * TextGeometry. Ignored by the MVP scaffold (no TextGeometry yet). The
   * scaffold uses a placeholder cyan plane per char.
   */
  fontUrls?: readonly string[];
}

// ── Internal per-char entry ─────────────────────────────────────────────────
//
// Mirrors the shape of `Hologram3DRenderer.charMeshes` but stripped to what
// the scaffold actually drives. The full port will add `frontMat` / `sideMat`
// + `uTime` + `uTransition` references once `sharedShaders.ts` lands.

interface TextCharEntry {
  group: Group;
  mesh: Mesh;
  material: MeshBasicMaterial;
  geometry: PlaneGeometry;
}

// ── Implementation ──────────────────────────────────────────────────────────

const PLACEHOLDER_CHAR_COLOR = 0x00bbff;
const PLACEHOLDER_CHAR_SIZE = 40; // CSS pixels — visible default

export class TextHologramLayer implements Layer {
  readonly name: string;
  private readonly z: number;

  // Shared SceneGraph references (populated in `init`).
  private parentScene: ThreeScene | null = null;
  private camera: ThreeOrthographicCamera | null = null;
  private widthCss = 0;
  private heightCss = 0;

  /** Container group — direct child of `ctx.scene`, owns all char meshes. */
  private container: Group | null = null;

  /** Sub-group that receives idle-wobble rotation (full port). */
  private charContainer: Group | null = null;

  /** Per-char render state, keyed by `HologramChar.id`. */
  private readonly charMeshes = new Map<string, TextCharEntry>();

  // ── Caller-driven state ───────────────────────────────────────────────────

  private chars: readonly HologramChar[] = [];
  private rotX = 0;
  private rotY = 0;
  private rotZ = 0;
  private zoom = 1;
  private transition = 0;
  private spread = 1;
  private handActive = false;
  private enabled = true;
  private elapsedMs = 0;

  /** Per-char drag position overrides (CSS coords). */
  private readonly movedChars = new Map<string, { x: number; y: number }>();
  /** Char currently actively dragged, or null. */
  private activeDragId: string | null = null;

  // ── Lifecycle gates ───────────────────────────────────────────────────────

  private initialized = false;
  private disposed = false;
  private visible = true;

  // ── Construction ──────────────────────────────────────────────────────────

  constructor(opts: TextHologramLayerOptions = {}) {
    // Distinct default name from the legacy `'hologram-3d'` so a SceneGraph
    // can host both layers concurrently during migration.
    this.name = opts.name ?? 'text-hologram';
    this.z = opts.z ?? LAYER_DEFAULTS.hologram3d.z;
  }

  // ── Layer interface ───────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error('[TextHologramLayer] cannot init after dispose');
    }
    if (this.initialized) {
      throw new Error('[TextHologramLayer] init has already run');
    }

    this.parentScene = ctx.scene;
    this.camera = ctx.camera;
    this.widthCss = ctx.widthCss;
    this.heightCss = ctx.heightCss;

    this.container = new Group();
    this.container.name = `TextHologramLayer:${this.name}`;
    this.container.position.set(0, 0, this.z);
    this.container.frustumCulled = false;
    ctx.scene.add(this.container);

    // Inner group reserved for the idle-wobble + spread rotation channel
    // the full port writes (`charContainer.rotation`). Keeping it as a real
    // child of `container` now means the full-port commit only adds the
    // per-frame writes — no scene-graph topology changes required.
    this.charContainer = new Group();
    this.charContainer.name = `TextHologramLayer:${this.name}:chars`;
    this.container.add(this.charContainer);

    this.initialized = true;
  }

  render(_deltaMs: number): void {
    if (!this.initialized || this.disposed) return;
    if (!this.charContainer) return;
    if (!this.enabled || this.transition < 0.001) {
      // Hide every char without disposing — the SceneGraph clears the
      // render target each frame, so simply skipping the per-char update
      // would leave them drawn with stale state. Toggle the container.
      this.charContainer.visible = false;
      return;
    }
    this.charContainer.visible = this.visible;

    this.elapsedMs += _deltaMs;

    // Apply container rotation (the full port adds idle-wobble math here).
    this.charContainer.rotation.set(this.rotX, this.rotY, this.rotZ);

    // ── Sync char meshes ─────────────────────────────────────────────────
    const activeIds = new Set<string>();
    const chars = this.chars.filter((c) => !c.isDeleting);
    const numChars = Math.min(chars.length, 20);

    for (let i = 0; i < numChars; i++) {
      const ch = chars[i]!;
      activeIds.add(ch.id);

      let entry = this.charMeshes.get(ch.id);
      if (!entry) {
        entry = this.createPlaceholderEntry();
        this.charMeshes.set(ch.id, entry);
        this.charContainer.add(entry.group);
      }

      // Position: convert CSS coords → orthographic world coords (1:1
      // mapping; SceneGraph uses 1 unit = 1 CSS pixel, frustum centered at
      // origin). y-axis is flipped (CSS down → world up).
      const moved = this.movedChars.get(ch.id);
      const charX = moved?.x ?? ch.x;
      const charY = moved?.y ?? ch.y;
      const worldX = charX - this.widthCss / 2;
      const worldY = -(charY - this.heightCss / 2);

      // Scale: char height in CSS px → world units; zoom scales uniformly.
      const charSize = Math.max(ch.height, PLACEHOLDER_CHAR_SIZE) * this.zoom;
      const scale = charSize * this.transition;

      entry.group.position.set(worldX, worldY, 0);
      entry.group.scale.setScalar(scale);

      // Drag affordance — bump scale slightly when actively dragged so it
      // matches the legacy renderer's 1.2× drag scale visually.
      if (this.activeDragId === ch.id) {
        entry.group.scale.setScalar(scale * 1.2);
      }
    }

    // Remove meshes for deleted chars
    for (const [id, entry] of this.charMeshes) {
      if (!activeIds.has(id)) {
        this.charContainer.remove(entry.group);
        entry.geometry.dispose();
        entry.material.dispose();
        this.charMeshes.delete(id);
      }
    }
  }

  resize(widthCss: number, heightCss: number, _dpr: number): void {
    this.widthCss = widthCss;
    this.heightCss = heightCss;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const [, entry] of this.charMeshes) {
      try {
        entry.geometry.dispose();
        entry.material.dispose();
      } catch {
        /* noop */
      }
    }
    this.charMeshes.clear();

    if (this.charContainer && this.container) {
      this.container.remove(this.charContainer);
    }
    this.charContainer = null;

    if (this.container && this.parentScene) {
      this.parentScene.remove(this.container);
    }
    this.container = null;
    this.parentScene = null;
    this.camera = null;

    this.initialized = false;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.container) this.container.visible = visible;
  }

  // ── Char data sink ────────────────────────────────────────────────────────

  /**
   * Update the active char list. Mirrors `Hologram3DRenderer.setText`.
   * The actual per-char mesh sync runs lazily on the next `render()` tick.
   */
  updateChars(chars: readonly HologramChar[]): void {
    this.chars = chars;
  }

  // ── Shared gesture inputs ────────────────────────────────────────────────

  setRotation(rotX: number, rotY: number, rotZ?: number): void {
    this.rotX = rotX;
    this.rotY = rotY;
    if (rotZ !== undefined) this.rotZ = rotZ;
  }

  setZoom(zoom: number): void {
    // Same lower clamp as the legacy renderer; no upper bound.
    this.zoom = Math.max(0.01, zoom);
  }

  setTransition(t: number): void {
    this.transition = Math.max(0, Math.min(1, t));
  }

  setSpread(spread: number): void {
    this.spread = Math.max(0, Math.min(6.0, spread));
  }

  setHandActive(active: boolean): void {
    this.handActive = active;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  resetTransform(): void {
    this.rotX = 0;
    this.rotY = 0;
    this.rotZ = 0;
    this.zoom = 1;
    this.spread = 1;
    this.movedChars.clear();
    this.activeDragId = null;
  }

  // ── Char drag affordance ──────────────────────────────────────────────────

  grabChar(charId: string, x: number, y: number): void {
    this.movedChars.set(charId, { x, y });
    this.activeDragId = charId;
  }

  releaseChar(_charId: string): void {
    this.activeDragId = null;
  }

  // ── Hit-test ──────────────────────────────────────────────────────────────

  /**
   * 2D distance hit-test against the active char list. Mirrors the legacy
   * renderer's `hitTestCharFallback`. The 3D raycast variant lands in the
   * full-port commit once the per-char mesh shape is no longer a placeholder
   * (raycasting against full-frame planes returns false positives).
   */
  hitTestChar(x: number, y: number, maxDist: number): HitTestResult | null {
    const chars = this.chars.filter((c) => !c.isDeleting);
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

  // ── Diagnostics ───────────────────────────────────────────────────────────

  /** Current set of rendered char ids. Mirrors `getRenderedCharIds`. */
  getRenderedCharIds(): readonly string[] {
    return [...this.charMeshes.keys()];
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Build the placeholder per-char render state. This exists so the wire-up
   * across `init` / `render` / `dispose` is exercised end-to-end on day one;
   * the real visual replacement (TextGeometry + TSL hologram material) is the
   * next milestone per the plan §7 parity matrix.
   */
  private createPlaceholderEntry(): TextCharEntry {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({
      color: PLACEHOLDER_CHAR_COLOR,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    const group = new Group();
    group.add(mesh);
    return { group, mesh, material, geometry };
  }
}
