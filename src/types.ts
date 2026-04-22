// ── Core Data Types (design.md SS3) ───────────────────

/** A single point in a stroke with timestamp and pressure */
export interface StrokePoint {
  x: number;
  y: number;
  t: number;          // performance.now() timestamp in ms
  pressure: number;   // 0.0 ~ 1.0
}

/** 2D point (used by math utilities and matching) */
export interface Point {
  x: number;
  y: number;
}

/** 3D point extending Point with z-depth (used by CameraCapture) */
export interface Point3D extends Point {
  z: number;
}

/** RGB color tuple */
export interface RGB {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
}

/** Visual parameters for a single effect preset */
export interface EffectStyle {
  color: string;             // Primary hex color
  minWidth: number;          // Minimum stroke width (px)
  maxWidth: number;          // Maximum stroke width (px)
  glowColor: string;         // CSS color for shadowColor
  glowSize: number;          // shadowBlur value
  particleColor: string;     // CSS color for particles
  gradient: string[] | null; // Hex color stops, or null for solid color
}

/** A single particle in the particle system */
export interface Particle {
  x: number;
  y: number;
  vx: number;       // velocity x (px/frame)
  vy: number;       // velocity y (px/frame)
  life: number;     // 1.0 -> 0.0
  decay: number;    // life reduction per frame
  size: number;     // radius in px
  color: string;    // CSS color
}

/** Matched point pair for morph animation */
export interface MatchedPair {
  hand: Point;
  font: Point;
  charIndex: number;
  pointIndex: number;
}

/** A rendered point with visual properties */
export interface RenderedPoint {
  x: number;
  y: number;
  color: RGB;
  size: number;
  alpha: number;
}

/** A single frame of morph animation */
export interface MorphFrame {
  points: RenderedPoint[];
  globalProgress: number;  // 0.0 ~ 1.0
  isComplete: boolean;
}

// ── Pipeline Interfaces ──────────────────────────────

/** Raw point emitted by an input source before pipeline processing */
export interface RawInputPoint {
  x: number;
  y: number;
  t: number;                            // performance.now()
  source: 'mouse' | 'touch' | 'camera';
  pressure?: number;                     // Hardware pressure if available
}

/** An input capture source (mouse, touch, or camera) */
export interface InputCapture {
  start(canvas: HTMLCanvasElement): void;
  stop(): void;
  isActive(): boolean;
}

/** A single stage in the processing pipeline */
export interface PipelineStage {
  name: string;
  process(input: StrokePoint): StrokePoint;   // Per-point real-time processing
  reset(): void;                               // Reset state between strokes
}

/** A batch-processing stage (runs on completed strokes, not per-point) */
export interface BatchPipelineStage {
  name: string;
  processBatch(points: StrokePoint[]): StrokePoint[];
  reset(): void;
}

/** A compositing layer for the renderer */
export interface RenderLayer {
  name: string;
  order: number;                                           // Lower = drawn first
  render(ctx: CanvasRenderingContext2D, dt: number): void;
  isVisible: boolean;
}

// ── Fill ─────────────────────────────────────────────

/** A filled region produced by the paint-bucket / flood-fill tool */
export interface Fill {
  id: string;
  color: string;
  bitmap: ImageBitmap;
  createdAt: number;
}

// ── GlymoObject ─────────────────────────────────────

/** A grouped drawing object: strokes + fills animated as a single unit */
export interface GlymoObject {
  id: string;
  strokeIds: string[];
  fillIds: string[];
  bbox: { x: number; y: number; width: number; height: number };
  createdAt: number;
  animationId?: string;
  metadata?: Record<string, unknown>;
}

// ── Stroke Correction ────────────────────────────────

/** Options for stroke correction algorithms */
export interface CorrectionOptions {
  /** Snapping threshold in canvas-space pixels (default 15) */
  snapThreshold?: number;
  /** Whether to apply endpoint snapping (default true) */
  endpointSnap?: boolean;
  /** Whether to apply overshoot trimming (default true) */
  overshootTrim?: boolean;
}

