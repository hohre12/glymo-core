/**
 * CascadingRecognizer — framework-agnostic cascading handwriting recognition.
 *
 * Two-layer recognition pipeline:
 *
 *   Net 1 (instant): Each stroke is recognized independently the moment it
 *         completes. Fast (~200ms) but low accuracy. Confidence: 0.6.
 *
 *   Net 2 (context): After each Net 1, ALL accumulated strokes are re-sent
 *         to the API. The full context dramatically improves accuracy.
 *         Mismatches are emitted as corrections. Confidence: 0.95.
 *
 * Usage:
 *   const recognizer = new CascadingRecognizer({ onChar, onCorrection, onRecognizing });
 *   recognizer.feedStroke(rawPoints, boundingBox);
 *   recognizer.removeChar(id);   // eraser
 *   recognizer.clear();          // reset
 *   recognizer.destroy();        // cleanup
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
  /** Stroke points relative to char center (for morph/particle animations) */
  strokePoints?: { x: number; y: number }[];
}

export interface CharCorrection {
  id: string;
  oldChar: string;
  newChar: string;
}

export interface CascadingRecognizerOptions {
  /** Called when Net 1 recognizes a new character */
  onChar: (char: RecognizedChar) => void;
  /** Called when Net 2 corrects an existing character */
  onCorrection: (correction: CharCorrection) => void;
  /** Called when recognizing state changes */
  onRecognizing?: (busy: boolean) => void;
  /** Force uppercase output (default: true — air writing is naturally uppercase) */
  uppercase?: boolean;
  /** Rolling window size for height normalization (default: 5) */
  heightWindowSize?: number;
}

interface Bbox { x: number; y: number; width: number; height: number }

interface StrokeRecord {
  raw: StrokePoint[];
  bbox: Bbox;
  charId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function rollingAvg(window: number[], value: number, maxLen: number): number {
  window.push(value);
  if (window.length > maxLen) window.shift();
  return window.reduce((a, b) => a + b, 0) / window.length;
}

// ── Class ─────────────────────────────────────────────────────────────────

export class CascadingRecognizer {
  private readonly opts: Required<CascadingRecognizerOptions>;
  private idCounter = 0;
  private generation = 0;
  private sweepId = 0;
  private inflight = 0;
  private net2Disabled = false;
  private destroyed = false;

  private strokeHistory: StrokeRecord[] = [];
  private heightWindow: number[] = [];

  /** Map of all recognized chars (source of truth for Net 2 diffing) */
  private chars = new Map<string, RecognizedChar>();

  constructor(options: CascadingRecognizerOptions) {
    this.opts = {
      onChar: options.onChar,
      onCorrection: options.onCorrection,
      onRecognizing: options.onRecognizing ?? (() => {}),
      uppercase: options.uppercase ?? true,
      heightWindowSize: options.heightWindowSize ?? 5,
    };
  }

  /**
   * Feed a completed stroke for recognition.
   * @param raw       Raw stroke points (canvas-pixel coordinates)
   * @param bbox      Bounding box of the stroke (canvas-pixel coordinates)
   * @param dpr       Device pixel ratio — used to convert to CSS pixels
   */
  feedStroke(raw: StrokePoint[], bbox: Bbox, dpr = 1): void {
    if (this.destroyed) return;

    const cssBbox: Bbox = {
      x: bbox.x / dpr,
      y: bbox.y / dpr,
      width: bbox.width / dpr,
      height: bbox.height / dpr,
    };

    const strokeIndex = this.strokeHistory.length;
    const record: StrokeRecord = { raw, bbox: cssBbox, charId: '' };
    this.strokeHistory.push(record);

    const normHeight = rollingAvg(
      this.heightWindow, cssBbox.height, this.opts.heightWindowSize,
    );

    this.inflight++;
    this.opts.onRecognizing(true);

    const gen = this.generation;

    // ── Net 1: instant per-stroke ─────────────────────────────────────
    recognizeHandwriting([raw]).then(result => {
      if (this.destroyed || this.generation !== gen) return;

      if (result && result.text.trim()) {
        let firstChar = result.text.trim()[0]!;
        if (this.opts.uppercase) firstChar = firstChar.toUpperCase();

        const charId = `char-${++this.idCounter}`;
        record.charId = charId;

        const cx = cssBbox.x + cssBbox.width / 2;
        const cy = cssBbox.y + cssBbox.height / 2;
        const strokePts = raw.map(p => ({
          x: (p.x / dpr) - cx,
          y: (p.y / dpr) - cy,
        }));

        const char: RecognizedChar = {
          id: charId,
          char: firstChar,
          x: cx,
          y: cy,
          width: cssBbox.width,
          height: normHeight,
          confidence: 0.6,
          strokeIndex,
          strokePoints: strokePts,
        };

        this.chars.set(charId, char);
        this.opts.onChar(char);

        // ── Fire Net 2 ────────────────────────────────────────────────
        this.fireContextSweep();
      }
    }).catch(() => {
      // Error propagated via onRecognizing(false) in finally
    }).finally(() => {
      this.inflight--;
      if (this.inflight === 0) {
        this.opts.onRecognizing(false);
      }
    });
  }

