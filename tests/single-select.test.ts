// Tests for the single-select wrapper added in v0.6.1 (D7 in
// docs/plans/media-art-mvp.md). The Media Art picker needs a stable
// single-object selection independent of the multi-select toggle
// behaviour exposed via SelectionManager.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Glymo } from '../src/index.js';

// Reused canvas mocks from tests/Glymo.test.ts — kept inline here so
// this file stays self-contained.
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

describe('Glymo single-select wrapper', () => {
  let g: Glymo;

  beforeEach(() => {
    g = new Glymo(createMockCanvas());
  });

  it('selectObject sets exactly one selected id', () => {
    const a = g.createObject([], { x: 0, y: 0, width: 50, height: 50 });
    const b = g.createObject([], { x: 60, y: 0, width: 50, height: 50 });

    g.selectObject(a.id);
    expect(g.getSelectedObjectIds()).toEqual([a.id]);
    expect(g.getSelectedObjectId()).toBe(a.id);

    // Switching is single-select: previous selection cleared, not appended.
    g.selectObject(b.id);
    expect(g.getSelectedObjectIds()).toEqual([b.id]);
    expect(g.getSelectedObjectId()).toBe(b.id);
  });

  it('selectObject is a no-op for unknown ids and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    g.selectObject('does-not-exist');
    expect(g.getSelectedObjectIds()).toEqual([]);
    expect(g.getSelectedObjectId()).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('selectObject');

    warnSpy.mockRestore();
  });

  it('getSelectedObjectId returns null when zero selected', () => {
    expect(g.getSelectedObjectId()).toBeNull();
  });

  it('getSelectedObjectId returns null when multiple selected', () => {
    const a = g.createObject([], { x: 0, y: 0, width: 10, height: 10 });
    const b = g.createObject([], { x: 20, y: 0, width: 10, height: 10 });

    g.toggleObjectSelection(a.id);
    g.toggleObjectSelection(b.id);
    expect([...g.getSelectedObjectIds()].sort()).toEqual([a.id, b.id].sort());
    // Multi-select must produce null on the single-select getter — callers
    // who want all ids should use getSelectedObjectIds() explicitly.
    expect(g.getSelectedObjectId()).toBeNull();
  });

  it('clearSelection() resets the single-select getter to null', () => {
    const obj = g.createObject([], { x: 0, y: 0, width: 10, height: 10 });
    g.selectObject(obj.id);
    expect(g.getSelectedObjectId()).toBe(obj.id);

    g.clearSelection();
    expect(g.getSelectedObjectId()).toBeNull();
  });

  it('undoObject of the single-selected target clears selection', () => {
    const obj = g.createObject([], { x: 0, y: 0, width: 10, height: 10 });
    g.selectObject(obj.id);
    expect(g.getSelectedObjectId()).toBe(obj.id);

    // Glymo.undoObject is the public wrapped removal path that fires
    // SelectionManager.removeIfSelected; the single-select getter must
    // observe the auto-deselect.
    const removed = g.undoObject();
    expect(removed?.id).toBe(obj.id);
    expect(g.getSelectedObjectId()).toBeNull();
  });
});
