// Tests for Glymo.translateObject — the drawing-mode counterpart to
// text-mode glyph translation. See docs/plans/air-toolbar-refactor.md §6.3
// (the move-tool 4-cell matrix). The dispatcher in @glymo/ui calls this
// when (!textMode && selectedObjectId) so that move works on
// recognised-but-untextualised stroke groups.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Glymo } from '../src/index.js';
import type { StrokeDoc } from '../src/types.js';

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

describe('Glymo.translateObject', () => {
  let g: Glymo;

  beforeEach(() => {
    g = new Glymo(createMockCanvas());
  });

  it('shifts every stroke point and the bbox by the requested delta', () => {
    g.loadStrokes([makeStrokeDoc('s1', 100, 100), makeStrokeDoc('s2', 200, 100)]);
    const obj = g.createObject(['s1', 's2'], { x: 100, y: 100, width: 120, height: 10 });

    const ok = g.translateObject(obj.id, 50, -25);
    expect(ok).toBe(true);

    const strokes = g.getStrokes();
    const s1 = strokes.find((s) => s.id === 's1');
    const s2 = strokes.find((s) => s.id === 's2');
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();

    expect(s1!.raw[0]).toMatchObject({ x: 150, y: 75 });
    expect(s1!.smoothed[0]).toMatchObject({ x: 150, y: 75 });
    expect(s2!.raw[2]).toMatchObject({ x: 270, y: 75 });

    const refreshed = g.listObjects().find((o) => o.id === obj.id)!;
    expect(refreshed.bbox).toMatchObject({ x: 150, y: 75, width: 120, height: 10 });
  });

  it('returns false for an unknown object id', () => {
    const ok = g.translateObject('does-not-exist', 10, 10);
    expect(ok).toBe(false);
  });

  it('is a no-op when delta is (0, 0)', () => {
    g.loadStrokes([makeStrokeDoc('s1', 0, 0)]);
    const obj = g.createObject(['s1'], { x: 0, y: 0, width: 20, height: 10 });

    const before = JSON.stringify(g.getStrokes()[0]);
    const ok = g.translateObject(obj.id, 0, 0);
    expect(ok).toBe(true);
    const after = JSON.stringify(g.getStrokes()[0]);
    expect(after).toBe(before);
  });

  it('emits "object:translated" with the delta payload', () => {
    g.loadStrokes([makeStrokeDoc('s1', 0, 0)]);
    const obj = g.createObject(['s1'], { x: 0, y: 0, width: 20, height: 10 });

    const handler = vi.fn();
    g.on('object:translated', handler);

    g.translateObject(obj.id, 7, -3);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ id: obj.id, dx: 7, dy: -3 });
  });

  it('skips strokes that are no longer in the store (dangling ids)', () => {
    g.loadStrokes([makeStrokeDoc('s1', 0, 0)]);
    const obj = g.createObject(['s1', 'ghost-id'], { x: 0, y: 0, width: 20, height: 10 });

    const ok = g.translateObject(obj.id, 5, 5);
    expect(ok).toBe(true);
    const s1 = g.getStrokes().find((s) => s.id === 's1');
    expect(s1!.raw[0]).toMatchObject({ x: 5, y: 5 });
  });

  // ── setMeshTranslator / translateObject mesh-sync (0.21.0) ──────────────
  //
  // The host-provided translator fires with the same (id, dx, dy) as the
  // underlying stroke translation so media-art meshes follow their
  // GlymoObject under move-tool drag (see Glymo.setMeshTranslator JSDoc).
  // Renderer seam is the UI-owned Hologram3DRenderer.translateMeshBy, but
  // core only sees the function passed in via setMeshTranslator; these
  // tests stub it with a vi.fn to pin the contract.

  it('forwards the translateObject delta to the host-provided mesh translator', () => {
    g.loadStrokes([makeStrokeDoc('s1', 0, 0)]);
    const obj = g.createObject(['s1'], { x: 0, y: 0, width: 20, height: 10 });
    const translator = vi.fn<(id: string, dx: number, dy: number) => void>();
    g.setMeshTranslator(translator);

    g.translateObject(obj.id, 11, -7);

    expect(translator).toHaveBeenCalledTimes(1);
    expect(translator).toHaveBeenCalledWith(obj.id, 11, -7);
  });

  it('does not invoke the translator on unknown id (object:translated not emitted either)', () => {
    const translator = vi.fn<(id: string, dx: number, dy: number) => void>();
    g.setMeshTranslator(translator);

    const ok = g.translateObject('does-not-exist', 10, 10);
    expect(ok).toBe(false);
    expect(translator).not.toHaveBeenCalled();
  });

  it('does not invoke the translator on zero-delta (no-op fast path)', () => {
    g.loadStrokes([makeStrokeDoc('s1', 0, 0)]);
    const obj = g.createObject(['s1'], { x: 0, y: 0, width: 20, height: 10 });
    const translator = vi.fn<(id: string, dx: number, dy: number) => void>();
    g.setMeshTranslator(translator);

    const ok = g.translateObject(obj.id, 0, 0);
    expect(ok).toBe(true);
    expect(translator).not.toHaveBeenCalled();
  });

  it('works without a registered translator (backward-compatible default)', () => {
    // Regression gate: pre-0.21.0 callers never installed a translator and
    // translateObject must continue to succeed as a pure stroke/bbox move.
    g.loadStrokes([makeStrokeDoc('s1', 0, 0)]);
    const obj = g.createObject(['s1'], { x: 0, y: 0, width: 20, height: 10 });

    const handler = vi.fn();
    g.on('object:translated', handler);

    const ok = g.translateObject(obj.id, 3, 4);
    expect(ok).toBe(true);
    expect(handler).toHaveBeenCalledWith({ id: obj.id, dx: 3, dy: 4 });
    const s1 = g.getStrokes()[0]!;
    expect(s1.raw[0]).toMatchObject({ x: 3, y: 4 });
  });

  it('unregisters the translator when setMeshTranslator(null) is called', () => {
    g.loadStrokes([makeStrokeDoc('s1', 0, 0)]);
    const obj = g.createObject(['s1'], { x: 0, y: 0, width: 20, height: 10 });
    const translator = vi.fn<(id: string, dx: number, dy: number) => void>();
    g.setMeshTranslator(translator);
    g.setMeshTranslator(null);

    g.translateObject(obj.id, 5, 5);
    expect(translator).not.toHaveBeenCalled();
  });

  it('still emits object:translated even if the translator throws', () => {
    g.loadStrokes([makeStrokeDoc('s1', 0, 0)]);
    const obj = g.createObject(['s1'], { x: 0, y: 0, width: 20, height: 10 });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    g.setMeshTranslator(() => { throw new Error('boom'); });
    const handler = vi.fn();
    g.on('object:translated', handler);

    const ok = g.translateObject(obj.id, 1, 1);
    expect(ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
