import type { EffectPresetName, Fill, Stroke, StrokePoint } from '../types.js';
import { EFFECT_PRESETS } from '../types.js';
import { ParticleSystem } from './ParticleSystem.js';
import type { MorphAnimator } from '../animate/MorphAnimator.js';
import type { FontMorphAnimator } from '../text/FontMorphAnimator.js';
import { PerformanceMonitor } from '../util/PerformanceMonitor.js';
import type { EventBus } from '../state/EventBus.js';
import type { IRenderer, RendererType } from './IRenderer.js';
import type { OverlayText } from '../text/types.js';
import type { StrokeAnimator } from '../animation/StrokeAnimator.js';
import type { ObjectStore } from '../store/ObjectStore.js';

import { renderBackground } from './layers/background.js';
import { renderCompletedStrokes } from './layers/completed.js';
import { renderMorphingStroke } from './layers/morph.js';
import { renderTextMorph } from './layers/textMorph.js';
import { renderFadingStrokes } from './layers/fading.js';
import type { FadingStroke } from './layers/fading.js';
import { renderOverlayText } from './layers/overlay.js';
import { renderActiveStroke } from './layers/active.js';
import { renderFills } from './layers/fill.js';
import { renderSelection } from './layers/selection.js';
import type { SelectionManager } from '../selection/SelectionManager.js';

// ── CanvasRenderer ───────────────────────────────────

/**
 * Stage 6: EFFECT — Canvas 2D Rendering (design.md SS4.6)
 *
 * RAF loop with 6-layer compositing.
 * Layers: bg(0), completed(10), morphing(20), active(30), particles(40), ui(50)
 */
export class CanvasRenderer implements IRenderer {
  readonly type: RendererType = 'canvas2d';
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly dpr: number;
  private readonly particleSystem = new ParticleSystem();
  private readonly perfMonitor = new PerformanceMonitor();

  private eventBus: EventBus | null = null;
  private animationId: number | null = null;
  private lastFrameTime = 0;
  private degradedEmitted = false;

  private completedStrokes: Stroke[] = [];
  private activePoints: ReadonlyArray<StrokePoint> = [];
  private activeEffect: EffectPresetName = 'neon';
  private overlayTexts: OverlayText[] = [];
  private fadingStrokes: FadingStroke[] = [];
  private morphAnimator: MorphAnimator | null = null;
  private fontMorphAnimator: FontMorphAnimator | null = null;
  private backgroundMode: 'solid' | 'transparent' = 'solid';
  private morphBurstFired = false;
  private lastSparkleSpawn = 0;
  private static readonly SPARKLE_INTERVAL = 120; // ms between sparkle particle spawns

  // Offscreen canvas cache for completed strokes — avoids re-rendering static strokes every frame
  private completedCache: OffscreenCanvas | null = null;
  private completedCacheCtx: OffscreenCanvasRenderingContext2D | null = null;
  private completedCacheDirty = true;

  private fills: Fill[] = [];

  private strokeAnimator: StrokeAnimator | null = null;
  private objectStore: ObjectStore | null = null;
  private selectionManager: SelectionManager | null = null;

  private getActivePointsFn: (() => ReadonlyArray<StrokePoint>) | null = null;

  constructor(canvas: HTMLCanvasElement, dpr: number = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) {
    this.canvas = canvas;
    this.dpr = dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    this.setupCanvas();
  }

  /** Attach an EventBus for emitting performance events */
  setEventBus(bus: EventBus): void {
    this.eventBus = bus;
  }

  /** Start the render loop */
  start(): void {
    if (this.animationId !== null) return;
    if (typeof requestAnimationFrame === 'undefined') return;
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame((t) => this.renderLoop(t));
  }

