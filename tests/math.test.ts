import { clamp, distance, hexToRgb, lerpGradient, resamplePoints } from '../src/util/math.js';

// ── clamp ─────────────────────────────────────────────

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns min when value is below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('returns max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('handles negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });
});

// ── distance ──────────────────────────────────────────

describe('distance', () => {
  it('calculates distance between two points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('returns 0 for same point', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('is symmetric', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 4, y: 6 };
    expect(distance(a, b)).toBe(distance(b, a));
  });

  it('handles negative coordinates', () => {
    expect(distance({ x: -3, y: 0 }, { x: 0, y: 4 })).toBe(5);
  });
});

// ── hexToRgb ──────────────────────────────────────────

describe('hexToRgb', () => {
  it('converts #ff0000 to red', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('converts #00ff00 to green', () => {
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('converts #0000ff to blue', () => {
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('converts #ffffff to white', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('converts #000000 to black', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('handles hex without # prefix', () => {
    expect(hexToRgb('ff6b35')).toEqual({ r: 255, g: 107, b: 53 });
  });

  it('converts #00ffaa correctly (neon preset)', () => {
    expect(hexToRgb('#00ffaa')).toEqual({ r: 0, g: 255, b: 170 });
  });
});

// ── lerpGradient ──────────────────────────────────────

describe('lerpGradient', () => {
  it('returns start color at t=0', () => {
    const result = lerpGradient(['#000000', '#ffffff'], 0);
    expect(result).toBe('rgb(0, 0, 0)');
  });

  it('returns end color at t=1', () => {
    const result = lerpGradient(['#000000', '#ffffff'], 1);
    expect(result).toBe('rgb(255, 255, 255)');
  });

  it('returns midpoint at t=0.5 for 2-stop gradient', () => {
    const result = lerpGradient(['#000000', '#ffffff'], 0.5);
    expect(result).toBe('rgb(128, 128, 128)');
  });

  it('handles 3-stop gradient', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff'];
    // t=0 → red
    expect(lerpGradient(colors, 0)).toBe('rgb(255, 0, 0)');
    // t=0.5 → green (midpoint of segment 1)
    expect(lerpGradient(colors, 0.5)).toBe('rgb(0, 255, 0)');
    // t=1 → blue
    expect(lerpGradient(colors, 1)).toBe('rgb(0, 0, 255)');
  });

  it('clamps t below 0 to 0', () => {
    const result = lerpGradient(['#ff0000', '#0000ff'], -0.5);
    expect(result).toBe('rgb(255, 0, 0)');
  });

  it('clamps t above 1 to 1', () => {
    const result = lerpGradient(['#ff0000', '#0000ff'], 1.5);
    expect(result).toBe('rgb(0, 0, 255)');
  });

  it('returns black for empty array', () => {
    expect(lerpGradient([], 0.5)).toBe('rgb(0, 0, 0)');
  });

  it('returns single color for single-element array', () => {
    const result = lerpGradient(['#ff0000'], 0.5);
    expect(result).toBe('rgb(255, 0, 0)');
  });
});

// ── resamplePoints ────────────────────────────────────

describe('resamplePoints — basic behavior', () => {
  it('resamples 5 points to 10 points', () => {
    const input = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 40, y: 0 },
    ];
    const result = resamplePoints(input, 10);
    expect(result).toHaveLength(10);
  });

  it('preserves start point', () => {
    const input = [
      { x: 5, y: 15 },
      { x: 25, y: 35 },
      { x: 45, y: 55 },
    ];
    const result = resamplePoints(input, 6);
    expect(result[0]!.x).toBe(5);
    expect(result[0]!.y).toBe(15);
  });

  it('preserves end point', () => {
    const input = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const result = resamplePoints(input, 5);
    const last = result[result.length - 1]!;
    expect(last.x).toBe(20);
    expect(last.y).toBe(0);
  });

});

describe('resamplePoints — spacing and edge cases', () => {
  it('points are evenly spaced along path', () => {
    const input = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const result = resamplePoints(input, 5);
    for (let i = 1; i < result.length; i++) {
      const dx = result[i]!.x - result[i - 1]!.x;
      expect(dx).toBeCloseTo(25, 0);
    }
  });

  it('returns copy for < 2 points', () => {
    const input = [{ x: 5, y: 5 }];
    const result = resamplePoints(input, 10);
    expect(result).toHaveLength(1);
  });

  it('returns copy for targetCount < 2', () => {
    const input = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const result = resamplePoints(input, 1);
    expect(result).toHaveLength(2); // Returns original
  });

  it('empty input returns empty', () => {
    const result = resamplePoints([], 10);
    expect(result).toHaveLength(0);
  });
});