  /** Remove a character (e.g. eraser). Disables Net 2 to prevent cycling. */
  removeChar(id: string): void {
    this.strokeHistory = this.strokeHistory.filter(r => r.charId !== id);
    this.net2Disabled = true;
    this.sweepId++; // invalidate in-flight Net 2
    this.chars.delete(id);
  }

  /** Undo the most recently added character */
  undo(): string | undefined {
    // Find the char with highest strokeIndex
    let lastId: string | undefined;
    let maxIdx = -1;
    for (const [id, ch] of this.chars) {
      if (ch.strokeIndex > maxIdx) {
        maxIdx = ch.strokeIndex;
        lastId = id;
      }
    }
    if (lastId) {
      this.removeChar(lastId);
    }
    return lastId;
  }

  /** Reset all state */
  clear(): void {
    this.strokeHistory = [];
    this.heightWindow = [];
    this.generation++;
    this.sweepId++;
    this.net2Disabled = false;
    this.chars.clear();
  }

  /** Get current character count */
  get charCount(): number {
    return this.chars.size;
  }

  /** Cleanup — discard all pending results */
  destroy(): void {
    this.destroyed = true;
    this.generation++;
    this.sweepId++;
  }

  // ── Net 2: context sweep ────────────────────────────────────────────

  private fireContextSweep(): void {
    if (this.net2Disabled) return;
    const history = this.strokeHistory;
    if (history.length < 2) return;

    const sweepId = ++this.sweepId;
    const allStrokes = history.map(r => r.raw);

    recognizeHandwriting(allStrokes).then(result => {
      if (this.destroyed || this.sweepId !== sweepId) return;
      if (!result || !result.text.trim()) return;

      const fullText = result.text.trim();
      let netChars = fullText.replace(/\s/g, '').split('');
      if (this.opts.uppercase) netChars = netChars.map(c => c.toUpperCase());

      // Safety: only apply when counts match (1:1 stroke→char mapping)
      if (netChars.length !== history.length) return;

      for (let i = 0; i < history.length; i++) {
        const rec = history[i]!;
        if (!rec.charId) continue;

        const existing = this.chars.get(rec.charId);
        if (!existing) continue;

        const newChar = netChars[i]!;

        // Same letter (case-insensitive) → boost confidence only
        if (newChar.toUpperCase() === existing.char.toUpperCase()) {
          existing.confidence = 0.95;
          existing.char = newChar;
          continue;
        }

        // Already confirmed → don't re-correct (prevents cycling)
        if (existing.confidence >= 0.9) continue;

        // Never degrade letter → digit
        if (/[A-Z]/i.test(existing.char) && /\d/.test(newChar)) {
          existing.confidence = 0.85;
          continue;
        }

        // Apply correction
        const oldChar = existing.char;
        existing.char = newChar;
        existing.confidence = 0.95;

        this.opts.onCorrection({ id: rec.charId, oldChar, newChar });
      }
    }).catch(() => {
      // Error silenced — corrections are best-effort
    });
  }
}
