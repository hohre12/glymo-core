// Pins the drawing-mode selection halo renderer against the 2026-04-21
// unification: no marching-ants dash pattern, no corner handles, fixed
// `#00ffcc` regardless of active paint effect. Mirrors the text-mode char
// halo visual language in `@glymo/ui` TextOverlayCanvas.tsx:866-887.

import { describe, it, expect, vi } from 'vitest';
import { renderSelection } from '../src/render/layers/selection.js';
import type { ObjectStore } from '../src/store/ObjectStore.js';
import type { GlymoObject } from '../src/types.js';

interface CallRecord {
  method: string;
  args: unknown[];
}

interface PropWrite {
  prop: string;
  value: unknown;
}

interface RecordingContext {
  ctx: CanvasRenderingContext2D;
  calls: CallRecord[];
  writes: PropWrite[];
}

function makeRecordingContext(): RecordingContext {
  const calls: CallRecord[] = [];
  const writes: PropWrite[] = [];
  const record = (method: string) =>
    vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
    });

  const backing: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineDashOffset: 0,
  };

  const target: Record<string, unknown> = {
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arcTo: record('arcTo'),
    arc: record('arc'),
    fill: record('fill'),
    stroke: record('stroke'),
    strokeRect: record('strokeRect'),
    fillRect: record('fillRect'),
    setLineDash: record('setLineDash'),
  };

  const proxy = new Proxy(target, {
    get(obj, prop: string) {
      if (prop in obj) return obj[prop];
      return backing[prop];
    },
    set(_obj, prop: string, value) {
      writes.push({ prop, value });
      backing[prop] = value;
      return true;
    },
  });

  return { ctx: proxy as unknown as CanvasRenderingContext2D, calls, writes };
}

function makeObjectStoreWith(objects: GlymoObject[]): ObjectStore {
  return {
    getObject: (id: string) => objects.find((o) => o.id === id),
  } as unknown as ObjectStore;
}

function makeObject(id: string, bbox = { x: 100, y: 100, width: 200, height: 150 }): GlymoObject {
  return {
    id,
    strokeIds: [],
    fillIds: [],
    bbox,
    createdAt: 0,
  };
}