/** Result of endpoint snapping on a single stroke */
export interface SnapResult {
  snapped: boolean;
  /** Which end was snapped */
  end: 'start' | 'end' | 'both' | 'none';
  /** IDs of strokes that were snapped to */
  targetStrokeIds: string[];
  /** The corrected raw points */
  correctedRaw: StrokePoint[];
}

/** Result of overshoot trimming on a single stroke */
export interface TrimResult {
  trimmed: boolean;
  /** Number of points removed from the end */
  pointsRemoved: number;
  /** The corrected raw points */
  correctedRaw: StrokePoint[];
}

/** Correction metadata stored in GlymoObject.metadata.correction */
export interface CorrectionMetadata {
  corrected: boolean;
  /** Pre-correction raw points keyed by stroke ID */
  originalRaw: Record<string, StrokePoint[]>;
  /** Pre-correction smoothed points keyed by stroke ID */
  originalSmoothed: Record<string, StrokePoint[]>;
  /** Full Stroke objects that were removed during polish (for revert restoration) */
  removedStrokes?: Stroke[];
  /** Which corrections were applied */
  appliedCorrections: string[];
}

// ── Session State ────────────────────────────────────

/** A completed or in-progress stroke */
export interface Stroke {
  id: string;                    // crypto.randomUUID()
  raw: StrokePoint[];            // After stages 1-4 (stabilized + pressure)
  smoothed: StrokePoint[];       // After Chaikin x4 (stage 5)
  state: 'drawing' | 'smoothing' | 'effected';
  effect: EffectPresetName;
  createdAt: number;
  customColor?: string;          // Per-stroke color override (takes precedence over EffectStyle)
  customWidth?: number;          // Per-stroke fixed width override (ignores pressure)
}

/** Session-level canvas state */
export interface CanvasSession {
  strokes: Stroke[];           // Completed strokes (chronological)
  activeStroke: Stroke | null; // Currently being drawn
  effect: EffectPresetName;    // Current effect selection
  canvas: {
    width: number;
    height: number;
    dpr: number;               // Device pixel ratio
  };
  particles: Particle[];       // Active particle pool
  isExporting: boolean;        // Lock during export
}

/**
 * Structured error for pipeline failures. Thrown synchronously when an API
 * must surface a failure (e.g., {@link Glymo.exportSession} when a fill PNG
 * exceeds the 500 KB wire limit). The class doubles as the structural type
 * for `const e: GlymoError = new GlymoError(...)` — no separate interface is
 * needed because the class surface already exposes every field the consumer
 * contract cares about.
 */
export class GlymoError extends Error {
  readonly code: string;
  readonly recoverable: boolean;
  readonly stage?: string;
  readonly originalError?: Error;

  constructor(
    code: string,
    message: string,
    options: { stage?: string; recoverable?: boolean; originalError?: Error } = {},
  ) {
    super(message);
    this.name = 'GlymoError';
    this.code = code;
    this.recoverable = options.recoverable ?? false;
    if (options.stage) this.stage = options.stage;
    if (options.originalError) this.originalError = options.originalError;
  }
}

// ── Persistence (wire format) ────────────────────────

/**
 * A single point in the serialized wire format used by server / client
 * persistence layers. Intentionally slimmer than the internal runtime
 * {@link StrokePoint} so the capture-time invariants (`t`, required
 * `pressure`) do not leak into storage contracts.
 */
export interface StrokeDocPoint {
  x: number;
  y: number;
  pressure?: number;
}

/**
 * A single stroke in the serialized wire format. Consumed by
 * {@link Glymo.loadSession} (v2 full session) and {@link Glymo.loadStrokes}
 * (v1 strokes-only compat).
 *
 * v2 extends v1 via optional fields only — legacy payloads with only `points`
 * continue to deserialize. `id` is optional on the type but required at v2
 * semantics: the loader synthesises a UUID if missing so v1 payloads keep
 * working.
 */
