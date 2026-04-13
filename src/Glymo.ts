// ── Glymo Main Class ────────────────────────────────

import type { EffectPresetName, Fill, GlymoObject, GlymoOptions, GIFOptions, GlymoEventMap, Stroke, SessionState, RendererMode, StrokePoint, CreateOptions, CorrectionOptions, CorrectionMetadata } from './types.js';
import { GPU_EFFECT_NAMES, CANVAS_EFFECT_NAMES, EFFECT_PRESETS } from './types.js';
import { InputManager } from './input/InputManager.js';
import { PipelineEngine } from './pipeline/PipelineEngine.js';
import type { FinalizedStroke } from './pipeline/PipelineEngine.js';
import { CanvasRenderer } from './render/CanvasRenderer.js';
import { WebGPURenderer } from './render/WebGPURenderer.js';
import type { IRenderer } from './render/IRenderer.js';
import { EventBus } from './state/EventBus.js';
import { SessionStateMachine } from './state/SessionStateMachine.js';
import { MorphAnimator } from './animate/MorphAnimator.js';
import { StrokeAnimator } from './animation/StrokeAnimator.js';
import type { AnimationParams } from './animation/types.js';
import { ObjectStore } from './store/ObjectStore.js';
import { exportPNG } from './export/PNGExporter.js';
import { exportGIF as exportGIFImpl } from './export/GIFExporter.js';
import type { GIFExportOptions } from './export/GIFExporter.js';
import { DEFAULT_TEXT_MODE_CONFIG } from './text/types.js';
import type { LayoutMode, TypographyMode } from './text/types.js';
import { TextPipelineController } from './text/TextPipelineController.js';
import { KineticEngine } from './text/KineticEngine.js';
import { GestureEngine } from './gesture/GestureEngine.js';
import type { GestureDetectorFn } from './gesture/types.js';
import type { HandStyleName } from './input/hand-styles/types.js';
import { computeBounds } from './util/math.js';
import { SelectionManager } from './selection/SelectionManager.js';
import { StrokeCorrector } from './correction/StrokeCorrector.js';
import { SmoothStage } from './pipeline/stages/SmoothStage.js';

// ── Constants ────────────────────────────────────────

const DEFAULT_EFFECT: EffectPresetName = 'neon';
const MAX_STROKES = 50;
const CLEAR_FADE_MS = 300;

// ── Main Class ───────────────────────────────────────

export class Glymo {
  private readonly canvas: HTMLCanvasElement;
  private readonly options: Required<Pick<GlymoOptions, 'effect' | 'maxStrokes' | 'pixelRatio'>>;

  private readonly eventBus: EventBus;
  private readonly inputManager: InputManager;
  private readonly pipeline: PipelineEngine;
  private renderer: IRenderer;
  private readonly stateMachine: SessionStateMachine;
  private webgpuAvailable = false;

  private strokes: Stroke[] = [];
  private fills: Fill[] = [];
  private currentEffect: EffectPresetName;
  private morphAnimator: MorphAnimator | null = null;
  private readonly strokeAnimator: StrokeAnimator;
  private readonly objectStore: ObjectStore;
  private pendingStroke: FinalizedStroke | null = null;
  private destroyed = false;
  private instantComplete = false;
  private _customColor: string | null = null;
  private _customWidth: number | null = null;
  private _pendingCustomColor: string | null = null;
  private _pendingCustomWidth: number | null = null;
  private _pausedAnimations: Map<string, AnimationParams> = new Map();
  private _pausedObjectAnimations: Map<string, AnimationParams> = new Map();

  // Second-hand drawing pipeline — runs fully independently from hand 0.
  // Always uses instant-complete (no morph) to avoid state machine conflicts.
  private readonly pipeline2: PipelineEngine;
  private secondHandPenIsDown = false;

  // Gesture recognition engine — evaluates all registered gestures each frame
  private readonly gestureEngine: GestureEngine;

  // Preset text overlay timer — bypasses the morph pipeline entirely
  private overlayTimer: ReturnType<typeof setTimeout> | null = null;

  // Selection & Correction
  private readonly selectionManager: SelectionManager;
  private readonly strokeCorrector = new StrokeCorrector();
  private readonly smoothStageRef = new SmoothStage();
  private autoCorrectEnabled = false;

  // Text mode
  private textPipeline: TextPipelineController;
  private accumulatedStrokes: FinalizedStroke[] = [];
  private kineticEngine: KineticEngine;

  constructor(canvas: HTMLCanvasElement, options?: GlymoOptions) {
    this.canvas = canvas;
    this.currentEffect = options?.effect ?? DEFAULT_EFFECT;
    this.options = {
      effect: this.currentEffect,
      maxStrokes: options?.maxStrokes ?? MAX_STROKES,
      pixelRatio: options?.pixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
    };

    this.eventBus = new EventBus();
    this.pipeline = new PipelineEngine(this.eventBus);
    this.pipeline2 = new PipelineEngine(this.eventBus);
    this.strokeAnimator = new StrokeAnimator();
    this.objectStore = new ObjectStore();
    this.selectionManager = new SelectionManager(this.eventBus);
    this.renderer = new CanvasRenderer(canvas, this.options.pixelRatio);
    this.inputManager = new InputManager();
    this.stateMachine = new SessionStateMachine(this.eventBus);
    this.gestureEngine = new GestureEngine((event, data) => {
      this.eventBus.emit(event, data);
    });

    const textConfig = {
      ...DEFAULT_TEXT_MODE_CONFIG,
      enabled: options?.textMode ?? false,
      ...(options?.font ? { font: options.font } : {}),
      ...(options?.language ? { language: options.language } : {}),
    };
    this.textPipeline = new TextPipelineController(textConfig, this.eventBus, this.stateMachine);
    this.kineticEngine = new KineticEngine();

    this.wireInput();
    this.wireMorphComplete();
    this.wireTextMorph();
    this.renderer.setEventBus(this.eventBus);
    this.renderer.setEffect(this.currentEffect);
    this.renderer.setActivePointsSource(() => this.pipeline.getActivePoints());
    this.wireStrokeAnimator();
    this.wireObjectStore();
    this.wireSelectionManager();
    this.renderer.start();
    this.stateMachine.transition('init');

    if (textConfig.enabled) {
      this.textPipeline.setEnabled(true);
    }
  }

