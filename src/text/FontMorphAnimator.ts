// ── Stage 10: FontMorphAnimator — easeOutElastic Morph Animation ──

import type { MatchedPair, RenderedPoint, MorphFrame, RGB } from '../types.js';
import type { EventBus } from '../state/EventBus.js';
import type { MatchedCharacter, FontMorphOptions } from './types.js';
import { hexToRgb } from '../util/math.js';
import { easeOutElastic } from '../animate/MorphAnimator.js';

// ── Constants (IMMUTABLE per design.md) ─────────────

/** Total morph duration in milliseconds */
export const MORPH_DURATION_MS = 800;

/** Per-character cascade delay in milliseconds */
export const CASCADE_DELAY_MS = 80;

/** Starting morph color — green */
export const MORPH_START_COLOR = '#10b981';

// ── Internal Constants ──────────────────────────────

const START_RGB: RGB = { r: 16, g: 185, b: 129 }; // #10b981
const BASE_SIZE = 1.2;
const SIZE_GROWTH = 0.8;
const MIN_ALPHA = 0.4;
const ALPHA_RANGE = 0.6;
const SPARKLE_BASE = 0.7;
const SPARKLE_AMP = 0.3;
const SPARKLE_FREQ = 0.3;
const SPARKLE_SPEED = 20;

// ── FontMorphAnimator ───────────────────────────────

/**
 * Stage 10: FontMorphAnimator
 *
 * Animates morph from hand-drawn positions to font glyph positions.
 * Uses easeOutElastic easing (IMMUTABLE) over 800ms with 80ms
 * per-character cascade delay.
 *
 * Color interpolates from green (#10b981) to the effect color.
 */
export class FontMorphAnimator {
  private readonly matchedCharacters: MatchedCharacter[];
  private readonly allPairs: MatchedPair[];
  private readonly targetColor: RGB;
  private readonly duration: number;
  private readonly cascadeDelay: number;
  private readonly charCount: number;
  private readonly eventBus: EventBus;

  private animFrameId: number | null = null;
  private startTime = 0;
  private active = false;
  private lastFrame: MorphFrame | null = null;

  constructor(options: FontMorphOptions, eventBus: EventBus) {
    this.matchedCharacters = options.matchedCharacters;
    this.allPairs = flattenPairs(options.matchedCharacters);
    this.targetColor = hexToRgb(options.effectColor);
    this.duration = options.duration ?? MORPH_DURATION_MS;
    this.cascadeDelay = options.cascadeDelay ?? CASCADE_DELAY_MS;
    this.charCount = options.matchedCharacters.length;
    this.eventBus = eventBus;
  }

  /** Begin the morph animation (uses requestAnimationFrame) */
  start(): void {
    this.active = true;
    this.startTime = performance.now();
    this.eventBus.emit('morph:start');
    this.scheduleFrame();
  }

  /** Manually advance animation (for render-loop integration / testing) */
  update(elapsed: number): MorphFrame {
    const globalProgress = Math.min(1, elapsed / this.duration);
    const points = this.computeFrame(globalProgress);
    const isComplete = globalProgress >= 1;

    const frame: MorphFrame = { points, globalProgress, isComplete };
    this.lastFrame = frame;

    this.eventBus.emit('morph:progress', {
      progress: globalProgress,
      charCount: this.charCount,
    });

    if (isComplete) {
      this.active = false;
      this.eventBus.emit('morph:complete');
    }

    return frame;
  }

  /** Cancel ongoing animation */
  cancel(): void {
    this.active = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getLastFrame(): MorphFrame | null {
    return this.lastFrame;
  }

  getMatchedCharacters(): MatchedCharacter[] {
    return this.matchedCharacters;
  }

  // ── Private Methods ───────────────────────────────

  /** Schedule the next animation frame via rAF */
  private scheduleFrame(): void {
    if (!this.active) return;
    this.animFrameId = requestAnimationFrame((now) => this.onFrame(now));
  }

  /** Animation frame callback */
  private onFrame(now: number): void {
    if (!this.active) return;

    const elapsed = now - this.startTime;
    this.update(elapsed);

    if (this.active) {
      this.scheduleFrame();
    }
  }

  /** Compute rendered points for a single frame */
  private computeFrame(globalProgress: number): RenderedPoint[] {
    const points: RenderedPoint[] = [];
    const totalDelay = this.charCount * this.cascadeDelay;
    const effectiveDuration = this.duration - totalDelay;

    for (const pair of this.allPairs) {
      const charOffset = pair.charIndex * this.cascadeDelay;
      const charProgress = clampProgress(
        globalProgress,
        charOffset,
        effectiveDuration,
        this.duration,
      );

      const easedT = easeOutElastic(charProgress);
      const rendered = interpolatePoint(
        pair, easedT, charProgress, globalProgress,
        START_RGB, this.targetColor,
      );
      points.push(rendered);
    }

    return points;
  }
}

// ── Pure Helper Functions ───────────────────────────

/** Flatten all per-character pairs into a single array */
function flattenPairs(chars: MatchedCharacter[]): MatchedPair[] {
  const result: MatchedPair[] = [];
  for (const mc of chars) {
    for (const pair of mc.pairs) {
      result.push(pair);
    }
  }
  return result;
}

/** Compute per-character progress with cascade delay */
function clampProgress(
  globalProgress: number,
  charOffsetMs: number,
  effectiveDuration: number,
  totalDuration: number,
): number {
  if (effectiveDuration <= 0) return globalProgress;
  const charStart = charOffsetMs / totalDuration;
  const charDuration = effectiveDuration / totalDuration;
  return Math.max(0, Math.min(1, (globalProgress - charStart) / charDuration));
}

/** Interpolate a single point's position, color, size, and alpha */
function interpolatePoint(
  pair: MatchedPair,
  easedT: number,
  charProgress: number,
  globalProgress: number,
  startColor: RGB,
  targetColor: RGB,
): RenderedPoint {
  const x = pair.hand.x + (pair.font.x - pair.hand.x) * easedT;
  const y = pair.hand.y + (pair.font.y - pair.hand.y) * easedT;

  const color = lerpColor(startColor, targetColor, charProgress);
  const size = BASE_SIZE + charProgress * SIZE_GROWTH;

  const sparkle = charProgress > 0 && charProgress < 1
    ? SPARKLE_BASE + Math.sin(
        pair.pointIndex * SPARKLE_FREQ + globalProgress * SPARKLE_SPEED,
      ) * SPARKLE_AMP
    : 1;

  const alpha = (MIN_ALPHA + charProgress * ALPHA_RANGE) * sparkle;

  return { x, y, color, size, alpha };
}

/** Linearly interpolate between two RGB colors */
function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}
