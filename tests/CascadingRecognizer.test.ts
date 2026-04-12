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

  it('does not include 두\'s first stroke in 만\'s flush list when there is an 800ms pause', async () => {
    const flushedGroups: string[][] = [];
    const finalizedChars: string[] = [];

    mockRecognize.mockImplementation((strokes: StrokePoint[][]) => {
      // Fake recognizer: 1–7 strokes → '만', 1+ strokes after split → '두'
      return Promise.resolve({ text: '만', candidates: ['만'] });
    });

    const recognizer = new CascadingRecognizer({
      onChar: (c) => finalizedChars.push(c.char),
      onCorrection: () => {},
      onDisplayFlush: (ids) => flushedGroups.push([...ids]),
    });
    recognizer.setLanguage('ko');

    // 만: feed 7 strokes in rapid succession
    const manStrokeIds: string[] = [];
    for (let i = 0; i < 7; i++) {
      const id = `man-${i}`;
      manStrokeIds.push(id);
      const s = mkStroke(100 + i * 5, 100 + i * 2);
      recognizer.feedStroke(s.raw, s.bbox, 1, id);
      nowMs += 50; // 50ms between 만 strokes
    }
    await flushMicrotasks();

    // Pause 800ms — longer than half the ko finalizeDelay (1500/2 = 750ms).
    // This triggers the time-based boundary.
    nowMs += 800;

    // 두: feed 3 strokes spatially close to 만 (this is the bug scenario —
    // without the fix, the first 두 stroke would merge into 만's group).
    mockRecognize.mockImplementation(() => Promise.resolve({ text: '두', candidates: ['두'] }));

    const duStrokeIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = `du-${i}`;
      duStrokeIds.push(id);
      const s = mkStroke(180 + i * 5, 100 + i * 2); // spatially adjacent
      recognizer.feedStroke(s.raw, s.bbox, 1, id);
      nowMs += 50;
    }
    await flushMicrotasks();

    // Force finalize all remaining groups so onDisplayFlush fires for 두.
    // Use the public API — we simulate end-of-drawing.
    // We finalize via grouper's internal timer by advancing time past delay,
    // but the cleanest path is to access it via the clear+flush semantics.
    // Since CascadingRecognizer does not expose flushAll, simulate by
    // waiting for each group's timer — use fake timers would complicate
    // things. Instead, assert on the ALREADY-fired flush for 만.

    // Assertion 1: 만's flush must NOT include any 두 stroke ID.
    expect(flushedGroups.length).toBeGreaterThanOrEqual(1);
    const manFlush = flushedGroups[0]!;
    for (const duId of duStrokeIds) {
      expect(manFlush).not.toContain(duId);
    }

    // Assertion 2: 만's flush must include all 7 만 stroke IDs.
    for (const manId of manStrokeIds) {
      expect(manFlush).toContain(manId);
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
