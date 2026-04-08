/**
 * CascadingRecognizer — spatial-grouping handwriting recognition.
 *
 * Strokes are grouped by spatial proximity. Each group is recognized
 * independently. When the user moves to a new location, the previous
 * group finalizes and converts to a font character.
 *
 * Flow:
 *   1. Stroke arrives → check if near current group's bounding box
 *   2. Near → add to group, re-recognize group
 *   3. Far  → finalize previous group, start new group
 *   4. Finalized group → short timer → display font + fade handwritten strokes
 */

import type { StrokePoint } from '../types.js';
import { recognizeHandwriting } from './HandwritingRecognizer.js';

// ── Public types ──────────────────────────────────────────────────────────

export interface RecognizedChar {
  id: string;
  char: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  strokeIndex: number;
  strokePoints?: { x: number; y: number }[];
}

export interface CharCorrection {
  id: string;
  oldChar: string;
  newChar: string;
}

export interface CascadingRecognizerOptions {
  onChar: (char: RecognizedChar) => void;
  onCorrection: (correction: CharCorrection) => void;
  onRecognizing?: (busy: boolean) => void;
  /** Called before font display — consumer should fade out handwritten strokes for the group */
  onDisplayFlush?: (strokeCount: number) => void;
  uppercase?: boolean;
  heightWindowSize?: number;
}

// ── Internal types ────────────────────────────────────────────────────────

interface Bbox { x: number; y: number; width: number; height: number }

interface StrokeGroup {
  strokes: { raw: StrokePoint[]; bbox: Bbox }[];
  bbox: Bbox;
  generation: number;
  result: string;
  displayed: boolean;
  displayTimer: ReturnType<typeof setTimeout> | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function combineBbox(a: Bbox, b: Bbox): Bbox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

function bboxNear(a: Bbox, b: Bbox, threshold: number): boolean {
  // Expand b by threshold and check overlap with a
  const ex = b.x - threshold;
  const ey = b.y - threshold;
  const ew = b.width + threshold * 2;
  const eh = b.height + threshold * 2;

  return !(a.x + a.width < ex || a.x > ex + ew ||
           a.y + a.height < ey || a.y > ey + eh);
}

function rollingAvg(window: number[], value: number, maxLen: number): number {
  window.push(value);
  if (window.length > maxLen) window.shift();
  return window.reduce((a, b) => a + b, 0) / window.length;
}

// ── Constants ─────────────────────────────────────────────────────────────

/** Language-specific recognition parameters */
const LANG_PARAMS: Record<string, { proximityFactor: number; minProximityPx: number; finalizeDelay: number }> = {
  en: { proximityFactor: 0.8, minProximityPx: 40, finalizeDelay: 600 },
  ko: { proximityFactor: 1.2, minProximityPx: 80, finalizeDelay: 1200 },
};
const DEFAULT_PARAMS = LANG_PARAMS.en!;

// ── Class ─────────────────────────────────────────────────────────────────

export class CascadingRecognizer {
  private readonly opts: Required<CascadingRecognizerOptions>;
  private idCounter = 0;
  private destroyed = false;
  private inflight = 0;

  private groups: StrokeGroup[] = [];
  private heightWindow: number[] = [];
  private chars = new Map<string, RecognizedChar>();

  private language: string = 'en';

  constructor(options: CascadingRecognizerOptions) {
    this.opts = {
      onChar: options.onChar,
      onCorrection: options.onCorrection,
      onRecognizing: options.onRecognizing ?? (() => {}),
      onDisplayFlush: options.onDisplayFlush ?? (() => {}),
      uppercase: options.uppercase ?? true,
      heightWindowSize: options.heightWindowSize ?? 5,
    };
  }

  setLanguage(lang: string): void {
    this.language = lang;
  }

  notifyStrokeStart(): void {
    // Cancel display timer on the active (last) group — user is still drawing
    const active = this.groups[this.groups.length - 1];
    if (active?.displayTimer) {
      clearTimeout(active.displayTimer);
      active.displayTimer = null;
    }
  }

