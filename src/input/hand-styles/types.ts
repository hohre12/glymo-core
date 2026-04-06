// ── Hand Style Types ─────────────────────────────────

/** Available hand rendering style names */
export type HandStyleName = 'neon-skeleton' | 'crystal' | 'flame' | 'aurora' | 'particle-cloud';

/** Configuration passed to each style's draw call */
export interface HandStyleConfig {
  /** Normalized landmark positions from MediaPipe (x,y,z in [0,1]) */
  landmarks: Array<{ x: number; y: number; z: number }>;
  /** Whether the hand is currently pinching (thumb + index close) */
  isPinching: boolean;
  /** Canvas width in physical pixels */
  canvasWidth: number;
  /** Canvas height in physical pixels */
  canvasHeight: number;
  /** 2D rendering context */
  ctx: CanvasRenderingContext2D;
  /** performance.now() timestamp for animation — use for sin/cos oscillations */
  time: number;
  /** Device pixel ratio */
  dpr: number;
}

/**
 * Abstract base class for all hand rendering styles.
 * Each concrete style encapsulates its own rendering logic and state.
 */
export abstract class HandStyleBase {
  /** Unique name identifying this style */
  abstract readonly name: HandStyleName;

  /**
   * Render one frame of the hand visualization.
   * The canvas is already cleared before this is called.
   */
  abstract draw(config: HandStyleConfig): void;

  /**
   * Release any persistent state (particle arrays, animation frames, etc.).
   * Called before switching to a different style.
   */
  destroy(): void {}
}
