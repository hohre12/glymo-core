/**
 * SpatialGrouper tests — verifying the current spatial-grouping contract.
 *
 * History:
 *   fd2b506 — Added time-based boundary (Fix A): pause > finalizeDelay/2 → split
 *   d4688ce — REMOVED Fix A: the time check caused every camera/air-drawn stroke
 *             to finalize individually (hand movement naturally exceeds 600ms).
 *             Reverted to spatial-only grouping in feedStroke().
 *
 * Current contract:
 *   - feedStroke() groups by spatial proximity only. Time-gap does NOT cause
 *     an immediate split. The finalizeDelay timer still fires, but feedStroke()
 *     itself is time-agnostic.
 *   - notifyStrokeStart() resets the timer (extends the group lifetime).
 *   - finalizeGroupById() (Fix B) — force-finalize by ID — is still present.
 *
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

// Time-based boundary was removed in commit d4688ce
// ("fix(grouping): remove time-boundary check that broke camera multi-stroke grouping").
// feedStroke() is now spatial-only: time gap does NOT split groups.
// The suite is renamed to reflect the current contract.

describe('SpatialGrouper spatial-only grouping contract (d4688ce)', () => {
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

  it('two spatially near strokes stay in SAME group regardless of time gap', () => {
    const { grouper, finalized } = makeGrouper({ finalizeDelay: 1500 });
    grouper.feedStroke(mkStroke(100, 100));
    // Advance 800ms — MORE than finalizeDelay/2, but feedStroke() is time-agnostic.
    nowMs += 800;
    grouper.feedStroke(mkStroke(110, 110)); // spatially near → merges

    grouper.flushAll();
    expect(finalized.length).toBe(1);
    expect(finalized[0]!.strokes.length).toBe(2);
  });

  it('two spatially FAR strokes end up in DIFFERENT groups (proximity split)', () => {
    const { grouper, finalized } = makeGrouper({ finalizeDelay: 1500 });
    grouper.feedStroke(mkStroke(100, 100));
    grouper.feedStroke(mkStroke(900, 900)); // spatially far → new group

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