  // ── Input ──────────────────────────────────────────
  bindMouse(): void {
    this.assertNotDestroyed();
    this.pipeline.setInputSource('mouse');
    this.inputManager.attachMouse(this.canvas);
  }

  async bindCamera(): Promise<void> {
    this.assertNotDestroyed();
    this.pipeline.setInputSource('camera');
    this.pipeline2.setInputSource('camera');
    this.inputManager.setErrorCallback((err) => { this.eventBus.emit('camera:denied', err); });
    this.inputManager.setSuccessCallback(() => {
      this.eventBus.emit('camera:ready');
      // Wire gesture engine to receive raw landmarks every frame
      this.inputManager.getCameraCapture()?.setGestureCallback((lm, secondHand) => {
        this.gestureEngine.update(lm, secondHand);
      });
    });
    this.inputManager.attachCamera(this.canvas);
  }

  /** Get the camera video element (only valid while camera is active) */
  getCameraVideoElement(): HTMLVideoElement | null {
    return this.inputManager.getCameraCapture()?.getVideoElement() ?? null;
  }

  /**
   * Enable simultaneous two-hand drawing.
   * The second hand (hand index 1) draws independently using pinch detection.
   * Second-hand strokes always use instant-complete (no morph animation) to
   * avoid conflicts with the first hand's state machine.
   * Call with false to disable second-hand drawing.
   */
  setTwoHandDrawing(enabled: boolean): void {
    this.assertNotDestroyed();
    if (enabled) {
      this.pipeline2.setInputSource('camera');
      this.inputManager.setSecondHandCallbacks(
        (raw) => { this.pipeline2.processPoint(raw); },
        (isDown) => {
          if (isDown) {
            this.handleSecondHandPenDown();
          } else {
            this.handleSecondHandPenUp();
          }
        },
      );
    } else {
      this.inputManager.setSecondHandCallbacks(null, null);
      if (this.secondHandPenIsDown) {
        this.pipeline2.penUp();
        this.pipeline2.reset();
        this.secondHandPenIsDown = false;
      }
    }
  }

  /** Set callback for raw hand landmark data (for HandVisualizer overlay) */
  setCameraLandmarkCallback(cb: ((landmarks: import('./input/CameraCapture.js').Landmark[], isPinching: boolean, secondHand?: import('./input/CameraCapture.js').Landmark[]) => void) | null): void {
    this.inputManager.getCameraCapture()?.setLandmarkCallback(cb);
  }

  unbind(): void { this.inputManager.detachAll(); }

  // ── Gesture DSL ──────────────────────────────────────

  /**
   * Define a custom gesture recognizer.
   * The detector is evaluated every frame and fires `gesture:${name}` events.
   */
  gesture(name: string, detector: GestureDetectorFn): void {
    this.gestureEngine.define(name, detector);
  }

  /** Get direct access to the gesture engine for advanced use */
  getGestureEngine(): GestureEngine { return this.gestureEngine; }

  // ── Hand Style ───────────────────────────────────────

  /** Set the artistic hand rendering style */
  setHandStyle(name: HandStyleName): void {
    // HandVisualizer is created externally — expose through InputManager
    // This is a convenience for when the user manages HandVisualizer themselves.
    // The camera page creates its own HandVisualizer and should call
    // handVisualizer.setStyle(name) directly.
    this._handStyleName = name;
  }

  /** Get the currently configured hand style name */
  getHandStyle(): HandStyleName { return this._handStyleName ?? 'neon-skeleton'; }

  private _handStyleName?: HandStyleName;

  // ── Static Factory ───────────────────────────────────

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
  static async create(canvas: HTMLCanvasElement, options?: CreateOptions): Promise<Glymo> {
    const glymo = new Glymo(canvas, options);

    if (options?.transparentBg ?? options?.camera) {
      glymo.setBackgroundMode('transparent');
    }
    if (options?.textMode) {
      glymo.setTextMode(true);
    }
    if (options?.instantComplete) {
      glymo.setInstantComplete(true);
    }
    if (options?.handStyle) {
      glymo.setHandStyle(options.handStyle);
    }
    if (options?.onGesture) {
      for (const [name, handler] of Object.entries(options.onGesture)) {
        glymo.on(`gesture:${name}`, handler);
      }
    }
    if (options?.onReady) {
      glymo.on('camera:ready', options.onReady);
    }
    if (options?.onError) {
      glymo.on('camera:denied', (error?: Error) => options.onError!(error ?? new Error('Camera denied')));
    }
    if (options?.camera) {
      await glymo.bindCamera();
      if (options?.twoHands) {
        glymo.setTwoHandDrawing(true);
      }
      if (options?.alwaysDraw) {
        glymo.setCameraAlwaysDrawMode(true);
      }
    }

    return glymo;
  }

  // ── Effects ────────────────────────────────────────
  setEffect(name: EffectPresetName): void {
    this.currentEffect = name;
    this.renderer.setEffect(name);
    this.eventBus.emit('effect:change', name);
    this.textPipeline.setEffect(name);

    // Auto-switch renderer when selecting GPU vs Canvas effects
    const needsGPU = GPU_EFFECT_NAMES.includes(name);
    const isGPU = this.renderer.type === 'webgpu';
    if (needsGPU && !isGPU) {
      this.setRenderer('webgpu').catch((err) => {
        this.eventBus.emit('error', { code: 'RENDERER_SWITCH_FAILED', message: String(err) });
      });
    } else if (!needsGPU && isGPU) {
      this.setRenderer('canvas2d').catch((err) => {
        this.eventBus.emit('error', { code: 'RENDERER_SWITCH_FAILED', message: String(err) });
      });
    }
  }

  getEffect(): EffectPresetName { return this.currentEffect; }

  getAvailableEffects(): EffectPresetName[] {
    const base: EffectPresetName[] = [...CANVAS_EFFECT_NAMES];
    if (this.webgpuAvailable) base.push(...GPU_EFFECT_NAMES);
    return base;
  }

  // ── Text Mode ─────────────────────────────────────
  setTextMode(enabled: boolean): void { this.assertNotDestroyed(); this.textPipeline.setEnabled(enabled); }
  isTextMode(): boolean { return this.textPipeline.enabled; }
  setFont(font: string): void { this.textPipeline.setFont(font); }
  getFont(): string { return this.textPipeline.getFont(); }

