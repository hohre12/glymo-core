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
import {
  SpatialGrouper,
  type Bbox,
  type GroupedStroke,
  type SpatialGroup,
} from '../grouping/SpatialGrouper.js';

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

export type CaseMode = 'upper' | 'lower' | 'auto';

export interface CascadingRecognizerOptions {
  onChar: (char: RecognizedChar) => void;
  onCorrection: (correction: CharCorrection) => void;
  onRecognizing?: (busy: boolean) => void;
  /** Called before font display — consumer should fade out specific strokes by ID */
  onDisplayFlush?: (strokeIds: string[]) => void;
  caseMode?: CaseMode;
  heightWindowSize?: number;
}

// ── Internal types ────────────────────────────────────────────────────────

interface RecognitionState {
  generation: number;
  result: string;
  displayed: boolean;
  /** Stroke count when the API last returned exactly 1 character */
  lastSingleCharStrokeCount: number;
  /** Last result produced (used for stability check → early-commit confidence) */
  lastResult: string;
  /** How many consecutive recognition passes agreed on `lastResult` */
  stableCount: number;
  /** Set once this group has been early-committed (prevents duplicate finalize) */
  earlyCommitted: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function rollingAvg(window: number[], value: number, maxLen: number): number {
  window.push(value);
  if (window.length > maxLen) window.shift();
  return window.reduce((a, b) => a + b, 0) / window.length;
}

// ── Constants ─────────────────────────────────────────────────────────────

/** Language-specific recognition parameters */
const LANG_PARAMS: Record<string, { proximityFactor: number; minProximityPx: number; maxProximityPx: number; finalizeDelay: number }> = {
  en: { proximityFactor: 0.8, minProximityPx: 40, maxProximityPx: 300, finalizeDelay: 1200 },
  ko: { proximityFactor: 1.0, minProximityPx: 60, maxProximityPx: 300, finalizeDelay: 1500 },
};
const DEFAULT_PARAMS = LANG_PARAMS.en!;

// ── Class ─────────────────────────────────────────────────────────────────

export class CascadingRecognizer {
  private readonly opts: Required<CascadingRecognizerOptions>;
  private idCounter = 0;
  private destroyed = false;
  private inflight = 0;

  private readonly grouper: SpatialGrouper;
  /** Recognition state per spatial group id */
  private groupState = new Map<number, RecognitionState>();
  private heightWindow: number[] = [];
  private chars = new Map<string, RecognizedChar>();

  /** Tracks dpr per group so finalize callback can use it */
  private groupDpr = new Map<number, number>();

  private language: string = 'en';

  constructor(options: CascadingRecognizerOptions) {
    this.opts = {
      onChar: options.onChar,
      onCorrection: options.onCorrection,
      onRecognizing: options.onRecognizing ?? (() => {}),
      onDisplayFlush: options.onDisplayFlush ?? (() => {}),
      caseMode: options.caseMode ?? 'upper',
      heightWindowSize: options.heightWindowSize ?? 5,
    };

    const params = LANG_PARAMS[this.language] ?? DEFAULT_PARAMS;
    this.grouper = new SpatialGrouper({
      proximityFactor: params.proximityFactor,
      minProximityPx: params.minProximityPx,
      maxProximityPx: params.maxProximityPx,
      finalizeDelay: params.finalizeDelay,
      onGroupUpdated: (group) => this.handleGroupUpdated(group),
      onGroupFinalized: (group) => this.handleGroupFinalized(group),
    });
  }

  setCaseMode(mode: CaseMode): void {
    this.opts.caseMode = mode;
  }

  setLanguage(lang: string): void {
    this.language = lang;
    const params = LANG_PARAMS[lang] ?? DEFAULT_PARAMS;
    this.grouper.setParams(params);
  }

  notifyStrokeStart(): void {
    this.grouper.notifyStrokeStart();
  }

  feedStroke(raw: StrokePoint[], bbox: Bbox, dpr = 1, strokeId?: string): void {
    if (this.destroyed) return;

    const stroke: GroupedStroke = {
      id: strokeId ?? `stroke-${++this.idCounter}`,
      raw,
      bbox,
    };

    // Store dpr for this feed — grouper callback will need it
    // We track it via a temporary field; the grouper's onGroupUpdated/onGroupFinalized
    // will fire synchronously during feedStroke for the "far away" finalize case,
    // and asynchronously (via timer) for the timer finalize case.
    this._currentDpr = dpr;
    this.grouper.feedStroke(stroke, dpr);
  }

  /** Temporary dpr storage for the current feedStroke call */
  private _currentDpr = 1;

  private handleGroupUpdated(group: SpatialGroup): void {
    const dpr = this._currentDpr;
    this.groupDpr.set(group.id, dpr);

    let state = this.groupState.get(group.id);
    if (!state) {
      state = { generation: 0, result: '', displayed: false, lastSingleCharStrokeCount: 0, lastResult: '', stableCount: 0, earlyCommitted: false };
      this.groupState.set(group.id, state);
    }

    this.recognizeGroup(group, state, dpr);
  }

