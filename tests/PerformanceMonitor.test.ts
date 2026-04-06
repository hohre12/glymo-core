import {
  PerformanceMonitor,
  PERF_WINDOW_SIZE,
  PERF_DEGRADED_THRESHOLD_MS,
  PERF_DEGRADED_CONSECUTIVE,
} from '../src/util/PerformanceMonitor.js';

// ── Helpers ─────────────────────────────────────────

/** Simulate N frames, each taking `ms` milliseconds */
function simulateFrames(
  monitor: PerformanceMonitor,
  count: number,
  ms: number,
): void {
  let now = 1000;
  const originalNow = performance.now;
  for (let i = 0; i < count; i++) {
    performance.now = () => now;
    monitor.startFrame();
    now += ms;
    performance.now = () => now;
    monitor.endFrame();
    now += 1; // small gap between frames
  }
  performance.now = originalNow;
}

// ── Constants ───────────────────────────────────────

describe('PerformanceMonitor constants', () => {
  it('PERF_WINDOW_SIZE is 60', () => {
    expect(PERF_WINDOW_SIZE).toBe(60);
  });

  it('PERF_DEGRADED_THRESHOLD_MS is 12', () => {
    expect(PERF_DEGRADED_THRESHOLD_MS).toBe(12);
  });

  it('PERF_DEGRADED_CONSECUTIVE is 10', () => {
    expect(PERF_DEGRADED_CONSECUTIVE).toBe(10);
  });
});

// ── Frame Timing Recording ──────────────────────────

describe('PerformanceMonitor frame timing', () => {
  it('records frame times', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, 5, 8);
    expect(monitor.getAverageFrameTime()).toBeCloseTo(8, 0);
  });

  it('returns 0 average with no frames', () => {
    const monitor = new PerformanceMonitor();
    expect(monitor.getAverageFrameTime()).toBe(0);
  });

  it('returns 0 max with no frames', () => {
    const monitor = new PerformanceMonitor();
    expect(monitor.getMaxFrameTime()).toBe(0);
  });

  it('caps at PERF_WINDOW_SIZE frames', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, PERF_WINDOW_SIZE + 20, 10);
    // Internal array should not grow beyond window
    // Average should still be ~10ms (all frames same)
    expect(monitor.getAverageFrameTime()).toBeCloseTo(10, 0);
  });
});

// ── Rolling Average ─────────────────────────────────

describe('PerformanceMonitor rolling average', () => {
  it('computes correct average for uniform frames', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, 10, 5);
    expect(monitor.getAverageFrameTime()).toBeCloseTo(5, 0);
  });

  it('rolling window drops old frames', () => {
    const monitor = new PerformanceMonitor();
    // Fill with 60 fast frames
    simulateFrames(monitor, PERF_WINDOW_SIZE, 2);
    expect(monitor.getAverageFrameTime()).toBeCloseTo(2, 0);

    // Add 60 slow frames — old fast frames should be dropped
    simulateFrames(monitor, PERF_WINDOW_SIZE, 15);
    expect(monitor.getAverageFrameTime()).toBeCloseTo(15, 0);
  });

  it('tracks max frame time', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, 5, 3);
    simulateFrames(monitor, 1, 20);
    simulateFrames(monitor, 5, 3);
    expect(monitor.getMaxFrameTime()).toBeCloseTo(20, 0);
  });
});

// ── Degradation Detection ───────────────────────────

describe('PerformanceMonitor degradation detection', () => {
  it('not degraded with fast frames', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, 20, 5);
    expect(monitor.isPerformanceDegraded()).toBe(false);
  });

  it('not degraded initially', () => {
    const monitor = new PerformanceMonitor();
    expect(monitor.isPerformanceDegraded()).toBe(false);
  });

  it('degraded after consecutive slow frames', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, PERF_DEGRADED_CONSECUTIVE, 15);
    expect(monitor.isPerformanceDegraded()).toBe(true);
  });

  it('not degraded if slow frames < threshold count', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, PERF_DEGRADED_CONSECUTIVE - 1, 15);
    expect(monitor.isPerformanceDegraded()).toBe(false);
  });

  it('resets consecutive counter on fast frame', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, PERF_DEGRADED_CONSECUTIVE - 1, 15);
    simulateFrames(monitor, 1, 5); // one fast frame resets
    simulateFrames(monitor, PERF_DEGRADED_CONSECUTIVE - 1, 15);
    expect(monitor.isPerformanceDegraded()).toBe(false);
  });

  it('exactly at threshold ms is not degraded', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, PERF_DEGRADED_CONSECUTIVE, PERF_DEGRADED_THRESHOLD_MS);
    expect(monitor.isPerformanceDegraded()).toBe(false);
  });

  it('one ms above threshold triggers degradation', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, PERF_DEGRADED_CONSECUTIVE, PERF_DEGRADED_THRESHOLD_MS + 1);
    expect(monitor.isPerformanceDegraded()).toBe(true);
  });
});

// ── Reset ───────────────────────────────────────────

describe('PerformanceMonitor reset', () => {
  it('clears all state', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, PERF_DEGRADED_CONSECUTIVE, 15);
    expect(monitor.isPerformanceDegraded()).toBe(true);

    monitor.reset();

    expect(monitor.getAverageFrameTime()).toBe(0);
    expect(monitor.getMaxFrameTime()).toBe(0);
    expect(monitor.isPerformanceDegraded()).toBe(false);
  });

  it('can record frames after reset', () => {
    const monitor = new PerformanceMonitor();
    simulateFrames(monitor, 5, 10);
    monitor.reset();
    simulateFrames(monitor, 5, 6);
    expect(monitor.getAverageFrameTime()).toBeCloseTo(6, 0);
  });
});
