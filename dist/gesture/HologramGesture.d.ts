import { HologramGestureState, HitTestResult } from '../hologram/types.js';
/** Landmark point with x, y, z in normalized [0,1] coordinates */
export interface LandmarkPoint {
    x: number;
    y: number;
    z: number;
}
/**
 * Stateful gesture processor for hologram manipulation.
 *
 * Feed it hand landmarks each frame via `update()`, and it produces
 * a `HologramGestureState` describing the desired hologram transforms.
 *
 * Two-hand mode: spread/rotation via relative hand distance, midpoint, and wrist angle.
 * Single-hand mode: pinch-to-grab individual characters.
 */
export declare class HologramGesture {
    private rotX;
    private rotY;
    private rotZ;
    private spread;
    private baseline;
    private smoothMidX;
    private smoothMidY;
    private twoHandEntryTime;
    private bothFistsPrev;
    private grabbedCharId;
    /** Smoothing factor for midpoint (lower = heavier smoothing) */
    readonly midpointSmoothing: number;
    /** Dead zone radius for rotation joystick (0-0.5, normalized coords) */
    readonly deadZone: number;
    /** Rotation speed multiplier */
    readonly rotSpeed: number;
    /** Assumed FPS for per-frame rotation increment */
    readonly fps: number;
    /** Pinch threshold in normalized hand coords */
    readonly pinchThreshold: number;
    /** Spread smoothing factor */
    readonly spreadSmoothing: number;
    /** Z-rotation smoothing factor */
    readonly rotZSmoothing: number;
    /** Maximum Z angle delta per frame (prevents hand-swap spikes) */
    readonly maxZDelta: number;
    /** Delay before two-hand manipulation kicks in (ms) */
    readonly twoHandStableDelay: number;
    /** Callback for hit-testing characters (provided by the consumer) */
    private hitTestFn;
    constructor(options?: {
        midpointSmoothing?: number;
        deadZone?: number;
        rotSpeed?: number;
        fps?: number;
        pinchThreshold?: number;
        spreadSmoothing?: number;
        rotZSmoothing?: number;
        maxZDelta?: number;
        twoHandStableDelay?: number;
    });
    /** Set the hit-test function used for single-hand grab */
    setHitTestFn(fn: (x: number, y: number, maxDist: number) => HitTestResult | null): void;
    /** Reset all state to defaults */
    reset(): void;
    /**
     * Process one frame of hand landmarks and return the desired hologram state.
     *
     * @param landmarks - Primary hand landmarks (21 points, normalized [0,1])
     * @param secondHand - Optional secondary hand landmarks
     * @param canvasWidth - Canvas width in CSS pixels (for pinch coordinate conversion)
     * @param canvasHeight - Canvas height in CSS pixels
     * @param mirrorX - Whether to mirror the X axis (selfie camera). Default true.
     * @returns The updated hologram gesture state
     */
    update(landmarks: ReadonlyArray<LandmarkPoint>, secondHand: ReadonlyArray<LandmarkPoint> | null, canvasWidth: number, canvasHeight: number, mirrorX?: boolean): HologramGestureState;
    /** Get current rotation values (useful for external reset logic) */
    getRotation(): {
        rotX: number;
        rotY: number;
        rotZ: number;
    };
    /** Get current spread value */
    getSpread(): number;
    /** Directly set rotation (e.g. after external reset) */
    setRotation(rotX: number, rotY: number, rotZ: number): void;
    /** Directly set spread (e.g. after external reset) */
    setSpread(spread: number): void;
}
