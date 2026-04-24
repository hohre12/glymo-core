/**
 * StrokeAnimator primitive amplitude locks.
 *
 * Regression gate for the 0.11.1 glow/shine/sparkle visibility fix. Before
 * 0.11.1 these three modulation primitives only drove `glowIntensity`, which
 * the renderer applies only to the outer glow pass (shadowBlur + globalAlpha).
 * On effect presets with a minimal glow style (or when consumers disable the
 * glow pass) the main stroke looked frozen — the root cause of the
 * "house → classifier works but stroke doesn't move" bug reported
 * 2026-04-21.
 *
 * The fix was to additionally modulate `scale` and `opacity` so the stroke
 * itself breathes. These tests pin the new amplitudes so future drift
 * (intentional or accidental) surfaces as a failing test with a direct
 * reference to the bug above.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrokeAnimator } from '../src/animation/StrokeAnimator.js';
import type { AnimationTransform } from '../src/animation/types.js';

const STROKE_ID = 'stroke-0';

function startedAnimator(): StrokeAnimator {
  // Freeze time so the animator can be driven deterministically with
  // `vi.setSystemTime` via `performance.now()` mocking.
  return new StrokeAnimator();
}

function transformAt(
  animator: StrokeAnimator,
  normalizedPhase: number, // 0..1 within the first cycle
  durationMs: number,
): AnimationTransform | null {
  // `getTransform` uses performance.now() internally; we mock it.
  const startedAt = 1_000; // arbitrary base
  vi.spyOn(performance, 'now').mockReturnValue(startedAt + durationMs * normalizedPhase);
  // Phase 2 of rendering-pipeline-v2 added a `getTransform(..., out)`
  // overload returning `boolean`. The legacy 2-arg shape still returns
  // `AnimationTransform | null` bit-identical to pre-Phase-2; declaring
  // the return type explicitly here pins us to that overload and stops
  // `ReturnType<>` from resolving to the last overload's `boolean`.
  return animator.getTransform(STROKE_ID, startedAt + durationMs * normalizedPhase);
}

describe('StrokeAnimator — modulation primitive visibility', () => {
  let nowSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    // Anchor startTime so that any animation added during the test starts
    // precisely at t=0 of our synthetic clock.
    nowSpy = vi.spyOn(performance, 'now').mockReturnValue(1_000);
  });

  afterEach(() => {
    nowSpy?.mockRestore();
    nowSpy = null;
    vi.restoreAllMocks();
  });

  describe('glow', () => {
    it('breathes scale ±4% with opacity 0.85→1.0 and glowIntensity 0.8→1.8', () => {
      const animator = startedAnimator();
      const durationMs = 2_000;
      animator.addAnimation([STROKE_ID], {
        type: 'glow',
        duration: durationMs,
        repeat: true,
      });

      const peak = transformAt(animator, 0.25, durationMs);
      const trough = transformAt(animator, 0.75, durationMs);
      const neutral = transformAt(animator, 0.0, durationMs);

      expect(peak).not.toBeNull();
      expect(trough).not.toBeNull();
      expect(neutral).not.toBeNull();

      // Peak: sin = +1 — scale ×1.04, opacity 1.0, glowIntensity 1.8
      expect(peak!.scale).toBeCloseTo(1.04, 4);
      expect(peak!.opacity).toBeCloseTo(1.0, 4);
      expect(peak!.glowIntensity).toBeCloseTo(1.8, 4);

      // Trough: sin = −1 — scale ×0.96, opacity 0.85, glowIntensity 0.8
      expect(trough!.scale).toBeCloseTo(0.96, 4);
      expect(trough!.opacity).toBeCloseTo(0.85, 4);
      expect(trough!.glowIntensity).toBeCloseTo(0.8, 4);

      // Neutral (t=0, sin=0): scale 1.0, opacity 0.925, glowIntensity 1.3
      expect(neutral!.scale).toBeCloseTo(1.0, 4);
      expect(neutral!.opacity).toBeCloseTo(0.925, 4);
      expect(neutral!.glowIntensity).toBeCloseTo(1.3, 4);
    });
  });

  describe('shine', () => {
    it('breathes scale ±3% with opacity 0.8→1.0 and glowIntensity 1.0→2.2', () => {
      const animator = startedAnimator();
      const durationMs = 2_000;
      animator.addAnimation([STROKE_ID], {
        type: 'shine',
        duration: durationMs,
        repeat: true,
      });

      const peak = transformAt(animator, 0.25, durationMs);
      const trough = transformAt(animator, 0.75, durationMs);

      expect(peak).not.toBeNull();
      expect(trough).not.toBeNull();

      // Peak: sin = +1 — scale ×1.03, opacity 1.0, glowIntensity 1+1.2=2.2
      expect(peak!.scale).toBeCloseTo(1.03, 4);
      expect(peak!.opacity).toBeCloseTo(1.0, 4);
      expect(peak!.glowIntensity).toBeCloseTo(2.2, 4);

      // Trough: sin = −1 — scale ×0.97, opacity 0.8, glowIntensity 1.0
      expect(trough!.scale).toBeCloseTo(0.97, 4);
      expect(trough!.opacity).toBeCloseTo(0.8, 4);
      expect(trough!.glowIntensity).toBeCloseTo(1.0, 4);
    });
  });

  describe('sparkle', () => {
    it('breathes scale ±3% with opacity 0.8→1.0 and glowIntensity 0.6→1.4', () => {
      const animator = startedAnimator();
      const durationMs = 2_000;
      animator.addAnimation([STROKE_ID], {
        type: 'sparkle',
        duration: durationMs,
        repeat: true,
      });

      const peak = transformAt(animator, 0.25, durationMs);
      const trough = transformAt(animator, 0.75, durationMs);

      expect(peak).not.toBeNull();
      expect(trough).not.toBeNull();

      expect(peak!.scale).toBeCloseTo(1.03, 4);
      expect(peak!.opacity).toBeCloseTo(1.0, 4);
      expect(peak!.glowIntensity).toBeCloseTo(1.4, 4);

      expect(trough!.scale).toBeCloseTo(0.97, 4);
      expect(trough!.opacity).toBeCloseTo(0.8, 4);
      expect(trough!.glowIntensity).toBeCloseTo(0.6, 4);
    });
  });

  describe('pulse (regression)', () => {
    // pulse already modulated scale + opacity pre-0.11.1; this lock ensures
    // the fix to glow/shine/sparkle didn't accidentally redefine pulse.
    it('still breathes scale ±15% with opacity 0.6→1.0 (unchanged)', () => {
      const animator = startedAnimator();
      const durationMs = 2_000;
      animator.addAnimation([STROKE_ID], {
        type: 'pulse',
        duration: durationMs,
        repeat: true,
      });

      const peak = transformAt(animator, 0.25, durationMs);
      const trough = transformAt(animator, 0.75, durationMs);

      expect(peak).not.toBeNull();
      expect(trough).not.toBeNull();

      expect(peak!.scale).toBeCloseTo(1.15, 4);
      expect(peak!.opacity).toBeCloseTo(1.0, 4);

      expect(trough!.scale).toBeCloseTo(0.85, 4);
      expect(trough!.opacity).toBeCloseTo(0.6, 4);
    });
  });
});