  private handleGroupFinalized(group: SpatialGroup): void {
    const dpr = this.groupDpr.get(group.id) ?? 1;
    let state = this.groupState.get(group.id);
    if (!state) {
      state = { generation: 0, result: '', displayed: false, lastSingleCharStrokeCount: 0, lastResult: '', stableCount: 0, earlyCommitted: false };
      this.groupState.set(group.id, state);
    }
    this.finalizeGroup(group, state, dpr);
  }

  /** Trigger recognition for a group's strokes */
  private recognizeGroup(group: SpatialGroup, state: RecognitionState, dpr: number): void {
    const gen = ++state.generation;
    const strokeCountNow = group.strokes.length;
    // raw is typed loosely in GroupedStroke, but we know it's StrokePoint[]
    const strokes = group.strokes.map(s => s.raw as StrokePoint[]);

    this.inflight++;
    this.opts.onRecognizing(true);

    recognizeHandwriting(strokes, this.language).then(result => {
      if (this.destroyed || state.generation !== gen) return;
      if (!result?.text?.trim()) return;

      let text = result.text.trim().replace(/\s+/g, '');
      if (this.opts.caseMode === 'upper') text = text.toUpperCase();
      else if (this.opts.caseMode === 'lower') text = text.toLowerCase();

      if (text.length > 1 && state.lastSingleCharStrokeCount > 0) {
        // Character boundary detected! Split the group.
        // Keep the strokes that produced 1 char, re-feed the rest.
        const keepCount = state.lastSingleCharStrokeCount;
        state.result = text[0] ?? '';

        const overflow = this.grouper.splitGroup(group.id, keepCount);
        if (overflow && overflow.length > 0) {
          // Re-feed all overflow strokes as a single new group (not one-by-one,
          // which would cause tiny threshold → further splits)
          this.grouper.createGroup(overflow);
        }
      } else {
        // Single character result — track stroke count for future split detection
        const newResult = text[0] ?? '';
        state.result = newResult;
        if (text.length === 1) {
          state.lastSingleCharStrokeCount = strokeCountNow;
        }

        // Stability tracking: if two consecutive recognition passes produce
        // the same single-char result, we treat the group as high-confidence.
        if (text.length === 1 && newResult === state.lastResult && newResult !== '') {
          state.stableCount += 1;
        } else {
          state.stableCount = text.length === 1 ? 1 : 0;
        }
        state.lastResult = newResult;

        // Confidence-based early commit.
        // When the group has been unambiguously recognized (stable single-
        // char result across ≥ 2 passes), finalize NOW so the next stroke
        // cannot join this group and cause re-recognition that loses the
        // next character's first stroke. See stroke-loss root cause in
        // docs/execution-plan.md.
        const confidenceHigh = state.stableCount >= 2 && text.length === 1;
        if (
          confidenceHigh
          && !state.displayed
          && !state.earlyCommitted
          && strokeCountNow >= 2
        ) {
          state.earlyCommitted = true;
          // Mark recognizing=false before finalize so UI clears its spinner.
          this.opts.onRecognizing(false);
          this.grouper.finalizeGroupById(group.id);
        }
      }
    }).catch(() => {}).finally(() => {
      this.inflight--;
      if (this.inflight === 0) this.opts.onRecognizing(false);
    });
  }

  /** Finalize a group: display font character, fade handwritten strokes */
  private finalizeGroup(group: SpatialGroup, state: RecognitionState, dpr: number): void {
    if (state.displayed) return;
    state.displayed = true;

    if (!state.result) return;

    // Fade out handwritten strokes for this group (by specific IDs, not "last N")
    this.opts.onDisplayFlush(group.strokes.map(s => s.id));

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
      char: state.result,
      x: cx,
      y: cy,
      width: group.bbox.width,
      height: normHeight,
      confidence: 0.8,
      strokeIndex: group.id - 1,
      strokePoints: strokePts,
    };

    this.chars.set(charId, char);
    this.opts.onChar(char);

    // Clean up per-group maps to prevent memory leak
    this.groupState.delete(group.id);
    this.groupDpr.delete(group.id);
  }

  removeChar(id: string): void {
    this.chars.delete(id);
  }

  undo(): string | undefined {
    // Remove last char
    const lastId = [...this.chars.keys()].pop();
    if (lastId) {
      this.chars.delete(lastId);
      return lastId;
    }
    return undefined;
  }

  clear(): void {
    this.grouper.clear();
    this.groupState.clear();
    this.groupDpr.clear();
    this.heightWindow = [];
    this.chars.clear();
  }

  get charCount(): number {
    return this.chars.size;
  }

  destroy(): void {
    this.destroyed = true;
    this.grouper.destroy();
    this.groupState.clear();
    this.groupDpr.clear();
    this.heightWindow = [];
    this.chars.clear();
  }
}
