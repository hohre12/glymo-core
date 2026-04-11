// ── Hologram 3D Types ─────────────────────────────────────────────────────────

/**
 * Minimal character data needed by the hologram renderer.
 * Extends the base RecognizedChar from CascadingRecognizer with animation fields.
 */
export interface HologramChar {
  id: string;
  char: string;
  /** CSS x-coordinate of the character center */
  x: number;
  /** CSS y-coordinate of the character center */
  y: number;
  width: number;
  height: number;
  /** performance.now() timestamp when the character entered */
  entryTime: number;
  /** Whether the character is being deleted (should be hidden) */
  isDeleting?: boolean;
}

/** Configuration for creating a Hologram3DRenderer */
export interface Hologram3DRendererOptions {
  /** The canvas element to render into */
  canvas: HTMLCanvasElement;
}

/** Result of a character hit test */
export interface HitTestResult {
  /** Character ID */
  id: string;
  /** Distance from the test point in CSS pixels */
  dist: number;
}

/** Snapshot of hologram manipulation state, output by HologramGesture */
export interface HologramGestureState {
  /** X-axis rotation in radians */
  rotX: number;
  /** Y-axis rotation in radians */
  rotY: number;
  /** Z-axis rotation in radians */
  rotZ: number;
  /** Spread multiplier: 0 = flat, 1 = normal, 2+ = explosion */
  spread: number;
  /** Whether two hands are actively controlling the hologram */
  handsActive: boolean;
  /** Currently grabbed character ID, or null */
  grabbedCharId: string | null;
  /** Grab position in CSS coords, if a char is grabbed */
  grabPosition: { x: number; y: number } | null;
  /** Whether the user just performed a reset gesture (both fists) */
  didReset: boolean;
}
