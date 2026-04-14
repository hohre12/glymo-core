import { SessionState } from '../types.js';
import { EventBus } from './EventBus.js';
/** Delay after pen-up before morph begins (ms) */
export declare const MORPH_DELAY_MS = 300;
/** Duration of the morph animation (ms) */
export declare const MORPH_DURATION_MS = 1200;
/**
 * Manages canvas session states (PRD SS18.1):
 * IDLE → READY → DRAWING → PEN_UP_WAIT → MORPHING → READY
 */
export declare class SessionStateMachine {
    private state;
    private delayTimer;
    private readonly eventBus;
    constructor(eventBus: EventBus);
    /** Attempt a state transition. Returns true if transition was valid. */
    transition(action: string): boolean;
    getState(): SessionState;
    /** Determine the correct pen-up action based on point count */
    getPenUpAction(pointCount: number): string;
    /** Start the morph delay timer. Calls callback after MORPH_DELAY_MS. */
    startMorphDelay(callback: () => void, delay?: number): void;
    /** Cancel any pending morph delay */
    cancelMorphDelay(): void;
    /** Check if morph delay is pending */
    hasPendingDelay(): boolean;
    /** Reset to idle and cancel timers */
    destroy(): void;
}