export interface StrokeDoc {
  /** Stable stroke identity — load-time synthesised from `crypto.randomUUID()` if absent. */
  id?: string;
  points: StrokeDocPoint[];
  /** Per-stroke effect override; takes precedence over {@link SessionDoc.effect} on load. */
  effect?: string;
  /** Per-stroke color override; takes precedence over the resolved effect's color. */
  customColor?: string;
  /** Per-stroke fixed width override (ignores pressure). */
  customWidth?: number;
  /** Per-stroke animation params. Live state (startTime/active) is session-local. */
  animation?: AnimationDoc;
}

// ── Session Wire Format (v2) ────────────────────────

/**
 * Serialized wire format for a {@link GlymoObject} grouping — a set of strokes
 * and fills treated as a single unit for animation / selection / undo.
 *
 * Referential integrity: `strokeIds` and `fillIds` MUST resolve within the
 * same {@link SessionDoc}. Dangling references on load are dropped with a
 * `console.warn`; the canvas does not throw on a corrupt session.
 */
export interface ObjectDoc {
  id: string;
  strokeIds: string[];
  fillIds: string[];
  bbox: { x: number; y: number; width: number; height: number };
  metadata?: Record<string, unknown>;
}

/**
 * Serialized wire format for a {@link Fill}. The bitmap is persisted to the
 * S3-compatible bucket (same bucket as artwork images); `bitmap_url` carries
 * the public URL at rest. `projects.data` JSONB stays purely textual.
 *
 * Size limit: 500 KB per fill PNG, enforced client-side before upload.
 */
export interface FillDoc {
  id: string;
  color: string;
  bitmap_url: string;
}

/**
 * Serialized wire format for a stroke animation. Live state (`startTime`,
 * `active`) is NOT persisted — animations restart at t=0 on load, matching
 * the UX of a page refresh today.
 *
 * Deliberately diverges from the runtime
 * {@link import('./animation/types.js').AnimationParams} on two fields:
 *
 *   - `durationMs` (wire) ↔ `duration` (runtime)
 *   - `loop` (wire) ↔ `repeat` (runtime)
 *
 * The rename keeps the persistence contract explicit about the unit and
 * intent — a choice the server-side pydantic schema locks in as well.
 * Translation happens in {@link Glymo.exportSession} /
 * {@link Glymo.loadSession}; runtime code continues to use
 * {@link import('./animation/types.js').AnimationParams} unchanged.
 */
export interface AnimationDoc {
  type: import('./animation/types.js').AnimationType;
  durationMs?: number;
  loop?: boolean;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amplitude?: number;
  speed?: number;
  particleCount?: number;
  keyframes?: import('./animation/types.js').AnimationKeyframe[];
}

/**
 * Serialized wire format for a recognised character — the typography output
 * produced by `CascadingRecognizer` once it finalises a group of handwritten
 * strokes into a glyph. Carries only what the user sees on the canvas after
 * finalisation; the original handwritten strokes are already removed from
 * `Glymo.this.strokes` via `fadeOutStrokeById` and are NOT persisted.
 *
 * `strokePoints` (char-local geometry used by hologram / morph effects) is
 * intentionally omitted from the wire shape: it is deterministically derivable
 * from `char + fontId + (x, y, width, height)` on load, and keeping it out of
 * the wire keeps `projects.data` inside the 1 MiB soft cap.
 *
 * Added for session persistence Revision 2 (2026-04-19); see
 * `docs/plans/session-persistence-round-trip.md` §11 for the design context.
 */
