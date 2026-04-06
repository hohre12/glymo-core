import { SessionStateMachine, MORPH_DELAY_MS } from '../src/state/SessionStateMachine.js';
import { EventBus } from '../src/state/EventBus.js';

// Cross-compatible timer helpers for vitest + jest
const useFakeTimers = typeof vi !== 'undefined' ? () => vi.useFakeTimers() : () => jest.useFakeTimers();
const useRealTimers = typeof vi !== 'undefined' ? () => vi.useRealTimers() : () => jest.useRealTimers();
const advanceTimers = typeof vi !== 'undefined'
  ? (ms: number) => vi.advanceTimersByTime(ms)
  : (ms: number) => jest.advanceTimersByTime(ms);
const mockFn = typeof vi !== 'undefined' ? vi.fn : jest.fn;

// ── State Transitions ───────────────────────────────

describe('SessionStateMachine transitions', () => {
  let sm: SessionStateMachine;
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    sm = new SessionStateMachine(bus);
  });

  afterEach(() => {
    sm.destroy();
  });

  it('starts in idle state', () => {
    expect(sm.getState()).toBe('idle');
  });

  it('idle → ready on init', () => {
    expect(sm.transition('init')).toBe(true);
    expect(sm.getState()).toBe('ready');
  });

  it('ready → drawing on penDown', () => {
    sm.transition('init');
    expect(sm.transition('penDown')).toBe(true);
    expect(sm.getState()).toBe('drawing');
  });

  it('drawing → pen_up_wait on penUp', () => {
    sm.transition('init');
    sm.transition('penDown');
    expect(sm.transition('penUp')).toBe(true);
    expect(sm.getState()).toBe('pen_up_wait');
  });

  it('drawing → ready on penUp_short', () => {
    sm.transition('init');
    sm.transition('penDown');
    expect(sm.transition('penUp_short')).toBe(true);
    expect(sm.getState()).toBe('ready');
  });
});

// ── pen_up_wait transitions ─────────────────────────

describe('SessionStateMachine pen_up_wait', () => {
  let sm: SessionStateMachine;
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    sm = new SessionStateMachine(bus);
    sm.transition('init');
    sm.transition('penDown');
    sm.transition('penUp');
  });

  afterEach(() => {
    sm.destroy();
  });

  it('pen_up_wait → morphing on timeout', () => {
    expect(sm.transition('timeout')).toBe(true);
    expect(sm.getState()).toBe('morphing');
  });

  it('pen_up_wait → drawing on penDown (re-draw)', () => {
    expect(sm.transition('penDown')).toBe(true);
    expect(sm.getState()).toBe('drawing');
  });
});

// ── Morphing transitions ────────────────────────────

describe('SessionStateMachine morphing', () => {
  let sm: SessionStateMachine;
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    sm = new SessionStateMachine(bus);
    sm.transition('init');
    sm.transition('penDown');
    sm.transition('penUp');
    sm.transition('timeout');
  });

  afterEach(() => {
    sm.destroy();
  });

  it('morphing → ready on morph_complete', () => {
    expect(sm.transition('morph_complete')).toBe(true);
    expect(sm.getState()).toBe('ready');
  });

  it('rejects invalid transition from morphing', () => {
    expect(sm.transition('penDown')).toBe(false);
    expect(sm.getState()).toBe('morphing');
  });
});

// ── Invalid Transitions ─────────────────────────────

describe('SessionStateMachine invalid transitions', () => {
  let sm: SessionStateMachine;

  beforeEach(() => {
    sm = new SessionStateMachine(new EventBus());
  });

  afterEach(() => {
    sm.destroy();
  });

  it('rejects invalid transition from idle', () => {
    expect(sm.transition('penDown')).toBe(false);
    expect(sm.getState()).toBe('idle');
  });

  it('rejects invalid transition from ready', () => {
    sm.transition('init');
    expect(sm.transition('timeout')).toBe(false);
    expect(sm.getState()).toBe('ready');
  });
});

// ── EventBus Integration ────────────────────────────

