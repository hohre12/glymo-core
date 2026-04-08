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

/** Structured error for pipeline failures */
export interface GlymoError {
  code: string;
  message: string;
  stage?: string;
  originalError?: Error;
  recoverable: boolean;
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
