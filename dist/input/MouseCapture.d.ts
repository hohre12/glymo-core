import { InputCapture, RawInputPoint } from '../types.js';
type PointCallback = (point: RawInputPoint) => void;
type PenStateCallback = (isDown: boolean) => void;
/**
 * Captures mouse/touch input via PointerEvent API.
 * Normalizes coordinates to canvas space with DPR scaling.
 */
export declare class MouseCapture implements InputCapture {
    private canvas;
    private active;
    private pointerDown;
    private readonly onPoint;
    private readonly onPenState;
    private handlePointerDown;
    private handlePointerMove;
    private handlePointerUp;
    constructor(onPoint: PointCallback, onPenState: PenStateCallback);
    /** Bind pointer events to the canvas */
    start(canvas: HTMLCanvasElement): void;
    /** Remove all pointer event listeners */
    stop(): void;
    isActive(): boolean;
    private bindEvents;
    private unbindEvents;
    private onDown;
    private onMove;
    private onUp;
    private emitPoint;
}
export {};
