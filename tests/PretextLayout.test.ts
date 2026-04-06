import {
  layoutTextAlongCurve,
  layoutTextInCircle,
  layoutTextInShape,
} from '../src/text/PretextLayout.js';
import type { Point } from '../src/types.js';

// ── OffscreenCanvas mock for pretext ────────────────
// pretext calls OffscreenCanvas internally for canvas.measureText()

const mockMeasureText = (text: string) => ({
  width: text.length * 8, // ~8px per character approximation
});

vi.stubGlobal('OffscreenCanvas', class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  getContext() {
    return {
      measureText: mockMeasureText,
      font: '',
      direction: 'ltr',
    };
  }
});

// ── Helpers ─────────────────────────────────────────

/** Create a straight horizontal path from (x0,y) to (x1,y) with n points */
function horizontalPath(x0: number, x1: number, y: number, n: number): Point[] {
  const step = (x1 - x0) / (n - 1);
  return Array.from({ length: n }, (_, i) => ({ x: x0 + step * i, y }));
}

/** Create a circular path with n points */
function circularPath(cx: number, cy: number, r: number, n: number): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

/** Create a square path (closed) */
function squarePath(x: number, y: number, size: number): Point[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

// ── layoutTextAlongCurve ���───────────────────────────

describe('layoutTextAlongCurve', () => {
  it('positions characters along a horizontal path', () => {
    const path = horizontalPath(0, 100, 50, 20);
    const result = layoutTextAlongCurve('HELLO', path);

    expect(result).toHaveLength(5);

    // All y values should be at the path's y coordinate
    for (const pc of result) {
      expect(pc.y).toBeCloseTo(50, 0);
    }

    // Characters should be in ascending x order
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.x).toBeGreaterThan(result[i - 1]!.x);
    }
  });

  it('aligns rotation to path tangent (horizontal)', () => {
    const path = horizontalPath(0, 200, 0, 50);
    const result = layoutTextAlongCurve('ABC', path);

    // On a horizontal path, tangent angle should be ~0
    for (const pc of result) {
      expect(Math.abs(pc.rotation)).toBeLessThan(0.01);
    }
  });

  it('aligns rotation on a diagonal path', () => {
    const path: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const result = layoutTextAlongCurve('AB', path);

    expect(result).toHaveLength(2);
    // 45 degrees = PI/4
    for (const pc of result) {
      expect(pc.rotation).toBeCloseTo(Math.PI / 4, 2);
    }
  });

  it('returns empty for empty text', () => {
    const path = horizontalPath(0, 100, 0, 10);
    expect(layoutTextAlongCurve('', path)).toHaveLength(0);
  });

  it('returns empty for path with fewer than 2 points', () => {
    expect(layoutTextAlongCurve('A', [{ x: 0, y: 0 }])).toHaveLength(0);
    expect(layoutTextAlongCurve('A', [])).toHaveLength(0);
  });

  it('handles single character on path', () => {
    const path = horizontalPath(0, 100, 0, 10);
    const result = layoutTextAlongCurve('X', path);

    expect(result).toHaveLength(1);
    expect(result[0]!.char).toBe('X');
    expect(result[0]!.scale).toBe(1);
  });

  it('handles a curved (S-shaped) path', () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
      { x: 150, y: 50 },
      { x: 200, y: 0 },
    ];
    const result = layoutTextAlongCurve('ABCD', path);

    expect(result).toHaveLength(4);
    // Characters should progress along x
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.x).toBeGreaterThan(result[i - 1]!.x);
    }
  });
});

// ── layoutTextInCircle ─────────��────────────────────

