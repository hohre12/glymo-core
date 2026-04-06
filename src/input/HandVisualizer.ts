import type { Landmark } from './CameraCapture.js';
import { createHandStyle, HandStyleBase } from './hand-styles/index.js';
import type { HandStyleName } from './hand-styles/index.js';

// ── Re-export for consumers that import HAND_CONNECTIONS directly ─────────────
export { HAND_CONNECTIONS } from './hand-styles/constants.js';

// ── HandVisualizer ───────────────────────────────────────────────────────────

/**
 * Renders a hand skeleton overlay on a canvas element.
 *
 * In 'full' mode, delegates all rendering to the active HandStyle.
 * In 'minimal' mode, only draws the index-finger cursor dot (no style system).
 *
 * Style can be changed at runtime via {@link setStyle}.
 * Default style: 'neon-skeleton' (identical to the original visual output).
 */
export class HandVisualizer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly mode: 'full' | 'minimal';

  /** Currently active rendering style (only used when mode === 'full') */
  private style: HandStyleBase;
  /** Name of the currently active style */
  private styleName: HandStyleName;

  constructor(
    canvas: HTMLCanvasElement,
    mode: 'full' | 'minimal' = 'full',
    style: HandStyleName = 'neon-skeleton',
  ) {
    this.canvas = canvas;
    this.mode = mode;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('HandVisualizer: cannot get 2d context');
    this.ctx = ctx;

    this.styleName = style;
    this.style = createHandStyle(style);
  }

  /**
   * Switch to a different rendering style.
   * Destroys the previous style's particle/animation state first.
   */
  setStyle(name: HandStyleName): void {
    if (name === this.styleName) return;
    this.style.destroy();
    this.styleName = name;
    this.style = createHandStyle(name);
  }

  /** Returns the name of the currently active style. */
  getStyle(): HandStyleName {
    return this.styleName;
  }

  /**
   * Draw the hand skeleton overlay for a single frame.
   * @param skipClear — if true, don't clear the canvas (used for drawing a second hand)
   */
  draw(landmarks: Landmark[], isPinching: boolean, skipClear = false): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    if (!skipClear) ctx.clearRect(0, 0, w, h);
    if (landmarks.length === 0) return;

    if (this.mode === 'full') {
      // Delegate all rendering to the active style
      this.style.draw({
        landmarks,
        isPinching,
        canvasWidth: w,
        canvasHeight: h,
        ctx,
        time: performance.now(),
        dpr: window.devicePixelRatio ?? 1,
      });
    } else {
      // Minimal mode: just the index cursor dot
      this.drawMinimalCursor(landmarks, w, h, isPinching);
    }
  }

  /** Clear the overlay canvas. */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Destroy all style state (call when removing the visualizer). */
  destroy(): void {
    this.style.destroy();
  }

  // ── Minimal mode cursor ───────────────────────────────────────────────────

  private drawMinimalCursor(
    landmarks: Landmark[],
    w: number,
    h: number,
    isPinching: boolean,
  ): void {
    const INDEX_TIP = 8;
    const tip = landmarks[INDEX_TIP];
    if (!tip) return;

    const { ctx } = this;
    const x = (1 - tip.x) * w;
    const y = tip.y * h;
    const color = isPinching ? 'rgba(0, 255, 204, 1.0)' : 'rgba(255, 100, 100, 0.6)';

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}