  /** Stop the render loop */
  stop(): void {
    if (this.animationId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /** Set the function that provides active stroke points */
  setActivePointsSource(fn: () => ReadonlyArray<StrokePoint>): void {
    this.getActivePointsFn = fn;
  }

  /** Set or clear the active morph animator (layer 20) */
  setMorphAnimator(animator: MorphAnimator | null): void {
    // Reset burst flag whenever a new animator is installed
    if (animator !== null && this.morphAnimator === null) {
      this.morphBurstFired = false;
    }
    this.morphAnimator = animator;
  }

  /** Set or clear the FontMorphAnimator for text morph rendering */
  setFontMorphAnimator(animator: FontMorphAnimator | null): void {
    this.fontMorphAnimator = animator;
  }

  /** Set the StrokeAnimator for per-stroke animation transforms */
  setStrokeAnimator(animator: StrokeAnimator | null): void {
    this.strokeAnimator = animator;
  }

  /** Set the ObjectStore for object-aware fill rendering */
  setObjectStore(store: ObjectStore | null): void {
    this.objectStore = store;
  }

  /** Set the SelectionManager for rendering selection highlights */
  setSelectionManager(manager: SelectionManager | null): void {
    this.selectionManager = manager;
  }

  /** Mark completed strokes cache as dirty (triggers re-render) */
  markDirty(): void {
    this.completedCacheDirty = true;
  }

  /** Set background rendering mode — 'transparent' skips the black fill */
  setBackgroundMode(mode: 'solid' | 'transparent'): void {
    this.backgroundMode = mode;
  }

  /** Add a completed stroke for rendering */
  addCompletedStroke(stroke: Stroke): void {
    this.completedStrokes.push(stroke);
    this.particleSystem.spawnForStroke(stroke);
    this.completedCacheDirty = true;
  }

  /** Remove the last completed stroke (undo) */
  removeLastStroke(): Stroke | undefined {
    const removed = this.completedStrokes.pop();
    this.completedCacheDirty = true;
    return removed;
  }

  /** Remove a specific completed stroke by ID (immediate, no fade) */
  removeStrokeById(strokeId: string): Stroke | undefined {
    const idx = this.completedStrokes.findIndex(s => s.id === strokeId);
    if (idx === -1) return undefined;
    const [removed] = this.completedStrokes.splice(idx, 1);
    this.completedCacheDirty = true;
    return removed;
  }

  /** Fade out the last completed stroke over durationMs, then auto-remove */
  fadeOutLastStroke(durationMs: number): Stroke | undefined {
    const removed = this.completedStrokes.pop();
    if (removed) {
      this.fadingStrokes.push({
        stroke: removed,
        fadeStart: performance.now(),
        fadeDuration: durationMs,
      });
      this.completedCacheDirty = true;
    }
    return removed;
  }

  /** Fade out a specific stroke by ID over durationMs, then auto-remove */
  fadeOutStrokeById(strokeId: string, durationMs: number): Stroke | undefined {
    const idx = this.completedStrokes.findIndex(s => s.id === strokeId);
    if (idx === -1) return undefined;
    const [removed] = this.completedStrokes.splice(idx, 1);
    this.fadingStrokes.push({
      stroke: removed!,
      fadeStart: performance.now(),
      fadeDuration: durationMs,
    });
    this.completedCacheDirty = true;
    return removed;
  }

  /** Clear all strokes, fills, and particles */
  clearAll(): void {
    this.completedStrokes = [];
    this.overlayTexts = [];
    this.fadingStrokes = [];
    this.clearFills();
    this.particleSystem.clear();
    this.completedCacheDirty = true;
  }

  /** Set an overlay text to render above strokes (Mode A) */
  setOverlayText(overlay: OverlayText | null): void {
    if (overlay) {
      this.overlayTexts.push(overlay);
      // Move completed strokes to fading list so they dissolve while text fades in
      for (const stroke of this.completedStrokes) {
        this.fadingStrokes.push({
          stroke,
          fadeStart: performance.now(),
          fadeDuration: overlay.fadeDuration,
        });
      }
      this.completedStrokes = [];
      this.completedCacheDirty = true;
      // Particle burst at centre of text bounding box
      const cx = overlay.x + overlay.width / 2;
      const cy = overlay.y + overlay.height / 2;
      this.particleSystem.spawnBurstAtPosition(cx, cy, overlay.glowColor, 40);
    }
  }

  /** Clear all overlay texts and fading strokes */
  clearOverlayText(): void {
    this.overlayTexts = [];
    this.fadingStrokes = [];
  }

  /** Set the current effect preset */
  setEffect(name: EffectPresetName): void {
    this.activeEffect = name;
  }

  /** Get the current effect preset */
  getEffect(): EffectPresetName {
    return this.activeEffect;
  }

  /** Get current stroke count */
  getStrokeCount(): number {
    return this.completedStrokes.length;
  }

  // ── Fill Methods ───────────────────────────────────

  /** Add a fill bitmap to render below strokes */
  addFill(fill: Fill): void {
    this.fills.push(fill);
  }

  /** Remove the last fill (undo) */
  removeLastFill(): Fill | undefined {
    return this.fills.pop();
  }

  /** Remove a specific fill by ID */
  removeFillById(fillId: string): Fill | undefined {
    const idx = this.fills.findIndex(f => f.id === fillId);
    if (idx === -1) return undefined;
    const [removed] = this.fills.splice(idx, 1);
    return removed;
  }

  /** Clear all fills */
  clearFills(): void {
    this.fills = [];
  }

  /** Get current fill count */
  getFillCount(): number {
    return this.fills.length;
  }

  /** Destroy renderer and release resources */
  destroy(): void {
    this.stop();
    this.clearAll();
  }

  // ── Private: Setup ──────────────────────────────────

  private setupCanvas(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    // Create offscreen canvas matching the main canvas size for completed-stroke caching
    this.completedCache = new OffscreenCanvas(this.canvas.width, this.canvas.height);
    this.completedCacheCtx = this.completedCache.getContext('2d')!;
    this.completedCacheDirty = true;
  }

  // ── Private: Render Loop ────────────────────────────

  private renderLoop(timestamp: number): void {
    this.perfMonitor.startFrame();

    const dt = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    const degraded = this.perfMonitor.isPerformanceDegraded();

    this.activePoints = this.getActivePointsFn?.() ?? [];

    // Layer 0 — Background
    renderBackground(this.ctx, this.canvas.width, this.canvas.height, this.backgroundMode);

    // Layer 5 — Fills (below strokes, with object animation transforms)
    renderFills(this.ctx, this.fills, this.objectStore, this.strokeAnimator);

    // Layer 10 — Completed strokes (offscreen cache + animation transforms)
    this.completedCacheDirty = renderCompletedStrokes(
      this.ctx,
      this.completedStrokes,
      this.completedCache,
      this.completedCacheCtx,
      this.completedCacheDirty,
      this.strokeAnimator,
      this.objectStore,
    );

    // Layer 15 — Selection highlights (marching ants)
    if (this.selectionManager && this.selectionManager.count > 0 && this.objectStore) {
      renderSelection(
        this.ctx,
        this.selectionManager.getSelectedIds(),
        this.objectStore,
        EFFECT_PRESETS[this.activeEffect].color,
        timestamp,
        this.dpr,
      );
    }

    // Layer 20 — Morphing stroke
    this.renderMorphLayer(dt);

    // Layer 25 — Text morph
    this.renderTextMorphLayer();

    // Layer 26 — Fading strokes
    this.fadingStrokes = renderFadingStrokes(this.ctx, this.fadingStrokes, performance.now());

    // Layer 27 — Overlay text
    renderOverlayText(this.ctx, this.overlayTexts, performance.now());

    // Layer 30 — Active stroke
    renderActiveStroke(this.ctx, this.activePoints, EFFECT_PRESETS[this.activeEffect]);

    // Sparkle particle spawning (throttled)
    this.spawnSparkleParticles(timestamp);

    // Layer 40 — Particles
    this.particleSystem.updateAndRender(this.ctx, dt, degraded);

    this.perfMonitor.endFrame();
    this.emitDegradedIfNeeded(degraded);

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationId = requestAnimationFrame((t) => this.renderLoop(t));
    }
  }

  /**
   * Orchestrate morph layer — manages animator state and particle burst,
   * then delegates pure rendering to the extracted layer function.
   */
  private renderMorphLayer(dt: number): void {
    // Capture to local — update() may synchronously trigger morph:complete
    // which calls setMorphAnimator(null), nullifying the instance field.
    const animator = this.morphAnimator;
    if (!animator?.isActive()) return;

    // Fire a one-shot particle burst at the very start of the morph
    if (!this.morphBurstFired) {
      this.morphBurstFired = true;
      const morphStroke = animator.sourceStroke;
      if (morphStroke) {
        this.particleSystem.spawnBurstForMorph(morphStroke);
      }
    }

    const points = animator.update(dt);
    if (!points || points.length < 2) return;

    renderMorphingStroke(this.ctx, {
      effect: animator.effect,
      points,
      progress: animator.getProgress(),
    });
  }

  /**
   * Orchestrate text morph layer — reads animator frame and delegates rendering.
   */
  private renderTextMorphLayer(): void {
    const animator = this.fontMorphAnimator;
    if (!animator) return;

    const frame = animator.getLastFrame();
    if (!frame || frame.points.length === 0) return;

    renderTextMorph(this.ctx, frame);
  }

  /** Spawn sparkle particles along strokes with active sparkle animations */
  private spawnSparkleParticles(now: number): void {
    if (!this.strokeAnimator?.hasAnimations()) return;
    if (now - this.lastSparkleSpawn < CanvasRenderer.SPARKLE_INTERVAL) return;

    this.lastSparkleSpawn = now;
    const sparkleIds = this.strokeAnimator.getSparkleStrokeIds(now);

    for (const id of sparkleIds) {
      const stroke = this.completedStrokes.find((s) => s.id === id);
      if (!stroke || stroke.smoothed.length < 2) continue;
      const style = EFFECT_PRESETS[stroke.effect];
      this.particleSystem.spawnSparkleAlongStroke(stroke.smoothed, style.particleColor);
    }
  }

  private emitDegradedIfNeeded(degraded: boolean): void {
    if (degraded && !this.degradedEmitted) {
      this.degradedEmitted = true;
      this.eventBus?.emit('performance:degraded');
    } else if (!degraded && this.degradedEmitted) {
      this.degradedEmitted = false;
    }
  }
}
