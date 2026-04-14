import { InputCapture, RawInputPoint } from '../types.js';
import { PINCH_THRESHOLD } from '../gesture/constants.js';
import { computePinchDistance, computeSpeed, zToPressure } from './camera-utils.js';
export { PINCH_THRESHOLD };
export { computePinchDistance, computeSpeed, zToPressure };
/** MediaPipe hand landmarker model URL */
export declare const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
/** MediaPipe WASM runtime URL */
export declare const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
export interface Landmark {
    x: number;
    y: number;
    z: number;
}
export interface HandLandmarkerResult {
    landmarks: Landmark[][];
    worldLandmarks: Landmark[][];
}
type PointCallback = (point: RawInputPoint) => void;
type PenStateCallback = (isDown: boolean) => void;
type ErrorCallback = (error: Error) => void;
type SuccessCallback = () => void;
/** Callback for raw landmark data (used by HandVisualizer) */
type LandmarkCallback = (landmarks: Landmark[], isPinching: boolean, secondHand?: Landmark[]) => void;
/**
 * Captures hand input via MediaPipe HandLandmarker.
 * Dynamically imports @mediapipe/tasks-vision (optional peer dependency).
 *
 * Pen state: pinch only (thumb tip to index tip distance).
 * Debounced over N frames to reject noise.
 * Auto stroke-break when pinch-held hand jumps a large distance.
 *
 * Speed gate rejects ultra-fast hand movements to filter noise.
 * Mirror correction flips X for front-facing camera.
 */
export declare class CameraCapture implements InputCapture {
    private canvas;
    private video;
    private stream;
    private handLandmarker;
    private animFrameId;
    private active;
    private worker;
    private workerBusy;
    private workerReady;
    private workerInitTimeout;
    /** External worker URL — when set, uses a same-origin module worker instead of inline Blob */
    private externalWorkerUrl;
    private penDown;
    private alwaysDrawMode;
    private drawingPaused;
    private onTransitMove;
    private gestureDetector;
    private noHandFrames;
    private readonly NO_HAND_DEBOUNCE;
    private pendingStateFrames;
    private pendingState;
    private lastDrawPos;
    private pauseFrames;
    private pausedAt;
    private xFilter;
    private yFilter;
    private penDown2;
    private pendingStateFrames2;
    private pendingState2;
    private lastDrawPos2;
    private xFilter2;
    private yFilter2;
    private onPoint2;
    private onPenState2;
    private readonly onPoint;
    private readonly onPenState;
    private readonly onError;
    private readonly onSuccess;
    private onLandmarks;
    private onGestureLandmarks;
    private onHandVisibility;
    private handWasVisible;
    constructor(onPoint: PointCallback, onPenState: PenStateCallback, onError?: ErrorCallback, onSuccess?: SuccessCallback);
    /**
     * Set an external worker URL for off-thread MediaPipe detection.
     * The file must be served from the same origin (e.g. /mediapipe-worker.mjs in public/).
     * Must be called before start().
     */
    setWorkerUrl(url: string): void;
    /** Enable gesture-based draw mode: ☝️ point = draw, ✊ fist/other = don't draw */
    setAlwaysDrawMode(enabled: boolean): void;
    /** Set callback for transit move events (fast hand movement between letters) */
    setTransitMoveCallback(cb: ((x: number, y: number) => void) | null): void;
    /** Pause/resume all drawing input. Landmarks + hand visibility still fire. */
    setDrawingPaused(paused: boolean): void;
    /** Set callback for hand visibility changes (for hand:lost / hand:found events) */
    setHandVisibilityCallback(cb: ((visible: boolean) => void) | null): void;
    /** Register a callback to receive raw landmark data each frame */
    setLandmarkCallback(cb: LandmarkCallback | null): void;
    /** Register a callback that receives raw landmarks every frame for gesture processing */
    setGestureCallback(cb: ((landmarks: Landmark[], secondHand?: Landmark[]) => void) | null): void;
    /**
     * Register callbacks for second-hand (hand index 1) drawing events.
     * When set, the second hand uses pinch detection to draw independently
     * from the first hand. Pass null to disable second-hand drawing.
     */
    setSecondHandCallbacks(onPoint: PointCallback | null, onPenState: PenStateCallback | null): void;
    /** Return the internal video element (for webcam preview) */
    getVideoElement(): HTMLVideoElement | null;
    /** Initialize camera + MediaPipe and start detection loop */
    start(canvas: HTMLCanvasElement): void;
    /** Stop detection, release camera and resources */
    stop(): void;
    isActive(): boolean;
    private initAsync;
    /**
     * Detect if the device has a unified GPU (shared CPU/GPU memory)
     * where Worker mode causes GPU contention. Returns true for sync preference.
     *
     * Uses WebGPU adapter info when available, falls back to heuristics.
     */
    private static shouldPreferSync;
    /** Fallback: load MediaPipe on main thread and start sync detection loop */
    private initMediaPipeSync;
    private startCamera;
    private handleInitError;
    /**
     * Try to create a Worker for off-thread MediaPipe detection.
     * Prefers external same-origin URL (module worker) over inline Blob (classic worker).
     * Returns true if Worker was created and init message sent.
     */
    private tryCreateWorker;
    /** Count of consecutive detection-time Worker errors. */
    private workerDetectErrors;
    private static readonly MAX_WORKER_ERRORS;
    private static readonly CALIBRATION_FRAMES;
    private static readonly ROUNDTRIP_THRESHOLD_MS;
    private calibrationRoundtrips;
    private workerSendTime;
    private calibrationDone;
    private handleWorkerMessage;
    /** Send one video frame to the Worker (non-blocking). */
    private sendFrameToWorker;
    private startWorkerDetectionLoop;
    private terminateWorker;
    private startDetectionLoop;
    /** Sync fallback: detect + process in one blocking call. */
    private processFrameSync;
    /**
     * Process a detection result (from Worker or sync fallback).
     * All landmark processing, gesture detection, filtering, and callbacks.
     */
    private processDetectionResult;
    /**
     * Process the second hand (index 1) for drawing via pinch detection.
     * Uses its own filters and pen state, independent of hand 0.
     * Only called when second-hand callbacks are registered.
     */
    private processSecondHand;
    /**
     * Detect pen state using pinch only, with debouncing.
     * Requires PEN_STATE_DEBOUNCE_FRAMES consecutive frames of the new state
     * before actually transitioning, to reject MediaPipe tracking noise.
     */
    private detectPenState;
    private emitPoint;
    private cancelAnimationFrame;
    private releaseCamera;
    private releaseHandLandmarker;
}
