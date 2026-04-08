import type { RawInputPoint } from '../types.js';
import { MouseCapture } from './MouseCapture.js';
import { CameraCapture } from './CameraCapture.js';

type PointCallback = (point: RawInputPoint) => void;
type PenStateCallback = (isDown: boolean) => void;
type ErrorCallback = (error: Error) => void;
type TransitMoveCallback = (x: number, y: number) => void;

/**
 * Manages input sources and routes events to the pipeline.
 * Supports mouse/touch via PointerEvent API and camera via MediaPipe.
 */
export class InputManager {
  private mouseCapture: MouseCapture | null = null;
  private cameraCapture: CameraCapture | null = null;

  private onPoint: PointCallback = () => {};
  private onPenState: PenStateCallback = () => {};
  private onError: ErrorCallback = () => {};
  private onSuccess: () => void = () => {};
  private alwaysDrawMode = false;
  private workerUrl: string | null = null;
  private onHandVisibility: ((visible: boolean) => void) | null = null;

  /** Set the callback for incoming points */
  setPointCallback(callback: PointCallback): void {
    this.onPoint = callback;
  }

  /** Set the callback for pen state changes (down/up) */
  setPenStateCallback(callback: PenStateCallback): void {
    this.onPenState = callback;
  }

  /** Set the callback for input errors (e.g., camera denied) */
  setErrorCallback(callback: ErrorCallback): void {
    this.onError = callback;
  }

  /** Set the callback for successful camera initialization */
  setSuccessCallback(callback: () => void): void {
    this.onSuccess = callback;
  }

  /** Attach mouse/touch capture to the given canvas */
  attachMouse(canvas: HTMLCanvasElement): void {
    this.detachMouse();

    this.mouseCapture = new MouseCapture(
      (point) => this.onPoint(point),
      (isDown) => this.onPenState(isDown),
    );
    this.mouseCapture.start(canvas);
  }

  /** Attach camera capture (MediaPipe HandLandmarker) to the canvas */
  attachCamera(canvas: HTMLCanvasElement): void {
    this.detachCamera();

    this.cameraCapture = new CameraCapture(
      (point) => this.onPoint(point),
      (isDown) => this.onPenState(isDown),
      (err) => this.onError(err),
      () => this.onSuccess(),
    );
    // Apply stored settings to new camera instance
    if (this.workerUrl) {
      this.cameraCapture.setWorkerUrl(this.workerUrl);
    }
    if (this.alwaysDrawMode) {
      this.cameraCapture.setAlwaysDrawMode(true);
    }
    // Forward hand visibility callback
    if (this.onHandVisibility) {
      this.cameraCapture.setHandVisibilityCallback(this.onHandVisibility);
    }
    this.cameraCapture.start(canvas);
  }

  /** Detach mouse/touch capture */
  detachMouse(): void {
    if (this.mouseCapture) {
      this.mouseCapture.stop();
      this.mouseCapture = null;
    }
  }

  /** Detach camera capture */
  detachCamera(): void {
    if (this.cameraCapture) {
      this.cameraCapture.stop();
      this.cameraCapture = null;
    }
  }

  /** Detach all input sources */
  detachAll(): void {
    this.detachMouse();
    this.detachCamera();
  }

  /** Set callback for hand visibility changes */
  setHandVisibilityCallback(cb: ((visible: boolean) => void) | null): void {
    this.onHandVisibility = cb;
    this.cameraCapture?.setHandVisibilityCallback(cb);
  }

  /** Set external Worker URL for off-thread MediaPipe detection */
  setWorkerUrl(url: string): void {
    this.workerUrl = url;
    this.cameraCapture?.setWorkerUrl(url);
  }

  /** Enable gesture-based draw mode on camera */
  setCameraAlwaysDrawMode(enabled: boolean): void {
    this.alwaysDrawMode = enabled;
    this.cameraCapture?.setAlwaysDrawMode(enabled);
  }

  /** Pause/resume all drawing input (landmarks still fire) */
  setDrawingPaused(paused: boolean): void {
    this.cameraCapture?.setDrawingPaused(paused);
  }

  /** Set callback for transit move events (sparkle trail between letters) */
  setTransitMoveCallback(cb: TransitMoveCallback | null): void {
    this.cameraCapture?.setTransitMoveCallback(cb);
  }

  /**
   * Register callbacks for second-hand (hand index 1) drawing events.
   * When set, the second hand can draw simultaneously with the first hand.
   * Pass null for both to disable second-hand drawing.
   */
  setSecondHandCallbacks(
    onPoint: PointCallback | null,
    onPenState: PenStateCallback | null,
  ): void {
    this.cameraCapture?.setSecondHandCallbacks(onPoint, onPenState);
  }

  /** Check if any input source is currently active */
  hasActiveSource(): boolean {
    return (this.mouseCapture?.isActive() ?? false)
      || (this.cameraCapture?.isActive() ?? false);
  }

  /** Get the current CameraCapture instance (null if not attached) */
  getCameraCapture(): CameraCapture | null {
    return this.cameraCapture;
  }
}
