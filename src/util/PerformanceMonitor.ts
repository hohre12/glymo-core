// ── Performance Monitor ─────────────────────────────

// ── Constants ───────────────────────────────────────

export const PERF_WINDOW_SIZE = 60;
export const PERF_DEGRADED_THRESHOLD_MS = 12;
export const PERF_DEGRADED_CONSECUTIVE = 10;

// ── PerformanceMonitor ──────────────────────────────

/**
 * Tracks frame timings over a rolling window to detect
 * performance degradation.
 *
 * Usage: call startFrame() at the beginning of each frame
 * and endFrame() at the end. Query isPerformanceDegraded()
 * to check if performance has dropped below acceptable levels.
 */
export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private frameStart = 0;
  private consecutiveDegraded = 0;

  startFrame(): void {
    this.frameStart = performance.now();
  }

  endFrame(): void {
    const elapsed = performance.now() - this.frameStart;
    this.frameTimes.push(elapsed);

    if (this.frameTimes.length > PERF_WINDOW_SIZE) {
      this.frameTimes.shift();
    }

    this.updateDegradation(elapsed);
  }

  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return sum / this.frameTimes.length;
  }

  getMaxFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return Math.max(...this.frameTimes);
  }

  isPerformanceDegraded(): boolean {
    return this.consecutiveDegraded >= PERF_DEGRADED_CONSECUTIVE;
  }

  reset(): void {
    this.frameTimes = [];
    this.frameStart = 0;
    this.consecutiveDegraded = 0;
  }

  // ── Private ───────────────────────────────────────

  private updateDegradation(elapsed: number): void {
    if (elapsed > PERF_DEGRADED_THRESHOLD_MS) {
      this.consecutiveDegraded++;
    } else {
      this.consecutiveDegraded = 0;
    }
  }
}
