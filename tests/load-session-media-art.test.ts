// Tests for Task 2.4: media-art:restore event emission from Glymo.loadSession.
// Verifies: basic emission, multiple objects, no emission when empty,
// corrupt metadata filtering, and sourceLabel normalization.

import { describe, it, expect, vi } from 'vitest';
import { Glymo } from '../src/index.js';
import type { SessionDoc } from '../src/types.js';

// ── Canvas + OffscreenCanvas mocks ─────────────────────────────────────────────

const mockOffscreenCtx = {
  clearRect: () => {},
  fillRect: () => {},
  beginPath: () => {},
  closePath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  quadraticCurveTo: () => {},
  bezierCurveTo: () => {},
  arc: () => {},
  arcTo: () => {},
  fill: () => {},
  stroke: () => {},
  save: () => {},
  restore: () => {},
  scale: () => {},
  translate: () => {},
  rotate: () => {},
  setTransform: () => {},
  getImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
  putImageData: () => {},
  drawImage: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  createPattern: () => null,
  clip: () => {},
  fillText: () => {},
  measureText: () => ({ width: 0 }),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'round',
  lineJoin: 'round',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  shadowBlur: 0,
  shadowColor: '',
  font: '',
  textAlign: 'left',
  canvas: { width: 800, height: 600 },
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
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
    style: { transition: '', opacity: '' },
    setAttribute: () => {},
    dataset: {},
  } as unknown as HTMLCanvasElement;
}

// ── Minimal valid SessionDoc builder ──────────────────────────────────────────

function makeSession(objects: SessionDoc['objects']): SessionDoc {
  return {
    version: 2,
    canvas: { w: 800, h: 600 },
    effect: { name: 'neon' },
    strokes: [],
    fills: [],
    objects,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('loadSession: media-art:restore event', () => {
  it('emits once with a single restoration entry when one object has mediaArt', async () => {
    const g = new Glymo(createMockCanvas());

    const payloads: unknown[] = [];
    g.on('media-art:restore', (payload) => payloads.push(payload));

    await g.loadSession(makeSession([
      {
        id: 'o1',
        strokeIds: [],
        fillIds: [],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        metadata: { mediaArt: { modelId: 'earth', appliedAt: 0, sourceLabel: null } },
      },
      {
        id: 'o2',
        strokeIds: [],
        fillIds: [],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        // no mediaArt
      },
    ]));

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toEqual({
      restorations: [{ objectId: 'o1', modelId: 'earth', sourceLabel: null }],
    });
  });

  it('emits a single event with all valid entries when multiple objects have mediaArt', async () => {
    const g = new Glymo(createMockCanvas());

    const payloads: unknown[] = [];
    g.on('media-art:restore', (payload) => payloads.push(payload));

    await g.loadSession(makeSession([
      {
        id: 'o1',
        strokeIds: [],
        fillIds: [],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        metadata: { mediaArt: { modelId: 'earth', appliedAt: 0, sourceLabel: 'NASA / Blue Marble' } },
      },
      {
        id: 'o2',
        strokeIds: [],
        fillIds: [],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        metadata: { mediaArt: { modelId: 'astronaut', appliedAt: 1, sourceLabel: null } },
      },
    ]));

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toEqual({
      restorations: [
        { objectId: 'o1', modelId: 'earth', sourceLabel: 'NASA / Blue Marble' },
        { objectId: 'o2', modelId: 'astronaut', sourceLabel: null },
      ],
    });
  });

  it('does NOT emit when no objects have mediaArt', async () => {
    const g = new Glymo(createMockCanvas());

    const payloads: unknown[] = [];
    g.on('media-art:restore', (payload) => payloads.push(payload));

    await g.loadSession(makeSession([
      {
        id: 'o1',
        strokeIds: [],
        fillIds: [],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
      },
    ]));

    expect(payloads).toHaveLength(0);
  });

  it('does NOT emit when session has no objects', async () => {
    const g = new Glymo(createMockCanvas());

    const payloads: unknown[] = [];
    g.on('media-art:restore', (payload) => payloads.push(payload));

    await g.loadSession(makeSession([]));

    expect(payloads).toHaveLength(0);
  });

  it('filters out corrupt metadata — non-string modelId and null mediaArt', async () => {
    const g = new Glymo(createMockCanvas());

    const payloads: unknown[] = [];
    g.on('media-art:restore', (payload) => payloads.push(payload));

    await g.loadSession(makeSession([
      {
        // modelId is a number — invalid, must be filtered
        id: 'bad1',
        strokeIds: [],
        fillIds: [],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        metadata: { mediaArt: { modelId: 42 } },
      },
      {
        // mediaArt is null — invalid, must be filtered
        id: 'bad2',
        strokeIds: [],
        fillIds: [],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        metadata: { mediaArt: null },
      },
    ]));

    // All objects corrupted → no event at all
    expect(payloads).toHaveLength(0);
  });

  it('normalizes absent sourceLabel to null', async () => {
    const g = new Glymo(createMockCanvas());

    const payloads: unknown[] = [];
    g.on('media-art:restore', (payload) => payloads.push(payload));

    await g.loadSession(makeSession([
      {
        id: 'o1',
        strokeIds: [],
        fillIds: [],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        // sourceLabel intentionally absent
        metadata: { mediaArt: { modelId: 'earth', appliedAt: 0 } },
      },
    ]));

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toEqual({
      restorations: [{ objectId: 'o1', modelId: 'earth', sourceLabel: null }],
    });
  });

  it('emits only valid entries and filters corrupted ones in a mixed batch', async () => {
    const g = new Glymo(createMockCanvas());

    const payloads: unknown[] = [];
    g.on('media-art:restore', (payload) => payloads.push(payload));

    await g.loadSession(makeSession([
      {
        id: 'good',
        strokeIds: [],
        fillIds: [],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        metadata: { mediaArt: { modelId: 'earth', appliedAt: 0, sourceLabel: 'NASA' } },
      },
      {
        id: 'corrupt',
        strokeIds: [],
        fillIds: [],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        metadata: { mediaArt: { modelId: 999 } },
      },
    ]));

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toEqual({
      restorations: [{ objectId: 'good', modelId: 'earth', sourceLabel: 'NASA' }],
    });
  });
});
