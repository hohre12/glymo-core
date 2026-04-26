// HandLayer — Phase 6 sub-slice 6a-6b: native Three.js producer.
//
// Replaces the 0.27.x mirror-of-HandVisualizer implementation (a
// `CanvasMirrorLayer` subclass that just uploaded the 2D `<canvas>` painted
// by `HandVisualizer`) with a native `LineSegments2` + `InstancedMesh`
// subtree. Eliminates the `handLandmarkCanvas` DOM element from
// `<CanvasLayerStack>` (canvas count -1 toward §2's "1 visible canvas"
// target).
//
// Design doc:
//   - `docs/plans/rendering-pipeline-v2.md` §6 (refactor target)
//   - `docs/plans/render-v2-6a-6b-handlayer-line2.md` (this slice)
//
// Public surface (per §1.5.4 R-A — plain TS / DOM / Glymo-owned types only):
//   class HandLayer implements Layer {
//     constructor(opts?: HandLayerOptions);
//     init(ctx); render(deltaMs); resize(w,h,dpr); dispose(); setVisible(v);
//     updateLandmarks(landmarks, isPinching, handIndex?);
//     clearLandmarks();
//     setStyle(style: HandLayerStyle);
//     getStyle(): HandLayerStyle;
//   }
//
// Per §3 invariant I9 — `init` / `dispose` are a balanced pair, `dispose`
// is idempotent (Strict Mode dev double-mount safe).
// Per Phase 2/3 hot-path invariant — `updateLandmarks` is allocation-free
// (mutates the persistent `Float32Array` interleaved buffer in place;
// marks `needsUpdate = true`; never `new`s geometry / material / array).
//
// Style fidelity (this commit):
//   - `neon-skeleton` (default) is an exact functional port of the legacy
//     HandVisualizer NeonSkeletonStyle: cyan glow + bones + joints +
//     fingertips + pulsing index cursor.
//   - `crystal` / `flame` / `aurora` / `particle-cloud` accept the API
//     and render a recognisable hand with style-appropriate colors, but
//     do not bit-for-bit reproduce the HandVisualizer 2D output. Full
//     parity ships in Phase 6c (per the plan doc §4).

import {
  CircleGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type InterleavedBufferAttribute,
  type InstancedInterleavedBuffer,
  type Scene as ThreeScene,
} from 'three';
import { Line2NodeMaterial } from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import type { Layer, LayerInitContext } from '../Layer.js';
import { LAYER_DEFAULTS } from '../constants.js';
import { HAND_CONNECTIONS } from '../../input/hand-styles/constants.js';
import { FINGER_TIPS } from '../../input/hand-styles/constants.js';

// ── Public types ────────────────────────────────────────────────────────────

/**
 * Style names — identical string union to `HandStyleName` in
 * `@glymo/core/input/hand-styles`. Re-declared here (not re-exported)
 * because the input-side `HandStyleName` is a 2D-canvas concept; the
 * rendering-pipeline-v2 surface deliberately stays decoupled from the
 * legacy 2D pipeline so a future style added on the native side does
 * not have to round-trip through the input module.
 */
export type HandLayerStyle =
  | 'neon-skeleton'
  | 'crystal'
  | 'flame'
  | 'aurora'
  | 'particle-cloud';

export interface HandLayerOptions {
  /** Stable layer id. Defaults to `LAYER_DEFAULTS.hand.name` (`'hand'`). */
  name?: string;
  /** Z position. Defaults to `LAYER_DEFAULTS.hand.z` (=3). */
  z?: number;
  /** Initial style. Defaults to `'neon-skeleton'`. */
  style?: HandLayerStyle;
  /** Maximum number of simultaneously-tracked hands. Defaults to 2. */
  maxHands?: number;
}