describe('SessionStateMachine events', () => {
  it('emits state:change on valid transition', () => {
    const bus = new EventBus();
    const sm = new SessionStateMachine(bus);
    const events: unknown[] = [];

    bus.on('state:change', (...args) => events.push(args[0]));
    sm.transition('init');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ from: 'idle', to: 'ready', action: 'init' });
    sm.destroy();
  });

  it('does not emit on invalid transition', () => {
    const bus = new EventBus();
    const sm = new SessionStateMachine(bus);
    const events: unknown[] = [];

    bus.on('state:change', (...args) => events.push(args[0]));
    sm.transition('penDown'); // invalid from idle

    expect(events).toHaveLength(0);
    sm.destroy();
  });
});

// ── getPenUpAction ──────────────────────────────────

describe('SessionStateMachine getPenUpAction', () => {
  let sm: SessionStateMachine;

  beforeEach(() => {
    sm = new SessionStateMachine(new EventBus());
  });

  it('returns penUp for >= 3 points', () => {
    expect(sm.getPenUpAction(3)).toBe('penUp');
    expect(sm.getPenUpAction(100)).toBe('penUp');
  });

  it('returns penUp_short for < 3 points', () => {
    expect(sm.getPenUpAction(2)).toBe('penUp_short');
    expect(sm.getPenUpAction(0)).toBe('penUp_short');
  });
});

// ── Morph Delay — basic ─────────────────────────────

describe('SessionStateMachine morph delay — basic', () => {
  beforeEach(() => { useFakeTimers(); });
  afterEach(() => { useRealTimers(); });

  it('calls callback after MORPH_DELAY_MS', () => {
    const sm = new SessionStateMachine(new EventBus());
    const callback = mockFn();
    sm.startMorphDelay(callback);
    expect(callback).not.toHaveBeenCalled();
    advanceTimers(MORPH_DELAY_MS);
    expect(callback).toHaveBeenCalledTimes(1);
    sm.destroy();
  });

  it('cancelMorphDelay prevents callback', () => {
    const sm = new SessionStateMachine(new EventBus());
    const callback = mockFn();
    sm.startMorphDelay(callback);
    sm.cancelMorphDelay();
    advanceTimers(MORPH_DELAY_MS);
    expect(callback).not.toHaveBeenCalled();
    sm.destroy();
  });
});

// ── Morph Delay — state tracking ────────────────────

describe('SessionStateMachine morph delay — state', () => {
  beforeEach(() => { useFakeTimers(); });
  afterEach(() => { useRealTimers(); });

  it('hasPendingDelay reflects timer state', () => {
    const sm = new SessionStateMachine(new EventBus());
    expect(sm.hasPendingDelay()).toBe(false);
    sm.startMorphDelay(() => {});
    expect(sm.hasPendingDelay()).toBe(true);
    advanceTimers(MORPH_DELAY_MS);
    expect(sm.hasPendingDelay()).toBe(false);
    sm.destroy();
  });

  it('startMorphDelay replaces existing timer', () => {
    const sm = new SessionStateMachine(new EventBus());
    const first = mockFn();
    const second = mockFn();
    sm.startMorphDelay(first);
    sm.startMorphDelay(second);
    advanceTimers(MORPH_DELAY_MS);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    sm.destroy();
  });
});

// ── Destroy ─────────────────────────────────────────

describe('SessionStateMachine destroy', () => {
  it('resets to idle and cancels timers', () => {
    useFakeTimers();
    const sm = new SessionStateMachine(new EventBus());
    const callback = mockFn();

    sm.transition('init');
    sm.startMorphDelay(callback);
    sm.destroy();

    expect(sm.getState()).toBe('idle');
    advanceTimers(MORPH_DELAY_MS);
    expect(callback).not.toHaveBeenCalled();
    useRealTimers();
  });
});

// ── Exporting Transitions ───────────────────────────

describe('SessionStateMachine exporting', () => {
  let sm: SessionStateMachine;

  beforeEach(() => {
    sm = new SessionStateMachine(new EventBus());
    sm.transition('init');
  });

  afterEach(() => {
    sm.destroy();
  });

  it('ready → exporting on export_start', () => {
    expect(sm.transition('export_start')).toBe(true);
    expect(sm.getState()).toBe('exporting');
  });

  it('exporting → ready on export_complete', () => {
    sm.transition('export_start');
    expect(sm.transition('export_complete')).toBe(true);
    expect(sm.getState()).toBe('ready');
  });

  it('exporting → ready on export_fail', () => {
    sm.transition('export_start');
    expect(sm.transition('export_fail')).toBe(true);
    expect(sm.getState()).toBe('ready');
  });
});
