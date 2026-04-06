// ── KineticEngine — Kinetic Typography Layout + Animation ──
//
// Combines PretextLayout (spatial arrangement) with FontMorphAnimator
// (temporal animation). After morph completes, characters are
// rearranged according to the chosen layout mode. Supports dynamic
// re-layout when the stroke path updates.

import type { Point } from '../types.js';
import type { PositionedChar, LayoutMode, LayoutOptions } from './types.js';
import { DEFAULT_LAYOUT_OPTIONS } from './types.js';
import {
  layoutTextAlongCurve,
  layoutTextInCircle,
  layoutTextInShape,
} from './PretextLayout.js';

// ── Constants ───────────────────────────────────────

const DEFAULT_STAGGER_MS = 30;
const LINEAR_CHAR_WIDTH = 0.6;

// ── KineticEngine ───────────────────────────────────

/**
 * Orchestrates kinetic typography by computing layout positions
 * and providing staggered timing for character appearance along
 * curves, circles, or filled shapes.
 */
export class KineticEngine {
  private layoutMode: LayoutMode;
  private options: LayoutOptions;
  private positioned: PositionedChar[] = [];
  private staggerMs: number;

  constructor(options?: Partial<LayoutOptions>, staggerMs?: number) {
    this.options = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
    this.layoutMode = this.options.mode;
    this.staggerMs = staggerMs ?? DEFAULT_STAGGER_MS;
  }

  // ── Configuration ─────────────────────────────────

  setLayoutMode(mode: LayoutMode): void {
    this.layoutMode = mode;
    this.options.mode = mode;
  }

  getLayoutMode(): LayoutMode {
    return this.layoutMode;
  }

  setOptions(options: Partial<LayoutOptions>): void {
    Object.assign(this.options, options);
    if (options.mode !== undefined) {
      this.layoutMode = options.mode;
    }
  }

  // ── Layout Computation ────────────────────────────

  /**
   * Compute layout positions for the given text and stroke path.
   * The layout mode determines which algorithm is used.
   */
  computeLayout(text: string, strokePath: Point[]): PositionedChar[] {
    const fontSize = this.options.fontSize ?? 16;

    switch (this.layoutMode) {
      case 'curve':
        this.positioned = layoutTextAlongCurve(text, strokePath, fontSize);
        break;
      case 'circle':
        this.positioned = this.computeCircleLayout(text, strokePath);
        break;
      case 'fill':
        this.positioned = layoutTextInShape(text, strokePath, fontSize);
        break;
      case 'linear':
      default:
        this.positioned = this.computeLinearLayout(text, strokePath, fontSize);
        break;
    }

    return this.positioned;
  }

  /**
   * Re-layout existing text with an updated stroke path.
   * Returns the new positions or empty array if no text was set.
   */
  relayout(text: string, newPath: Point[]): PositionedChar[] {
    return this.computeLayout(text, newPath);
  }

  /** Get the most recently computed positioned characters */
  getPositionedChars(): PositionedChar[] {
    return this.positioned;
  }

  // ── Staggered Timing ──────────────────────────────

  /**
   * Compute staggered delay for each character index.
   * Used for animating characters appearing one-by-one along the layout.
   */
  getStaggerDelay(charIndex: number): number {
    return charIndex * this.staggerMs;
  }

  /**
   * Compute progress (0-1) for a character at a given elapsed time.
   * Duration is the total animation time per character.
   */
  getCharProgress(
    charIndex: number,
    elapsedMs: number,
    charDurationMs: number,
  ): number {
    const delay = this.getStaggerDelay(charIndex);
    const local = elapsedMs - delay;
    if (local <= 0) return 0;
    if (local >= charDurationMs) return 1;
    return local / charDurationMs;
  }

  /**
   * Total animation duration for all characters to finish,
   * given a per-character duration.
   */
  getTotalDuration(charCount: number, charDurationMs: number): number {
    if (charCount <= 0) return 0;
    return (charCount - 1) * this.staggerMs + charDurationMs;
  }

  // ── Private Layout Helpers ────────────────────────

  /** Circle layout: derive center and radius from stroke path */
  private computeCircleLayout(
    text: string,
    strokePath: Point[],
  ): PositionedChar[] {
    if (strokePath.length < 2) return [];

    const center = this.computeCentroid(strokePath);
    const radius = this.options.radius ?? this.computeAvgRadius(center, strokePath);
    const startAngle = this.options.startAngle ?? 0;

    return layoutTextInCircle(text, center, radius, startAngle);
  }

  /** Linear layout: horizontal placement starting at the first stroke point */
  private computeLinearLayout(
    text: string,
    strokePath: Point[],
    fontSize: number,
  ): PositionedChar[] {
    if (text.length === 0) return [];

    const start = strokePath.length > 0
      ? strokePath[0]!
      : { x: 0, y: 0 };

    const charWidth = fontSize * LINEAR_CHAR_WIDTH;
    return Array.from(text).map((char, i) => ({
      char,
      x: start.x + charWidth * i,
      y: start.y,
      rotation: 0,
      scale: 1,
    }));
  }

  /** Compute centroid of a set of points */
  private computeCentroid(points: Point[]): Point {
    let sx = 0;
    let sy = 0;
    for (const p of points) {
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / points.length, y: sy / points.length };
  }

  /** Compute average distance from center to all points */
  private computeAvgRadius(center: Point, points: Point[]): number {
    let total = 0;
    for (const p of points) {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total / points.length;
  }
}
