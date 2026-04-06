import type { EffectPresetName, Stroke, StrokePoint } from '../types.js';
import { EFFECT_PRESETS } from '../types.js';
import { renderGlowPass, renderMainStroke } from './StrokeRenderer.js';
import { ParticleSystem } from './ParticleSystem.js';
import type { MorphAnimator } from '../animate/MorphAnimator.js';
import type { FontMorphAnimator } from '../text/FontMorphAnimator.js';
import { PerformanceMonitor } from '../util/PerformanceMonitor.js';
import type { EventBus } from '../state/EventBus.js';
import type { IRenderer, RendererType } from './IRenderer.js';
import type { OverlayText } from '../text/types.js';

// ── Constants ────────────────────────────────────────

/** Background color */
const BG_COLOR = '#000000';

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
  private fadingStrokes: { stroke: Stroke; fadeStart: number; fadeDuration: number }[] = [];
  private morphAnimator: MorphAnimator | null = null;
  private fontMorphAnimator: FontMorphAnimator | null = null;
  private backgroundMode: 'solid' | 'transparent' = 'solid';
  private morphBurstFired = false;

  // Offscreen canvas cache for completed strokes — avoids re-rendering static strokes every frame
  private completedCache: OffscreenCanvas | null = null;
  private completedCacheCtx: OffscreenCanvasRenderingContext2D | null = null;
  private completedCacheDirty = true;

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

  /** Clear all strokes and particles */
  clearAll(): void {
    this.completedStrokes = [];
    this.overlayTexts = [];
    this.fadingStrokes = [];
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

    this.renderBackground();
    this.renderCompletedStrokes();
    this.renderMorphingStroke(dt);
    this.renderTextMorph();
    this.renderFadingStrokes();
    this.renderOverlayText();
    this.renderActiveStroke();
    this.particleSystem.updateAndRender(this.ctx, dt, degraded);

    this.perfMonitor.endFrame();
    this.emitDegradedIfNeeded(degraded);

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationId = requestAnimationFrame((t) => this.renderLoop(t));
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

  // ── Private: Layer 0 — Background ──────────────────

  private renderBackground(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.backgroundMode === 'solid') {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // 'transparent' mode: clearRect is sufficient — no fill
  }

  // ── Private: Layer 10 — Completed Strokes ──────────

  private renderCompletedStrokes(): void {
    if (this.completedStrokes.length === 0) return;

    // Re-render into the offscreen cache only when strokes have changed.
    // Every other frame we simply blit the cached bitmap — O(1) cost.
    if (this.completedCacheDirty && this.completedCacheCtx && this.completedCache) {
      this.completedCacheCtx.clearRect(0, 0, this.completedCache.width, this.completedCache.height);
      for (const stroke of this.completedStrokes) {
        if (stroke.smoothed.length < 2) continue;
        const style = EFFECT_PRESETS[stroke.effect];
        renderGlowPass(this.completedCacheCtx as unknown as CanvasRenderingContext2D, stroke.smoothed, style);
        renderMainStroke(this.completedCacheCtx as unknown as CanvasRenderingContext2D, stroke.smoothed, style);
      }
      this.completedCacheDirty = false;
    }

    if (this.completedCache) {
      this.ctx.drawImage(this.completedCache, 0, 0);
    }
  }

  // ── Private: Layer 20 — Morphing Stroke ─────────────

  private renderMorphingStroke(dt: number): void {
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

    const effect = animator.effect;
    const points = animator.update(dt);
    if (!points || points.length < 2) return;

    // Glow intensification: peaks at 2.0 at the midpoint of the animation
    const progress = animator.getProgress();
    const intensityScale = 1.0 + Math.sin(progress * Math.PI) * 1.0;

    const style = EFFECT_PRESETS[effect];
    renderGlowPass(this.ctx, points, style, intensityScale);
    renderMainStroke(this.ctx, points, style);
  }

  // ── Private: Layer 25 — Text Morph (FontMorphAnimator) ─

  private renderTextMorph(): void {
    const animator = this.fontMorphAnimator;
    if (!animator) return;

    const frame = animator.getLastFrame();
    if (!frame || frame.points.length === 0) return;

    const ctx = this.ctx;
    const points = frame.points;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Glow pass — connected path with gap detection
    const firstPt = points[0]!;
    const avgAlpha = points.reduce((s, p) => s + p.alpha, 0) / points.length;
    const glowColor = `rgba(${firstPt.color.r},${firstPt.color.g},${firstPt.color.b},${avgAlpha * 0.6})`;

    ctx.globalAlpha = avgAlpha * 0.7;
    ctx.strokeStyle = glowColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(firstPt.x, firstPt.y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      if (dx * dx + dy * dy > 400) {
        ctx.moveTo(curr.x, curr.y);
      } else {
        ctx.lineTo(curr.x, curr.y);
      }
    }
    ctx.stroke();

    // Main stroke pass — per-segment with per-point color and alpha
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = 1.0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      if (dx * dx + dy * dy > 400) continue;

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = `rgba(${curr.color.r},${curr.color.g},${curr.color.b},${curr.alpha})`;
      ctx.lineWidth = curr.size * 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Private: Layer 26 — Fading Strokes ─────────────

  private renderFadingStrokes(): void {
    const now = performance.now();
    this.fadingStrokes = this.fadingStrokes.filter(({ stroke, fadeStart, fadeDuration }) => {
      const elapsed = now - fadeStart;
      if (elapsed >= fadeDuration) return false;

      const alpha = 1.0 - (elapsed / fadeDuration);
      const style = EFFECT_PRESETS[stroke.effect];
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      renderGlowPass(this.ctx, stroke.smoothed, style);
      renderMainStroke(this.ctx, stroke.smoothed, style);
      this.ctx.restore();
      return true;
    });
  }

  // ── Private: Layer 27 — Overlay Text ───────────────

  private renderOverlayText(): void {
    if (this.overlayTexts.length === 0) return;

    const ctx = this.ctx;
    const now = performance.now();

    for (const overlay of this.overlayTexts) {
      const elapsed = now - overlay.startTime;
      const alpha = Math.min(1, elapsed / overlay.fadeDuration);

      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.font = overlay.font;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      const metrics = ctx.measureText(overlay.text);
      const textWidth = metrics.width;
      const textHeight = metrics.actualBoundingBoxDescent ?? 72;

      // Scale text to fit stroke bounding box
      const scaleX = overlay.width / Math.max(textWidth, 1);
      const scaleY = overlay.height / Math.max(textHeight, 1);
      const scale = Math.min(scaleX, scaleY, 3);

      const cx = overlay.x + overlay.width / 2;
      const cy = overlay.y + overlay.height / 2;

      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-textWidth / 2, -textHeight / 2);

      // Glow pass
      const glowIntensity = 0.5 + alpha * 0.5;
      ctx.shadowColor = overlay.glowColor;
      ctx.shadowBlur = overlay.glowSize * glowIntensity;
      ctx.fillStyle = overlay.effectColor;
      ctx.fillText(overlay.text, 0, 0);

      // Crisp pass on top
      ctx.shadowBlur = 0;
      ctx.fillText(overlay.text, 0, 0);

      ctx.restore();
    }
  }

  // ── Private: Layer 30 — Active Stroke ──────────────

  private renderActiveStroke(): void {
    const points = this.activePoints;
    if (points.length === 0) return;

    const style = EFFECT_PRESETS[this.activeEffect];

    if (points.length === 1) {
      // Single point: draw as a small glowing dot using the preset color
      const { ctx } = this;
      const pt = points[0]!;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, style.minWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = style.color;
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur = style.glowSize * 0.3;
      ctx.fill();
      ctx.restore();
      return;
    }

    // Two or more points: render a live single-pass glow + main stroke for performance
    const { ctx } = this;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Single shadow glow pass
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = style.glowSize * 0.6;
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = style.glowColor;
    ctx.lineWidth = style.maxWidth;
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();

    // Core stroke on top
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.minWidth;
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();

    ctx.restore();
  }
}
