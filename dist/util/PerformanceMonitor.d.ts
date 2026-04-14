export declare const PERF_WINDOW_SIZE = 60;
export declare const PERF_DEGRADED_THRESHOLD_MS = 12;
export declare const PERF_DEGRADED_CONSECUTIVE = 10;
/**
 * Tracks frame timings over a rolling window to detect
 * performance degradation.
 *
 * Usage: call startFrame() at the beginning of each frame
 * and endFrame() at the end. Query isPerformanceDegraded()
 * to check if performance has dropped below acceptable levels.
 */
export declare class PerformanceMonitor {
    private frameTimes;
    private frameStart;
    private consecutiveDegraded;
    startFrame(): void;
    endFrame(): void;
    getAverageFrameTime(): number;
    getMaxFrameTime(): number;
    isPerformanceDegraded(): boolean;
    reset(): void;
    private updateDegradation;
}
