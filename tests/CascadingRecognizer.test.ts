/**
 * CascadingRecognizer tests — verifies the 만→두 stroke-loss scenario is
 * fixed by the time-based boundary in SpatialGrouper and the early-commit
 * path in CascadingRecognizer.
 */

import { CascadingRecognizer } from '../src/text/CascadingRecognizer.js';
import type { StrokePoint } from '../src/types.js';
import type { Bbox } from '../src/grouping/SpatialGrouper.js';

// ── Hoisted mock ─────────────────────────────────────────────────────────

const mockRecognize = vi.hoisted(() => vi.fn());

vi.mock('../src/text/HandwritingRecognizer.js', () => ({
  recognizeHandwriting: mockRecognize,
}));

// ── Helpers ──────────────────────────────────────────────────────────────

let nowMs = 1000;
let originalNow: () => number;

function mkStroke(x: number, y: number, w = 15, h = 15): { raw: StrokePoint[]; bbox: Bbox } {
  return {
    raw: [
      { x, y, t: nowMs, pressure: 0.5 },
      { x: x + w, y: y + h, t: nowMs + 10, pressure: 0.5 },
    ],
    bbox: { x, y, width: w, height: h },
  };
}

/** Wait for all pending microtasks (the mocked recognizer resolves via Promise.resolve). */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('CascadingRecognizer — 만두 stroke-loss scenario', () => {
  beforeEach(() => {
    nowMs = 1000;
    originalNow = performance.now.bind(performance);
    performance.now = () => nowMs;
    mockRecognize.mockReset();
  });

  afterEach(() => {
    performance.now = originalNow;
  });

  it('early-commit via confidence separates 만 from 두 strokes', async () => {
    // Root cause of the 만두 stroke-loss bug:
    //   Without early-commit, when 두's first stroke arrives spatially near 만,
    //   it merges into 만's group → 만 never finalizes cleanly → stroke loss.
    //
    // Fix: confidence-based early-commit. When a Korean group has been
    // recognized as the SAME single char for >= 4 consecutive passes (stableThreshold=4)
    // AND has >= 4 strokes (minStrokes=4), the group is finalized immediately
    // regardless of what the next stroke does spatially.
    //
    // Critical requirement: recognition must complete BETWEEN each stroke so
    // stableCount can accumulate. Each feedStroke increments state.generation,
    // invalidating in-flight promises — therefore flushMicrotasks() must be
    // awaited INSIDE the stroke loop, not after it.
    //
    // Original test placed flushMicrotasks() outside the loop: 7 feedStrokes
    // fired, each incrementing generation, so only the last gen's promise was
    // valid → stableCount=1 → early-commit never fired → test failed.
    // This test fixes that structural mistake.
    const flushedGroups: string[][] = [];
    const finalizedChars: string[] = [];

    mockRecognize.mockImplementation(() =>
      Promise.resolve({ text: '만', candidates: ['만'] }),
    );

    const recognizer = new CascadingRecognizer({
      onChar: (c) => finalizedChars.push(c.char),
      onCorrection: () => {},
      onDisplayFlush: (ids) => flushedGroups.push([...ids]),
    });
    recognizer.setLanguage('ko');

    // Feed 만 strokes ONE AT A TIME, flushing microtasks after each stroke
    // so recognition completes and stableCount increments for every stroke.
    // Korean stableThreshold=4, minStrokes=4 — so at stroke 4 early-commit fires.
    const manStrokeIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = `man-${i}`;
      manStrokeIds.push(id);
      const s = mkStroke(100 + i * 5, 100 + i * 2);
      recognizer.feedStroke(s.raw, s.bbox, 1, id);
      nowMs += 50;
      await flushMicrotasks(); // MUST be inside loop — each stroke invalidates the previous gen
    }

    // At stroke 4, early-commit should have fired.
    // onDisplayFlush was called with the first group's stroke IDs.
    expect(flushedGroups.length).toBeGreaterThanOrEqual(1);
    const manFlush = flushedGroups[0]!;

    // All flushed stroke IDs must be 만 strokes (no contamination).
    for (const id of manFlush) {
      expect(manStrokeIds).toContain(id);
    }

    // Feed 두 strokes — spatially near to 만 but 만 is already finalized.
    // They must start a NEW group.
    mockRecognize.mockImplementation(() =>
      Promise.resolve({ text: '두', candidates: ['두'] }),
    );
    const duStrokeIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = `du-${i}`;
      duStrokeIds.push(id);
      const s = mkStroke(120 + i * 5, 100 + i * 2); // spatially near — but 만 is already gone
      recognizer.feedStroke(s.raw, s.bbox, 1, id);
      nowMs += 50;
      await flushMicrotasks();
    }

    // 두 strokes must NOT appear in 만's flush list.
    for (const duId of duStrokeIds) {
      expect(manFlush).not.toContain(duId);
    }

    recognizer.destroy();
  });

  it('time-based boundary finalizes previous group even when strokes are spatially close', async () => {
    const flushedGroups: string[][] = [];

    mockRecognize.mockImplementation(() =>
      Promise.resolve({ text: 'A', candidates: ['A'] }),
    );

    const recognizer = new CascadingRecognizer({
      onChar: () => {},
      onCorrection: () => {},
      onDisplayFlush: (ids) => flushedGroups.push([...ids]),
    });
    recognizer.setLanguage('en');
    // en finalizeDelay = 1200 → half = 600

    const s1 = mkStroke(100, 100);
    recognizer.feedStroke(s1.raw, s1.bbox, 1, 'stroke-A');
    await flushMicrotasks();
    nowMs += 50;
    const s2 = mkStroke(110, 100);
    recognizer.feedStroke(s2.raw, s2.bbox, 1, 'stroke-B');
    await flushMicrotasks();

    // Now pause 700ms (> 600ms half-delay) and feed a near stroke.
    nowMs += 700;
    const s3 = mkStroke(120, 100); // spatially near
    recognizer.feedStroke(s3.raw, s3.bbox, 1, 'stroke-C');
    await flushMicrotasks();

    // Core invariant: stroke-C must NEVER appear in the same flush as stroke-A
    // (that would mean the boundary was missed and C was merged into AB's group,
    // which is exactly the stroke-loss bug).
    for (const flush of flushedGroups) {
      if (flush.includes('stroke-A')) {
        expect(flush).not.toContain('stroke-C');
      }
    }

    recognizer.destroy();
  });

  it('emits globally-unique char ids across recognizer instances (no counter collision)', async () => {
    // Regression gate for the 2026-04-19 "안녕 → save → load → 반 → 녕반"
    // bug. CascadingRecognizer previously minted char ids as
    // `char-${++idCounter}` — a per-instance counter that reset to 0 on
    // every new recognizer. On re-entry into a saved session, the first
    // newly-recognised character would claim id `char-1`, colliding with
    // the FIRST saved character's id. `CharacterStore.addCharacter`
    // interprets a known id as an update → the new char silently
    // overwrote the loaded one, making it appear to have vanished.
    // Canonical fix: crypto.randomUUID() so ids are globally unique.
    // See docs/plans/session-persistence-round-trip.md §11.9.

    mockRecognize.mockImplementation(() =>
      Promise.resolve({ text: 'A', candidates: ['A'] }),
    );

    const firstIds: string[] = [];
    const secondIds: string[] = [];

    // Recognizer #1 — mimics the original save-time recognizer.
    const r1 = new CascadingRecognizer({
      onChar: (c) => firstIds.push(c.id),
      onCorrection: () => {},
      onDisplayFlush: () => {},
    });
    r1.setLanguage('en');
    const a1 = mkStroke(100, 100);
    r1.feedStroke(a1.raw, a1.bbox, 1, 'r1-a');
    await flushMicrotasks();
    const a2 = mkStroke(105, 100);
    r1.feedStroke(a2.raw, a2.bbox, 1, 'r1-b');
    await flushMicrotasks();
    r1.destroy();
    expect(firstIds).toHaveLength(1);

    // Recognizer #2 — mimics the fresh recognizer created after load.
    const r2 = new CascadingRecognizer({
      onChar: (c) => secondIds.push(c.id),
      onCorrection: () => {},
      onDisplayFlush: () => {},
    });
    r2.setLanguage('en');
    const b1 = mkStroke(200, 100);
    r2.feedStroke(b1.raw, b1.bbox, 1, 'r2-a');
    await flushMicrotasks();
    const b2 = mkStroke(205, 100);
    r2.feedStroke(b2.raw, b2.bbox, 1, 'r2-b');
    await flushMicrotasks();
    r2.destroy();
    expect(secondIds).toHaveLength(1);

    // Primary invariant: ids across instances MUST NOT collide.
    expect(firstIds[0]).not.toBe(secondIds[0]);

    // Shape invariant: lock in UUID format so a future revert to the
    // counter pattern fails at the shape level, not just the collision
    // check. UUID v4 shape — 8-4-4-4-12 hex digits.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(firstIds[0]).toMatch(uuidRe);
    expect(secondIds[0]).toMatch(uuidRe);
  });

  it('early-commit finalizes a group immediately when recognition is stable', async () => {
    const flushedGroups: string[][] = [];
    const finalizedChars: string[] = [];

    // Mock: always returns the same stable single-char result.
    mockRecognize.mockImplementation(() =>
      Promise.resolve({ text: 'A', candidates: ['A'] }),
    );

    const recognizer = new CascadingRecognizer({
      onChar: (c) => finalizedChars.push(c.char),
      onCorrection: () => {},
      onDisplayFlush: (ids) => flushedGroups.push([...ids]),
    });
    recognizer.setLanguage('en');

    // Feed 2 strokes in rapid succession. After the 2nd pass, stableCount=2
    // → confidenceHigh → early-commit fires.
    const s1 = mkStroke(100, 100);
    recognizer.feedStroke(s1.raw, s1.bbox, 1, 'a-1');
    await flushMicrotasks();

    const s2 = mkStroke(105, 100);
    recognizer.feedStroke(s2.raw, s2.bbox, 1, 'a-2');
    await flushMicrotasks();

    // Early-commit should have fired.
    expect(flushedGroups.length).toBe(1);
    expect(flushedGroups[0]).toEqual(['a-1', 'a-2']);
    expect(finalizedChars).toEqual(['A']);

    // A third stroke now arrives — even spatially near, no time gap.
    // It must start a NEW group because the previous group was force-finalized.
    const s3 = mkStroke(108, 100);
    recognizer.feedStroke(s3.raw, s3.bbox, 1, 'a-3');
    await flushMicrotasks();

    // The previous flush count must not have grown — 'a-3' belongs to a new group.
    expect(flushedGroups.length).toBe(1);

    recognizer.destroy();
  });
});