  setTypographyMode(mode: TypographyMode): void {
    this.assertNotDestroyed();
    this.textPipeline.setTypographyMode(mode);
  }

  getTypographyMode(): TypographyMode {
    return this.textPipeline.getTypographyMode();
  }

  /** Set pre-typed text (bypasses OCR — uses this text directly for transformation) */
  setPresetText(text: string): void {
    this.assertNotDestroyed();
    this.textPipeline.setPresetText(text);
  }

  /** Skip morph animation — strokes complete instantly with effect applied */
  setInstantComplete(skip: boolean): void {
    this.assertNotDestroyed();
    this.instantComplete = skip;
  }

  /** Set external Worker URL for off-thread MediaPipe detection. Must be called before bindCamera(). */
  setWorkerUrl(url: string): void {
    this.assertNotDestroyed();
    this.inputManager.setWorkerUrl(url);
  }

  /** Enable gesture-based draw mode: ☝️ point = draw, ✊ fist = don't draw */
  setCameraAlwaysDrawMode(enabled: boolean): void {
    this.assertNotDestroyed();
    this.inputManager.setCameraAlwaysDrawMode(enabled);
    // Wire hand visibility events
    this.inputManager.setHandVisibilityCallback((visible) => {
      this.eventBus.emit(visible ? 'hand:found' : 'hand:lost');
    });
  }

  /** Pause/resume all drawing input. Hand tracking + landmarks still fire. */
  setDrawingPaused(paused: boolean): void {
    this.assertNotDestroyed();
    this.inputManager.setDrawingPaused(paused);
  }

  /** Set callback for transit move events (fast hand movement between letters) */
  setTransitMoveCallback(cb: ((x: number, y: number) => void) | null): void {
    this.assertNotDestroyed();
    this.inputManager.setTransitMoveCallback(cb);
  }

  // ── Layout Mode ───────────────────────────────────
  setLayoutMode(mode: LayoutMode): void { this.assertNotDestroyed(); this.kineticEngine.setLayoutMode(mode); }
  getLayoutMode(): LayoutMode { return this.kineticEngine.getLayoutMode(); }
  getKineticEngine(): KineticEngine { return this.kineticEngine; }

  // ── Stroke Animation ─────────────────────────────

  /** Animate one or more strokes with the given animation parameters. Returns an animation ID. */
  animateStrokes(strokeIds: string[], params: AnimationParams): string {
    this.assertNotDestroyed();
    return this.strokeAnimator.addAnimation(strokeIds, params);
  }

  /** Stop a specific animation by its ID */
  stopAnimation(animationId: string): void {
    this.assertNotDestroyed();
    this.strokeAnimator.removeAnimation(animationId);
  }

  /** Stop all active stroke animations */
  stopAllAnimations(): void {
    this.assertNotDestroyed();
    this.strokeAnimator.clear();
  }

  /** Stop all animations targeting the given stroke IDs */
  stopAnimations(strokeIds: string[]): void {
    this.assertNotDestroyed();
    for (const id of strokeIds) {
      this.strokeAnimator.removeByStrokeId(id);
    }
  }

  // ── Per-stroke Custom Color/Width ────────────────────

  /** Store a custom color for newly created strokes. Pass null to clear. */
  setCustomColor(color: string | null): void {
    this.assertNotDestroyed();
    this._customColor = color;
  }

  /** Store a custom width for newly created strokes. Pass null to clear. */
  setCustomWidth(width: number | null): void {
    this.assertNotDestroyed();
    this._customWidth = width;
  }

  // ── Hit Testing ──────────────────────────────────────

