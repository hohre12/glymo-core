// ── Glymo Main Class ────────────────────────────────

import type { AnimationDoc, BitmapLoader, BitmapUploader, CharacterDoc, EffectPresetName, Fill, FillDoc, GlymoObject, GlymoOptions, GIFOptions, GlymoEventMap, ObjectDoc, SessionDoc, Stroke, StrokeDoc, StrokeDocPoint, SessionState, RendererMode, StrokePoint, CreateOptions, CorrectionOptions, CorrectionMetadata } from './types.js';
import { GlymoError } from './types.js';
import { GPU_EFFECT_NAMES, CANVAS_EFFECT_NAMES } from './types.js';
import { resolveEffect } from './effects/registry.js';
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
import { CharacterStore } from './store/CharacterStore.js';
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

  private backgroundMode: 'solid' | 'transparent' = 'solid';
  private backgroundColor = '#000000';

  private strokes: Stroke[] = [];
  private fills: Fill[] = [];
  private currentEffect: EffectPresetName;
  private morphAnimator: MorphAnimator | null = null;
  /**
   * Per-stroke animation engine. Public so callers can drive
   * {@link StrokeAnimator.serialize}/{@link StrokeAnimator.restore} directly
   * when persisting sessions — exportSession/loadSession use the same
   * interface internally.
   */
  readonly strokeAnimator: StrokeAnimator;
  private readonly objectStore: ObjectStore;
  /**
   * Authoritative store for recognised characters (text-mode typography
   * output). Owned by core so `exportSession` can serialise without a
   * React round-trip and the renderer can read char geometry directly.
   * See `docs/plans/session-persistence-round-trip.md` §11.2.
   */
  private readonly characterStore: CharacterStore;
  private readonly bitmapUploader: BitmapUploader | null;
  private readonly bitmapLoader: BitmapLoader | null;
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

  // Set via setMeshHitTestFn — null when no host renderer is registered.
  private meshHitTestFn: ((x: number, y: number) => string | null) | null = null;

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
    this.characterStore = new CharacterStore();
    this.bitmapUploader = options?.bitmapUploader ?? null;
    this.bitmapLoader = options?.bitmapLoader ?? null;
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

  /** Get all active fills (read-only). */
  getFills(): readonly Fill[] {
    this.assertNotDestroyed();
    return this.fills;
  }

  /** Get all {@link GlymoObject} groups in creation order. */
  listObjects(): GlymoObject[] {
    this.assertNotDestroyed();
    return this.objectStore.getAllObjects();
  }

  /**
   * Translate every stroke that belongs to {@link GlymoObject} `id` by
   * `(dx, dy)` in canvas-space and shift the cached bbox by the same delta.
   *
   * Drawing-mode counterpart to text-mode glyph translation. Returns `false`
   * when the object id is unknown so callers can fall back to no-op without
   * a try/catch. Mutates stroke points in place because the renderer holds
   * the same `Stroke` references — markDirty invalidates the offscreen cache.
   *
   * Limitation: fills are full-canvas bitmaps (no per-pixel offset), so
   * fills inside the object are intentionally NOT translated.
   */
  translateObject(id: string, dx: number, dy: number): boolean {
    this.assertNotDestroyed();
    const obj = this.objectStore.getObject(id);
    if (!obj) return false;
    if (dx === 0 && dy === 0) return true;

    const strokeIndex = new Map(this.strokes.map((s) => [s.id, s]));
    for (const sid of obj.strokeIds) {
      const stroke = strokeIndex.get(sid);
      if (!stroke) continue;
      for (const pt of stroke.raw) {
        pt.x += dx;
        pt.y += dy;
      }
      for (const pt of stroke.smoothed) {
        pt.x += dx;
        pt.y += dy;
      }
    }

    // ObjectStore.getObject() returns the live reference, so in-place
    // bbox mutation is the persistence path (no setter needed).
    obj.bbox.x += dx;
    obj.bbox.y += dy;
    this.renderer.markDirty();
    this.eventBus.emit('object:translated', { id, dx, dy });
    return true;
  }

  /**
   * Hydrate the session from a pre-recorded stroke set (e.g. a project
   * loaded from the server). Replaces all existing strokes and fills.
   *
   * The wire format is intentionally slim (`StrokeDoc` carries only `x`,
   * `y`, optional `pressure`) so persistence does not leak capture-time
   * invariants. Missing fields are filled in with safe defaults:
   *   - `t` (timestamp) is synthesized monotonically per-stroke; wire
   *     payloads never carry wall-clock timing and rendering does not
   *     depend on it.
   *   - `pressure` defaults to 1.0, the most common capture fallback when
   *     hardware does not report pressure.
   *
   * Loaded strokes are rendered but are NOT wrapped into `GlymoObject`
   * groups — undo/group semantics apply only to strokes drawn after load.
   */
  loadStrokes(docs: StrokeDoc[]): void {
    this.assertNotDestroyed();
    this.strokes = [];
    this.renderer.clearAll();
    for (const doc of docs) {
      const stroke = this.strokeFromDoc(doc);
      this.strokes.push(stroke);
      this.renderer.addCompletedStroke(stroke);
    }
    this.renderer.markDirty();
  }

  /**
   * Internal: convert a persisted StrokeDoc to an internal Stroke.
   *
   * Honors the v2 wire shape: preserves `doc.id` when present (required for
   * round-trip ObjectDoc referential integrity), and resolves the effect as
   * `doc.effect ?? defaultEffect ?? this.currentEffect` so callers in the
   * session-load path can inject the session-level effect name.
   */
  private strokeFromDoc(doc: StrokeDoc, defaultEffect?: EffectPresetName): Stroke {
    const points: StrokePoint[] = doc.points.map((p, i) => ({
      x: p.x,
      y: p.y,
      t: i,
      pressure: p.pressure ?? 1.0,
    }));
    const effect = (doc.effect as EffectPresetName | undefined)
      ?? defaultEffect
      ?? this.currentEffect;
    return {
      id: doc.id ?? crypto.randomUUID(),
      raw: points,
      // Persisted points are treated as already pipeline-processed; skip
      // re-running Chaikin here to avoid visual drift across save/load.
      smoothed: points.map(p => ({ ...p })),
      state: 'effected',
      effect,
      createdAt: Date.now(),
      ...(doc.customColor != null && { customColor: doc.customColor }),
      ...(doc.customWidth != null && { customWidth: doc.customWidth }),
    };
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

  // ── Recognised Characters (Revision 2) ─────────────

  /**
   * Add a newly-recognised character to the authoritative store and emit
   * `character:change` with the full post-mutation list. Called by the UI
   * adapter (`useTextRecognition`) whenever `CascadingRecognizer.onChar`
   * fires. The stroke fadeOut that accompanies finalisation is intentionally
   * kept — at save time the user sees typography, not strokes, so the wire
   * snapshot must match that screen. See §11.2 in the plan.
   */
  addCharacter(doc: CharacterDoc): void {
    this.assertNotDestroyed();
    this.characterStore.addCharacter(doc);
    this.emitCharacterChange();
  }

  /**
   * Patch a character — used when `CascadingRecognizer.onCorrection` issues
   * a net2 sweep override (same id, new glyph). No-op for unknown ids
   * (the store warns and skips).
   */
  updateCharacter(id: string, patch: Partial<Omit<CharacterDoc, 'id'>>): void {
    this.assertNotDestroyed();
    this.characterStore.updateCharacter(id, patch);
    this.emitCharacterChange();
  }

  /**
   * Remove a character by id. Used for explicit deletes (user gesture) and
   * recognised-char teardown paths. No-op for unknown ids.
   */
  removeCharacter(id: string): CharacterDoc | undefined {
    this.assertNotDestroyed();
    const removed = this.characterStore.removeCharacter(id);
    if (removed) this.emitCharacterChange();
    return removed;
  }

  /**
   * Snapshot of the current character list. Fresh copies — mutations on
   * the returned array never affect the store.
   */
  getCharacters(): CharacterDoc[] {
    return this.characterStore.getAllCharacters();
  }

  /** Emit `character:change` with the full authoritative list. */
  private emitCharacterChange(): void {
    this.eventBus.emit('character:change', {
      characters: this.characterStore.getAllCharacters(),
    });
  }

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

  /**
   * Host registers a mesh hit-test function so selectObjectAtPoint can
   * route clicks on a media-art mesh to the underlying GlymoObject BEFORE
   * falling back to the stroke hit-test. Non-core renderers (Hologram3D
   * lives in @glymo/core but is instantiated by the UI layer with its own
   * canvas) plug in via this seam so the core stays renderer-agnostic.
   * Pass null to unregister.
   */
  setMeshHitTestFn(fn: ((x: number, y: number) => string | null) | null): void {
    this.meshHitTestFn = fn;
  }

  /**
   * Hit-test a point and select the object at that position. Mesh-first
   * dispatch: if a host registered `setMeshHitTestFn`, a click on a
   * rendered mesh routes to that object before the stroke hit-test runs.
   * When no mesh is hit (or no mesh tester is registered) the stroke
   * fallback restores the previous drawing-mode selection behaviour.
   *
   * Single-select: selecting a new object clears the previous selection.
   * The old toggle semantics (click twice = deselect) are retired as of
   * 0.16.0 because media-art workflows always target exactly one object.
   */
  selectObjectAtPoint(x: number, y: number): GlymoObject | undefined {
    this.assertNotDestroyed();

    // 1) Mesh-first (media-art): route clicks on a rendered mesh to the
    //    underlying GlymoObject so media-art overrides strokes visually AND
    //    in selection. A stale/unknown id from the host falls through.
    if (this.meshHitTestFn) {
      const meshObjectId = this.meshHitTestFn(x, y);
      if (meshObjectId) {
        const obj = this.objectStore.getObject(meshObjectId);
        if (obj) {
          this.selectionManager.clearSelection();
          this.selectionManager.select(obj.id);
          return obj;
        }
      }
    }

    // 2) Stroke fallback (drawing-mode default).
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
    this.selectionManager.clearSelection();
    this.selectionManager.select(obj.id);
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

  /**
   * Single-select an object — clears any existing selection and selects
   * only `objectId`. Used by features (Media Art per
   * `docs/plans/media-art-mvp.md` D7) that operate on exactly one object
   * at a time and need a stable single-select handle independent of the
   * existing multi-select toggle behaviour.
   *
   * Validates the id against ObjectStore so callers cannot select a
   * stale or never-existed object. Unknown ids leave selection unchanged
   * and emit a single `console.warn` so corrupt upstream state surfaces
   * without throwing.
   */
  selectObject(objectId: string): void {
    this.assertNotDestroyed();
    if (!this.objectStore.getObject(objectId)) {
      console.warn(`[Glymo] selectObject: unknown objectId "${objectId}"`);
      return;
    }
    this.selectionManager.clearSelection();
    this.selectionManager.select(objectId);
  }

  /**
   * Convenience: returns the single selected object id (or `null` when
   * zero or multiple objects are selected). Pairs with
   * {@link Glymo.selectObject} for features that operate on exactly one
   * object at a time. Multi-select consumers should use
   * {@link Glymo.getSelectedObjectIds} instead.
   */
  getSelectedObjectId(): string | null {
    const ids = this.selectionManager.getSelectedIds();
    if (ids.size !== 1) return null;
    return ids.values().next().value ?? null;
  }

  // ── Object metadata ────────────────────────────────
  //
  // Public surface so features (Media Art per `docs/plans/media-art-mvp.md`
  // D6 — `metadata.mediaArt = { modelId, appliedAt, sourceLabel }`) can
  // persist feature-specific state alongside the stroke geometry without
  // reaching into the internal ObjectStore. The metadata bag is opaque
  // to core: callers own the schema and the server round-trips the whole
  // bag verbatim through its opaque metadata column. Any JSON-serialisable
  // value is safe to store.

  /**
   * Set a metadata key on an object. Returns true when the object was
   * found and the value applied, false when the id is unknown. Pass
   * `undefined` to clear a key.
   */
  setObjectMetadata(objectId: string, key: string, value: unknown): boolean {
    this.assertNotDestroyed();
    return this.objectStore.updateMetadata(objectId, key, value);
  }

  /**
   * Read a metadata key from an object. Returns `undefined` for unknown
   * object ids or missing keys. Does not clone — callers must treat the
   * result as immutable.
   */
  getObjectMetadata(objectId: string, key: string): unknown {
    const obj = this.objectStore.getObject(objectId);
    return obj?.metadata?.[key];
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
    this.backgroundMode = mode;
    this.renderer.setBackgroundMode(mode);
  }

  /** Set the background color (hex string). Only visible when mode is 'solid'. */
  setBackgroundColor(color: string): void {
    this.assertNotDestroyed();
    this.backgroundColor = color;
    this.renderer.setBackgroundColor(color);
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

  // ── Session Persistence (v2) ──────────────────────

  /**
   * Serialize the full Studio state into the v2 {@link SessionDoc} wire
   * format. Fill bitmaps are uploaded via the configured
   * {@link BitmapUploader} and referenced by URL — large binary never
   * inlines into the JSON payload, keeping `projects.data` under the
   * Supabase Free JSONB budget.
   *
   * Any {@link BitmapUploader.upload} rejection propagates cleanly; no
   * partial `SessionDoc` is ever returned.
   */
  async exportSession(): Promise<SessionDoc> {
    this.assertNotDestroyed();

    if (this.fills.length > 0 && !this.bitmapUploader) {
      throw new GlymoError(
        'bitmap-uploader-missing',
        'exportSession requires a BitmapUploader when fills are present',
        { stage: 'export', recoverable: false },
      );
    }

    // Upload fills sequentially so a mid-batch failure aborts the export
    // before we hand the caller an incomplete doc.
    const fillDocs: FillDoc[] = [];
    for (const fill of this.fills) {
      const url = await this.bitmapUploader!.upload(fill.bitmap);
      fillDocs.push({ id: fill.id, color: fill.color, bitmap_url: url });
    }

    const sessionEffect = this.currentEffect;

    const strokeDocs: StrokeDoc[] = this.strokes.map(s => {
      const points: StrokeDocPoint[] = s.smoothed.map(p => {
        const out: StrokeDocPoint = { x: p.x, y: p.y };
        if (p.pressure !== undefined && p.pressure !== 1) {
          out.pressure = p.pressure;
        }
        return out;
      });
      const animParams = this.strokeAnimator.getAnimationParams(s.id);
      const doc: StrokeDoc = { id: s.id, points };
      if (s.effect && s.effect !== sessionEffect) doc.effect = s.effect;
      if (s.customColor != null) doc.customColor = s.customColor;
      if (s.customWidth != null) doc.customWidth = s.customWidth;
      if (animParams) doc.animation = Glymo.animationParamsToDoc(animParams);
      return doc;
    });

    const objectDocs: ObjectDoc[] = this.objectStore.getAllObjects().map(o => {
      const doc: ObjectDoc = {
        id: o.id,
        strokeIds: [...o.strokeIds],
        fillIds: [...o.fillIds],
        bbox: { ...o.bbox },
      };
      if (o.metadata && Object.keys(o.metadata).length > 0) {
        doc.metadata = { ...o.metadata };
      }
      return doc;
    });

    const dpr = this.options.pixelRatio || 1;
    const canvasW = Math.round(this.canvas.width / dpr);
    const canvasH = Math.round(this.canvas.height / dpr);

    // Recognised characters (Revision 2). Serialise only when text mode
    // produced typography — drawing-mode / empty payloads keep the wire
    // shape minimal by omitting the field entirely.
    const characterDocs = this.characterStore.getAllCharacters();

    const doc: SessionDoc = {
      version: 2,
      canvas: { w: canvasW, h: canvasH },
      effect: { name: sessionEffect },
      strokes: strokeDocs,
      objects: objectDocs,
      fills: fillDocs,
    };
    if (characterDocs.length > 0) {
      doc.characters = characterDocs;
    }
    return doc;
  }

  /**
   * Hydrate the Studio from a persisted session. Accepts the v2
   * {@link SessionDoc} or a legacy v1 {@link StrokeDoc} array (§4 D3).
   *
   * Referential integrity: objects referencing unknown strokes or fills
   * are dropped with a `console.warn`; the canvas does not throw on a
   * corrupt session. Stroke ids are preserved so object references resolve
   * after the round-trip.
   */
  async loadSession(payload: SessionDoc | StrokeDoc[]): Promise<void> {
    this.assertNotDestroyed();

    // D3: legacy v1 shape — a bare StrokeDoc[]
    if (Array.isArray(payload)) {
      this.resetSessionState();
      for (const sd of payload) {
        const stroke = this.strokeFromDoc(sd);
        this.strokes.push(stroke);
        this.renderer.addCompletedStroke(stroke);
      }
      this.renderer.markDirty();
      return;
    }

    const doc = payload;

    if (doc.fills.length > 0 && !this.bitmapLoader) {
      throw new GlymoError(
        'bitmap-loader-missing',
        'loadSession requires a BitmapLoader when the SessionDoc contains fills',
        { stage: 'load', recoverable: false },
      );
    }

    this.resetSessionState();

    const sessionEffect = doc.effect.name as EffectPresetName;
    this.setEffect(sessionEffect);

    // Strokes first — establish the id set before objects reference it.
    const validStrokeIds = new Set<string>();
    for (const sd of doc.strokes) {
      const stroke = this.strokeFromDoc(sd, sessionEffect);
      this.strokes.push(stroke);
      this.renderer.addCompletedStroke(stroke);
      validStrokeIds.add(stroke.id);
    }

    // Fills — parallel load; any rejection propagates. Size / MIME
    // enforcement belongs to the host loader.
    const loaded = await Promise.all(
      doc.fills.map(async (fd): Promise<Fill> => ({
        id: fd.id,
        color: fd.color,
        bitmap: await this.bitmapLoader!.load(fd.bitmap_url),
        createdAt: Date.now(),
      })),
    );
    const validFillIds = new Set<string>();
    for (const fill of loaded) {
      this.fills.push(fill);
      this.renderer.addFill(fill);
      validFillIds.add(fill.id);
    }

    // Objects — drop any with dangling refs per §4 D6.
    for (const od of doc.objects) {
      const danglingStroke = od.strokeIds.find(id => !validStrokeIds.has(id));
      const danglingFill = od.fillIds.find(id => !validFillIds.has(id));
      if (danglingStroke || danglingFill) {
        const what = danglingStroke
          ? `stroke "${danglingStroke}"`
          : `fill "${danglingFill}"`;
        console.warn(
          `[Glymo] loadSession: dropping object "${od.id}" — unresolved ${what}.`,
        );
        continue;
      }
      this.objectStore.restoreObject(
        od.id,
        od.strokeIds,
        od.fillIds,
        od.bbox,
        od.metadata,
      );
    }

    // Animations — each stroke carries its own params (D4). Wire →
    // runtime translation happens here so the rest of the engine keeps
    // using `AnimationParams` unchanged.
    for (const sd of doc.strokes) {
      if (!sd.animation || !sd.id) continue;
      if (!validStrokeIds.has(sd.id)) continue;
      this.strokeAnimator.addAnimation(
        [sd.id],
        Glymo.animationDocToParams(sd.animation),
      );
    }

    // Recognised characters (Revision 2). Empty payloads and drawing-mode
    // payloads simply omit the field — the store stays cleared from
    // `resetSessionState`. Emit a single `character:change` so the UI
    // adapter can hydrate its overlay state in one render pass.
    if (doc.characters && doc.characters.length > 0) {
      this.characterStore.loadCharacters(doc.characters);
      this.emitCharacterChange();
    }

    this.renderer.markDirty();
  }

  /**
   * Convert a runtime {@link AnimationParams} into the wire
   * {@link AnimationDoc} shape: `duration` → `durationMs`, `repeat` → `loop`.
   * Other optional fields pass through so type-specific params ('fly',
   * 'rotate', 'sparkle', 'keyframe') survive a round-trip.
   */
  private static animationParamsToDoc(params: AnimationParams): AnimationDoc {
    const doc: AnimationDoc = { type: params.type, durationMs: params.duration };
    if (params.repeat !== undefined) doc.loop = params.repeat;
    if (params.delay !== undefined) doc.delay = params.delay;
    if (params.direction !== undefined) doc.direction = params.direction;
    if (params.amplitude !== undefined) doc.amplitude = params.amplitude;
    if (params.speed !== undefined) doc.speed = params.speed;
    if (params.particleCount !== undefined) doc.particleCount = params.particleCount;
    if (params.keyframes !== undefined) doc.keyframes = params.keyframes.map(k => ({ ...k }));
    return doc;
  }

  /**
   * Reverse of {@link Glymo.animationParamsToDoc}. Missing `durationMs` on
   * the wire falls back to a 2000 ms cycle to match the engine defaults.
   */
  private static animationDocToParams(doc: AnimationDoc): AnimationParams {
    const params: AnimationParams = {
      type: doc.type,
      duration: doc.durationMs ?? 2000,
    };
    if (doc.loop !== undefined) params.repeat = doc.loop;
    if (doc.delay !== undefined) params.delay = doc.delay;
    if (doc.direction !== undefined) params.direction = doc.direction;
    if (doc.amplitude !== undefined) params.amplitude = doc.amplitude;
    if (doc.speed !== undefined) params.speed = doc.speed;
    if (doc.particleCount !== undefined) params.particleCount = doc.particleCount;
    if (doc.keyframes !== undefined) params.keyframes = doc.keyframes.map(k => ({ ...k }));
    return params;
  }

  /** Fully reset session-level state before a load. */
  private resetSessionState(): void {
    this.strokes = [];
    this.fills = [];
    this.strokeAnimator.clear();
    this.objectStore.clear();
    // CharacterStore is a live-observed store — UI mirrors (e.g. the React
    // `useTextRecognition` hook) subscribe to `character:change` to rebuild
    // their own cached lists. A silent `clear()` would leave those mirrors
    // stale until the next add/update/remove. When `resetSessionState` is
    // followed by `loadCharacters` + `emitCharacterChange` (the normal load
    // path) the mirror catches up naturally, but any caller that clears
    // without a subsequent load (tests, defensive resets, future flows)
    // would desync. Emit a single change event if the store had items so
    // the clear is observable to subscribers.
    const hadCharacters = this.characterStore.size > 0;
    this.characterStore.clear();
    if (hadCharacters) this.emitCharacterChange();
    this._pausedAnimations.clear();
    this._pausedObjectAnimations.clear();
    this.selectionManager.clearSelection();
    this.renderer.clearFills();
    this.renderer.clearAll();
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

    const style = resolveEffect(this.currentEffect);
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
    this.renderer.setBackgroundMode(this.backgroundMode);
    this.renderer.setBackgroundColor(this.backgroundColor);
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
