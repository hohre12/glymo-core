/**
 * Lightweight diagnostic bus for the 6-stage pipeline.
 *
 * Zero overhead when disabled: every call site short-circuits on a single
 * boolean check before allocating an event object. Consumers (e.g. landing's
 * `strokeDiag` subscriber) enable via `DiagBus.enable()` after detecting the
 * `?diag=1` query param.
 *
 * This bus is deliberately separate from `EventBus` so production event
 * contracts stay clean and tree-shakers can drop diag code in release builds
 * where `DiagBus.enabled` is statically false.
 */
export type DiagStage = 'capture' | 'stabilize' | 'pressure' | 'segment' | 'smooth' | 'recognize';
export interface DiagEvent {
    stage: DiagStage;
    /** Monotonic stroke identifier. Matches `Stroke.id` when available. */
    strokeId: string;
    /** Number of points entering this stage (undefined for per-point stages). */
    pointsIn?: number;
    /** Number of points leaving this stage (undefined if the stage is per-point). */
    pointsOut?: number;
    /** Stage wall-clock duration in milliseconds. */
    timeMs: number;
    /** Stage-specific metadata (input source, reason for drop, etc.). */
    meta?: Record<string, unknown>;
    /** High-resolution timestamp (performance.now()) when the event fired. */
    ts: number;
}
export type DiagListener = (event: DiagEvent) => void;
declare class DiagBusImpl {
    private _enabled;
    private listeners;
    get enabled(): boolean;
    enable(): void;
    disable(): void;
    subscribe(listener: DiagListener): () => void;
    /** Emit a diag event. No-op when disabled; no allocation in caller. */
    emit(event: DiagEvent): void;
}
export declare const DiagBus: DiagBusImpl;
export {};
