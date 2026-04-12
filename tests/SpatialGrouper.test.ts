/**
 * SpatialGrouper tests — focused on the A+B stroke-loss boundary fix.
 *
 * Fix A: time-based boundary. If the pause between strokes exceeds half
 *        the finalizeDelay, the previous group finalizes even if the
 *        new stroke is spatially near.
 * Fix B: finalizeGroupById — force finalize a specific group immediately,
 *        regardless of timer or proximity.
 */

import { SpatialGrouper, type GroupedStroke, type SpatialGroup } from '../src/grouping/SpatialGrouper.js';

// ── Helpers ──────────────────────────────────────────────────────────────

let idCounter = 0;

function mkStroke(x: number, y: number, w = 20, h = 20): GroupedStroke {
  return {
    id: `s${++idCounter}`,
    raw: [
      { x, y },
      { x: x + w, y: y + h },
    ],
    bbox: { x, y, width: w, height: h },
  };
}

interface Harness {
  grouper: SpatialGrouper;
  finalized: SpatialGroup[];
  updated: SpatialGroup[];
}

function makeGrouper(opts?: Partial<{
  proximityFactor: number;
  minProximityPx: number;
  maxProximityPx: number;
  finalizeDelay: number;
}>): Harness {
  const finalized: SpatialGroup[] = [];
  const updated: SpatialGroup[] = [];
  const grouper = new SpatialGrouper({
    proximityFactor: opts?.proximityFactor ?? 1.0,
    minProximityPx: opts?.minProximityPx ?? 60,
    maxProximityPx: opts?.maxProximityPx ?? 300,
    finalizeDelay: opts?.finalizeDelay ?? 1500,
    onGroupUpdated: (g) => updated.push({ ...g, strokes: [...g.strokes] }),
    onGroupFinalized: (g) => finalized.push({ ...g, strokes: [...g.strokes] }),
  });
  return { grouper, finalized, updated };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('SpatialGrouper time-based boundary (Fix A)', () => {
  let nowMs = 1000;
  let originalNow: () => number;

  beforeEach(() => {
    idCounter = 0;
    nowMs = 1000;
    originalNow = performance.now.bind(performance);
    performance.now = () => nowMs;
  });

  afterEach(() => {
    performance.now = originalNow;
  });

  it('two strokes within half-delay stay in SAME group (close)', () => {
    const { grouper, finalized } = makeGrouper({ finalizeDelay: 1500 });
    // delay = 1500 → half = 750 → 500 < 750 → same group
    grouper.feedStroke(mkStroke(100, 100));
    nowMs += 500;
    grouper.feedStroke(mkStroke(110, 110));

    // Force finalize all so we can inspect
    grouper.flushAll();
    expect(finalized.length).toBe(1);
    expect(finalized[0]!.strokes.length).toBe(2);
  });

  it('two strokes > half-delay apart end up in DIFFERENT groups even if near', () => {
    const { grouper, finalized } = makeGrouper({ finalizeDelay: 1500 });
    // delay = 1500 → half = 750 → 800 > 750 → boundary
    grouper.feedStroke(mkStroke(100, 100));
    nowMs += 800;
    grouper.feedStroke(mkStroke(110, 110)); // spatially near — would merge without time guard

    grouper.flushAll();
    expect(finalized.length).toBe(2);
    expect(finalized[0]!.strokes.length).toBe(1);
    expect(finalized[1]!.strokes.length).toBe(1);
    expect(finalized[0]!.strokes[0]!.id).not.toBe(finalized[1]!.strokes[0]!.id);
  });

  it('accumulates strokes added in rapid succession', () => {
    const { grouper, finalized } = makeGrouper({ finalizeDelay: 1500 });
    grouper.feedStroke(mkStroke(100, 100));
    nowMs += 100;
    grouper.feedStroke(mkStroke(105, 100));
    nowMs += 100;
    grouper.feedStroke(mkStroke(110, 100));

    grouper.flushAll();
    expect(finalized.length).toBe(1);
    expect(finalized[0]!.strokes.length).toBe(3);
  });
});

describe('SpatialGrouper finalizeGroupById (Fix B)', () => {
  let nowMs = 1000;
  let originalNow: () => number;

  beforeEach(() => {
    idCounter = 0;
    nowMs = 1000;
    originalNow = performance.now.bind(performance);
    performance.now = () => nowMs;
  });

  afterEach(() => {
    performance.now = originalNow;
  });

  it('force-finalizes a specific group immediately', () => {
    const { grouper, finalized } = makeGrouper({ finalizeDelay: 1500 });
    grouper.feedStroke(mkStroke(100, 100));
    // Active group has id=1 (idCounter starts at 0, ++counter → 1)
    grouper.finalizeGroupById(1);
    expect(finalized.length).toBe(1);
    expect(finalized[0]!.id).toBe(1);
  });

  it('is a no-op for non-existent or already-finalized groups', () => {
    const { grouper, finalized } = makeGrouper({ finalizeDelay: 1500 });
    grouper.feedStroke(mkStroke(100, 100));
    grouper.finalizeGroupById(1);
    // Second call on same id — must not re-fire the callback
    grouper.finalizeGroupById(1);
    grouper.finalizeGroupById(999);
    expect(finalized.length).toBe(1);
  });

  it('after early-commit, next stroke starts a NEW group even if spatially close', () => {
    const { grouper, finalized } = makeGrouper({ finalizeDelay: 1500 });
    grouper.feedStroke(mkStroke(100, 100));
    grouper.finalizeGroupById(1);
    // Next stroke arrives immediately, same location — must start new group
    nowMs += 10;
    grouper.feedStroke(mkStroke(105, 105));
    grouper.flushAll();
    expect(finalized.length).toBe(2);
    expect(finalized[0]!.strokes.length).toBe(1);
    expect(finalized[1]!.strokes.length).toBe(1);
  });
});
