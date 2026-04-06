import type { EffectPresetName, Stroke, StrokePoint } from '../types.js';
import type { MorphAnimator } from '../animate/MorphAnimator.js';
import type { FontMorphAnimator } from '../text/FontMorphAnimator.js';
import type { EventBus } from '../state/EventBus.js';
import type { OverlayText } from '../text/types.js';

// ── Renderer Type ───────────────────────────────────

export type RendererType = 'canvas2d' | 'webgpu';

// ── IRenderer Interface ─────────────────────────────

/**
 * Common interface for all Glymo renderers.
 *
 * Both CanvasRenderer and WebGPURenderer implement this
 * so the Glymo class can swap them transparently.
 */
export interface IRenderer {
  /** The renderer backend type */
  readonly type: RendererType;

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

  /** Add a completed stroke for rendering */
  addCompletedStroke(stroke: Stroke): void;

  /** Remove the last completed stroke (undo) */
  removeLastStroke(): Stroke | undefined;

  /** Fade out the last completed stroke over the given duration (ms), then remove it */
  fadeOutLastStroke(durationMs: number): Stroke | undefined;

  /** Clear all strokes and particles */
  clearAll(): void;

  /** Set the current effect preset */
  setEffect(name: EffectPresetName): void;

  /** Get the current effect preset */
  getEffect(): EffectPresetName;

  /** Get current stroke count */
  getStrokeCount(): number;

  /** Set background rendering mode */
  setBackgroundMode(mode: 'solid' | 'transparent'): void;

  /** Destroy renderer and release resources */
  destroy(): void;

  /** Set an overlay text to render above strokes (Mode A) */
  setOverlayText(overlay: OverlayText | null): void;

  /** Clear all overlay texts and fading strokes */
  clearOverlayText(): void;
}
