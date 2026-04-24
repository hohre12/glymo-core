// Tests for Task 2.3: renderCompletedStrokes + renderFills skip objects
// that have metadata.mediaArt set (3D mesh active — 2D bleed-through guard).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderCompletedStrokes } from '../src/render/layers/completed.js';
import { renderFills } from '../src/render/layers/fill.js';
import { ObjectStore } from '../src/store/ObjectStore.js';
import type { Stroke, Fill, StrokePoint } from '../src/types.js';

// ── Helpers ────────────────────────────────────────

function makePoint(x: number, y: number): StrokePoint {
  return { x, y, t: 0, pressure: 0.5 };
}

function makeStroke(id: string, x1: number, y1: number, x2: number, y2: number): Stroke {
  const p1 = makePoint(x1, y1);
  const p2 = makePoint(x2, y2);
  return {
    id,
    raw: [p1, p2],
    smoothed: [p1, p2],
    state: 'effected',
    effect: 'neon',
    createdAt: 0,
  };
}

function makeFakeCacheCtx() {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    globalAlpha: 1,
    lineCap: 'round',
    lineJoin: 'round',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    lineWidth: 1,
  } as unknown as OffscreenCanvasRenderingContext2D;
}

function makeFakeCache(w = 100, h = 100): OffscreenCanvas {
  return { width: w, height: h } as unknown as OffscreenCanvas;
}

function makeFakeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    globalAlpha: 1,
    lineCap: 'round',
    lineJoin: 'round',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

function makeFakeBitmap(): ImageBitmap {
  return {} as unknown as ImageBitmap;
}

// ── Tests ──────────────────────────────────────────

describe('renderCompletedStrokes: static-cache path skips mesh-applied strokes', () => {
  let store: ObjectStore;
  let s1: Stroke;
  let s2: Stroke;
  let cacheCtx: OffscreenCanvasRenderingContext2D;
  let cache: OffscreenCanvas;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    store = new ObjectStore();
    s1 = makeStroke('s1', 0, 0, 10, 0);
    s2 = makeStroke('s2', 20, 0, 30, 0);

    // s1 belongs to an object with mediaArt metadata
    const obj1 = store.createObject(['s1'], { x: 0, y: 0, width: 10, height: 1 });
    store.updateMetadata(obj1.id, 'mediaArt', { modelId: 'earth', appliedAt: 0 });

    // s2 belongs to an object WITHOUT mediaArt
    store.createObject(['s2'], { x: 20, y: 0, width: 10, height: 1 });

    cacheCtx = makeFakeCacheCtx();
    cache = makeFakeCache();
    ctx = makeFakeCtx();
  });

  it('does not draw mesh-applied stroke (s1) but draws non-mesh stroke (s2)', () => {
    renderCompletedStrokes(
      ctx,
      [s1, s2],
      cache,
      cacheCtx,
      /*dirty*/ true,
      null,
      store,
      new Map(),
      new Set(),
    );

    // Both strokes have 2 points → renderGlowPass + renderMainStroke call beginPath.
    // s1 must be skipped; s2 must be drawn.
    // renderGlowPass: 1 beginPath per stroke. renderMainStroke: (n-1) beginPath per stroke (1 segment = 1 beginPath).
    // For s2 only: renderGlowPass(1 beginPath) + renderMainStroke(1 segment → 1 beginPath) = 2 beginPath calls.
    // For s1+s2 without guard: 4 beginPath calls.
    const beginPathCalls = (cacheCtx.beginPath as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(beginPathCalls).toBe(2); // only s2
  });
});

describe('renderCompletedStrokes: animated path skips mesh-applied strokes', () => {
  let store: ObjectStore;
  let s1: Stroke;
  let s2: Stroke;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    store = new ObjectStore();
    s1 = makeStroke('s1', 0, 0, 10, 0);
    s2 = makeStroke('s2', 20, 0, 30, 0);

    // s1 with mediaArt
    const obj1 = store.createObject(['s1'], { x: 0, y: 0, width: 10, height: 1 });
    store.updateMetadata(obj1.id, 'mediaArt', { modelId: 'earth', appliedAt: 0 });

    // s2 without mediaArt
    store.createObject(['s2'], { x: 20, y: 0, width: 10, height: 1 });

    ctx = makeFakeCtx();
  });

  it('does not call ctx.translate with s1 pivot when s1 is mesh-applied (skips animated draw block)', () => {
    // Provide a StrokeAnimator that returns a transform for BOTH strokes
    // so both take the animated path.
    const mockTransform = {
      translateX: 0,
      translateY: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      glowIntensity: 1,
    };
    const animator = {
      hasAnimations: () => true,
      getTransform: (_id: string, _now: number) => mockTransform,
    } as unknown as import('../src/animation/StrokeAnimator.js').StrokeAnimator;

    renderCompletedStrokes(
      ctx,
      [s1, s2],
      null,
      null,
      false,
      animator,
      store,
      new Map(),
      new Set(),
    );

    // We verify the guard's effect directly rather than via ctx.save count,
    // because save count is brittle: if renderGlowPass or renderMainStroke ever
    // adds another save() pass (e.g. shadow), the count changes for unrelated reasons.
    //
    // s1's bbox is { x:0, y:0, width:10, height:1 } → pivot (5, 0.5).
    // s2's bbox is { x:20, y:0, width:10, height:1 } → pivot (25, 0.5).
    // If s1 entered the animated draw block, ctx.translate(5 + 0, 0.5 + 0) = (5, 0.5) would be called.
    // Assert that call never happened — i.e. s1 was skipped entirely.
    const translateCalls = (ctx.translate as ReturnType<typeof vi.fn>).mock.calls;
    const s1PivotCalled = translateCalls.some(([x, y]) => x === 5 && y === 0.5);
    expect(s1PivotCalled).toBe(false);

    // Sanity: s2 DID enter the draw block — its pivot translate was called.
    const s2PivotCalled = translateCalls.some(([x, y]) => x === 25 && y === 0.5);
    expect(s2PivotCalled).toBe(true);
  });
});