/** Minimal landmark shape — same as `HandStyleConfig.landmarks[number]`. */
export interface HandLandmark {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

// ── Geometry constants ──────────────────────────────────────────────────────

const SEG_COUNT_PER_HAND = HAND_CONNECTIONS.length; // 23
const FLOATS_PER_SEGMENT = 6;                       // xyz × 2
const POSITIONS_PER_HAND = SEG_COUNT_PER_HAND * FLOATS_PER_SEGMENT; // 138
// (color buffer length = positions length, since rgb-per-vertex × 2 vertices)
const LANDMARK_COUNT = 21;
const FINGERTIP_COUNT = FINGER_TIPS.length;         // 5
const JOINT_COUNT_PER_HAND = LANDMARK_COUNT - FINGERTIP_COUNT; // 16 (non-tip joints)

/** MediaPipe index of the index-finger tip. */
const INDEX_TIP = 8;

// ── Style palette table ─────────────────────────────────────────────────────
//
// One row per supported style — keeps every per-style tunable in a single
// readable literal so `setStyle` is O(1). Colors are `Color`-friendly hex
// triples; alphas are applied via material `opacity`.

interface StyleDescriptor {
  readonly bone: { color: number; opacity: number; lineWidth: number };
  readonly boneGlow: { color: number; opacity: number; lineWidth: number } | null;
  readonly joint: { color: number; opacity: number; radius: number };
  readonly tip: { color: number; opacity: number; radius: number };
  readonly cursorActive: number;
  readonly cursorIdle: number;
}

const STYLE_TABLE: Readonly<Record<HandLayerStyle, StyleDescriptor>> = {
  'neon-skeleton': {
    bone:     { color: 0x00ffcc, opacity: 0.6,  lineWidth: 2.5 },
    boneGlow: { color: 0x00ffcc, opacity: 0.15, lineWidth: 6   },
    joint:    { color: 0x00ffcc, opacity: 0.8,  radius: 4 },
    tip:      { color: 0x00ffcc, opacity: 0.7,  radius: 6 },
    cursorActive: 0x00ffcc,
    cursorIdle:   0xff6464,
  },
  crystal: {
    bone:     { color: 0x88ccff, opacity: 0.55, lineWidth: 5 },
    boneGlow: { color: 0xffffff, opacity: 0.4,  lineWidth: 1.5 },
    joint:    { color: 0xaaccff, opacity: 0.6,  radius: 4 },
    tip:      { color: 0xffffff, opacity: 0.85, radius: 6 },
    cursorActive: 0xffffff,
    cursorIdle:   0x88ccff,
  },
  flame: {
    bone:     { color: 0xff7814, opacity: 0.7, lineWidth: 2 },
    boneGlow: { color: 0xff5000, opacity: 0.5, lineWidth: 5 },
    joint:    { color: 0xffcc00, opacity: 0.8, radius: 3 },
    tip:      { color: 0xff6600, opacity: 0.9, radius: 5 },
    cursorActive: 0xffcc00,
    cursorIdle:   0xff0000,
  },
  aurora: {
    bone:     { color: 0x66ddff, opacity: 0.7, lineWidth: 3 },
    boneGlow: { color: 0xaa66ff, opacity: 0.3, lineWidth: 7 },
    joint:    { color: 0x66ffcc, opacity: 0.5, radius: 3 },
    tip:      { color: 0xff66cc, opacity: 0.8, radius: 6 },
    cursorActive: 0xffffff,
    cursorIdle:   0x66ddff,
  },
  'particle-cloud': {
    // Bones-only fallback (no particle FX yet — see plan §4)
    bone:     { color: 0xffffff, opacity: 0.25, lineWidth: 1.5 },
    boneGlow: null,
    joint:    { color: 0x64dcff, opacity: 0.6, radius: 2.5 },
    tip:      { color: 0xffffff, opacity: 0.7, radius: 3.5 },
    cursorActive: 0xffffff,
    cursorIdle:   0x64dcff,
  },
};

/** Cursor pulse cycle (rad/ms). Matches NEON.GLOW_PULSE_SPEED. */
const CURSOR_PULSE_SPEED = 0.005;
/** Cursor base radius in CSS pixels. Matches NEON.GLOW_RADIUS. */
const CURSOR_BASE_RADIUS = 24;

// ── Implementation ──────────────────────────────────────────────────────────

/**
 * HandLayer — native Three.js producer for the MediaPipe hand-skeleton
 * overlay. See module-level header for design doc references.
 */
export class HandLayer implements Layer {
  // ── Layer interface ───────────────────────────────────────────────────────

