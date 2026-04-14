import { EffectPresetName, Fill, GlymoObject, GlymoOptions, GIFOptions, GlymoEventMap, Stroke, SessionState, RendererMode, CreateOptions, CorrectionOptions } from './types.js';
import { AnimationParams } from './animation/types.js';
import { ObjectStore } from './store/ObjectStore.js';
import { GIFExportOptions } from './export/GIFExporter.js';
import { LayoutMode, TypographyMode } from './text/types.js';
import { KineticEngine } from './text/KineticEngine.js';
import { GestureEngine } from './gesture/GestureEngine.js';
import { GestureDetectorFn } from './gesture/types.js';
import { HandStyleName } from './input/hand-styles/types.js';
export declare class Glymo {
    private readonly canvas;
    private readonly options;
    private readonly eventBus;
    private readonly inputManager;
    private readonly pipeline;
    private renderer;
    private readonly stateMachine;
    private webgpuAvailable;
    private strokes;
    private fills;
    private currentEffect;
    private morphAnimator;
    private readonly strokeAnimator;
    private readonly objectStore;
    private pendingStroke;
    private destroyed;
    private instantComplete;
    private _customColor;
    private _customWidth;
    private _pendingCustomColor;
    private _pendingCustomWidth;
    private _pausedAnimations;
    private _pausedObjectAnimations;
    private readonly pipeline2;
    private secondHandPenIsDown;
    private readonly gestureEngine;
    private overlayTimer;
    private readonly selectionManager;
    private readonly strokeCorrector;
    private readonly smoothStageRef;
    private autoCorrectEnabled;
    private textPipeline;
    private accumulatedStrokes;
    private kineticEngine;
    constructor(canvas: HTMLCanvasElement, options?: GlymoOptions);
    bindMouse(): void;
    bindCamera(): Promise<void>;
    /** Get the camera video element (only valid while camera is active) */
    getCameraVideoElement(): HTMLVideoElement | null;
    /**
     * Enable simultaneous two-hand drawing.
     * The second hand (hand index 1) draws independently using pinch detection.
     * Second-hand strokes always use instant-complete (no morph animation) to
     * avoid conflicts with the first hand's state machine.
     * Call with false to disable second-hand drawing.
     */
    setTwoHandDrawing(enabled: boolean): void;
    /** Set callback for raw hand landmark data (for HandVisualizer overlay) */
    setCameraLandmarkCallback(cb: ((landmarks: import('./input/CameraCapture.js').Landmark[], isPinching: boolean, secondHand?: import('./input/CameraCapture.js').Landmark[]) => void) | null): void;
    unbind(): void;
    /**
     * Define a custom gesture recognizer.
     * The detector is evaluated every frame and fires `gesture:${name}` events.
     */
    gesture(name: string, detector: GestureDetectorFn): void;
    /** Get direct access to the gesture engine for advanced use */
    getGestureEngine(): GestureEngine;
    /** Set the artistic hand rendering style */
    setHandStyle(name: HandStyleName): void;
    /** Get the currently configured hand style name */
    getHandStyle(): HandStyleName;
    private _handStyleName?;
    /**
     * One-line convenience factory.
     * Sets up camera, effects, gestures, and hand style in a single call.
     *
     * ```ts
     * const glymo = await Glymo.create(canvas, {
     *   camera: true,
     *   effect: 'neon',
     *   handStyle: 'crystal',
     *   twoHands: true,
     *   onGesture: { 'fist': () => glymo.undo() },
     * });
     * ```
     */
    static create(canvas: HTMLCanvasElement, options?: CreateOptions): Promise<Glymo>;
    setEffect(name: EffectPresetName): void;
    getEffect(): EffectPresetName;
    getAvailableEffects(): EffectPresetName[];
    setTextMode(enabled: boolean): void;
    isTextMode(): boolean;
    setFont(font: string): void;
    getFont(): string;
    setTypographyMode(mode: TypographyMode): void;
    getTypographyMode(): TypographyMode;
    /** Set pre-typed text (bypasses OCR — uses this text directly for transformation) */
    setPresetText(text: string): void;
    /** Skip morph animation — strokes complete instantly with effect applied */
    setInstantComplete(skip: boolean): void;
    /** Set external Worker URL for off-thread MediaPipe detection. Must be called before bindCamera(). */
    setWorkerUrl(url: string): void;
    /** Enable gesture-based draw mode: ☝️ point = draw, ✊ fist = don't draw */
    setCameraAlwaysDrawMode(enabled: boolean): void;
    /** Pause/resume all drawing input. Hand tracking + landmarks still fire. */
    setDrawingPaused(paused: boolean): void;
    /** Set callback for transit move events (fast hand movement between letters) */
    setTransitMoveCallback(cb: ((x: number, y: number) => void) | null): void;
    setLayoutMode(mode: LayoutMode): void;
    getLayoutMode(): LayoutMode;
    getKineticEngine(): KineticEngine;
    /** Animate one or more strokes with the given animation parameters. Returns an animation ID. */
    animateStrokes(strokeIds: string[], params: AnimationParams): string;
    /** Stop a specific animation by its ID */
    stopAnimation(animationId: string): void;
    /** Stop all active stroke animations */
    stopAllAnimations(): void;
    /** Stop all animations targeting the given stroke IDs */
    stopAnimations(strokeIds: string[]): void;
    /** Store a custom color for newly created strokes. Pass null to clear. */
    setCustomColor(color: string | null): void;
    /** Store a custom width for newly created strokes. Pass null to clear. */
    setCustomWidth(width: number | null): void;
    /**
     * Find which completed stroke is at the given (x, y) canvas coordinate.
     * Iterates strokes in reverse order (most recent on top).
     * Returns the stroke id if min distance from (x,y) to any smoothed point < radius, else null.
     */
    hitTestStroke(x: number, y: number, radius?: number): string | null;
    /** Add a fill to the canvas */
    addFill(fill: Fill): void;
    /** Remove the last fill (undo) */
    undoFill(): Fill | undefined;
    /** Clear all fills */
    clearFills(): void;
    /** Get all completed strokes (read-only, for external use like fill mask) */
    getStrokes(): readonly Stroke[];
    /** Get canvas dimensions */
    getCanvasSize(): {
        width: number;
        height: number;
        dpr: number;
    };
    /**
     * Toggle a default sparkle animation on a specific stroke.
     * If the stroke already has an animation, stop it and return false.
     * If it doesn't, add a sparkle animation and return true.
     */
    toggleStrokeAnimation(strokeId: string, params?: AnimationParams): boolean;
    /** Create a GlymoObject grouping existing strokes. Returns the new object. */
    createObject(strokeIds: string[], bbox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    }): GlymoObject;
    /** Add a fill to an existing object (fill follows the object's animation) */
    addFillToObject(objectId: string, fill: Fill): void;
    /** Find the GlymoObject that contains a specific stroke */
    getObjectByStrokeId(strokeId: string): GlymoObject | undefined;
    /** Find the nearest GlymoObject at a canvas point (hit tests strokes) */
    getObjectByPoint(x: number, y: number, radius?: number): GlymoObject | undefined;
    /** Get direct access to the ObjectStore */
    getObjectStore(): ObjectStore;
    /**
     * Toggle animation on an entire object (all strokes animated together).
     * Returns true if animation was turned ON, false if turned OFF.
     */
    toggleObjectAnimation(objectId: string, params?: AnimationParams): boolean;
    /**
     * Undo the last GlymoObject: removes its strokes, fills, and animations.
     * Returns the removed object or undefined if no objects exist.
     */
    undoObject(): GlymoObject | undefined;
    /** Hit-test a point and toggle selection on the object at that position */
    selectObjectAtPoint(x: number, y: number): GlymoObject | undefined;
    /** Toggle selection on a specific object */
    toggleObjectSelection(objectId: string): void;
    /** Clear all selection */
    clearSelection(): void;
    /** Get IDs of all selected objects */
    getSelectedObjectIds(): string[];
    /** Check if any objects are currently selected */
    hasSelection(): boolean;
    /** Apply endpoint snapping + overshoot trimming to a specific object */
    polishObject(objectId: string, options?: CorrectionOptions): boolean;
    /** Apply correction to all selected objects */
    polishSelectedObjects(options?: CorrectionOptions): void;
    /** Revert correction on a specific object, restoring original raw + smoothed */
    revertObject(objectId: string): boolean;
    /** Revert correction on all selected objects */
    revertSelectedObjects(): void;
    /** Enable/disable auto-correction on new strokes */
    setAutoCorrect(enabled: boolean): void;
    /** Check if auto-correction is enabled */
    isAutoCorrectEnabled(): boolean;
    /** Switch the rendering backend ('canvas2d' | 'webgpu' | 'auto') */
    setRenderer(mode: RendererMode): Promise<void>;
    isWebGPU(): boolean;
    /**
     * Switch between a solid black background and a transparent one.
     * Use 'transparent' when a camera video feed is shown behind the canvas.
     */
    setBackgroundMode(mode: 'solid' | 'transparent'): void;
    clear(): void;
    undo(): void;
    /** Fade out the last completed stroke over durationMs (dissolve effect), then remove it */
    fadeOutLastStroke(durationMs?: number): void;
    /** Fade out a specific stroke by ID */
    fadeOutStrokeById(strokeId: string, durationMs?: number): void;
    getStrokeCount(): number;
    /** Get IDs of all completed strokes */
    getStrokeIds(): string[];
    getState(): SessionState;
    exportPNG(): Promise<Blob>;
    exportGIF(options?: GIFOptions & GIFExportOptions): Promise<Blob>;
    on<K extends keyof GlymoEventMap>(event: K, handler: (...args: GlymoEventMap[K]) => void): () => void;
    destroy(): void;
    private wireInput;
    private wireMorphComplete;
    private wireTextMorph;
    /** Connect the StrokeAnimator to the current renderer (CanvasRenderer only) */
    private wireStrokeAnimator;
    /** Connect the ObjectStore to the current renderer (CanvasRenderer only) */
    private wireObjectStore;
    private wireSelectionManager;
    private handlePenDown;
    private handlePenUp;
    private handleSecondHandPenDown;
    private handleSecondHandPenUp;
    private triggerTextOverlay;
    private startMorph;
    private completeMorph;
    private cancelMorph;
    private computeStrokeBounds;
    /** Compute combined bounding box for strokes by their IDs */
    private computeStrokeBoundsForIds;
    private enforceMaxStrokes;
    private assertNotDestroyed;
    /** Replace the current renderer, preserving strokes. Pass null for Canvas 2D. */
    private replaceRenderer;
}
