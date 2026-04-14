import { EffectPresetName, Fill, Stroke, StrokePoint } from '../types.js';
import { MorphAnimator } from '../animate/MorphAnimator.js';
import { FontMorphAnimator } from '../text/FontMorphAnimator.js';
import { EventBus } from '../state/EventBus.js';
import { IRenderer, RendererType } from './IRenderer.js';
import { OverlayText } from '../text/types.js';
import { StrokeAnimator } from '../animation/StrokeAnimator.js';
import { ObjectStore } from '../store/ObjectStore.js';
import { SelectionManager } from '../selection/SelectionManager.js';
/**
 * Stage 6: EFFECT — Canvas 2D Rendering (design.md SS4.6)
 *
 * RAF loop with 6-layer compositing.
 * Layers: bg(0), completed(10), morphing(20), active(30), particles(40), ui(50)
 */
export declare class CanvasRenderer implements IRenderer {
    readonly type: RendererType;
    private readonly ctx;
    private readonly canvas;
    private readonly dpr;
    private readonly particleSystem;
    private readonly perfMonitor;
    private eventBus;
    private animationId;
    private lastFrameTime;
    private degradedEmitted;
    private completedStrokes;
    private activePoints;
    private activeEffect;
    private overlayTexts;
    private fadingStrokes;
    private morphAnimator;
    private fontMorphAnimator;
    private backgroundMode;
    private morphBurstFired;
    private lastSparkleSpawn;
    private static readonly SPARKLE_INTERVAL;
    private completedCache;
    private completedCacheCtx;
    private completedCacheDirty;
    private fills;
    private strokeAnimator;
    private objectStore;
    private selectionManager;
    private getActivePointsFn;
    constructor(canvas: HTMLCanvasElement, dpr?: number);
    /** Attach an EventBus for emitting performance events */
    setEventBus(bus: EventBus): void;
    /** Start the render loop */
    start(): void;
    /** Stop the render loop */
    stop(): void;
    /** Set the function that provides active stroke points */
    setActivePointsSource(fn: () => ReadonlyArray<StrokePoint>): void;
    /** Set or clear the active morph animator (layer 20) */
    setMorphAnimator(animator: MorphAnimator | null): void;
    /** Set or clear the FontMorphAnimator for text morph rendering */
    setFontMorphAnimator(animator: FontMorphAnimator | null): void;
    /** Set the StrokeAnimator for per-stroke animation transforms */
    setStrokeAnimator(animator: StrokeAnimator | null): void;
    /** Set the ObjectStore for object-aware fill rendering */
    setObjectStore(store: ObjectStore | null): void;
    /** Set the SelectionManager for rendering selection highlights */
    setSelectionManager(manager: SelectionManager | null): void;
    /** Mark completed strokes cache as dirty (triggers re-render) */
    markDirty(): void;
    /** Set background rendering mode — 'transparent' skips the black fill */
    setBackgroundMode(mode: 'solid' | 'transparent'): void;
    /** Add a completed stroke for rendering */
    addCompletedStroke(stroke: Stroke): void;
    /** Remove the last completed stroke (undo) */
    removeLastStroke(): Stroke | undefined;
    /** Remove a specific completed stroke by ID (immediate, no fade) */
    removeStrokeById(strokeId: string): Stroke | undefined;
    /** Fade out the last completed stroke over durationMs, then auto-remove */
    fadeOutLastStroke(durationMs: number): Stroke | undefined;
    /** Fade out a specific stroke by ID over durationMs, then auto-remove */
    fadeOutStrokeById(strokeId: string, durationMs: number): Stroke | undefined;
    /** Clear all strokes, fills, and particles */
    clearAll(): void;
    /** Set an overlay text to render above strokes (Mode A) */
    setOverlayText(overlay: OverlayText | null): void;
    /** Clear all overlay texts and fading strokes */
    clearOverlayText(): void;
    /** Set the current effect preset */
    setEffect(name: EffectPresetName): void;
    /** Get the current effect preset */
    getEffect(): EffectPresetName;
    /** Get current stroke count */
    getStrokeCount(): number;
    /** Add a fill bitmap to render below strokes */
    addFill(fill: Fill): void;
    /** Remove the last fill (undo) */
    removeLastFill(): Fill | undefined;
    /** Remove a specific fill by ID */
    removeFillById(fillId: string): Fill | undefined;
    /** Clear all fills */
    clearFills(): void;
    /** Get current fill count */
    getFillCount(): number;
    /** Destroy renderer and release resources */
    destroy(): void;
    private setupCanvas;
    private renderLoop;
    /**
     * Orchestrate morph layer — manages animator state and particle burst,
     * then delegates pure rendering to the extracted layer function.
     */
    private renderMorphLayer;
    /**
     * Orchestrate text morph layer — reads animator frame and delegates rendering.
     */
    private renderTextMorphLayer;
    /** Spawn sparkle particles along strokes with active sparkle animations */
    private spawnSparkleParticles;
    private emitDegradedIfNeeded;
}
