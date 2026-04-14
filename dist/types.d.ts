/** A single point in a stroke with timestamp and pressure */
export interface StrokePoint {
    x: number;
    y: number;
    t: number;
    pressure: number;
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
    r: number;
    g: number;
    b: number;
}
/** Visual parameters for a single effect preset */
export interface EffectStyle {
    color: string;
    minWidth: number;
    maxWidth: number;
    glowColor: string;
    glowSize: number;
    particleColor: string;
    gradient: string[] | null;
}
/** A single particle in the particle system */
export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    decay: number;
    size: number;
    color: string;
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
    globalProgress: number;
    isComplete: boolean;
}
/** Raw point emitted by an input source before pipeline processing */
export interface RawInputPoint {
    x: number;
    y: number;
    t: number;
    source: 'mouse' | 'touch' | 'camera';
    pressure?: number;
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
    process(input: StrokePoint): StrokePoint;
    reset(): void;
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
    order: number;
    render(ctx: CanvasRenderingContext2D, dt: number): void;
    isVisible: boolean;
}
/** A filled region produced by the paint-bucket / flood-fill tool */
export interface Fill {
    id: string;
    color: string;
    bitmap: ImageBitmap;
    createdAt: number;
}
/** A grouped drawing object: strokes + fills animated as a single unit */
export interface GlymoObject {
    id: string;
    strokeIds: string[];
    fillIds: string[];
    bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    createdAt: number;
    animationId?: string;
    metadata?: Record<string, unknown>;
}
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
/** A completed or in-progress stroke */
export interface Stroke {
    id: string;
    raw: StrokePoint[];
    smoothed: StrokePoint[];
    state: 'drawing' | 'smoothing' | 'effected';
    effect: EffectPresetName;
    createdAt: number;
    customColor?: string;
    customWidth?: number;
}
/** Session-level canvas state */
export interface CanvasSession {
    strokes: Stroke[];
    activeStroke: Stroke | null;
    effect: EffectPresetName;
    canvas: {
        width: number;
        height: number;
        dpr: number;
    };
    particles: Particle[];
    isExporting: boolean;
}
/** Structured error for pipeline failures */
export interface GlymoError {
    code: string;
    message: string;
    stage?: string;
    originalError?: Error;
    recoverable: boolean;
}
export type EffectPresetName = 'neon' | 'aurora' | 'gold' | 'calligraphy' | 'fire' | 'liquid' | 'hologram' | 'bloom' | 'gpu-particles' | 'dissolve';
/** Effect preset names that require WebGPU */
export declare const GPU_EFFECT_NAMES: EffectPresetName[];
/** Effect preset names available in Canvas 2D */
export declare const CANVAS_EFFECT_NAMES: EffectPresetName[];
export type SessionState = 'idle' | 'ready' | 'drawing' | 'pen_up_wait' | 'morphing' | 'recognizing' | 'exporting';
/** @deprecated Use `GlymoEventMap` for typed event payloads instead */
export type GlymoEvent = 'stroke:start' | 'stroke:end' | 'morph:start' | 'morph:progress' | 'morph:complete' | 'effect:change' | 'state:change' | 'camera:denied' | 'camera:ready' | 'performance:degraded' | 'error' | 'text:recognized' | 'text:error' | 'text:overlay' | 'glyph:extracted' | 'text:matched' | 'renderer:fallback' | 'stroke:complete' | 'hand:lost' | 'hand:found' | `gesture:${string}`;
/** Typed event map — maps event names to their payload tuples */
export interface GlymoEventMap {
    'stroke:start': [];
    'stroke:end': [];
    'stroke:complete': [{
        stroke: Stroke;
        bbox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }];
    'morph:start': [];
    'morph:progress': [{
        progress: number;
    }];
    'morph:complete': [];
    'effect:change': [EffectPresetName];
    'state:change': [{
        from: SessionState;
        to: SessionState;
        action: string;
    }];
    'camera:denied': [Error?];
    'camera:ready': [];
    'performance:degraded': [];
    'error': [{
        code: string;
        message: string;
        stage?: string;
    }];
    'text:recognized': [{
        text: string;
        confidence: number;
        characters: unknown[];
        processingTimeMs: number;
    }];
    'text:error': [{
        code: string;
        message: string;
    }];
    'text:overlay': [import('./text/types.js').OverlayText];
    'glyph:extracted': [];
    'text:matched': [];
    'renderer:fallback': [];
    'hand:lost': [];
    'hand:found': [];
    'object:selected': [{
        objectId: string;
    }];
    'object:deselected': [{
        objectId: string;
    }];
    'selection:changed': [{
        selectedIds: string[];
    }];
    'correction:applied': [{
        objectId: string;
        corrections: string[];
    }];
    'correction:reverted': [{
        objectId: string;
    }];
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
export declare const EFFECT_PRESETS: Record<EffectPresetName, EffectStyle>;
