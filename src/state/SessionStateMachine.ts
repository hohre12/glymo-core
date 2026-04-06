import type { SessionState } from '../types.js';
import type { EventBus } from './EventBus.js';

// ── Constants ────────────────────────────────────────

/** Delay after pen-up before morph begins (ms) */
export const MORPH_DELAY_MS = 300;

/** Duration of the morph animation (ms) */
export const MORPH_DURATION_MS = 1200;

/** Minimum points for a valid stroke */
const MIN_STROKE_POINTS = 3;

// ── Transition Table ────────────────────────────────

const TRANSITIONS: Record<SessionState, Record<string, SessionState>> = {
  idle: { init: 'ready' },
  ready: { penDown: 'drawing', unbind: 'idle', export_start: 'exporting' },
  drawing: { penUp: 'pen_up_wait', penUp_short: 'ready' },
  pen_up_wait: { timeout: 'morphing', penDown: 'drawing' },
  morphing: { morph_complete: 'ready', recognize_start: 'recognizing' },
  recognizing: { recognize_complete: 'morphing', recognize_fail: 'ready' },
  exporting: { export_complete: 'ready', export_fail: 'ready' },
};

// ── SessionStateMachine ─────────────────────────────

/**
 * Manages canvas session states (PRD SS18.1):
 * IDLE → READY → DRAWING → PEN_UP_WAIT → MORPHING → READY
 */
export class SessionStateMachine {
  private state: SessionState = 'idle';
  private delayTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /** Attempt a state transition. Returns true if transition was valid. */
  transition(action: string): boolean {
    const nextState = TRANSITIONS[this.state]?.[action];
    if (!nextState) return false;

    const prevState = this.state;
    this.state = nextState;
    this.eventBus.emit('state:change', { from: prevState, to: nextState, action });
    return true;
  }

  getState(): SessionState {
    return this.state;
  }

  /** Determine the correct pen-up action based on point count */
  getPenUpAction(pointCount: number): string {
    return pointCount >= MIN_STROKE_POINTS ? 'penUp' : 'penUp_short';
  }

  // ── Timer Management ──────────────────────────────

  /** Start the morph delay timer. Calls callback after MORPH_DELAY_MS. */
  startMorphDelay(callback: () => void, delay: number = MORPH_DELAY_MS): void {
    this.cancelMorphDelay();
    this.delayTimer = setTimeout(() => {
      this.delayTimer = null;
      callback();
    }, delay);
  }

  /** Cancel any pending morph delay */
  cancelMorphDelay(): void {
    if (this.delayTimer !== null) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
  }

  /** Check if morph delay is pending */
  hasPendingDelay(): boolean {
    return this.delayTimer !== null;
  }

  /** Reset to idle and cancel timers */
  destroy(): void {
    this.cancelMorphDelay();
    this.state = 'idle';
  }
}
