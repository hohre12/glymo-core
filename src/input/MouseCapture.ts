import type { InputCapture, RawInputPoint } from '../types.js';

type PointCallback = (point: RawInputPoint) => void;
type PenStateCallback = (isDown: boolean) => void;

/**
 * Captures mouse/touch input via PointerEvent API.
 * Normalizes coordinates to canvas space with DPR scaling.
 */
export class MouseCapture implements InputCapture {
  private canvas: HTMLCanvasElement | null = null;
  private active = false;
  private pointerDown = false;

  private readonly onPoint: PointCallback;
  private readonly onPenState: PenStateCallback;

  // Bound handlers for cleanup
  private handlePointerDown: ((e: PointerEvent) => void) | null = null;
  private handlePointerMove: ((e: PointerEvent) => void) | null = null;
  private handlePointerUp: ((e: PointerEvent) => void) | null = null;

  constructor(onPoint: PointCallback, onPenState: PenStateCallback) {
    this.onPoint = onPoint;
    this.onPenState = onPenState;
  }

  /** Bind pointer events to the canvas */
  start(canvas: HTMLCanvasElement): void {
    if (this.active) return;

    this.canvas = canvas;
    this.active = true;
    this.bindEvents(canvas);
  }

  /** Remove all pointer event listeners */
  stop(): void {
    if (!this.active || !this.canvas) return;

    this.unbindEvents(this.canvas);
    this.canvas = null;
    this.active = false;
    this.pointerDown = false;
  }

  isActive(): boolean {
    return this.active;
  }

  private bindEvents(canvas: HTMLCanvasElement): void {
    this.handlePointerDown = (e: PointerEvent) => this.onDown(e);
    this.handlePointerMove = (e: PointerEvent) => this.onMove(e);
    this.handlePointerUp = () => this.onUp();

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointerleave', this.handlePointerUp);
  }

  private unbindEvents(canvas: HTMLCanvasElement): void {
    if (this.handlePointerDown) {
      canvas.removeEventListener('pointerdown', this.handlePointerDown);
    }
    if (this.handlePointerMove) {
      canvas.removeEventListener('pointermove', this.handlePointerMove);
    }
    if (this.handlePointerUp) {
      canvas.removeEventListener('pointerup', this.handlePointerUp);
      canvas.removeEventListener('pointerleave', this.handlePointerUp);
    }
  }

  private onDown(e: PointerEvent): void {
    this.pointerDown = true;
    this.onPenState(true);
    this.emitPoint(e);
  }

  private onMove(e: PointerEvent): void {
    if (!this.pointerDown) return;
    this.emitPoint(e);
  }

  private onUp(): void {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    this.onPenState(false);
  }

  private emitPoint(e: PointerEvent): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    const point: RawInputPoint = {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
      t: performance.now(),
      source: e.pointerType === 'touch' ? 'touch' : 'mouse',
      pressure: e.pressure > 0 ? e.pressure : undefined,
    };

    this.onPoint(point);
  }
}
