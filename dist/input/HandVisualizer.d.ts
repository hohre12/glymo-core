import { Landmark } from './CameraCapture.js';
import { HandStyleName } from './hand-styles/index.js';
export { HAND_CONNECTIONS } from './hand-styles/constants.js';
/**
 * Renders a hand skeleton overlay on a canvas element.
 *
 * In 'full' mode, delegates all rendering to the active HandStyle.
 * In 'minimal' mode, only draws the index-finger cursor dot (no style system).
 *
 * Style can be changed at runtime via {@link setStyle}.
 * Default style: 'neon-skeleton' (identical to the original visual output).
 */
export declare class HandVisualizer {
    private readonly canvas;
    private readonly ctx;
    private readonly mode;
    /** Currently active rendering style (only used when mode === 'full') */
    private style;
    /** Name of the currently active style */
    private styleName;
    constructor(canvas: HTMLCanvasElement, mode?: 'full' | 'minimal', style?: HandStyleName);
    /**
     * Switch to a different rendering style.
     * Destroys the previous style's particle/animation state first.
     */
    setStyle(name: HandStyleName): void;
    /** Returns the name of the currently active style. */
    getStyle(): HandStyleName;
    /**
     * Draw the hand skeleton overlay for a single frame.
     * @param skipClear — if true, don't clear the canvas (used for drawing a second hand)
     */
    draw(landmarks: Landmark[], isPinching: boolean, skipClear?: boolean): void;
    /** Clear the overlay canvas. */
    clear(): void;
    /** Destroy all style state (call when removing the visualizer). */
    destroy(): void;
    private drawMinimalCursor;
}
