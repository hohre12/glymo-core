import {
  CameraCapture,
  PINCH_THRESHOLD,
  MODEL_URL,
  WASM_URL,
  computePinchDistance,
  computeSpeed,
  zToPressure,
} from '../src/input/CameraCapture.js';

// NOTE: Z_PEN_THRESHOLD and SPEED_GATE_THRESHOLD were removed from the public
// API in commit 118dad5 (refactor: extract GestureDetector and camera utils).
// Tests for those exports have been removed accordingly.

const mockFn = vi.fn;

// ── Mock setup ───────────────────────────────────────

function createMockCanvas() {
  return {
    width: 800,
    height: 600,
    addEventListener: mockFn(),
    removeEventListener: mockFn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  } as unknown as HTMLCanvasElement;
}

// ── Constants ────────────────────────────────────────

describe('CameraCapture constants', () => {
  // PINCH_THRESHOLD was tuned from 0.055 → 0.045 in commit be952d6
  // ("fix: reduce PINCH_THRESHOLD for better magic tool sensitivity",
  //  rationale: ~18% tighter to reduce accidental pinch activations).
  // Deliberate — the test must track the production constant, not infer it.
  // Per CLAUDE.md: no changing OneEuroFilter/gesture parameters without testing;
  // this test is the enforcement gate.
  it('exports PINCH_THRESHOLD as the locked value 0.045', () => {
    expect(PINCH_THRESHOLD).toBe(0.045);
  });

  // Z_PEN_THRESHOLD and SPEED_GATE_THRESHOLD were removed in the refactor
  // commit 118dad5 ("extract GestureDetector and camera utils from CameraCapture").
  // These constants were never part of the public API and were not re-exported
  // after extraction. The tests below are removed because the exports no longer
  // exist.  Any future re-introduction must be a deliberate public-API addition
  // with its own test entry here.
  //
  // (tests previously at lines 35–43 removed as part of Cat A cleanup — 2026-04-20)

  it('exports MODEL_URL', () => {
    expect(MODEL_URL).toContain('hand_landmarker');
  });

  it('exports WASM_URL', () => {
    expect(WASM_URL).toContain('mediapipe');
  });
});

// ── computePinchDistance ─────────────────────────────

describe('computePinchDistance', () => {
  it('returns 0 for identical points', () => {
    const lm = { x: 0.5, y: 0.5, z: 0 };
    expect(computePinchDistance(lm, lm)).toBe(0);
  });

  it('returns correct Euclidean distance', () => {
    const thumb = { x: 0.0, y: 0.0, z: 0 };
    const index = { x: 0.3, y: 0.4, z: 0 };
    expect(computePinchDistance(thumb, index)).toBeCloseTo(0.5, 5);
  });

  it('detects pinch when distance < threshold', () => {
    const thumb = { x: 0.5, y: 0.5, z: 0 };
    const index = { x: 0.5 + PINCH_THRESHOLD * 0.5, y: 0.5, z: 0 };
    expect(computePinchDistance(thumb, index)).toBeLessThan(PINCH_THRESHOLD);
  });

  it('rejects pinch when distance > threshold', () => {
    const thumb = { x: 0.0, y: 0.0, z: 0 };
    const index = { x: 0.5, y: 0.5, z: 0 };
    expect(computePinchDistance(thumb, index)).toBeGreaterThan(PINCH_THRESHOLD);
  });
});

// ── computeSpeed ────────────────────────────────────

describe('computeSpeed', () => {
  it('returns correct speed in px/ms', () => {
    const prev = { x: 0, y: 0, t: 100 };
    const curr = { x: 30, y: 40 };
    const now = 200;
    // distance = 50, dt = 100ms -> speed = 0.5 px/ms
    expect(computeSpeed(prev, curr, now)).toBeCloseTo(0.5, 5);
  });

  it('returns Infinity for zero time delta', () => {
    const prev = { x: 0, y: 0, t: 100 };
    const curr = { x: 10, y: 10 };
    expect(computeSpeed(prev, curr, 100)).toBe(Infinity);
  });

  it('returns 0 for no movement', () => {
    const prev = { x: 50, y: 50, t: 100 };
    const curr = { x: 50, y: 50 };
    expect(computeSpeed(prev, curr, 200)).toBe(0);
  });

  // SPEED_GATE_THRESHOLD is no longer exported (removed in refactor commit 118dad5).
  // These tests verify the numeric output of computeSpeed directly:
  //   ultra-fast: 600px / 10ms = 60 px/ms — should be very large
  //   normal draw: 5px / 33ms ≈ 0.15 px/ms — should be very small
  it('returns large speed for ultra-fast movements (60 px/ms)', () => {
    const prev = { x: 0, y: 0, t: 100 };
    const curr = { x: 600, y: 0 };
    expect(computeSpeed(prev, curr, 110)).toBeCloseTo(60, 0);
  });

  it('returns small speed for normal drawing movements (~0.15 px/ms)', () => {
    const prev = { x: 100, y: 100, t: 100 };
    const curr = { x: 105, y: 100 };
    expect(computeSpeed(prev, curr, 133)).toBeCloseTo(5 / 33, 2);
  });
});

