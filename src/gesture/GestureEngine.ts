// ── GestureEngine ────────────────────────────────────

import type {
  BuiltInGesture,
  GestureDetectorFn,
  GestureEvent,
  HandState,
} from './types.js';
import { BUILTIN_GESTURES } from './builtins.js';
import { HandStateImpl } from './HandStateImpl.js';
import { GESTURE_ACTIVATE_FRAMES, GESTURE_DEACTIVATE_FRAMES } from './constants.js';

// ── Internal state per tracked gesture ───────────────

interface GestureRecord {
  /** The detector function evaluated each frame */
  detector: GestureDetectorFn;
  /** Whether the gesture is currently in the active state */
  isActive: boolean;
  /** Consecutive frames the gesture has been detected (pre-activation counter) */
  activateFrames: number;
  /** Consecutive frames the gesture has been absent (pre-deactivation counter) */
  deactivateFrames: number;
}

// ── Landmark input shape ──────────────────────────────

/** Minimal landmark shape accepted by the engine (matches MediaPipe output) */
export interface RawLandmark {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

// ── Event emitter type ────────────────────────────────

/** Internal event emitter callback shape */
export type GestureEmitFn = (event: string, data: GestureEvent) => void;

/**
 * Per-frame gesture evaluation engine.
 *
 * Usage:
 * ```ts
 * const engine = new GestureEngine((event, data) => {
 *   console.log(event, data.gesture);
 * });
 *
 * engine.define('wave', (hand) => hand.extended('index', 'middle', 'ring', 'pinky'));
 *
 * // Inside MediaPipe result loop:
 * engine.update(result.landmarks[0], result.landmarks[1]);
 * ```
 *
 * Built-in gestures (pinch, fist, point, open-palm, peace-sign, thumbs-up) are
 * registered automatically at construction time.
 *
 * Debouncing: a gesture must be detected for GESTURE_ACTIVATE_FRAMES consecutive
 * frames before `gesture:<name>` fires, and absent for GESTURE_DEACTIVATE_FRAMES
 * consecutive frames before `gesture:<name>:end` fires.
 */
export class GestureEngine {
  private readonly _emit: GestureEmitFn;
  private readonly _gestures = new Map<string, GestureRecord>();

  /**
   * @param emit - Called on every gesture start/end transition.
   *   event format: `gesture:<name>` (start) or `gesture:<name>:end` (end)
   */
  constructor(emit: GestureEmitFn) {
    this._emit = emit;
    this._registerBuiltins();
  }

  // ── Public API ────────────────────────────────────

  /**
   * Register a custom gesture detector under a unique name.
   * If a gesture with the same name already exists it is replaced.
   *
   * @param name     - Unique gesture identifier (e.g. `'wave'`)
   * @param detector - Predicate function; return true while gesture is active
   */
  define(name: string, detector: GestureDetectorFn): void {
    this._gestures.set(name, {
      detector,
      isActive: false,
      activateFrames: 0,
      deactivateFrames: 0,
    });
  }

  /**
   * Evaluate all registered gestures for one frame.
   *
   * @param landmarks   - Primary hand landmark array (21 points).
   *   Pass an empty array or undefined when no hand is detected — all active
   *   gestures will begin their deactivation countdown.
   * @param secondHandLandmarks - Optional second hand landmarks.
   */
  update(
    landmarks: ReadonlyArray<RawLandmark> | undefined,
    secondHandLandmarks?: ReadonlyArray<RawLandmark>,
  ): void {
    // When no hand is present we still want deactivation to run, so we use
    // an empty-landmarks HandStateImpl which returns safe default values.
    const hand = new HandStateImpl(landmarks ?? []);
    const secondHand: HandState | undefined = secondHandLandmarks !== undefined
      ? new HandStateImpl(secondHandLandmarks)
      : undefined;

    for (const [name, record] of this._gestures) {
      const detected = this._safeDetect(record.detector, hand, secondHand);
      this._updateRecord(name, record, detected, hand, secondHand);
    }
  }

  /**
   * Query the current stable state of a gesture.
   *
   * @returns `'active'` if the gesture has been debounced into active state,
   *          `'inactive'` otherwise.
   */
  getState(name: string): 'active' | 'inactive' {
    return this._gestures.get(name)?.isActive ? 'active' : 'inactive';
  }

  // ── Private helpers ───────────────────────────────

  /** Register all built-in gestures at construction time */
  private _registerBuiltins(): void {
    const builtinNames = Object.keys(BUILTIN_GESTURES) as BuiltInGesture[];
    for (const name of builtinNames) {
      this.define(name, BUILTIN_GESTURES[name]);
    }
  }

  /**
   * Run a detector function and swallow any thrown exceptions.
   * Returning false on error is the safe fallback: a broken detector should
   * not crash the whole frame update.
   */
  private _safeDetect(
    detector: GestureDetectorFn,
    hand: HandState,
    secondHand: HandState | undefined,
  ): boolean {
    try {
      return detector(hand, secondHand);
    } catch {
      // Intentionally silent: a broken detector must not crash the per-frame
      // update loop. Returning false safely deactivates the gesture.
      return false;
    }
  }

  /**
   * Apply debounce logic and emit transition events when state changes.
   *
   * State machine (per gesture):
   *   inactive → active  : requires GESTURE_ACTIVATE_FRAMES   consecutive detected frames
   *   active   → inactive: requires GESTURE_DEACTIVATE_FRAMES consecutive absent frames
   */
  private _updateRecord(
    name: string,
    record: GestureRecord,
    detected: boolean,
    hand: HandState,
    secondHand: HandState | undefined,
  ): void {
    if (!record.isActive) {
      // ── Trying to activate ────────────────────────
      if (detected) {
        record.activateFrames++;
        record.deactivateFrames = 0;

        if (record.activateFrames >= GESTURE_ACTIVATE_FRAMES) {
          record.isActive = true;
          record.activateFrames = 0;
          this._emitEvent(`gesture:${name}`, name, hand, secondHand);
        }
      } else {
        record.activateFrames = 0;
      }
    } else {
      // ── Trying to deactivate ──────────────────────
      if (!detected) {
        record.deactivateFrames++;
        record.activateFrames = 0;

        if (record.deactivateFrames >= GESTURE_DEACTIVATE_FRAMES) {
          record.isActive = false;
          record.deactivateFrames = 0;
          this._emitEvent(`gesture:${name}:end`, name, hand, secondHand);
        }
      } else {
        record.deactivateFrames = 0;
      }
    }
  }

  /** Build and dispatch a GestureEvent */
  private _emitEvent(
    eventName: string,
    gestureName: string,
    hand: HandState,
    secondHand: HandState | undefined,
  ): void {
    const event: GestureEvent = {
      gesture: gestureName,
      hand,
      secondHand,
      timestamp: performance.now(),
    };
    this._emit(eventName, event);
  }
}
