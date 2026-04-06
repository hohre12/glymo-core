import {
  FontMorphAnimator,
  MORPH_DURATION_MS,
  CASCADE_DELAY_MS,
  MORPH_START_COLOR,
} from '../src/text/FontMorphAnimator.js';
import { easeOutElastic } from '../src/animate/MorphAnimator.js';
import { EventBus } from '../src/state/EventBus.js';
import type { MatchedPair } from '../src/types.js';
import type { MatchedCharacter } from '../src/text/types.js';

// ── Helpers ─────────────────────────────────────────

function makePair(
  handX: number, handY: number,
  fontX: number, fontY: number,
  charIndex: number, pointIndex: number,
): MatchedPair {
  return {
    hand: { x: handX, y: handY },
    font: { x: fontX, y: fontY },
    charIndex,
    pointIndex,
  };
}

function makeMatchedCharacter(
  char: string,
  charIndex: number,
  pairCount: number,
): MatchedCharacter {
  const pairs: MatchedPair[] = [];
  for (let i = 0; i < pairCount; i++) {
    pairs.push(makePair(
      i * 10, i * 10,           // hand positions
      i * 10 + 50, i * 10 + 50, // font positions (offset by 50)
      charIndex, i,
    ));
  }
  return { char, charIndex, pairs };
}

function createAnimator(
  charCount = 3,
  pairsPerChar = 5,
  options: Partial<{ duration: number; cascadeDelay: number; effectColor: string }> = {},
): { animator: FontMorphAnimator; eventBus: EventBus } {
  const eventBus = new EventBus();
  const matchedCharacters: MatchedCharacter[] = [];
  for (let i = 0; i < charCount; i++) {
    matchedCharacters.push(
      makeMatchedCharacter(String.fromCharCode(65 + i), i, pairsPerChar),
    );
  }

  const animator = new FontMorphAnimator(
    {
      matchedCharacters,
      effectColor: options.effectColor ?? '#00ffaa',
      duration: options.duration,
      cascadeDelay: options.cascadeDelay,
    },
    eventBus,
  );

  return { animator, eventBus };
}

// ── Constants tests ─────────────────────────────────

describe('FontMorphAnimator constants', () => {
  it('MORPH_DURATION_MS is 800', () => {
    expect(MORPH_DURATION_MS).toBe(800);
  });

  it('CASCADE_DELAY_MS is 80', () => {
    expect(CASCADE_DELAY_MS).toBe(80);
  });

  it('MORPH_START_COLOR is #10b981', () => {
    expect(MORPH_START_COLOR).toBe('#10b981');
  });
});

// ── easeOutElastic formula ──────────────────────────

describe('easeOutElastic in FontMorph context', () => {
  it('returns 0 at t=0', () => {
    expect(easeOutElastic(0)).toBe(0);
  });

  it('returns 1 at t=1', () => {
    expect(easeOutElastic(1)).toBe(1);
  });

  it('overshoots around t=0.15', () => {
    expect(easeOutElastic(0.15)).toBeGreaterThan(1);
  });

  it('output at t=0.5 is close to 1', () => {
    const val = easeOutElastic(0.5);
    expect(Math.abs(val - 1)).toBeLessThan(0.1);
  });

  it('converges to 1 by t=0.7', () => {
    const val = easeOutElastic(0.7);
    expect(Math.abs(val - 1)).toBeLessThan(0.02);
  });
});

// ── Duration ────────────────────────────────────────

describe('FontMorphAnimator duration', () => {
  it('uses 800ms default duration', () => {
    const { animator } = createAnimator();

    // Advance to exactly 800ms — should be complete
    const frame = animator.update(800);
    expect(frame.globalProgress).toBe(1);
    expect(frame.isComplete).toBe(true);
  });

  it('is not complete before 800ms', () => {
    const { animator } = createAnimator();

    const frame = animator.update(400);
    expect(frame.globalProgress).toBe(0.5);
    expect(frame.isComplete).toBe(false);
  });

  it('clamps progress at 1.0 for elapsed > duration', () => {
    const { animator } = createAnimator();

    const frame = animator.update(2000);
    expect(frame.globalProgress).toBe(1);
  });
});

// ── Per-character cascade delay ─────────────────────

describe('FontMorphAnimator cascade delay', () => {
  it('char 0 starts morphing immediately', () => {
    const { animator } = createAnimator(3, 5, { duration: 800, cascadeDelay: 80 });

    // At t=0, char 0 should have charProgress > 0 (or exactly 0)
    // At a small elapsed time, char 0 should be ahead of char 1
    const frame = animator.update(100); // 100ms in
    const char0Points = frame.points.filter(
      (_, idx) => idx < 5,  // first char has 5 points
    );
    const char2Points = frame.points.filter(
      (_, idx) => idx >= 10, // third char starts at index 10
    );

    // Char 0 should be more morphed (closer to target) than char 2
    // Char 0's hand starts at (0,0) font at (50,50) — if morphed, x > 0
    // Char 2 has a 160ms delay, at t=100ms it shouldn't have started much
    expect(char0Points[0]!.x).toBeGreaterThan(0);
  });

  it('later characters start morphing with delay offset', () => {
    const { animator } = createAnimator(3, 3, { duration: 800, cascadeDelay: 80 });

    // At very early time (10ms), char 2 (delay=160ms) should still be near start
    const frame = animator.update(10);

    // Get first point of each character
    const c0 = frame.points[0]!;  // charIndex=0, pointIndex=0
    const c2 = frame.points[6]!;  // charIndex=2, pointIndex=0

    // c0 should have more progress than c2
    // Both have hand at (0,0), font at (50,50)
    expect(c0.x).toBeGreaterThanOrEqual(c2.x);
  });
});

