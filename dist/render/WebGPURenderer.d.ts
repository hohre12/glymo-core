import { EffectPresetName, Fill, Stroke, StrokePoint } from '../types.js';
import { MorphAnimator } from '../animate/MorphAnimator.js';
import { FontMorphAnimator } from '../text/FontMorphAnimator.js';
import { EventBus } from '../state/EventBus.js';
import { IRenderer, RendererType } from './IRenderer.js';
import { OverlayText } from '../text/types.js';
export declare function isWebGPUAvailable(): boolean;
export declare function requestGPUDevice(): Promise<{
    device: GPUDevice;
} | null>;
export declare class WebGPURenderer implements IRenderer {
    readonly type: RendererType;
    private readonly canvas;
    private readonly dpr;
    private device;
    private gpuContext;
    private format;
    private strokePipeline;
    private glowPipeline;
    private uniformBuffer;
    private uniformBindGroup;
    private animationId;
    private lastFrameTime;
    private elapsedTime;
    private completedStrokes;
    private activePoints;
    private activeEffect;
    private morphAnimator;
    private getActivePointsFn;
    private overlayCanvas;
    private overlayCtx;
    private initialized;
    constructor(canvas: HTMLCanvasElement, dpr?: number);
    init(): Promise<boolean>;
    setEventBus(_bus: EventBus): void;
    start(): void;
    stop(): void;
    setActivePointsSource(fn: () => ReadonlyArray<StrokePoint>): void;
    setMorphAnimator(a: MorphAnimator | null): void;
    /** No-op — text morph rendering is not supported in WebGPU mode */
    setFontMorphAnimator(_animator: FontMorphAnimator | null): void;
    /** No-op — overlay text rendering is not supported in WebGPU mode */
    setOverlayText(_overlay: OverlayText | null): void;
    /** No-op — overlay text rendering is not supported in WebGPU mode */
    clearOverlayText(): void;
    /** No-op — selection rendering is not yet supported in WebGPU mode */
    markDirty(): void;
    /** No-op — fill rendering is not yet supported in WebGPU mode */
    addFill(_fill: Fill): void;
    /** No-op — fill rendering is not yet supported in WebGPU mode */
    removeLastFill(): Fill | undefined;
    /** No-op — fill rendering is not yet supported in WebGPU mode */
    removeFillById(_fillId: string): Fill | undefined;
    /** No-op — fill rendering is not yet supported in WebGPU mode */
    clearFills(): void;
    /** No-op — fill rendering is not yet supported in WebGPU mode */
    getFillCount(): number;
    addCompletedStroke(s: Stroke): void;
    removeLastStroke(): Stroke | undefined;
    removeStrokeById(strokeId: string): Stroke | undefined;
    fadeOutLastStroke(_durationMs: number): Stroke | undefined;
    fadeOutStrokeById(strokeId: string, _durationMs: number): Stroke | undefined;
    clearAll(): void;
    setEffect(name: EffectPresetName): void;
    getEffect(): EffectPresetName;
    getStrokeCount(): number;
    /** No-op for WebGPU renderer — background is always cleared by the GPU load op */
    setBackgroundMode(_mode: 'solid' | 'transparent'): void;
    destroy(): void;
    isGPUEffect(name: EffectPresetName): boolean;
    private createPipelines;
    private renderLoop;
    private renderFrame;
    /** Build quad geometry for a stroke and draw it */
    private drawStroke;
    /** Convert stroke points into triangle strip quads with color */
    private buildStrokeGeometry;
    private setupOverlay;
    private removeOverlay;
    private renderOverlay;
}
