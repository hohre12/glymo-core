// Tests that Glymo.setObjectMetadata invalidates the 2D offscreen cache
// (i.e. calls renderer.markDirty) on every successful write. This is the
// canonical fix for the Task 2.3 code-review criterion: metadata.mediaArt
// triggers render-layer skip guards, so a freshly-applied marker must not
// silently leave stale pixels in the cache bitmap.
//
// Behaviour contract:
//   T1 — successful set (value present) → markDirty fires once
//   T2 — successful clear (value undefined) → markDirty fires once
//   T3 — unknown objectId → returns false, markDirty does NOT fire

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Glymo } from '../src/index.js';

// ── Node-env polyfills ──────────────────────────────────────────────────────
// Same OffscreenCanvas stub used across translateObject / selection-mesh-hit.

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

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Glymo.setObjectMetadata — markDirty invariant', () => {
  let g: Glymo;
  let markDirty: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    g = new Glymo(createMockCanvas());
    // Reach into the private renderer via a typed cast and replace markDirty
    // with a spy so we can assert cache invalidation without running a full
    // render cycle.
    markDirty = vi.fn();
    (g as unknown as { renderer: { markDirty: () => void } }).renderer.markDirty =
      markDirty;
  });

  it('T1: successful set fires markDirty exactly once', () => {
    const obj = g.createObject([], { x: 0, y: 0, width: 10, height: 10 });

    const result = g.setObjectMetadata(obj.id, 'mediaArt', {
      modelId: 'earth',
      appliedAt: 0,
    });

    expect(result).toBe(true);
    expect(markDirty).toHaveBeenCalledTimes(1);
  });

  it('T2: successful clear (value undefined) fires markDirty exactly once', () => {
    const obj = g.createObject([], { x: 0, y: 0, width: 10, height: 10 });
    // First set — prime the metadata key.
    g.setObjectMetadata(obj.id, 'mediaArt', { modelId: 'earth', appliedAt: 0 });
    markDirty.mockClear();

    const result = g.setObjectMetadata(obj.id, 'mediaArt', undefined);

    expect(result).toBe(true);
    expect(markDirty).toHaveBeenCalledTimes(1);
  });

  it('T3: unknown objectId returns false and does not fire markDirty', () => {
    const before = markDirty.mock.calls.length;

    const result = g.setObjectMetadata('no-such-id', 'mediaArt', {
      modelId: 'earth',
      appliedAt: 0,
    });

    expect(result).toBe(false);
    expect(markDirty.mock.calls.length).toBe(before);
  });
});