// ── Color interpolation ─────────────────────────────

describe('FontMorphAnimator color interpolation', () => {
  it('starts at green (#10b981)', () => {
    const { animator } = createAnimator(1, 3, { effectColor: '#ff0000' });

    // At t=0, charProgress=0 → color should be start color (green)
    const frame = animator.update(0);
    const point = frame.points[0]!;

    // #10b981 = RGB(16, 185, 129)
    expect(point.color.r).toBe(16);
    expect(point.color.g).toBe(185);
    expect(point.color.b).toBe(129);
  });

  it('ends at target effect color', () => {
    const { animator } = createAnimator(1, 3, {
      effectColor: '#ff0000',
      duration: 100,
      cascadeDelay: 0,
    });

    // At full progress, color should be target
    const frame = animator.update(100);
    const point = frame.points[0]!;

    expect(point.color.r).toBe(255);
    expect(point.color.g).toBe(0);
    expect(point.color.b).toBe(0);
  });

  it('interpolates mid-morph between green and target', () => {
    const { animator } = createAnimator(1, 3, {
      effectColor: '#ff0000',
      duration: 200,
      cascadeDelay: 0,
    });

    // At 50% progress
    const frame = animator.update(100);
    const point = frame.points[0]!;

    // Mid interpolation: r should be between 16 and 255
    expect(point.color.r).toBeGreaterThan(16);
    expect(point.color.r).toBeLessThan(255);
  });
});

// ── Events ──────────────────────────────────────────

describe('FontMorphAnimator events', () => {
  it('emits morph:progress on update', () => {
    const { animator, eventBus } = createAnimator(2, 3, { duration: 100 });
    const progressEvents: unknown[] = [];
    eventBus.on('morph:progress', (data) => progressEvents.push(data));

    animator.update(50);
    expect(progressEvents).toHaveLength(1);
    expect((progressEvents[0] as { progress: number }).progress).toBeCloseTo(0.5);
  });

  it('emits morph:complete when finished', () => {
    const { animator, eventBus } = createAnimator(1, 3, { duration: 100 });
    const events: string[] = [];
    eventBus.on('morph:complete', () => events.push('complete'));

    animator.update(100);
    expect(events).toEqual(['complete']);
    expect(animator.isActive()).toBe(false);
  });

  it('does not emit morph:complete before duration ends', () => {
    const { animator, eventBus } = createAnimator(1, 3, { duration: 100 });
    const events: string[] = [];
    eventBus.on('morph:complete', () => events.push('complete'));

    animator.update(50);
    expect(events).toHaveLength(0);
  });
});

// ── Lifecycle ───────────────────────────────────────

describe('FontMorphAnimator lifecycle', () => {
  it('isActive returns false before start', () => {
    const { animator } = createAnimator();
    expect(animator.isActive()).toBe(false);
  });

  it('cancel stops the animation', () => {
    const { animator } = createAnimator();
    // Manually set active via update
    animator.update(100);
    animator.cancel();
    expect(animator.isActive()).toBe(false);
  });

  it('getMatchedCharacters returns the input data', () => {
    const { animator } = createAnimator(2, 4);
    const chars = animator.getMatchedCharacters();
    expect(chars).toHaveLength(2);
    expect(chars[0]!.pairs).toHaveLength(4);
  });

  it('getLastFrame returns null before any update', () => {
    const { animator } = createAnimator();
    expect(animator.getLastFrame()).toBeNull();
  });

  it('getLastFrame returns the most recent frame after update', () => {
    const { animator } = createAnimator(1, 3, { duration: 100 });
    animator.update(50);
    const frame = animator.getLastFrame();
    expect(frame).not.toBeNull();
    expect(frame!.globalProgress).toBeCloseTo(0.5);
  });
});

// ── Frame output ────────────────────────────────────

describe('FontMorphAnimator frame output', () => {
  it('produces RenderedPoint for every matched pair', () => {
    const { animator } = createAnimator(2, 5);
    const frame = animator.update(400);

    // 2 chars x 5 pairs = 10 total points
    expect(frame.points).toHaveLength(10);

    for (const point of frame.points) {
      expect(typeof point.x).toBe('number');
      expect(typeof point.y).toBe('number');
      expect(typeof point.color.r).toBe('number');
      expect(typeof point.size).toBe('number');
      expect(typeof point.alpha).toBe('number');
    }
  });

  it('points interpolate from hand to font positions', () => {
    // Single char, single point: hand(0,0) → font(100,100)
    const eventBus = new EventBus();
    const mc: MatchedCharacter = {
      char: 'Z',
      charIndex: 0,
      pairs: [makePair(0, 0, 100, 100, 0, 0)],
    };
    const animator = new FontMorphAnimator(
      {
        matchedCharacters: [mc],
        effectColor: '#ffffff',
        duration: 100,
        cascadeDelay: 0,
      },
      eventBus,
    );

    // At t=0: should be at hand position
    const frame0 = animator.update(0);
    expect(frame0.points[0]!.x).toBe(0);
    expect(frame0.points[0]!.y).toBe(0);

    // At t=duration: easeOutElastic(1) = 1, so should be at font position
    const animator2 = new FontMorphAnimator(
      {
        matchedCharacters: [mc],
        effectColor: '#ffffff',
        duration: 100,
        cascadeDelay: 0,
      },
      eventBus,
    );
    const frame1 = animator2.update(100);
    expect(frame1.points[0]!.x).toBe(100);
    expect(frame1.points[0]!.y).toBe(100);
  });
});