  /**
   * Find which completed stroke is at the given (x, y) canvas coordinate.
   * Iterates strokes in reverse order (most recent on top).
   * Returns the stroke id if min distance from (x,y) to any smoothed point < radius, else null.
   */
  hitTestStroke(x: number, y: number, radius: number = 20): string | null {
    this.assertNotDestroyed();
    const dpr = this.options.pixelRatio;
    const px = x * dpr;
    const py = y * dpr;
    const r2 = (radius * dpr) * (radius * dpr);

    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const stroke = this.strokes[i]!;
      const points = stroke.smoothed;
      for (let j = 0; j < points.length; j++) {
        const dx = points[j]!.x - px;
        const dy = points[j]!.y - py;
        if (dx * dx + dy * dy < r2) {
          return stroke.id;
        }
      }
    }
    return null;
  }

  // ── Fill Tool ────────────────────────────────────────

  /** Add a fill to the canvas */
  addFill(fill: Fill): void {
    this.assertNotDestroyed();
    this.fills.push(fill);
    this.renderer.addFill(fill);
  }

  /** Remove the last fill (undo) */
  undoFill(): Fill | undefined {
    this.assertNotDestroyed();
    const removed = this.renderer.removeLastFill();
    if (removed) {
      this.fills = this.fills.filter(f => f.id !== removed.id);
    }
    return removed;
  }

  /** Clear all fills */
  clearFills(): void {
    this.assertNotDestroyed();
    this.fills = [];
    this.renderer.clearFills();
  }

  /** Get all completed strokes (read-only, for external use like fill mask) */
  getStrokes(): readonly Stroke[] {
    this.assertNotDestroyed();
    return this.strokes;
  }

  /** Get canvas dimensions */
  getCanvasSize(): { width: number; height: number; dpr: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
      dpr: this.options.pixelRatio,
    };
  }

  // ── Toggle Stroke Animation ──────────────────────────

  /**
   * Toggle a default sparkle animation on a specific stroke.
   * If the stroke already has an animation, stop it and return false.
   * If it doesn't, add a sparkle animation and return true.
   */
  toggleStrokeAnimation(strokeId: string, params?: AnimationParams): boolean {
    this.assertNotDestroyed();

    // Check if this stroke currently has an active animation
    const hasActive = this.strokeAnimator.getTransform(strokeId, performance.now()) !== null;

    if (hasActive) {
      // Save the current animation params before removing
      const currentParams = this.strokeAnimator.getAnimationParams(strokeId);
      if (currentParams) {
        this._pausedAnimations.set(strokeId, currentParams);
      }
      this.strokeAnimator.removeByStrokeId(strokeId);
      return false;
    }

    // Restore paused animation, or use provided params, or default sparkle
    const animParams: AnimationParams =
      this._pausedAnimations.get(strokeId) ??
      params ??
      { type: 'sparkle', duration: 2000, repeat: true };

    this._pausedAnimations.delete(strokeId);
    this.strokeAnimator.addAnimation([strokeId], animParams);
    return true;
  }

  // ── GlymoObject API ─────────────────────────────────

  /** Create a GlymoObject grouping existing strokes. Returns the new object. */
  createObject(
    strokeIds: string[],
    bbox?: { x: number; y: number; width: number; height: number },
  ): GlymoObject {
    this.assertNotDestroyed();
    const effectiveBbox = bbox ?? this.computeStrokeBoundsForIds(strokeIds);
    return this.objectStore.createObject(strokeIds, effectiveBbox);
  }

  /** Add a fill to an existing object (fill follows the object's animation) */
  addFillToObject(objectId: string, fill: Fill): void {
    this.assertNotDestroyed();
    this.fills.push(fill);
    this.renderer.addFill(fill);
    this.objectStore.addFillToObject(objectId, fill.id);
  }

  /** Find the GlymoObject that contains a specific stroke */
  getObjectByStrokeId(strokeId: string): GlymoObject | undefined {
    return this.objectStore.getObjectByStrokeId(strokeId);
  }

  /** Find the nearest GlymoObject at a canvas point (hit tests strokes) */
  getObjectByPoint(x: number, y: number, radius = 20): GlymoObject | undefined {
    this.assertNotDestroyed();
    const hitId = this.hitTestStroke(x, y, radius);
    if (!hitId) return undefined;
    return this.objectStore.getObjectByStrokeId(hitId);
  }

  /** Get direct access to the ObjectStore */
  getObjectStore(): ObjectStore { return this.objectStore; }

  /**
   * Toggle animation on an entire object (all strokes animated together).
   * Returns true if animation was turned ON, false if turned OFF.
   */
  toggleObjectAnimation(objectId: string, params?: AnimationParams): boolean {
    this.assertNotDestroyed();
    const obj = this.objectStore.getObject(objectId);
    if (!obj || obj.strokeIds.length === 0) return false;

    if (obj.animationId) {
      // Currently animated → pause: save params and remove
      const currentParams = this.strokeAnimator.getAnimationParams(obj.strokeIds[0]!);
      if (currentParams) {
        this._pausedObjectAnimations.set(objectId, currentParams);
      }
      this.strokeAnimator.removeAnimation(obj.animationId);
      this.objectStore.setAnimationId(objectId, undefined);
      return false;
    }

    // Not animated → resume or start
    const animParams: AnimationParams =
      this._pausedObjectAnimations.get(objectId) ??
      params ??
      { type: 'sparkle', duration: 2000, repeat: true };
    this._pausedObjectAnimations.delete(objectId);
    const animId = this.strokeAnimator.addAnimation(obj.strokeIds, animParams);
    this.objectStore.setAnimationId(objectId, animId);
    return true;
  }

  /**
   * Undo the last GlymoObject: removes its strokes, fills, and animations.
   * Returns the removed object or undefined if no objects exist.
   */
  undoObject(): GlymoObject | undefined {
    this.assertNotDestroyed();
    const obj = this.objectStore.removeLastObject();
    if (!obj) return undefined;

    // Remove animation
    if (obj.animationId) {
      this.strokeAnimator.removeAnimation(obj.animationId);
    }
    this._pausedObjectAnimations.delete(obj.id);
    this.selectionManager.removeIfSelected(obj.id);

    // Remove strokes
    for (const sid of obj.strokeIds) {
      this.renderer.removeStrokeById(sid);
      this.strokes = this.strokes.filter(s => s.id !== sid);
      this.strokeAnimator.removeByStrokeId(sid);
      this._pausedAnimations.delete(sid);
    }

    // Remove fills
    for (const fid of obj.fillIds) {
      this.renderer.removeFillById(fid);
      this.fills = this.fills.filter(f => f.id !== fid);
    }

    return obj;
  }

  // ── Selection ─────────────────────────────────────

  /** Hit-test a point and toggle selection on the object at that position */
  selectObjectAtPoint(x: number, y: number): GlymoObject | undefined {
    this.assertNotDestroyed();
    const strokeId = this.hitTestStroke(x, y);
    if (!strokeId) {
      this.selectionManager.clearSelection();
      return undefined;
    }
    const obj = this.objectStore.getObjectByStrokeId(strokeId);
    if (!obj) {
      this.selectionManager.clearSelection();
      return undefined;
    }
    this.selectionManager.toggle(obj.id);
    return obj;
  }

  /** Toggle selection on a specific object */
  toggleObjectSelection(objectId: string): void {
    this.assertNotDestroyed();
    this.selectionManager.toggle(objectId);
  }

  /** Clear all selection */
  clearSelection(): void {
    this.assertNotDestroyed();
    this.selectionManager.clearSelection();
  }

  /** Get IDs of all selected objects */
  getSelectedObjectIds(): string[] {
    return [...this.selectionManager.getSelectedIds()];
  }

  /** Check if any objects are currently selected */
  hasSelection(): boolean {
    return this.selectionManager.count > 0;
  }

  // ── Correction ────────────────────────────────────

  /** Apply endpoint snapping + overshoot trimming to a specific object */
  polishObject(objectId: string, options?: CorrectionOptions): boolean {
    this.assertNotDestroyed();
    const obj = this.objectStore.getObject(objectId);
    if (!obj) return false;

    // Already corrected — skip
    const existing = obj.metadata?.correction as CorrectionMetadata | undefined;
    if (existing?.corrected) return false;

    const originalRaw: Record<string, StrokePoint[]> = {};
    const originalSmoothed: Record<string, StrokePoint[]> = {};
    const allCorrections: string[] = [];

    const dpr = this.options.pixelRatio;
    // Adaptive snap threshold: use 60% of object diagonal for manual Polish.
    // Hand tracking endpoints can be 200-400px apart; a fixed 15px is too small.
    const bboxDiag = Math.sqrt(obj.bbox.width ** 2 + obj.bbox.height ** 2);
    const adaptiveThreshold = Math.max(60 * dpr, bboxDiag * 0.6);
    const snapThreshold = options?.snapThreshold
      ? options.snapThreshold * dpr
      : adaptiveThreshold;

    // Step 1: Remove tiny artifact strokes (< 6 raw points or tiny bbox)
    // These are accidental pinch taps that create dots, not intentional strokes.
    const tinyStrokeIds: string[] = [];
    const TINY_THRESHOLD = 10 * dpr; // 10px CSS
    for (const sid of obj.strokeIds) {
      const stroke = this.strokes.find(s => s.id === sid);
      if (!stroke || stroke.raw.length >= 6) continue;
      const bounds = computeBounds(stroke.raw);
      if (bounds.width < TINY_THRESHOLD && bounds.height < TINY_THRESHOLD) {
        tinyStrokeIds.push(sid);
      }
    }

    // Remove tiny strokes (preserve full Stroke for revert)
    const removedStrokes: import('./types.js').Stroke[] = [];
    for (const sid of tinyStrokeIds) {
      const stroke = this.strokes.find(s => s.id === sid);
      if (stroke) {
        // Deep clone the full stroke for revert restoration
        removedStrokes.push({
          ...stroke,
          raw: stroke.raw.map(p => ({ ...p })),
          smoothed: stroke.smoothed.map(p => ({ ...p })),
        });
      }
      originalRaw[sid] = stroke?.raw.map(p => ({ ...p })) ?? [];
      originalSmoothed[sid] = stroke?.smoothed.map(p => ({ ...p })) ?? [];
      this.renderer.removeStrokeById(sid);
      this.strokes = this.strokes.filter(s => s.id !== sid);
      this.strokeAnimator.removeByStrokeId(sid);
      allCorrections.push('remove-artifact');
    }

    // Remove phantom stroke IDs from the object and stroke-to-object map
    for (const sid of tinyStrokeIds) {
      this.objectStore.removeStrokeFromObject(sid);
    }

    // Step 2: Correct remaining strokes (self-close + cross-snap)
    const remainingStrokeIds = obj.strokeIds.filter(id => !tinyStrokeIds.includes(id));
    for (const sid of remainingStrokeIds) {
      const stroke = this.strokes.find(s => s.id === sid);
      if (!stroke) continue;

      // Save originals before correction
      originalRaw[sid] = [...stroke.raw.map(p => ({ ...p }))];
      originalSmoothed[sid] = [...stroke.smoothed.map(p => ({ ...p }))];

      // Get other strokes in this object (excluding current one and removed ones)
      const others = this.strokes.filter(s => s.id !== sid);
      const dprOptions: CorrectionOptions = {
        ...options,
        snapThreshold,
      };
      const { correctedRaw, correctedSmoothed, corrections } = this.strokeCorrector.correctAndSmooth(
        stroke.raw, others, this.smoothStageRef, dprOptions,
      );

      if (corrections.length > 0) {
        stroke.raw = correctedRaw;
        stroke.smoothed = correctedSmoothed;
        for (const c of corrections) {
          if (!allCorrections.includes(c)) allCorrections.push(c);
        }
      }
    }

    if (allCorrections.length === 0) return false;

    // Store correction metadata for revert
    const meta: CorrectionMetadata = {
      corrected: true,
      originalRaw,
      originalSmoothed,
      removedStrokes: removedStrokes.length > 0 ? removedStrokes : undefined,
      appliedCorrections: allCorrections,
    };
    this.objectStore.updateMetadata(objectId, 'correction', meta);
    this.renderer.markDirty();
    this.eventBus.emit('correction:applied', { objectId, corrections: allCorrections });
    return true;
  }

  /** Apply correction to all selected objects */
  polishSelectedObjects(options?: CorrectionOptions): void {
    for (const id of this.selectionManager.getSelectedIds()) {
      this.polishObject(id, options);
    }
  }

  /** Revert correction on a specific object, restoring original raw + smoothed */
  revertObject(objectId: string): boolean {
    this.assertNotDestroyed();
    const obj = this.objectStore.getObject(objectId);
    if (!obj) return false;

    const meta = obj.metadata?.correction as CorrectionMetadata | undefined;
    if (!meta?.corrected) return false;

    // Restore removed strokes first
    if (meta.removedStrokes) {
      for (const removedStroke of meta.removedStrokes) {
        const restoredStroke = {
          ...removedStroke,
          raw: removedStroke.raw.map(p => ({ ...p })),
          smoothed: removedStroke.smoothed.map(p => ({ ...p })),
        };
        this.strokes.push(restoredStroke);
        // Re-register stroke in the object and stroke-to-object map
        this.objectStore.addStrokeToObject(objectId, restoredStroke.id);
        // Add stroke back to the renderer so it becomes visible again
        this.renderer.addCompletedStroke(restoredStroke);
      }
    }

    // Restore original points on remaining strokes
    for (const sid of obj.strokeIds) {
      const stroke = this.strokes.find(s => s.id === sid);
      if (!stroke) continue;
      if (meta.originalRaw[sid]) stroke.raw = meta.originalRaw[sid].map(p => ({ ...p }));
      if (meta.originalSmoothed[sid]) stroke.smoothed = meta.originalSmoothed[sid].map(p => ({ ...p }));
    }

    // Clear correction metadata
    this.objectStore.updateMetadata(objectId, 'correction', undefined);
    this.renderer.markDirty();
    this.eventBus.emit('correction:reverted', { objectId });
    return true;
  }

  /** Revert correction on all selected objects */
  revertSelectedObjects(): void {
    for (const id of this.selectionManager.getSelectedIds()) {
      this.revertObject(id);
    }
  }

  /** Enable/disable auto-correction on new strokes */
  setAutoCorrect(enabled: boolean): void {
    this.autoCorrectEnabled = enabled;
  }

  /** Check if auto-correction is enabled */
  isAutoCorrectEnabled(): boolean {
    return this.autoCorrectEnabled;
  }

  // ── Renderer ───────────────────────────────────────
  /** Switch the rendering backend ('canvas2d' | 'webgpu' | 'auto') */
  async setRenderer(mode: RendererMode): Promise<void> {
    this.assertNotDestroyed();
    if (mode === 'canvas2d') { this.replaceRenderer(null); return; }
    const gpu = new WebGPURenderer(this.canvas, this.options.pixelRatio);
    const ok = await gpu.init();
    if (ok) { this.webgpuAvailable = true; this.replaceRenderer(gpu); }
    else { gpu.destroy(); this.replaceRenderer(null); this.eventBus.emit('renderer:fallback'); }
  }

  isWebGPU(): boolean { return this.renderer.type === 'webgpu'; }

  // ── Background ─────────────────────────────────────
  /**
   * Switch between a solid black background and a transparent one.
   * Use 'transparent' when a camera video feed is shown behind the canvas.
   */
  setBackgroundMode(mode: 'solid' | 'transparent'): void {
    this.assertNotDestroyed();
    this.renderer.setBackgroundMode(mode);
  }

  // ── Canvas ─────────────────────────────────────────
  clear(): void {
    const style = this.canvas.style;
    style.transition = `opacity ${CLEAR_FADE_MS}ms ease-out`;
    style.opacity = '0';

    setTimeout(() => {
      this.strokes = [];
      this.fills = [];
      this.accumulatedStrokes = [];
      this.strokeAnimator.clear();
      this._pausedAnimations.clear();
      this._pausedObjectAnimations.clear();
      this.objectStore.clear();
      this.renderer.clearFills();
      this.renderer.clearAll();
      this.pipeline.reset();
      this.pipeline2.reset();
      this.secondHandPenIsDown = false;
      style.opacity = '1';
    }, CLEAR_FADE_MS);
  }

  undo(): void {
    const removed = this.renderer.removeLastStroke();
    if (removed) {
      // Clean up selection before removing from object store
      const ownerObj = this.objectStore.getObjectByStrokeId(removed.id);
      this.strokes = this.strokes.filter((s) => s.id !== removed.id);
      this.strokeAnimator.removeByStrokeId(removed.id);
      this._pausedAnimations.delete(removed.id);
      this.objectStore.removeStrokeFromObject(removed.id);
      // If the owning object now has no strokes, remove it from selection
      if (ownerObj && ownerObj.strokeIds.length === 0) {
        this.selectionManager.removeIfSelected(ownerObj.id);
      }
    }
  }

  /** Fade out the last completed stroke over durationMs (dissolve effect), then remove it */
  fadeOutLastStroke(durationMs = 500): void {
    const removed = this.renderer.fadeOutLastStroke(durationMs);
    if (removed) {
      this.strokes = this.strokes.filter((s) => s.id !== removed.id);
      this.strokeAnimator.removeByStrokeId(removed.id);
      this._pausedAnimations.delete(removed.id);
      this.objectStore.removeStrokeFromObject(removed.id);
    }
  }

  /** Fade out a specific stroke by ID */
  fadeOutStrokeById(strokeId: string, durationMs = 500): void {
    this.assertNotDestroyed();
    const removed = this.renderer.fadeOutStrokeById(strokeId, durationMs);
    if (removed) {
      this.strokes = this.strokes.filter((s) => s.id !== removed.id);
      this.strokeAnimator.removeByStrokeId(removed.id);
      this._pausedAnimations.delete(removed.id);
      this.objectStore.removeStrokeFromObject(removed.id);
    }
  }

  getStrokeCount(): number {
    return this.strokes.length;
  }

  /** Get IDs of all completed strokes */
  getStrokeIds(): string[] {
    this.assertNotDestroyed();
    return this.strokes.map(s => s.id);
  }

  getState(): SessionState {
    return this.stateMachine.getState();
  }

  // ── Export ─────────────────────────────────────────

  async exportPNG(): Promise<Blob> {
    this.assertNotDestroyed();
    this.stateMachine.transition('export_start');
    try {
      const blob = await exportPNG(this.canvas);
      this.stateMachine.transition('export_complete');
      return blob;
    } catch (err) {
      this.stateMachine.transition('export_fail');
      throw err;
    }
  }

  async exportGIF(options?: GIFOptions & GIFExportOptions): Promise<Blob> {
    this.assertNotDestroyed();
    this.stateMachine.transition('export_start');
    try {
      const blob = await exportGIFImpl(this.canvas, options);
      this.stateMachine.transition('export_complete');
      return blob;
    } catch (err) {
      this.stateMachine.transition('export_fail');
      throw err;
    }
  }

  // ── Events ─────────────────────────────────────────

  on<K extends keyof GlymoEventMap>(event: K, handler: (...args: GlymoEventMap[K]) => void): () => void {
    return this.eventBus.on(event, handler);
  }

  // ── Lifecycle ──────────────────────────────────────

  destroy(): void {
    this.destroyed = true;
    if (this.overlayTimer) { clearTimeout(this.overlayTimer); this.overlayTimer = null; }
    this.cancelMorph();
    this.strokeAnimator.clear();
    this._pausedAnimations.clear();
    this._pausedObjectAnimations.clear();
    this.selectionManager.clearSelection();
    this.objectStore.clear();
    this.stateMachine.destroy();
    this.unbind();
    this.renderer.destroy();
    this.eventBus.clear();
    this.strokes = [];
    this.fills = [];
    this.accumulatedStrokes = [];
    this.textPipeline.dispose();
  }

  // ── Private ────────────────────────────────────────

  private wireInput(): void {
    this.inputManager.setPointCallback((raw) => {
      this.pipeline.processPoint(raw);
    });

    this.inputManager.setPenStateCallback((isDown) => {
      if (isDown) {
        this.handlePenDown();
      } else {
        this.handlePenUp();
      }
    });
  }

  private wireMorphComplete(): void {
    this.eventBus.on('morph:complete', () => {
      this.completeMorph();
    });
  }

  private wireTextMorph(): void {
    // FontMorphAnimator.start() sets active=true then emits 'morph:start'.
    // By checking isActive() on the text pipeline's animator here, we can
    // distinguish a FontMorph start from a stroke MorphAnimator start.
    this.eventBus.on('morph:start', () => {
      const animator = this.textPipeline.getMorphAnimator();
      if (animator?.isActive()) {
        this.renderer.setFontMorphAnimator(animator);
      }
    });

    // When any morph completes, check if the FontMorphAnimator has finished
    // and clean it up from the renderer.
    this.eventBus.on('morph:complete', () => {
      const animator = this.textPipeline.getMorphAnimator();
      if (animator && !animator.isActive()) {
        // [stroke-trace] Font-morph completion — the exact instant the user
        // reports a stroke disappearing. Capture stroke counts across
        // store + renderer + object-store so we can diff against the next
        // stroke-trace event.
        // eslint-disable-next-line no-console
        console.info('[stroke-trace] fontMorph:complete', {
          strokesLen: this.strokes.length,
          accumulatedLen: this.accumulatedStrokes.length,
          ts: performance.now(),
        });
        this.renderer.setFontMorphAnimator(null);
      }
    });

    // Overlay mode: render recognized text over the stroke bounding box
    this.eventBus.on('text:overlay', (overlayData) => {
      this.renderer.setOverlayText(overlayData);
    });
  }

  /** Connect the StrokeAnimator to the current renderer (CanvasRenderer only) */
  private wireStrokeAnimator(): void {
    if (this.renderer instanceof CanvasRenderer) {
      this.renderer.setStrokeAnimator(this.strokeAnimator);
    }
  }

  /** Connect the ObjectStore to the current renderer (CanvasRenderer only) */
  private wireObjectStore(): void {
    if (this.renderer instanceof CanvasRenderer) {
      this.renderer.setObjectStore(this.objectStore);
    }
  }

  private wireSelectionManager(): void {
    if (this.renderer instanceof CanvasRenderer) {
      this.renderer.setSelectionManager(this.selectionManager);
    }
  }

  private handlePenDown(): void {
    // Cancel preset text overlay timer on new pen-down
    if (this.overlayTimer) {
      clearTimeout(this.overlayTimer);
      this.overlayTimer = null;
    }

    if (this.stateMachine.getState() === 'pen_up_wait') {
      this.stateMachine.cancelMorphDelay();
      this.pendingStroke = null;
    }
    this.stateMachine.transition('penDown');
    this.pipeline.reset();
    this.pipeline.penDown();
  }

  private handlePenUp(): void {
    const result = this.pipeline.penUp();
    const pointCount = result?.raw.length ?? 0;

    // Capture custom color/width at pen-up time so that completeMorph
    // uses the values the user had set when the stroke was drawn, not
    // whatever they might change to during the morph delay.
    this._pendingCustomColor = this._customColor;
    this._pendingCustomWidth = this._customWidth;

    // Instant complete mode: skip morph animation entirely
    if (this.instantComplete && result && pointCount >= 3) {
      // Must transition state machine so it stays in sync
      this.stateMachine.transition('penUp');
      this.stateMachine.transition('timeout');

      // Auto-correct if enabled
      let raw = result.raw;
      let smoothed = result.smoothed;
      if (this.autoCorrectEnabled) {
        const corrected = this.strokeCorrector.correctAndSmooth(
          raw, this.strokes, this.smoothStageRef,
          { snapThreshold: 15 * this.options.pixelRatio },
        );
        raw = corrected.correctedRaw;
        smoothed = corrected.correctedSmoothed;
      }

      const stroke: Stroke = {
        id: crypto.randomUUID(),
        raw,
        smoothed,
        state: 'effected',
        effect: this.currentEffect,
        createdAt: Date.now(),
        ...(this._customColor != null && { customColor: this._customColor }),
        ...(this._customWidth != null && { customWidth: this._customWidth }),
      };
      this.strokes.push(stroke);
      this.enforceMaxStrokes();
      this.renderer.addCompletedStroke(stroke);

      // Emit stroke:complete with useful data for text recognition
      // Use smoothed points for bbox — these match what's actually rendered
      const bbox = this.computeStrokeBounds([result.smoothed]);
      this.eventBus.emit('stroke:complete', { stroke, bbox });

      // Return to ready state
      this.stateMachine.transition('morph_complete');
      return;
    }

    const action = this.stateMachine.getPenUpAction(pointCount);

    if (!this.stateMachine.transition(action)) return;
    if (!result || action === 'penUp_short') return;

    this.pendingStroke = result;

    if (this.textPipeline.enabled) {
      this.accumulatedStrokes.push(result);
    }

    // Text mode with overlay: after inactivity, trigger text recognition + overlay
    if (this.textPipeline.enabled && this.textPipeline.getTypographyMode() === 'overlay') {
      if (this.overlayTimer) clearTimeout(this.overlayTimer);
      this.overlayTimer = setTimeout(() => {
        this.overlayTimer = null;
        this.triggerTextOverlay();
      }, 2000);
      // Still do normal morph for the stroke visual
      this.stateMachine.startMorphDelay(() => this.startMorph());
      return;
    }

    // Text mode without preset: longer delay for OCR accumulation
    const delay = this.textPipeline.enabled ? 1500 : undefined;
    this.stateMachine.startMorphDelay(() => this.startMorph(), delay);
  }

  // ── Second-hand drawing ────────────────────────────

  private handleSecondHandPenDown(): void {
    this.secondHandPenIsDown = true;
    this.pipeline2.reset();
    this.pipeline2.penDown();
  }

  private handleSecondHandPenUp(): void {
    if (!this.secondHandPenIsDown) return;
    this.secondHandPenIsDown = false;

    const result = this.pipeline2.penUp();
    const pointCount = result?.raw.length ?? 0;
    if (!result || pointCount < 3) {
      this.pipeline2.reset();
      return;
    }

    // Second-hand strokes always complete instantly (no morph, no state machine).
    // This avoids state conflicts when both hands draw simultaneously.
    const stroke: Stroke = {
      id: crypto.randomUUID(),
      raw: result.raw,
      smoothed: result.smoothed,
      state: 'effected',
      effect: this.currentEffect,
      createdAt: Date.now(),
      ...(this._customColor != null && { customColor: this._customColor }),
      ...(this._customWidth != null && { customWidth: this._customWidth }),
    };
    this.strokes.push(stroke);
    this.enforceMaxStrokes();
    this.renderer.addCompletedStroke(stroke);
    this.pipeline2.reset();
  }

  private async triggerTextOverlay(): Promise<void> {
    const allStrokes = this.strokes;
    if (allStrokes.length === 0) return;

    const allPoints: StrokePoint[][] = allStrokes.map(s => s.smoothed);
    const bbox = this.computeStrokeBounds(allPoints);
    const pad = 20;
    bbox.x -= pad;
    bbox.y -= pad;
    bbox.width += pad * 2;
    bbox.height += pad * 2;

    // Determine text: preset or recognize
    let text: string;
    const presetText = this.textPipeline.getPresetText();
    if (presetText) {
      text = presetText;
    } else {
      // Run handwriting recognition on accumulated strokes
      const { recognizeHandwriting } = await import('./text/HandwritingRecognizer.js');
      const rawStrokes = allStrokes.map(s => s.raw);
      const result = await recognizeHandwriting(rawStrokes);
      if (!result) {
        this.eventBus.emit('error', { code: 'HANDWRITING_RECOGNITION_FAILED', message: 'Handwriting recognition failed' });
        return;
      }
      text = result.text;
      this.eventBus.emit('text:recognized', { text, confidence: 1.0, characters: [], processingTimeMs: 0 });
    }

    const style = EFFECT_PRESETS[this.currentEffect];
    this.renderer.setOverlayText({
      text,
      font: this.textPipeline.getFont(),
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      effectColor: style?.color ?? '#00ffaa',
      glowColor: style?.glowColor ?? 'rgba(0,255,170,0.7)',
      glowSize: style?.glowSize ?? 40,
      startTime: performance.now(),
      fadeDuration: 800,
    });
  }

  private startMorph(): void {
    if (!this.pendingStroke) return;
    this.stateMachine.transition('timeout');

    this.morphAnimator = new MorphAnimator({
      raw: this.pendingStroke.raw,
      smoothed: this.pendingStroke.smoothed,
      effect: this.currentEffect,
      eventBus: this.eventBus,
    });
    this.renderer.setMorphAnimator(this.morphAnimator);
    this.morphAnimator.start();
  }

  private completeMorph(): void {
    if (!this.pendingStroke || !this.morphAnimator) return;

    // [stroke-trace] Audit stroke store before and after per-stroke morph
    // completion. Helps isolate whether strokes are being dropped here vs
    // during font-morph completion. Low overhead — one line per stroke.
    // eslint-disable-next-line no-console
    console.info('[stroke-trace] completeMorph:enter', {
      strokesBeforeLen: this.strokes.length,
      accumulatedLen: this.accumulatedStrokes.length,
      pendingRawLen: this.pendingStroke.raw.length,
      ts: performance.now(),
    });

    // Auto-correct if enabled
    let raw = this.pendingStroke.raw;
    let smoothed = this.morphAnimator.getSmoothedPoints();
    if (this.autoCorrectEnabled) {
      const corrected = this.strokeCorrector.correctAndSmooth(
        raw, this.strokes, this.smoothStageRef,
        { snapThreshold: 15 * this.options.pixelRatio },
      );
      raw = corrected.correctedRaw;
      smoothed = corrected.correctedSmoothed;
    }

    const stroke: Stroke = {
      id: crypto.randomUUID(),
      raw,
      smoothed,
      state: 'effected',
      effect: this.currentEffect,
      createdAt: Date.now(),
      ...(this._pendingCustomColor != null && { customColor: this._pendingCustomColor }),
      ...(this._pendingCustomWidth != null && { customWidth: this._pendingCustomWidth }),
    };

    this.strokes.push(stroke);
    this.enforceMaxStrokes();
    this.renderer.addCompletedStroke(stroke);
    this.renderer.setMorphAnimator(null);
    this.morphAnimator = null;

    // Emit stroke:complete for both morph and instant modes
    const bbox = this.computeStrokeBounds([stroke.smoothed]);
    this.eventBus.emit('stroke:complete', { stroke, bbox });

    this.pendingStroke = null;
    this.stateMachine.transition('morph_complete');

    // Overlay mode: text is handled by the inactivity timer in handlePenUp (triggerTextOverlay).
    // Morph mode: run the full text pipeline with accumulated strokes.
    if (this.textPipeline.enabled && this.accumulatedStrokes.length > 0
        && this.textPipeline.getTypographyMode() !== 'overlay') {
      const strokesToProcess = [...this.accumulatedStrokes];
      this.accumulatedStrokes = [];

      this.textPipeline.runPipeline(strokesToProcess.map((s) => s.raw)).catch((err) => {
        this.eventBus.emit('error', { code: 'TEXT_PIPELINE_FAILED', message: err instanceof Error ? err.message : String(err), stage: 'text-pipeline' });
      });
    }
  }

  private cancelMorph(): void {
    this.stateMachine.cancelMorphDelay();
    this.morphAnimator?.cancel();
    this.renderer.setMorphAnimator(null);
    this.morphAnimator = null;
    this.pendingStroke = null;
  }

  private computeStrokeBounds(strokeArrays: StrokePoint[][]): { x: number; y: number; width: number; height: number } {
    return computeBounds(strokeArrays.flat());
  }

  /** Compute combined bounding box for strokes by their IDs */
  private computeStrokeBoundsForIds(strokeIds: string[]): { x: number; y: number; width: number; height: number } {
    const points: StrokePoint[] = [];
    for (const sid of strokeIds) {
      const stroke = this.strokes.find(s => s.id === sid);
      if (stroke) points.push(...stroke.smoothed);
    }
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    return computeBounds(points);
  }

  private enforceMaxStrokes(): void {
    while (this.strokes.length > this.options.maxStrokes) {
      this.strokes.shift();
    }
  }

  private assertNotDestroyed(): void {
    if (this.destroyed) throw new Error('Glymo instance has been destroyed');
  }

  /** Replace the current renderer, preserving strokes. Pass null for Canvas 2D. */
  private replaceRenderer(newRenderer: IRenderer | null): void {
    const strokes = [...this.strokes];
    this.renderer.destroy();
    this.renderer = newRenderer ?? new CanvasRenderer(this.canvas, this.options.pixelRatio);
    this.renderer.setEventBus(this.eventBus);
    this.renderer.setEffect(this.currentEffect);
    this.renderer.setActivePointsSource(() => this.pipeline.getActivePoints());
    this.wireStrokeAnimator();
    this.wireObjectStore();
    this.wireSelectionManager();
    for (const s of strokes) this.renderer.addCompletedStroke(s);
    for (const f of this.fills) this.renderer.addFill(f);

    // Re-connect FontMorphAnimator if one is still running after the renderer swap
    const fontAnimator = this.textPipeline.getMorphAnimator();
    if (fontAnimator?.isActive()) {
      this.renderer.setFontMorphAnimator(fontAnimator);
    }

    this.renderer.start();
  }
}