// ── zToPressure ─────────────────────────────────────

// zToPressure: maps [-0.15, 0] → [1.0, 0.6]
// The floor was raised from 0.3 to 0.6 in commit 118dad5
// ("refactor: extract GestureDetector and camera utils") with the note:
// "Raised floor from 0.3 to 0.6 so camera strokes are never too thin."
// Deliberate — this is a UX decision, not an accident.
// Formula: 0.6 + clamp(0, 1, -z / 0.15) * 0.4
describe('zToPressure', () => {
  it('returns max pressure (1.0) for z = -0.15', () => {
    expect(zToPressure(-0.15)).toBeCloseTo(1.0, 5);
  });

  it('returns min pressure (0.6) for z = 0 (floor raised from 0.3 in commit 118dad5)', () => {
    expect(zToPressure(0)).toBeCloseTo(0.6, 5);
  });

  it('returns min pressure (0.6) for positive z (clamped at floor)', () => {
    expect(zToPressure(0.05)).toBeCloseTo(0.6, 5);
  });

  it('returns clamped max (1.0) for z < -0.15', () => {
    expect(zToPressure(-0.3)).toBeCloseTo(1.0, 5);
  });

  it('returns mid-range pressure (0.8) for z = -0.075', () => {
    // 0.6 + clamp(0.5) * 0.4 = 0.6 + 0.2 = 0.8
    expect(zToPressure(-0.075)).toBeCloseTo(0.8, 5);
  });
});

// ── Instantiation ────────────────────────────────────

describe('CameraCapture instantiation', () => {
  it('can be instantiated with callbacks', () => {
    const capture = new CameraCapture(() => {}, () => {}, () => {});
    expect(capture).toBeInstanceOf(CameraCapture);
  });

  it('can be instantiated without error callback', () => {
    const capture = new CameraCapture(() => {}, () => {});
    expect(capture).toBeInstanceOf(CameraCapture);
  });

  it('isActive returns false before start', () => {
    const capture = new CameraCapture(() => {}, () => {});
    expect(capture.isActive()).toBe(false);
  });
});

// ── Lifecycle ────────────────────────────────────────

describe('CameraCapture lifecycle', () => {
  it('stop is safe when not started', () => {
    const capture = new CameraCapture(() => {}, () => {});
    expect(() => capture.stop()).not.toThrow();
  });

  it('stop sets isActive to false', () => {
    const capture = new CameraCapture(() => {}, () => {});
    capture.stop();
    expect(capture.isActive()).toBe(false);
  });
});

// ── Node environment guard ───────────────────────────

describe('CameraCapture Node environment guard', () => {
  it('emits error when window is undefined', () => {
    const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

    // Temporarily remove window
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const errors: Error[] = [];
    const capture = new CameraCapture(
      () => {},
      () => {},
      (err) => errors.push(err),
    );

    capture.start(createMockCanvas());

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('browser environment');
    expect(capture.isActive()).toBe(false);

    // Restore
    if (savedWindow) {
      Object.defineProperty(globalThis, 'window', savedWindow);
    }
  });
});

// ── MediaPipe load failure ───────────────────────────

describe('CameraCapture MediaPipe load failure', () => {
  it('handles MediaPipe import failure gracefully', async () => {
    // In test environment, @mediapipe/tasks-vision is not installed,
    // so the dynamic import will fail — this tests the error path.
    const errors: Error[] = [];
    const capture = new CameraCapture(
      () => {},
      () => {},
      (err) => errors.push(err),
    );

    capture.start(createMockCanvas());

    // Wait for async init to fail
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(capture.isActive()).toBe(false);
  });
});