describe('layoutTextInCircle', () => {
  it('distributes characters evenly around circle', () => {
    const center: Point = { x: 100, y: 100 };
    const result = layoutTextInCircle('ABCD', center, 50);

    expect(result).toHaveLength(4);

    // All characters should be at correct radius from center
    for (const pc of result) {
      const dx = pc.x - center.x;
      const dy = pc.y - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeCloseTo(50, 1);
    }
  });

  it('positions first character at start angle', () => {
    const center: Point = { x: 0, y: 0 };
    const startAngle = Math.PI / 2; // 90 degrees
    const result = layoutTextInCircle('A', center, 100, startAngle);

    expect(result).toHaveLength(1);
    // At 90 degrees: x=0, y=100
    expect(result[0]!.x).toBeCloseTo(0, 1);
    expect(result[0]!.y).toBeCloseTo(100, 1);
  });

  it('supports configurable start angle', () => {
    const center: Point = { x: 0, y: 0 };
    const result0 = layoutTextInCircle('AB', center, 50, 0);
    const resultPi = layoutTextInCircle('AB', center, 50, Math.PI);

    // Different start angles should produce different positions
    expect(result0[0]!.x).not.toBeCloseTo(resultPi[0]!.x, 1);
  });

  it('returns empty for empty text', () => {
    expect(layoutTextInCircle('', { x: 0, y: 0 }, 50)).toHaveLength(0);
  });

  it('returns empty for zero radius', () => {
    expect(layoutTextInCircle('AB', { x: 0, y: 0 }, 0)).toHaveLength(0);
  });

  it('returns empty for negative radius', () => {
    expect(layoutTextInCircle('AB', { x: 0, y: 0 }, -10)).toHaveLength(0);
  });

  it('applies tangent rotation to each character', () => {
    const center: Point = { x: 0, y: 0 };
    const result = layoutTextInCircle('ABCD', center, 100, 0);

    // Each character rotation = angle + PI/2
    const expectedAngles = [
      0 + Math.PI / 2,
      Math.PI / 2 + Math.PI / 2,
      Math.PI + Math.PI / 2,
      (3 * Math.PI) / 2 + Math.PI / 2,
    ];

    for (let i = 0; i < result.length; i++) {
      expect(result[i]!.rotation).toBeCloseTo(expectedAngles[i]!, 2);
    }
  });
});

// ── layoutTextInShape ───────────────────────────────

describe('layoutTextInShape', () => {
  it('distributes text within a square shape', () => {
    const shape = squarePath(0, 0, 200);
    const result = layoutTextInShape('HELLO WORLD', shape, 16);

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(11);

    // All characters should be within the bounding box
    for (const pc of result) {
      expect(pc.x).toBeGreaterThanOrEqual(0);
      expect(pc.x).toBeLessThanOrEqual(200);
      expect(pc.y).toBeGreaterThanOrEqual(0);
      expect(pc.y).toBeLessThanOrEqual(200);
    }
  });

  it('distributes text in a large shape', () => {
    const shape = squarePath(0, 0, 500);
    const text = 'This is a longer text string for shape fill testing';
    const result = layoutTextInShape(text, shape, 14);

    expect(result.length).toBeGreaterThan(0);
    // All characters inside bounds
    for (const pc of result) {
      expect(pc.x).toBeGreaterThanOrEqual(0);
      expect(pc.x).toBeLessThanOrEqual(500);
    }
  });

  it('returns empty for empty text', () => {
    expect(layoutTextInShape('', squarePath(0, 0, 100))).toHaveLength(0);
  });

  it('returns empty for path with fewer than 3 points', () => {
    expect(layoutTextInShape('A', [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toHaveLength(0);
  });

  it('places characters with rotation 0 (horizontal text)', () => {
    const shape = squarePath(0, 0, 200);
    const result = layoutTextInShape('ABC', shape, 16);

    for (const pc of result) {
      expect(pc.rotation).toBe(0);
    }
  });

  it('respects font size for character spacing', () => {
    const shape = squarePath(0, 0, 300);
    const smallFont = layoutTextInShape('ABCDE', shape, 10);
    const largeFont = layoutTextInShape('ABCDE', shape, 30);

    // Both should produce results (shape is large enough)
    expect(smallFont.length).toBeGreaterThan(0);
    expect(largeFont.length).toBeGreaterThan(0);
  });
});

// ── Performance ────��────────────────────────────────

describe('Performance', () => {
  it('layout computation completes in < 50ms for < 100 characters', () => {
    const longText = 'A'.repeat(99);
    const path = horizontalPath(0, 1000, 50, 200);

    const start = performance.now();
    layoutTextAlongCurve(longText, path);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('circle layout completes in < 50ms for < 100 characters', () => {
    const longText = 'B'.repeat(99);

    const start = performance.now();
    layoutTextInCircle(longText, { x: 0, y: 0 }, 200);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('shape fill completes in < 50ms for < 100 characters', () => {
    const longText = 'C'.repeat(99);
    const shape = squarePath(0, 0, 1000);

    const start = performance.now();
    layoutTextInShape(longText, shape, 14);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});