  readonly name: string;

  // ── Configuration (immutable once constructed) ────────────────────────────

  private readonly z: number;
  private readonly maxHands: number;

  // ── State ─────────────────────────────────────────────────────────────────

  private style: HandLayerStyle;
  private widthCss = 0;
  private heightCss = 0;
  // Note: DPR is intentionally NOT cached here. The WebGPU `Line2NodeMaterial`
  // reads device pixel ratio from TSL's `screenDPR` node at sample time, so
  // the layer never has to participate in DPR-aware geometry math.

  private parentScene: ThreeScene | null = null;
  private group: Group | null = null;

  // Bone primitives
  private boneGeometry: LineSegmentsGeometry | null = null;
  private boneMaterial: Line2NodeMaterial | null = null;
  private boneMesh: LineSegments2 | null = null;
  private boneGlowMaterial: Line2NodeMaterial | null = null;
  private boneGlowMesh: LineSegments2 | null = null;

  /** Direct alias to the interleaved buffer's underlying Float32Array.
   *  We mutate this in place each `updateLandmarks` call. */
  private bonePositions: Float32Array | null = null;
  /** Cached attribute reference so `needsUpdate` flag stays one lookup deep. */
  private bonePositionAttr: InterleavedBufferAttribute | null = null;

  // Joint + tip primitives (one InstancedMesh each, sized for all hands)
  private jointGeometry: CircleGeometry | null = null;
  private jointMaterial: MeshBasicMaterial | null = null;
  private jointMesh: InstancedMesh | null = null;

  private tipGeometry: CircleGeometry | null = null;
  private tipMaterial: MeshBasicMaterial | null = null;
  private tipMesh: InstancedMesh | null = null;

  // Index cursor (one Mesh per hand, simple alpha mesh)
  private cursorGeometry: CircleGeometry | null = null;
  private cursorMaterials: MeshBasicMaterial[] = [];
  private cursorMeshes: Mesh[] = [];

  /** Per-hand last-known pinch state (drives cursor color). */
  private isPinchingPerHand: boolean[] = [];
  /** Time accumulator (ms) for animation uniforms. */
  private timeAccumMs = 0;

  /** Per-hand instance-matrix scratch — reused across calls (zero alloc). */
  private readonly scratchMatrix = new Matrix4();

  /** Idempotency gate. */
  private disposed = false;
  /** Set the moment `init()` completes. */
  private initialized = false;

  // ── Construction ──────────────────────────────────────────────────────────

  constructor(opts: HandLayerOptions = {}) {
    this.name = opts.name ?? LAYER_DEFAULTS.hand.name;
    this.z = opts.z ?? LAYER_DEFAULTS.hand.z;
    this.maxHands = Math.max(1, opts.maxHands ?? 2);
    this.style = opts.style ?? 'neon-skeleton';
    this.isPinchingPerHand = new Array(this.maxHands).fill(false);
  }

  // ── Layer lifecycle ───────────────────────────────────────────────────────

