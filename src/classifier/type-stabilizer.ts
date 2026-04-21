// Type-stabilizer for the AI Personality UX (Phase 2).
//
// Problem: `classifier.worker.ts` emits a fresh `detectedType` every ~500ms.
// The TYPE router is noisy around category boundaries (a slowly-drawn 'L'
// briefly registers as drawing, a serif on a letter briefly registers as
// symbol). If we fire the flip animation + copy on every raw transition the
// bubble feels jittery and confidently wrong.
//
// Fix: require the new type to persist for `windowMs` (and appear in at
// least `minConsecutive` back-to-back observations) before we confirm the
// flip. Anything shorter is treated as a spike and the stable type stays
// put. The implementation is a pure, synchronous observer — no timers,
// no React — so it's trivial to unit-test with explicit timestamps.
//
// Decision locked (user, 2026-04-13): windowMs=1500, minConsecutive=2.
// "Conservative" setting — flips are rare but always believable.

export type StableType = 'text' | 'symbol' | 'drawing';

export interface StabilizerObservation {
  /** The type the stabilizer currently considers stable. */
  stableType: StableType | null;
  /** True ONLY on the tick where `stableType` transitions to a new value. */
  changed: boolean;
}

interface Sample {
  type: StableType;
  timestamp: number;
}

export interface TypeStabilizerOptions {
  /** How long the new type must persist before it's confirmed (ms). */
  windowMs?: number;
  /**
   * Minimum number of consecutive same-type observations required in
   * addition to the time window. Guards against a single-sample spike
   * that happens to land exactly on the windowMs boundary.
   */
  minConsecutive?: number;
}

const DEFAULT_WINDOW_MS = 1500;
const DEFAULT_MIN_CONSECUTIVE = 2;

export class TypeStabilizer {
  private readonly windowMs: number;
  private readonly minConsecutive: number;

  /**
   * Rolling history of recent observations. We keep anything newer than
   * `windowMs` so the consecutive-streak check has the data it needs; older
   * samples are pruned on every `observe` call to cap memory.
   */
  private history: Sample[] = [];

  /** Last confirmed stable type. `null` until the very first observation. */
  private stableType: StableType | null = null;

  constructor(opts: TypeStabilizerOptions = {}) {
    this.windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
    this.minConsecutive = opts.minConsecutive ?? DEFAULT_MIN_CONSECUTIVE;
  }

  /**
   * Feed one raw classifier observation into the stabilizer.
   *
   * Returns the current stable type and whether this call caused it to
   * change. Rules:
   *   - First observation ever → stable type snaps to the observed type
   *     immediately (no warm-up), `changed = true`.
   *   - Subsequent observations → stable type only changes when the latest
   *     N samples are all of the new type AND the oldest of that streak
   *     is at least `windowMs` old (i.e. the new type has been held for
   *     the full hysteresis window without interruption).
   *
   * The method is pure with respect to its arguments — two calls with the
   * same (type, timestamp) against the same instance are idempotent after
   * the first.
   */
  observe(type: StableType, timestamp: number): StabilizerObservation {
    // Append the new sample, then trim anything outside the window.
    this.history.push({ type, timestamp });
    const cutoff = timestamp - this.windowMs;
    // `history` is append-only monotonically-increasing in timestamp so we
    // can drop from the front without scanning.
    while (this.history.length > 0 && this.history[0]!.timestamp < cutoff) {
      this.history.shift();
    }

    // First observation ever — snap and report a change so the UI paints
    // the initial state without waiting for hysteresis.
    if (this.stableType === null) {
      this.stableType = type;
      return { stableType: this.stableType, changed: true };
    }

    // Same as current stable type — nothing to confirm.
    if (type === this.stableType) {
      return { stableType: this.stableType, changed: false };
    }

    // Different from stable type — check whether the new type has held
    // for the full hysteresis window. Walk backwards over the history and
    // find the tail run of identical `type` samples.
    let streakStart = this.history.length;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i]!.type === type) {
        streakStart = i;
      } else {
        break;
      }
    }
    const streak = this.history.slice(streakStart);
    if (streak.length < this.minConsecutive) {
      return { stableType: this.stableType, changed: false };
    }

    // Oldest sample of the streak must be at least windowMs old relative
    // to the latest timestamp. `>=` rather than `>` so the exact-boundary
    // case (e.g. first=0ms, last=1500ms) counts as confirmed.
    const oldest = streak[0]!.timestamp;
    const elapsed = timestamp - oldest;
    if (elapsed < this.windowMs) {
      return { stableType: this.stableType, changed: false };
    }

    // Confirmed: promote the new type.
    this.stableType = type;
    return { stableType: this.stableType, changed: true };
  }

  /**
   * Clear history and stable-type state. Call when the drawing phase
   * restarts so the next round's first observation doesn't get compared
   * against a stale type from the previous round.
   */
  reset(): void {
    this.history = [];
    this.stableType = null;
  }

  /** Read-only accessor, mostly for tests / debug overlays. */
  getStableType(): StableType | null {
    return this.stableType;
  }
}
