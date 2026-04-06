import { KineticEngine } from '../src/text/KineticEngine.js';
import type { Point } from '../src/types.js';

// OffscreenCanvas mock for pretext (used internally by layoutTextInShape)
vi.stubGlobal('OffscreenCanvas', class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  getContext() {
    return {
      measureText: (text: string) => ({ width: text.length * 8 }),
      font: '',
      direction: 'ltr',
    };
  }
});

// ── Helpers ─────────────────────��───────────────────

function horizontalPath(x0: number, x1: number, y: number, n: number): Point[] {
  const step = (x1 - x0) / (n - 1);
  return Array.from({ length: n }, (_, i) => ({ x: x0 + step * i, y }));
}

function squarePath(x: number, y: number, size: number): Point[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

// ── KineticEngine ───────────────────────────────────

describe('KineticEngine', () => {
  describe('layout mode management', () => {
    it('defaults to linear mode', () => {
      const engine = new KineticEngine();
      expect(engine.getLayoutMode()).toBe('linear');
    });

    it('sets and gets layout mode', () => {
      const engine = new KineticEngine();
      engine.setLayoutMode('curve');
      expect(engine.getLayoutMode()).toBe('curve');
    });

    it('accepts initial options', () => {
      const engine = new KineticEngine({ mode: 'circle', radius: 50 });
      expect(engine.getLayoutMode()).toBe('circle');
    });
  });

  describe('computeLayout — linear', () => {
    it('places characters horizontally from first path point', () => {
      const engine = new KineticEngine({ mode: 'linear', fontSize: 20 });
      const path = [{ x: 10, y: 20 }];
      const result = engine.computeLayout('ABC', path);

      expect(result).toHaveLength(3);
      expect(result[0]!.char).toBe('A');
      expect(result[1]!.char).toBe('B');
      expect(result[2]!.char).toBe('C');

      // All at same y
      for (const pc of result) {
        expect(pc.y).toBe(20);
        expect(pc.rotation).toBe(0);
      }
    });

    it('returns empty for empty text', () => {
      const engine = new KineticEngine({ mode: 'linear' });
      expect(engine.computeLayout('', [])).toHaveLength(0);
    });
  });

  describe('computeLayout — curve', () => {
    it('distributes characters along stroke path', () => {
      const engine = new KineticEngine({ mode: 'curve' });
      const path = horizontalPath(0, 200, 50, 40);
      const result = engine.computeLayout('HELLO', path);

      expect(result).toHaveLength(5);
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.x).toBeGreaterThan(result[i - 1]!.x);
      }
    });
  });

  describe('computeLayout — circle', () => {
    it('uses stroke centroid when no radius given', () => {
      const engine = new KineticEngine({ mode: 'circle' });
      // A circular-ish path centered at (100, 100) with radius ~50
      const path: Point[] = [
        { x: 150, y: 100 },
        { x: 100, y: 150 },
        { x: 50, y: 100 },
        { x: 100, y: 50 },
      ];
      const result = engine.computeLayout('AB', path);

      expect(result).toHaveLength(2);
    });

    it('uses explicit radius from options', () => {
      const engine = new KineticEngine({
        mode: 'circle',
        radius: 80,
        startAngle: 0,
      });
      const path: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
      const result = engine.computeLayout('ABCD', path);

      expect(result).toHaveLength(4);
      // Check radius from centroid (5, 5)
      for (const pc of result) {
        const dx = pc.x - 5;
        const dy = pc.y - 5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeCloseTo(80, 0);
      }
    });
  });

  describe('computeLayout — fill', () => {
    it('fills text inside a shape', () => {
      const engine = new KineticEngine({ mode: 'fill', fontSize: 14 });
      const shape = squarePath(0, 0, 200);
      const result = engine.computeLayout('Hello World', shape);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('relayout', () => {
    it('recomputes layout with a new path', () => {
      const engine = new KineticEngine({ mode: 'curve' });
      const path1 = horizontalPath(0, 100, 0, 20);
      const path2 = horizontalPath(0, 200, 50, 40);

      const r1 = engine.computeLayout('AB', path1);
      const r2 = engine.relayout('AB', path2);

      // Different paths should produce different positions
      expect(r2[0]!.y).not.toEqual(r1[0]!.y);
    });
  });

  describe('getPositionedChars', () => {
    it('returns the most recent layout result', () => {
      const engine = new KineticEngine({ mode: 'linear' });
      engine.computeLayout('XY', [{ x: 0, y: 0 }]);
      const chars = engine.getPositionedChars();

      expect(chars).toHaveLength(2);
      expect(chars[0]!.char).toBe('X');
      expect(chars[1]!.char).toBe('Y');
    });

    it('returns empty before any layout is computed', () => {
      const engine = new KineticEngine();
      expect(engine.getPositionedChars()).toHaveLength(0);
    });
  });

  describe('staggered timing', () => {
    it('computes stagger delay per character', () => {
      const engine = new KineticEngine(undefined, 40);

      expect(engine.getStaggerDelay(0)).toBe(0);
      expect(engine.getStaggerDelay(1)).toBe(40);
      expect(engine.getStaggerDelay(5)).toBe(200);
    });

    it('computes character progress', () => {
      const engine = new KineticEngine(undefined, 30);

      // Char 0: no delay, 100ms duration
      expect(engine.getCharProgress(0, 0, 100)).toBe(0);
      expect(engine.getCharProgress(0, 50, 100)).toBeCloseTo(0.5);
      expect(engine.getCharProgress(0, 100, 100)).toBe(1);

      // Char 1: 30ms delay
      expect(engine.getCharProgress(1, 0, 100)).toBe(0);
      expect(engine.getCharProgress(1, 30, 100)).toBe(0);
      expect(engine.getCharProgress(1, 80, 100)).toBeCloseTo(0.5);
      expect(engine.getCharProgress(1, 130, 100)).toBe(1);
    });

    it('computes total duration', () => {
      const engine = new KineticEngine(undefined, 30);

      // 5 chars, 100ms each: (5-1)*30 + 100 = 220
      expect(engine.getTotalDuration(5, 100)).toBe(220);
      expect(engine.getTotalDuration(1, 100)).toBe(100);
      expect(engine.getTotalDuration(0, 100)).toBe(0);
    });
  });

  describe('setOptions', () => {
    it('updates layout mode via setOptions', () => {
      const engine = new KineticEngine();
      engine.setOptions({ mode: 'fill', fontSize: 20 });
      expect(engine.getLayoutMode()).toBe('fill');
    });
  });
});
