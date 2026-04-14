import { GestureDetectorFn, GestureEvent } from './types.js';
/** Minimal landmark shape accepted by the engine (matches MediaPipe output) */
export interface RawLandmark {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}
/** Internal event emitter callback shape */
export type GestureEmitFn = (event: string, data: GestureEvent) => void;
/**
 * Per-frame gesture evaluation engine.
 *
 * Usage:
 * ```ts
 * const engine = new GestureEngine((event, data) => {
 *   console.log(event, data.gesture);
 * });
 *
 * engine.define('wave', (hand) => hand.extended('index', 'middle', 'ring', 'pinky'));
 *
 * // Inside MediaPipe result loop:
 * engine.update(result.landmarks[0], result.landmarks[1]);
 * ```
 *
 * Built-in gestures (pinch, fist, point, open-palm, peace-sign, thumbs-up) are
 * registered automatically at construction time.
 *
 * Debouncing: a gesture must be detected for GESTURE_ACTIVATE_FRAMES consecutive
 * frames before `gesture:<name>` fires, and absent for GESTURE_DEACTIVATE_FRAMES
 * consecutive frames before `gesture:<name>:end` fires.
 */
export declare class GestureEngine {
    private readonly _emit;
    private readonly _gestures;
    /**
     * @param emit - Called on every gesture start/end transition.
     *   event format: `gesture:<name>` (start) or `gesture:<name>:end` (end)
     */
    constructor(emit: GestureEmitFn);
    /**
     * Register a custom gesture detector under a unique name.
     * If a gesture with the same name already exists it is replaced.
     *
     * @param name     - Unique gesture identifier (e.g. `'wave'`)
     * @param detector - Predicate function; return true while gesture is active
     */
    define(name: string, detector: GestureDetectorFn): void;
    /**
     * Evaluate all registered gestures for one frame.
     *
     * @param landmarks   - Primary hand landmark array (21 points).
     *   Pass an empty array or undefined when no hand is detected — all active
     *   gestures will begin their deactivation countdown.
     * @param secondHandLandmarks - Optional second hand landmarks.
     */
    update(landmarks: ReadonlyArray<RawLandmark> | undefined, secondHandLandmarks?: ReadonlyArray<RawLandmark>): void;
    /**
     * Query the current stable state of a gesture.
     *
     * @returns `'active'` if the gesture has been debounced into active state,
     *          `'inactive'` otherwise.
     */
    getState(name: string): 'active' | 'inactive';
    /** Register all built-in gestures at construction time */
    private _registerBuiltins;
    /**
     * Run a detector function and swallow any thrown exceptions.
     * Returning false on error is the safe fallback: a broken detector should
     * not crash the whole frame update.
     */
    private _safeDetect;
    /**
     * Apply debounce logic and emit transition events when state changes.
     *
     * State machine (per gesture):
     *   inactive → active  : requires GESTURE_ACTIVATE_FRAMES   consecutive detected frames
     *   active   → inactive: requires GESTURE_DEACTIVATE_FRAMES consecutive absent frames
     */
    private _updateRecord;
    /** Build and dispatch a GestureEvent */
    private _emitEvent;
}