export interface CharacterDoc {
  /**
   * Globally-unique character id. Minted via `crypto.randomUUID()` at
   * `CascadingRecognizer.onDisplayFlush` time so save → re-enter → add
   * does not collide a new glyph id with a loaded one. The counter-based
   * `char-N` scheme used pre-Revision-2 caused silent overwrites on
   * re-entry — see `docs/plans/session-persistence-round-trip.md` §11.9.
   */
  id: string;
  /** The recognised glyph (e.g. "안"). */
  char: string;
  /** Centre-x in CSS pixels, matches runtime `RecognizedChar.x`. */
  x: number;
  /** Centre-y in CSS pixels. */
  y: number;
  /** Width in CSS pixels. */
  width: number;
  /** Height in CSS pixels. Rolling-averaged at recognition time. */
  height: number;
  /** Per-character font override at creation time. */
  fontId?: string;
  /** Per-character effect override at creation time. */
  effect?: string;
  /** Diagnostic — not a load-time gate. */
  confidence?: number;
}

/**
 * Full session wire contract (v2). Round-trips the complete Studio state —
 * strokes, objects, fills, per-stroke animations, and (Revision 2) recognised
 * characters for text-mode typography.
 *
 * Legacy (v1) payloads as `StrokeDoc[]` remain accepted by
 * {@link Glymo.loadSession} for backward compatibility.
 */
export interface SessionDoc {
  version: 2;
  canvas: { w: number; h: number };
  effect: {
    /**
     * Effect identifier. `core` does not constrain this to
     * {@link EffectPresetName} so the app layer can carry extended presets
     * through the wire; resolution happens in the renderer via the runtime
     * effect registry.
     */
    name: string;
    params?: Record<string, unknown>;
  };
  strokes: StrokeDoc[];
  /** Object groupings. MAY be empty. */
  objects: ObjectDoc[];
  /** Fills. MAY be empty. */
  fills: FillDoc[];
  /**
   * Recognised characters (text-mode typography). MAY be omitted entirely
   * for drawing-mode / legacy payloads. See {@link CharacterDoc} for the
   * per-character shape and Revision 2 notes in the plan document.
   */
  characters?: CharacterDoc[];
}

// ── Bitmap Injection (host-provided) ────────────────

/**
 * Host-provided uploader for fill bitmaps. `core` is framework-agnostic and
 * does not own HTTP credentials or bucket configuration; the UI layer injects
 * a concrete implementation at {@link Glymo} construction time.
 */
export interface BitmapUploader {
  /** PNG-encode `bitmap` and upload; return the public URL at rest. */
  upload(bitmap: ImageBitmap): Promise<string>;
}

/**
 * Host-provided loader for previously-uploaded fill bitmaps.
 */
export interface BitmapLoader {
  /** Fetch `url` and decode it into an ImageBitmap. */
  load(url: string): Promise<ImageBitmap>;
}

// ── Effect Presets ───────────────────────────────────

export type EffectPresetName =
  | 'neon' | 'aurora' | 'gold' | 'calligraphy' | 'fire'
  | 'liquid' | 'hologram' | 'bloom' | 'gpu-particles' | 'dissolve';

/** Effect preset names that require WebGPU */
export const GPU_EFFECT_NAMES: EffectPresetName[] = [
  'liquid', 'hologram', 'bloom', 'gpu-particles', 'dissolve',
];

/** Effect preset names available in Canvas 2D */
export const CANVAS_EFFECT_NAMES: EffectPresetName[] = [
  'neon', 'aurora', 'gold', 'calligraphy', 'fire',
];

export type SessionState = 'idle' | 'ready' | 'drawing' | 'pen_up_wait' | 'morphing' | 'recognizing' | 'exporting';

/** @deprecated Use `GlymoEventMap` for typed event payloads instead */
export type GlymoEvent =
  | 'stroke:start'
  | 'stroke:end'
  | 'morph:start'
  | 'morph:progress'
  | 'morph:complete'
  | 'effect:change'
  | 'state:change'
  | 'camera:denied'
  | 'camera:ready'
  | 'performance:degraded'
  | 'error'
  | 'text:recognized'
  | 'text:error'
  | 'text:overlay'
  | 'glyph:extracted'
  | 'text:matched'
  | 'renderer:fallback'
  | 'stroke:complete'
  | 'hand:lost'
  | 'hand:found'
  | `gesture:${string}`;

