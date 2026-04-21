// Tests for Glymo.selectObjectAtPoint with mesh hit-tester — Task 2.2.
// Verifies mesh-first dispatch, stroke fallback, defensive stale-id handling,
// and the 0.16.0 single-select behaviour change.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Glymo } from '../src/index.js';
import type { StrokeDoc } from '../src/types.js';

// ── Mocks copied from tests/translateObject.test.ts ──

const mockOffscreenCtx = {
  clearRect: () => {},
  fillRect: () => {},
  beginPath: () => {},
  closePath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  arcTo: () => {},
  fill: () => {},
  stroke: () => {},
  save: () => {},
  restore: () => {},
  getImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
  drawImage: () => {},
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'round',
  lineJoin: 'round',
  globalAlpha: 1,
};

vi.stubGlobal(
  'OffscreenCanvas',
  class MockOffscreenCanvas {
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
    getContext() {
      return mockOffscreenCtx;
    }
  },
);

function createMockCanvas(): HTMLCanvasElement {
  return {
    width: 800,
    height: 600,
    getContext: () => mockOffscreenCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    style: { transition: '', opacity: '' },
  } as unknown as HTMLCanvasElement;
}

function makeStrokeDoc(id: string, x: number, y: number): StrokeDoc {
  return {
    id,
    points: [
      { x, y },
      { x: x + 10, y: y + 10 },
      { x: x + 20, y },
    ],
  };
}

describe('Glymo.selectObjectAtPoint with mesh hit-tester', () => {
  let g: Glymo;

  beforeEach(() => {
    g = new Glymo(createMockCanvas());
  });

  it('routes selection to the mesh-hit object when meshHitTestFn returns its id', () => {
    // Two objects: A with no strokes, B with no strokes. Mesh hit-tester
    // claims any click returns B. No strokes exist, so the stroke path would
    // return undefined — the assertion proves the mesh path took priority.
    g.createObject([], { x: 0, y: 0, width: 50, height: 50 }); // object A (decoy)
    const b = g.createObject([], { x: 60, y: 0, width: 50, height: 50 });

    g.setMeshHitTestFn(() => b.id);
    const result = g.selectObjectAtPoint(100, 100);
    expect(result?.id).toBe(b.id);
    expect(g.getSelectedObjectIds()).toEqual([b.id]);
  });

  it('falls through to stroke hit-test when meshHitTestFn returns null', () => {
    // Seed one stroke at (100, 100) and one object containing it.
    g.loadStrokes([makeStrokeDoc('s1', 100, 100)]);
    const obj = g.createObject(['s1'], { x: 90, y: 90, width: 40, height: 40 });

    g.setMeshHitTestFn(() => null);
    const result = g.selectObjectAtPoint(100, 100);
    expect(result?.id).toBe(obj.id);
    expect(g.getSelectedObjectIds()).toEqual([obj.id]);
  });

  it('falls through to stroke hit-test when no meshHitTestFn is registered', () => {
    // Same seed, but never call setMeshHitTestFn. The null-default tester
    // path must be safe — returns undefined with no hit, or the object with
    // a hit. We assert the hit case.
    g.loadStrokes([makeStrokeDoc('s1', 100, 100)]);
    const obj = g.createObject(['s1'], { x: 90, y: 90, width: 40, height: 40 });

    const result = g.selectObjectAtPoint(100, 100);
    expect(result?.id).toBe(obj.id);
  });

  it('selects the mesh-hit object even if the mesh id does not exist in the object store', () => {
    // Defensive: if the host passes a stale objectId (already deleted), the
    // method must NOT throw AND must NOT select anything. It should fall
    // through to the stroke path — which has no strokes here, so undefined.
    g.setMeshHitTestFn(() => 'stale-object-id');
    const result = g.selectObjectAtPoint(100, 100);
    expect(result).toBeUndefined();
    expect(g.getSelectedObjectIds()).toEqual([]);
  });

  it('single-select: selecting a different object clears the previous selection', () => {
    // Behaviour change in 0.16.0: previously selectObjectAtPoint used toggle;
    // now it's single-select. Selecting A then B leaves only B selected.
    const a = g.createObject([], { x: 0, y: 0, width: 10, height: 10 });
    const b = g.createObject([], { x: 20, y: 0, width: 10, height: 10 });

    g.setMeshHitTestFn(() => a.id);
    g.selectObjectAtPoint(0, 0);
    expect(g.getSelectedObjectIds()).toEqual([a.id]);

    g.setMeshHitTestFn(() => b.id);
    g.selectObjectAtPoint(25, 5);
    expect(g.getSelectedObjectIds()).toEqual([b.id]);
  });
});
