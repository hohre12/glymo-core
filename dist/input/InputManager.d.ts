import { RawInputPoint } from '../types.js';
import { CameraCapture } from './CameraCapture.js';
type PointCallback = (point: RawInputPoint) => void;
type PenStateCallback = (isDown: boolean) => void;
type ErrorCallback = (error: Error) => void;
type TransitMoveCallback = (x: number, y: number) => void;
/**
 * Manages input sources and routes events to the pipeline.
 * Supports mouse/touch via PointerEvent API and camera via MediaPipe.
 */
export declare class InputManager {
    private mouseCapture;
    private cameraCapture;
    private onPoint;
    private onPenState;
    private onError;
    private onSuccess;
    private alwaysDrawMode;
    private workerUrl;
    private onHandVisibility;
    /** Set the callback for incoming points */
    setPointCallback(callback: PointCallback): void;
    /** Set the callback for pen state changes (down/up) */
    setPenStateCallback(callback: PenStateCallback): void;
    /** Set the callback for input errors (e.g., camera denied) */
    setErrorCallback(callback: ErrorCallback): void;
    /** Set the callback for successful camera initialization */
    setSuccessCallback(callback: () => void): void;
    /** Attach mouse/touch capture to the given canvas */
    attachMouse(canvas: HTMLCanvasElement): void;
    /** Attach camera capture (MediaPipe HandLandmarker) to the canvas */
    attachCamera(canvas: HTMLCanvasElement): void;
    /** Detach mouse/touch capture */
    detachMouse(): void;
    /** Detach camera capture */
    detachCamera(): void;
    /** Detach all input sources */
    detachAll(): void;
    /** Set callback for hand visibility changes */
    setHandVisibilityCallback(cb: ((visible: boolean) => void) | null): void;
    /** Set external Worker URL for off-thread MediaPipe detection */
    setWorkerUrl(url: string): void;
    /** Enable gesture-based draw mode on camera */
    setCameraAlwaysDrawMode(enabled: boolean): void;
    /** Pause/resume all drawing input (landmarks still fire) */
    setDrawingPaused(paused: boolean): void;
    /** Set callback for transit move events (sparkle trail between letters) */
    setTransitMoveCallback(cb: TransitMoveCallback | null): void;
    /**
     * Register callbacks for second-hand (hand index 1) drawing events.
     * When set, the second hand can draw simultaneously with the first hand.
     * Pass null for both to disable second-hand drawing.
     */
    setSecondHandCallbacks(onPoint: PointCallback | null, onPenState: PenStateCallback | null): void;
    /** Check if any input source is currently active */
    hasActiveSource(): boolean;
    /** Get the current CameraCapture instance (null if not attached) */
    getCameraCapture(): CameraCapture | null;
}
export {};