/** Typed event map — maps event names to their payload tuples */
export interface GlymoEventMap {
  'stroke:start': [];
  'stroke:end': [];
  'stroke:complete': [{ stroke: Stroke; bbox: { x: number; y: number; width: number; height: number } }];
  'morph:start': [];
  'morph:progress': [{ progress: number }];
  'morph:complete': [];
  'effect:change': [EffectPresetName];
  'state:change': [{ from: SessionState; to: SessionState; action: string }];
  'camera:denied': [Error?];
  'camera:ready': [];
  'performance:degraded': [];
  'error': [{ code: string; message: string; stage?: string }];
  'text:recognized': [{ text: string; confidence: number; characters: unknown[]; processingTimeMs: number }];
  'text:error': [{ code: string; message: string }];
  'text:overlay': [import('./text/types.js').OverlayText];
  'glyph:extracted': [];
  'text:matched': [];
  'renderer:fallback': [];
  'hand:lost': [];
  'hand:found': [];
  'object:selected': [{ objectId: string }];
  'object:deselected': [{ objectId: string }];
  'selection:changed': [{ selectedIds: string[] }];
  /**
   * Fires whenever the recognised-character store mutates — add, update
   * (correction), remove, or bulk-load. The payload carries the full
   * authoritative list so subscribers can re-render without tracking
   * individual deltas. Added for session persistence Revision 2; see
   * `docs/plans/session-persistence-round-trip.md` §11.
   */
  'character:change': [{ characters: CharacterDoc[] }];
  'correction:applied': [{ objectId: string; corrections: string[] }];
  'correction:reverted': [{ objectId: string }];
  'object:translated': [{ id: string; dx: number; dy: number }];
  /**
   * Fires at the end of {@link Glymo.loadSession} for every object whose
   * `metadata.mediaArt` contains a valid `modelId` string. The UI layer
   * (Task 3.6) subscribes to reconstruct 3D meshes for restored objects.
   *
   * Only fires when `restorations` is non-empty — sessions that never used
   * the media-art feature do not receive this event.
   */
  'media-art:restore': [{ restorations: readonly { objectId: string; modelId: string; sourceLabel: string | null }[] }];
  [key: `gesture:${string}`]: [import('./gesture/types.js').GestureEvent];
}

export type RendererMode = 'canvas2d' | 'webgpu' | 'auto';

export interface GlymoOptions {
  width?: number;
  height?: number;
  effect?: EffectPresetName;
  showRawInput?: boolean;
  rawInputColor?: string;
  autoMorph?: boolean;
  morphDelay?: number;
  maxStrokes?: number;
  pixelRatio?: number;
  textMode?: boolean;
  font?: string;
  language?: string;
  renderer?: RendererMode;
  /**
   * Host-provided uploader for Fill bitmaps. Required for {@link Glymo.exportSession}
   * when fills are present. Keeping this pluggable lets `@glymo/core` stay
   * framework-agnostic while callers supply S3/Supabase/etc. transport.
   */
  bitmapUploader?: BitmapUploader;
  /**
   * Host-provided loader for Fill bitmaps. Required for {@link Glymo.loadSession}
   * when the wire doc references remote bitmap URLs.
   */
  bitmapLoader?: BitmapLoader;
}

/** Options for the `Glymo.create()` convenience factory */
export interface CreateOptions extends GlymoOptions {
  /** Auto-bind camera on creation */
  camera?: boolean;
  /** Artistic hand rendering style */
  handStyle?: import('./input/hand-styles/types.js').HandStyleName;
  /** Enable two-hand simultaneous drawing */
  twoHands?: boolean;
  /** Always-draw mode (point to draw, fist to pause) */
  alwaysDraw?: boolean;
  /** Skip morph animation — instant stroke completion */
  instantComplete?: boolean;
  /** Transparent background (default true when camera is enabled) */
  transparentBg?: boolean;
  /** Gesture event handlers keyed by gesture name */
  onGesture?: Record<string, (event: import('./gesture/types.js').GestureEvent) => void>;
  /** Called when camera is ready */
  onReady?: () => void;
  /** Called on error (camera denied, etc.) */
  onError?: (error: Error) => void;
}