describe('renderFills: skips mesh-applied fills', () => {
  it('does not drawImage for the fill whose object has mediaArt', () => {
    const store = new ObjectStore();

    const f1: Fill = { id: 'f1', color: '#ff0000', bitmap: makeFakeBitmap(), createdAt: 0 };
    const f2: Fill = { id: 'f2', color: '#00ff00', bitmap: makeFakeBitmap(), createdAt: 1 };

    // f1's object has mediaArt
    const obj1 = store.createObject([], { x: 0, y: 0, width: 10, height: 10 });
    store.addFillToObject(obj1.id, 'f1');
    store.updateMetadata(obj1.id, 'mediaArt', { modelId: 'earth', appliedAt: 0 });

    // f2's object has no mediaArt
    const obj2 = store.createObject([], { x: 20, y: 0, width: 10, height: 10 });
    store.addFillToObject(obj2.id, 'f2');

    const ctx = makeFakeCtx();

    renderFills(ctx, [f1, f2], store, null, {
      translateX: 0, translateY: 0, scale: 1, rotation: 0, opacity: 1, glowIntensity: 1,
    });

    // Only f2 should be drawn
    const drawImageCalls = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(drawImageCalls).toBe(1);
    // And it should be called with f2's bitmap
    expect((ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(f2.bitmap);
  });
});

describe('renderCompletedStrokes: null objectStore — guard is a no-op', () => {
  it('renders all strokes when objectStore is null (guard is a no-op)', () => {
    // With no objectStore, the mediaArt guard cannot fire. Both strokes render
    // normally — this locks in backward-compat for callers that don't pass a store.
    const s1 = makeStroke('s1', 0, 0, 10, 0);
    const s2 = makeStroke('s2', 20, 0, 30, 0);

    const cacheCtx = makeFakeCacheCtx();
    const cache = makeFakeCache();
    const ctx = makeFakeCtx();

    renderCompletedStrokes(ctx, [s1, s2], cache, cacheCtx, true, null, null, new Map(), new Set());

    // Both strokes drawn: each produces 2 beginPath calls (glow + main).
    const beginPathCalls = (cacheCtx.beginPath as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(beginPathCalls).toBe(4);
  });
});

describe('renderFills and renderCompletedStrokes: sanity — renders all when no mediaArt', () => {
  it('draws both strokes when neither object has mediaArt', () => {
    const store = new ObjectStore();
    const s1 = makeStroke('s1', 0, 0, 10, 0);
    const s2 = makeStroke('s2', 20, 0, 30, 0);

    store.createObject(['s1'], { x: 0, y: 0, width: 10, height: 1 });
    store.createObject(['s2'], { x: 20, y: 0, width: 10, height: 1 });

    const cacheCtx = makeFakeCacheCtx();
    const cache = makeFakeCache();
    const ctx = makeFakeCtx();

    renderCompletedStrokes(ctx, [s1, s2], cache, cacheCtx, true, null, store, new Map(), new Set());

    // Both strokes drawn: s1 and s2 each produce 2 beginPath calls (glow + main).
    const beginPathCalls = (cacheCtx.beginPath as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(beginPathCalls).toBe(4);
  });

  it('draws both fills when neither object has mediaArt', () => {
    const store = new ObjectStore();

    const f1: Fill = { id: 'f1', color: '#ff0000', bitmap: makeFakeBitmap(), createdAt: 0 };
    const f2: Fill = { id: 'f2', color: '#00ff00', bitmap: makeFakeBitmap(), createdAt: 1 };

    const obj1 = store.createObject([], { x: 0, y: 0, width: 10, height: 10 });
    store.addFillToObject(obj1.id, 'f1');
    const obj2 = store.createObject([], { x: 20, y: 0, width: 10, height: 10 });
    store.addFillToObject(obj2.id, 'f2');

    const ctx = makeFakeCtx();
    renderFills(ctx, [f1, f2], store, null, {
      translateX: 0, translateY: 0, scale: 1, rotation: 0, opacity: 1, glowIntensity: 1,
    });

    const drawImageCalls = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(drawImageCalls).toBe(2);
  });
});