describe('renderSelection — halo unification (2026-04-21)', () => {
  it('early-returns when no object is selected', () => {
    const { ctx, calls } = makeRecordingContext();
    const store = makeObjectStoreWith([]);
    renderSelection(ctx, new Set(), store, '#ff0000', 0, 1);
    expect(calls).toHaveLength(0);
  });

  it('does NOT use the marching-ants dash pattern', () => {
    const { ctx, calls } = makeRecordingContext();
    const store = makeObjectStoreWith([makeObject('obj-1')]);
    renderSelection(ctx, new Set(['obj-1']), store, '#ff0000', 0, 1);
    // The pre-unification code called `setLineDash([8, 4])` every frame.
    // Post-unification the halo is a solid neon outline.
    expect(calls.filter((c) => c.method === 'setLineDash')).toEqual([]);
  });

  it('does NOT draw corner handles (no arc() calls at bbox corners)', () => {
    const { ctx, calls } = makeRecordingContext();
    const store = makeObjectStoreWith([makeObject('obj-1', { x: 100, y: 100, width: 200, height: 150 })]);
    renderSelection(ctx, new Set(['obj-1']), store, '#ff0000', 0, 1);
    // Pre-unification drew four `arc()` calls at each bbox corner for tap-
    // drag resize handles. Glymo is gesture-driven, so handles are gone.
    expect(calls.filter((c) => c.method === 'arc')).toEqual([]);
  });

  it('uses the fixed brand neon stroke color, ignoring effectColor', () => {
    const { ctx: ctxRed, writes: writesRed } = makeRecordingContext();
    const { ctx: ctxBlue, writes: writesBlue } = makeRecordingContext();
    const store = makeObjectStoreWith([makeObject('obj-1')]);
    renderSelection(ctxRed, new Set(['obj-1']), store, '#ff0000', 0, 1);
    renderSelection(ctxBlue, new Set(['obj-1']), store, '#0000ff', 0, 1);

    // The selection halo must stay brand-neon regardless of paint effect.
    const strokesRed = writesRed.filter((w) => w.prop === 'strokeStyle').map((w) => w.value);
    const strokesBlue = writesBlue.filter((w) => w.prop === 'strokeStyle').map((w) => w.value);
    expect(strokesRed).toContain('#00ffcc');
    expect(strokesBlue).toContain('#00ffcc');
    // And the effectColor values never leak into strokeStyle.
    expect(strokesRed).not.toContain('#ff0000');
    expect(strokesBlue).not.toContain('#0000ff');
  });

  it('draws a rounded-rect path (moveTo + lineTo + arcTo)', () => {
    const { ctx, calls } = makeRecordingContext();
    const store = makeObjectStoreWith([makeObject('obj-1')]);
    renderSelection(ctx, new Set(['obj-1']), store, '#ff0000', 0, 1);
    expect(calls.some((c) => c.method === 'moveTo')).toBe(true);
    expect(calls.some((c) => c.method === 'lineTo')).toBe(true);
    expect(calls.some((c) => c.method === 'arcTo')).toBe(true);
    expect(calls.some((c) => c.method === 'beginPath')).toBe(true);
    expect(calls.some((c) => c.method === 'fill')).toBe(true);
    expect(calls.some((c) => c.method === 'stroke')).toBe(true);
  });

  it('sets a brand-neon shadow color for the glow pass', () => {
    const { ctx, writes } = makeRecordingContext();
    const store = makeObjectStoreWith([makeObject('obj-1')]);
    renderSelection(ctx, new Set(['obj-1']), store, '#ff0000', 0, 1);
    const shadowColors = writes.filter((w) => w.prop === 'shadowColor').map((w) => w.value);
    expect(shadowColors).toContain('#00ffcc');
  });

  it('does NOT switch to `lighter` composite (white-background visibility regression gate)', () => {
    // Pre-0.20.1 the ambient fill pass wrote `globalCompositeOperation =
    // 'lighter'`. On `SessionDoc.backgroundMode === 'white'` (added in
    // 0.18.0) the additive formula clamps channels against a (255,255,255)
    // dest, so the halo went fully invisible over a white canvas — the
    // exact mirror of the 0.29.0 `@glymo/ui` compositor `screen → source-
    // over` fix. This test pins the background-agnostic composite so that
    // a future "make it glow harder" refactor cannot silently reintroduce
    // the saturation hazard.
    const { ctx, writes } = makeRecordingContext();
    const store = makeObjectStoreWith([makeObject('obj-1')]);
    renderSelection(ctx, new Set(['obj-1']), store, '#ff0000', 0, 1);
    const composites = writes
      .filter((w) => w.prop === 'globalCompositeOperation')
      .map((w) => w.value);
    expect(composites).not.toContain('lighter');
  });

  it('animates via a sin-wave breath — same timestamp twice produces identical alpha writes', () => {
    const a = makeRecordingContext();
    const b = makeRecordingContext();
    const store = makeObjectStoreWith([makeObject('obj-1')]);
    renderSelection(a.ctx, new Set(['obj-1']), store, '#ff0000', 1234, 1);
    renderSelection(b.ctx, new Set(['obj-1']), store, '#ff0000', 1234, 1);
    const alphasA = a.writes.filter((w) => w.prop === 'globalAlpha').map((w) => w.value);
    const alphasB = b.writes.filter((w) => w.prop === 'globalAlpha').map((w) => w.value);
    expect(alphasA).toEqual(alphasB);
  });

  it('scales padding and radius by dpr', () => {
    // At dpr=2 the pad + radius should double. The observable consequence is
    // that the first moveTo — which lands at (x + radius, y) — shifts by the
    // correct delta between dpr=1 and dpr=2 runs on the same bbox.
    const ctx1 = makeRecordingContext();
    const ctx2 = makeRecordingContext();
    const store = makeObjectStoreWith([makeObject('obj-1', { x: 100, y: 100, width: 200, height: 150 })]);
    renderSelection(ctx1.ctx, new Set(['obj-1']), store, '#ff0000', 0, 1);
    renderSelection(ctx2.ctx, new Set(['obj-1']), store, '#ff0000', 0, 2);
    const move1 = ctx1.calls.find((c) => c.method === 'moveTo')!;
    const move2 = ctx2.calls.find((c) => c.method === 'moveTo')!;
    // x-coordinate of the first moveTo = bbox.x - HALO_PAD*dpr + HALO_RADIUS*dpr
    // At dpr=1: 100 - 10 + 12 = 102
    // At dpr=2: 100 - 20 + 24 = 104
    expect(move1.args[0]).toBe(102);
    expect(move2.args[0]).toBe(104);
  });
});