export interface GIFOptions {
  fps?: number;
  duration?: number;
  quality?: number;
  width?: number;
}

/**
 * Effect preset definitions — source of truth: design.md SS4.6.2
 *
 * Note: The core neon preset uses #00ffaa (drawing engine).
 * The landing page uses #00ffcc (brand accent / --neon-color).
 * These are intentionally different values — see design.md SS4.2 vs SS4.6.2.
 */
export const EFFECT_PRESETS: Record<EffectPresetName, EffectStyle> = {
  neon: {
    color: '#00ffaa',
    minWidth: 3,
    maxWidth: 8,
    glowColor: 'rgba(0,255,170,0.7)',
    glowSize: 40,
    particleColor: 'rgba(0,255,170,0.6)',
    gradient: ['#00ffaa', '#00ddff'],
  },
  aurora: {
    color: '#a78bfa',
    minWidth: 3,
    maxWidth: 9,
    glowColor: 'rgba(167,139,250,0.6)',
    glowSize: 35,
    particleColor: 'rgba(167,139,250,0.5)',
    gradient: ['#a78bfa', '#60a5fa', '#34d399'],
  },
  gold: {
    color: '#ffd700',
    minWidth: 3,
    maxWidth: 10,
    glowColor: 'rgba(255,215,0,0.5)',
    glowSize: 35,
    particleColor: 'rgba(255,215,0,0.5)',
    gradient: ['#ffd700', '#fff4b8', '#ffa500'],
  },
  calligraphy: {
    color: '#e8dcc8',
    minWidth: 2.5,
    maxWidth: 12,
    glowColor: 'rgba(232,220,200,0.35)',
    glowSize: 20,
    particleColor: 'rgba(232,220,200,0.4)',
    gradient: null,
  },
  fire: {
    color: '#ff6b35',
    minWidth: 3,
    maxWidth: 10,
    glowColor: 'rgba(255,107,53,0.6)',
    glowSize: 35,
    particleColor: 'rgba(255,200,50,0.6)',
    gradient: ['#ff6b35', '#ffd700', '#ff4444'],
  },

  // ── GPU Effect Presets (WebGPU required) ──────────

  liquid: {
    color: '#00ccff',
    minWidth: 2,
    maxWidth: 6,
    glowColor: 'rgba(0, 204, 255, 0.5)',
    glowSize: 30,
    particleColor: 'rgba(0, 204, 255, 0.4)',
    gradient: ['#00ccff', '#0088ff', '#00ffcc'],
  },
  hologram: {
    color: '#ff00ff',
    minWidth: 2,
    maxWidth: 5,
    glowColor: 'rgba(255, 0, 255, 0.5)',
    glowSize: 35,
    particleColor: 'rgba(255, 0, 255, 0.4)',
    gradient: ['#ff0000', '#00ff00', '#0000ff'],
  },
  bloom: {
    color: '#ffffff',
    minWidth: 2,
    maxWidth: 6,
    glowColor: 'rgba(255, 255, 255, 0.6)',
    glowSize: 40,
    particleColor: 'rgba(255, 255, 200, 0.5)',
    gradient: ['#ffffff', '#ffddaa', '#ffffff'],
  },
  'gpu-particles': {
    color: '#ff8800',
    minWidth: 2,
    maxWidth: 5,
    glowColor: 'rgba(255, 136, 0, 0.5)',
    glowSize: 25,
    particleColor: 'rgba(255, 200, 50, 0.6)',
    gradient: ['#ff8800', '#ffcc00', '#ff4400'],
  },
  dissolve: {
    color: '#88aaff',
    minWidth: 2,
    maxWidth: 6,
    glowColor: 'rgba(136, 170, 255, 0.4)',
    glowSize: 30,
    particleColor: 'rgba(136, 170, 255, 0.5)',
    gradient: ['#88aaff', '#aaccff', '#6688ff'],
  },
} as const;