  init(ctx: LayerInitContext): void {
    if (this.disposed) {
      throw new Error(`[${LAYER_DEFAULTS.hand.logName}] cannot init after dispose`);
    }
    if (this.initialized) {
      throw new Error(`[${LAYER_DEFAULTS.hand.logName}] init has already run`);
    }

    this.parentScene = ctx.scene;
    this.widthCss = ctx.widthCss;
    this.heightCss = ctx.heightCss;

    const desc = STYLE_TABLE[this.style];

    // ── Group root ────────────────────────────────────────────────────────
    this.group = new Group();
    this.group.name = `${LAYER_DEFAULTS.hand.logName}:${this.name}`;
    this.group.position.set(0, 0, this.z);
    this.group.frustumCulled = false;

    // ── Bone primitives (LineSegments2) ───────────────────────────────────
    // Pre-allocate the position/color buffers ONCE — every per-frame update
    // mutates them in place.
    const totalSegments = SEG_COUNT_PER_HAND * this.maxHands;
    const positions = new Float32Array(totalSegments * FLOATS_PER_SEGMENT);
    const colors = new Float32Array(totalSegments * FLOATS_PER_SEGMENT);
    // Pre-fill colors for each hand from the descriptor's bone color so
    // vertexColors looks coherent on the first render before
    // updateLandmarks has run.
    fillColors(colors, desc.bone.color);

    this.boneGeometry = new LineSegmentsGeometry();
    this.boneGeometry.setPositions(positions);
    this.boneGeometry.setColors(colors);

    // Cache the interleaved-buffer reference for zero-alloc updates.
    this.bonePositionAttr =
      this.boneGeometry.getAttribute('instanceStart') as InterleavedBufferAttribute;
    this.bonePositions =
      (this.bonePositionAttr.data as InstancedInterleavedBuffer).array as Float32Array;

    this.boneMaterial = new Line2NodeMaterial({
      vertexColors: true,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.boneMaterial.linewidth = desc.bone.lineWidth;
    this.boneMaterial.opacity = desc.bone.opacity;

    this.boneMesh = new LineSegments2(this.boneGeometry, this.boneMaterial);
    this.boneMesh.frustumCulled = false;
    this.boneMesh.name = `${this.group.name}:bones`;
    this.group.add(this.boneMesh);

    // Optional glow pass (wider, lower-opacity bones).
    if (desc.boneGlow) {
      this.boneGlowMaterial = new Line2NodeMaterial({
        vertexColors: true,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      this.boneGlowMaterial.linewidth = desc.boneGlow.lineWidth;
      this.boneGlowMaterial.opacity = desc.boneGlow.opacity;

      // Glow shares the same geometry — Three.js permits multiple meshes on
      // one geometry (the Line2 instanced quad attribute is read-only from
      // the material's standpoint). The position buffer mutation below is
      // visible to both meshes automatically.
      this.boneGlowMesh = new LineSegments2(this.boneGeometry, this.boneGlowMaterial);
      this.boneGlowMesh.frustumCulled = false;
      this.boneGlowMesh.name = `${this.group.name}:bones-glow`;
      // Render the glow underneath the main bone pass; renderOrder is
      // inverse-Z but Three.js sorts equal-Z by `renderOrder` then
      // insertion. Negative `renderOrder` = drawn first.
      this.boneGlowMesh.renderOrder = -1;
      this.group.add(this.boneGlowMesh);
    }

    // ── Joint InstancedMesh (non-tip joints) ──────────────────────────────
    this.jointGeometry = new CircleGeometry(desc.joint.radius, 16);
    this.jointMaterial = new MeshBasicMaterial({
      color: desc.joint.color,
      transparent: true,
      opacity: desc.joint.opacity,
      depthTest: false,
      depthWrite: false,
    });
    this.jointMesh = new InstancedMesh(
      this.jointGeometry,
      this.jointMaterial,
      JOINT_COUNT_PER_HAND * this.maxHands,
    );
    this.jointMesh.frustumCulled = false;
    this.jointMesh.name = `${this.group.name}:joints`;
    // Hide all instances initially (zero-scale matrix). updateLandmarks
    // overwrites the matrices for active hands.
    this.zeroAllInstances(this.jointMesh);
    this.group.add(this.jointMesh);

    // ── Tip InstancedMesh (fingertips — slightly larger, brighter) ────────
    this.tipGeometry = new CircleGeometry(desc.tip.radius, 24);
    this.tipMaterial = new MeshBasicMaterial({
      color: desc.tip.color,
      transparent: true,
      opacity: desc.tip.opacity,
      depthTest: false,
      depthWrite: false,
    });
    this.tipMesh = new InstancedMesh(
      this.tipGeometry,
      this.tipMaterial,
      FINGERTIP_COUNT * this.maxHands,
    );
    this.tipMesh.frustumCulled = false;
    this.tipMesh.name = `${this.group.name}:tips`;
    this.zeroAllInstances(this.tipMesh);
    this.group.add(this.tipMesh);

    // ── Index cursor (one Mesh per hand) ──────────────────────────────────
    this.cursorGeometry = new CircleGeometry(CURSOR_BASE_RADIUS, 32);
    for (let h = 0; h < this.maxHands; h++) {
      const mat = new MeshBasicMaterial({
        color: desc.cursorIdle,
        transparent: true,
        opacity: 0.35,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new Mesh(this.cursorGeometry, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.name = `${this.group.name}:cursor-${h}`;
      this.cursorMaterials.push(mat);
      this.cursorMeshes.push(mesh);
      this.group.add(mesh);
    }

    this.parentScene.add(this.group);
    this.initialized = true;
  }

  /** Per-frame: animation uniforms only (cursor pulse). All landmark data
   *  is pushed into the buffers by `updateLandmarks` outside of `render`. */
  render(deltaMs: number): void {
    if (!this.initialized || this.disposed) return;
    this.timeAccumMs += deltaMs;

    // Pulse the cursor scale + opacity. The legacy NeonSkeletonStyle used
    // `1 + 0.25 * Math.sin(time * 0.005)` — same coefficient here so the
    // visual matches without bringing time-domain drift between the two
    // implementations.
    const pulse = 1 + 0.25 * Math.sin(this.timeAccumMs * CURSOR_PULSE_SPEED);
    for (let h = 0; h < this.cursorMeshes.length; h++) {
      const mesh = this.cursorMeshes[h];
      if (!mesh || !mesh.visible) continue;
      mesh.scale.setScalar(pulse);
      const mat = this.cursorMaterials[h];
      if (mat) {
        // Pinch-active cursors hold a tighter pulse opacity envelope so the
        // ring "snaps" when pinching engages.
        const baseOpacity = this.isPinchingPerHand[h] ? 0.65 : 0.35;
        mat.opacity = baseOpacity * (0.85 + 0.15 * Math.sin(this.timeAccumMs * CURSOR_PULSE_SPEED));
      }
    }
  }

  setVisible(visible: boolean): void {
    if (!this.initialized || this.disposed) return;
    if (this.group) this.group.visible = visible;
  }

  resize(widthCss: number, heightCss: number, _dpr: number): void {
    if (!this.initialized || this.disposed) return;
    if (!Number.isFinite(widthCss) || widthCss <= 0) return;
    if (!Number.isFinite(heightCss) || heightCss <= 0) return;
    this.widthCss = widthCss;
    this.heightCss = heightCss;
    // Note: `Line2NodeMaterial` (WebGPU variant) reads viewport dimensions
    // from TSL's `viewport` / `screenDPR` nodes internally, so unlike the
    // WebGL `LineMaterial` we do NOT need to push a `resolution: Vector2`
    // uniform on resize. Three.js's WebGPURenderer updates the viewport
    // node automatically when the renderer is resized by SceneGraph.
    // Note: existing landmark-based positions are STALE relative to the new
    // viewport (they were computed in the old CSS-pixel space). The next
    // `updateLandmarks` call will re-emit them in the new space; until that
    // call, hands appear at their pre-resize coordinates. MediaPipe calls
    // landmark callbacks at camera FPS (≥30Hz), so the visible window is
    // <33ms — well under perceptible. Matching the legacy HandVisualizer
    // which had identical behaviour.
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.parentScene && this.group) {
      this.parentScene.remove(this.group);
    }
    if (this.boneGeometry) {
      this.boneGeometry.dispose();
      this.boneGeometry = null;
    }
    if (this.boneMaterial) {
      this.boneMaterial.dispose();
      this.boneMaterial = null;
    }
    if (this.boneGlowMaterial) {
      this.boneGlowMaterial.dispose();
      this.boneGlowMaterial = null;
    }
    if (this.jointGeometry) {
      this.jointGeometry.dispose();
      this.jointGeometry = null;
    }
    if (this.jointMaterial) {
      this.jointMaterial.dispose();
      this.jointMaterial = null;
    }
    if (this.tipGeometry) {
      this.tipGeometry.dispose();
      this.tipGeometry = null;
    }
    if (this.tipMaterial) {
      this.tipMaterial.dispose();
      this.tipMaterial = null;
    }
    if (this.cursorGeometry) {
      this.cursorGeometry.dispose();
      this.cursorGeometry = null;
    }
    for (const mat of this.cursorMaterials) {
      mat.dispose();
    }
    this.cursorMaterials = [];
    this.cursorMeshes = [];

    this.boneMesh = null;
    this.boneGlowMesh = null;
    this.jointMesh = null;
    this.tipMesh = null;
    this.bonePositions = null;
    this.bonePositionAttr = null;
    this.group = null;
    this.parentScene = null;
    this.initialized = false;
  }

  // ── Per-frame data sink ───────────────────────────────────────────────────

  /**
   * Push the latest MediaPipe landmark batch for one hand. Allocation-free
   * — mutates the pre-allocated interleaved position buffer in place and
   * marks `needsUpdate = true`. Pass an empty array to hide the hand
   * (degenerate zero-length segments + zero-scale instance matrices).
   */
  updateLandmarks(
    landmarks: ReadonlyArray<HandLandmark>,
    isPinching: boolean,
    handIndex: number = 0,
  ): void {
    if (!this.initialized || this.disposed) return;
    if (handIndex < 0 || handIndex >= this.maxHands) return;
    if (!this.bonePositions || !this.bonePositionAttr) return;
    if (!this.jointMesh || !this.tipMesh) return;

    const w = this.widthCss;
    const h = this.heightCss;
    const positions = this.bonePositions;

    this.isPinchingPerHand[handIndex] = isPinching;

    // Empty array → hide everything for this hand.
    if (landmarks.length === 0) {
      const start = handIndex * POSITIONS_PER_HAND;
      positions.fill(0, start, start + POSITIONS_PER_HAND);
      this.hideHandInstances(handIndex);
      const cursor = this.cursorMeshes[handIndex];
      if (cursor) cursor.visible = false;
      this.markBuffersDirty();
      return;
    }

    // ── Bones ─────────────────────────────────────────────────────────────
    const segOff = handIndex * POSITIONS_PER_HAND;
    for (let s = 0; s < SEG_COUNT_PER_HAND; s++) {
      const conn = HAND_CONNECTIONS[s];
      if (!conn) continue;
      const [aIdx, bIdx] = conn;
      const la = landmarks[aIdx];
      const lb = landmarks[bIdx];
      const off = segOff + s * FLOATS_PER_SEGMENT;
      if (!la || !lb) {
        // Degenerate segment — collapse to origin (invisible).
        positions[off + 0] = 0;
        positions[off + 1] = 0;
        positions[off + 2] = 0;
        positions[off + 3] = 0;
        positions[off + 4] = 0;
        positions[off + 5] = 0;
        continue;
      }
      // Mirror-X (selfie) + Y-flip (canvas-down → world-up) + recenter.
      positions[off + 0] = ((1 - la.x) - 0.5) * w;
      positions[off + 1] = -(la.y - 0.5) * h;
      positions[off + 2] = 0;
      positions[off + 3] = ((1 - lb.x) - 0.5) * w;
      positions[off + 4] = -(lb.y - 0.5) * h;
      positions[off + 5] = 0;
    }

    // ── Joints (non-tip landmarks) ────────────────────────────────────────
    let jointSlot = handIndex * JOINT_COUNT_PER_HAND;
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      if (FINGER_TIPS.includes(i)) continue; // tip handled below
      const lm = landmarks[i];
      if (!lm) {
        this.scratchMatrix.makeScale(0, 0, 0);
      } else {
        const x = ((1 - lm.x) - 0.5) * w;
        const y = -(lm.y - 0.5) * h;
        this.scratchMatrix.makeTranslation(x, y, 0);
      }
      this.jointMesh.setMatrixAt(jointSlot, this.scratchMatrix);
      jointSlot++;
    }
    this.jointMesh.instanceMatrix.needsUpdate = true;

    // ── Fingertips ────────────────────────────────────────────────────────
    let tipSlot = handIndex * FINGERTIP_COUNT;
    for (let t = 0; t < FINGERTIP_COUNT; t++) {
      const tipIdx = FINGER_TIPS[t]!;
      const lm = landmarks[tipIdx];
      if (!lm) {
        this.scratchMatrix.makeScale(0, 0, 0);
      } else {
        const x = ((1 - lm.x) - 0.5) * w;
        const y = -(lm.y - 0.5) * h;
        // Index tip rendered slightly larger to mimic the legacy NEON ring.
        const scale = tipIdx === INDEX_TIP ? 1.0 : 0.7;
        this.scratchMatrix.makeScale(scale, scale, 1);
        this.scratchMatrix.setPosition(x, y, 0);
      }
      this.tipMesh.setMatrixAt(tipSlot, this.scratchMatrix);
      tipSlot++;
    }
    this.tipMesh.instanceMatrix.needsUpdate = true;

    // ── Index cursor ──────────────────────────────────────────────────────
    const cursor = this.cursorMeshes[handIndex];
    const cursorMat = this.cursorMaterials[handIndex];
    const indexLm = landmarks[INDEX_TIP];
    if (cursor && cursorMat && indexLm) {
      cursor.visible = true;
      cursor.position.set(
        ((1 - indexLm.x) - 0.5) * w,
        -(indexLm.y - 0.5) * h,
        0.001, // sit slightly above the bones to avoid Z fight
      );
      const desc = STYLE_TABLE[this.style];
      cursorMat.color.setHex(isPinching ? desc.cursorActive : desc.cursorIdle);
    } else if (cursor) {
      cursor.visible = false;
    }

    this.markBuffersDirty();
  }

  /** Clear ALL hands. Cheaper than per-hand empty arrays when MediaPipe
   *  reports tracking lost across the board. */
  clearLandmarks(): void {
    if (!this.initialized || this.disposed) return;
    if (!this.bonePositions || !this.bonePositionAttr) return;
    this.bonePositions.fill(0);
    if (this.jointMesh) {
      this.zeroAllInstances(this.jointMesh);
      this.jointMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.tipMesh) {
      this.zeroAllInstances(this.tipMesh);
      this.tipMesh.instanceMatrix.needsUpdate = true;
    }
    for (let h = 0; h < this.cursorMeshes.length; h++) {
      const m = this.cursorMeshes[h];
      if (m) m.visible = false;
      this.isPinchingPerHand[h] = false;
    }
    this.markBuffersDirty();
  }

  // ── Style switching ───────────────────────────────────────────────────────

  setStyle(style: HandLayerStyle): void {
    if (style === this.style) return;
    this.style = style;
    if (!this.initialized || this.disposed) return;

    const desc = STYLE_TABLE[style];

    // Bone material params (mutate in place — no GPU pipeline rebuild)
    if (this.boneMaterial) {
      this.boneMaterial.linewidth = desc.bone.lineWidth;
      this.boneMaterial.opacity = desc.bone.opacity;
    }
    if (this.boneGlowMaterial && desc.boneGlow) {
      this.boneGlowMaterial.linewidth = desc.boneGlow.lineWidth;
      this.boneGlowMaterial.opacity = desc.boneGlow.opacity;
      if (this.boneGlowMesh) this.boneGlowMesh.visible = true;
    } else if (this.boneGlowMesh) {
      this.boneGlowMesh.visible = false;
    }

    // Bone color buffer rewrite (per-vertex). Persistent buffer mutation
    // (no realloc) — `setColors` would replace the InterleavedBuffer; we
    // walk the existing colors attribute instead.
    this.recolorBones(desc.bone.color);

    // Joint/tip materials
    if (this.jointMaterial) {
      this.jointMaterial.color.setHex(desc.joint.color);
      this.jointMaterial.opacity = desc.joint.opacity;
    }
    if (this.tipMaterial) {
      this.tipMaterial.color.setHex(desc.tip.color);
      this.tipMaterial.opacity = desc.tip.opacity;
    }
  }

  getStyle(): HandLayerStyle {
    return this.style;
  }

  // ── Public diagnostics ────────────────────────────────────────────────────

  /** True after `init()` returns and before `dispose()` runs. */
  isInitialized(): boolean {
    return this.initialized && !this.disposed;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private markBuffersDirty(): void {
    if (this.bonePositionAttr) {
      (this.bonePositionAttr.data as InstancedInterleavedBuffer).needsUpdate = true;
    }
  }

  private zeroAllInstances(mesh: InstancedMesh): void {
    this.scratchMatrix.makeScale(0, 0, 0);
    for (let i = 0; i < mesh.count; i++) {
      mesh.setMatrixAt(i, this.scratchMatrix);
    }
  }

  private hideHandInstances(handIndex: number): void {
    if (!this.jointMesh || !this.tipMesh) return;
    this.scratchMatrix.makeScale(0, 0, 0);
    const jointStart = handIndex * JOINT_COUNT_PER_HAND;
    for (let j = 0; j < JOINT_COUNT_PER_HAND; j++) {
      this.jointMesh.setMatrixAt(jointStart + j, this.scratchMatrix);
    }
    this.jointMesh.instanceMatrix.needsUpdate = true;
    const tipStart = handIndex * FINGERTIP_COUNT;
    for (let t = 0; t < FINGERTIP_COUNT; t++) {
      this.tipMesh.setMatrixAt(tipStart + t, this.scratchMatrix);
    }
    this.tipMesh.instanceMatrix.needsUpdate = true;
  }

  private recolorBones(hex: number): void {
    if (!this.boneGeometry) return;
    const colorAttr = this.boneGeometry.getAttribute('instanceColorStart') as
      | InterleavedBufferAttribute
      | InstancedBufferAttribute
      | undefined;
    if (!colorAttr) return;
    const data = (colorAttr as InterleavedBufferAttribute).data as
      | InstancedInterleavedBuffer
      | undefined;
    const arr = (data?.array as Float32Array) ?? null;
    if (!arr) return;
    fillColors(arr, hex);
    if (data) data.needsUpdate = true;
  }
}

// ── Local utilities ─────────────────────────────────────────────────────────

const _scratchColor = new Color();

/** Fill an interleaved (rgb rgb) Float32Array with a single hex color. */
function fillColors(arr: Float32Array, hex: number): void {
  _scratchColor.setHex(hex);
  const r = _scratchColor.r;
  const g = _scratchColor.g;
  const b = _scratchColor.b;
  for (let i = 0; i < arr.length; i += 3) {
    arr[i + 0] = r;
    arr[i + 1] = g;
    arr[i + 2] = b;
  }
}