  feedStroke(raw: StrokePoint[], bbox: Bbox, dpr = 1): void {
    if (this.destroyed) return;

    const cssBbox: Bbox = {
      x: bbox.x / dpr,
      y: bbox.y / dpr,
      width: bbox.width / dpr,
      height: bbox.height / dpr,
    };

    const activeGroup = this.groups[this.groups.length - 1];

    if (activeGroup && !activeGroup.displayed) {
      // Check if new stroke is near the active group
      const params = LANG_PARAMS[this.language] ?? DEFAULT_PARAMS;
      const threshold = Math.max(
        Math.max(activeGroup.bbox.width, activeGroup.bbox.height) * params.proximityFactor,
        params.minProximityPx,
      );

      if (bboxNear(cssBbox, activeGroup.bbox, threshold)) {
        // Add to existing group
        activeGroup.strokes.push({ raw, bbox: cssBbox });
        activeGroup.bbox = combineBbox(activeGroup.bbox, cssBbox);
        // Cancel any pending display timer (still writing this char)
        if (activeGroup.displayTimer) {
          clearTimeout(activeGroup.displayTimer);
          activeGroup.displayTimer = null;
        }
        this.recognizeGroup(activeGroup, dpr);
        // Start finalize timer
        this.scheduleFinalize(activeGroup, dpr);
        return;
      }

      // New stroke is far away → finalize previous group immediately
      this.finalizeGroup(activeGroup, dpr);
    }

    // Start new group
    const newGroup: StrokeGroup = {
      strokes: [{ raw, bbox: cssBbox }],
      bbox: { ...cssBbox },
      generation: 0,
      result: '',
      displayed: false,
      displayTimer: null,
    };
    this.groups.push(newGroup);
    this.recognizeGroup(newGroup, dpr);
    this.scheduleFinalize(newGroup, dpr);
  }

  /** Trigger recognition for a group's strokes */
  private recognizeGroup(group: StrokeGroup, dpr: number): void {
    const gen = ++group.generation;
    const strokes = group.strokes.map(s => s.raw);

    this.inflight++;
    this.opts.onRecognizing(true);

    recognizeHandwriting(strokes, this.language).then(result => {
      if (this.destroyed || group.generation !== gen) return;
      if (!result?.text?.trim()) return;

      let text = result.text.trim().replace(/\s+/g, '');
      if (this.opts.uppercase) text = text.toUpperCase();

      // Take first character only (this group = one character)
      group.result = text[0] ?? '';
      console.log('[CascadingRecognizer] Group recognized:', group.result, '(full:', text, ')');
    }).catch(() => {}).finally(() => {
      this.inflight--;
      if (this.inflight === 0) this.opts.onRecognizing(false);
    });
  }

  /** Schedule finalize timer — fires if no more strokes arrive */
  private scheduleFinalize(group: StrokeGroup, dpr: number): void {
    if (group.displayTimer) clearTimeout(group.displayTimer);
    group.displayTimer = setTimeout(() => {
      group.displayTimer = null;
      this.finalizeGroup(group, dpr);
    }, (LANG_PARAMS[this.language] ?? DEFAULT_PARAMS).finalizeDelay);
  }

  /** Finalize a group: display font character, fade handwritten strokes */
  private finalizeGroup(group: StrokeGroup, dpr: number): void {
    if (group.displayed) return;
    group.displayed = true;

    if (group.displayTimer) {
      clearTimeout(group.displayTimer);
      group.displayTimer = null;
    }

    if (!group.result) return;

    // Fade out handwritten strokes for this group
    this.opts.onDisplayFlush(group.strokes.length);

    const normHeight = rollingAvg(
      this.heightWindow, group.bbox.height, this.opts.heightWindowSize,
    );

    const charId = `char-${++this.idCounter}`;
    const cx = group.bbox.x + group.bbox.width / 2;
    const cy = group.bbox.y + group.bbox.height / 2;

    const strokePts = group.strokes.flatMap(s =>
      s.raw.map(p => ({ x: (p.x / dpr) - cx, y: (p.y / dpr) - cy })),
    );

    const char: RecognizedChar = {
      id: charId,
      char: group.result,
      x: cx,
      y: cy,
      width: group.bbox.width,
      height: normHeight,
      confidence: 0.8,
      strokeIndex: this.groups.indexOf(group),
      strokePoints: strokePts,
    };

    this.chars.set(charId, char);
    this.opts.onChar(char);
    console.log('[CascadingRecognizer] Displayed:', group.result, 'at', Math.round(cx), Math.round(cy));
  }

  removeChar(id: string): void {
    this.chars.delete(id);
  }

  undo(): string | undefined {
    // Find last displayed group and remove its char
    for (let i = this.groups.length - 1; i >= 0; i--) {
      const g = this.groups[i]!;
      if (!g.displayed) {
        // Remove undisplayed group
        if (g.displayTimer) clearTimeout(g.displayTimer);
        this.groups.splice(i, 1);
        return undefined;
      }
    }
    // Remove last char
    const lastId = [...this.chars.keys()].pop();
    if (lastId) {
      this.chars.delete(lastId);
      return lastId;
    }
    return undefined;
  }

  clear(): void {
    for (const g of this.groups) {
      if (g.displayTimer) clearTimeout(g.displayTimer);
    }
    this.groups = [];
    this.heightWindow = [];
    this.chars.clear();
  }

  get charCount(): number {
    return this.chars.size;
  }

  destroy(): void {
    this.destroyed = true;
    this.clear();
  }
}
