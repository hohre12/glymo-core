import { EventBus } from '../src/state/EventBus.js';

// ── Basic on/emit ─────────────────────────────────────

describe('EventBus on/emit', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('emits event to registered listener', () => {
    const calls: unknown[][] = [];
    bus.on('stroke:start', (...args) => calls.push(args));

    bus.emit('stroke:start');

    expect(calls).toHaveLength(1);
  });

  it('passes arguments to listener', () => {
    const calls: unknown[][] = [];
    bus.on('error', (...args) => calls.push(args));

    bus.emit('error', 'test error', 42);

    expect(calls[0]).toEqual(['test error', 42]);
  });

  it('does nothing when emitting to no listeners', () => {
    expect(() => bus.emit('stroke:start')).not.toThrow();
  });
});

// ── off ───────────────────────────────────────────────

describe('EventBus off', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('removes specific listener', () => {
    let count = 0;
    const handler = () => { count++; };

    bus.on('stroke:end', handler);
    bus.emit('stroke:end');
    expect(count).toBe(1);

    bus.off('stroke:end', handler);
    bus.emit('stroke:end');
    expect(count).toBe(1); // Not called again
  });

  it('does not affect other listeners', () => {
    let countA = 0;
    let countB = 0;
    const handlerA = () => { countA++; };
    const handlerB = () => { countB++; };

    bus.on('stroke:start', handlerA);
    bus.on('stroke:start', handlerB);
    bus.off('stroke:start', handlerA);

    bus.emit('stroke:start');
    expect(countA).toBe(0);
    expect(countB).toBe(1);
  });

  it('off with non-registered handler does not throw', () => {
    const handler = () => {};
    expect(() => bus.off('stroke:start', handler)).not.toThrow();
  });
});

// ── Unsubscribe function from on() ────────────────────

describe('EventBus unsubscribe', () => {
  it('on returns unsubscribe function', () => {
    const bus = new EventBus();
    let count = 0;
    const unsub = bus.on('stroke:start', () => { count++; });

    bus.emit('stroke:start');
    expect(count).toBe(1);

    unsub();
    bus.emit('stroke:start');
    expect(count).toBe(1); // No longer called
  });
});

// ── once ──────────────────────────────────────────────

describe('EventBus once', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('fires only once then auto-removes', () => {
    let count = 0;
    bus.once('morph:complete', () => { count++; });

    bus.emit('morph:complete');
    bus.emit('morph:complete');
    bus.emit('morph:complete');

    expect(count).toBe(1);
  });

  it('passes arguments to once handler', () => {
    const calls: unknown[][] = [];
    bus.once('error', (...args) => calls.push(args));

    bus.emit('error', 'once-data');

    expect(calls[0]).toEqual(['once-data']);
  });

  it('once returns unsubscribe function', () => {
    let count = 0;
    const unsub = bus.once('stroke:start', () => { count++; });

    unsub(); // Unsubscribe before it fires
    bus.emit('stroke:start');

    expect(count).toBe(0);
  });
});

// ── Multiple listeners ────────────────────────────────

describe('EventBus multiple listeners', () => {
  it('supports multiple listeners on same event', () => {
    const bus = new EventBus();
    const results: string[] = [];

    bus.on('stroke:start', () => results.push('A'));
    bus.on('stroke:start', () => results.push('B'));
    bus.on('stroke:start', () => results.push('C'));

    bus.emit('stroke:start');

    expect(results).toEqual(['A', 'B', 'C']);
  });

  it('different events do not interfere', () => {
    const bus = new EventBus();
    let startCount = 0;
    let endCount = 0;

    bus.on('stroke:start', () => { startCount++; });
    bus.on('stroke:end', () => { endCount++; });

    bus.emit('stroke:start');

    expect(startCount).toBe(1);
    expect(endCount).toBe(0);
  });
});

// ── clear ─────────────────────────────────────────────

describe('EventBus clear', () => {
  it('removes all listeners for all events', () => {
    const bus = new EventBus();
    let startCount = 0;
    let endCount = 0;

    bus.on('stroke:start', () => { startCount++; });
    bus.on('stroke:end', () => { endCount++; });

    bus.clear();

    bus.emit('stroke:start');
    bus.emit('stroke:end');

    expect(startCount).toBe(0);
    expect(endCount).toBe(0);
  });

  it('can register new listeners after clear', () => {
    const bus = new EventBus();
    bus.on('stroke:start', () => {});
    bus.clear();

    let count = 0;
    bus.on('stroke:start', () => { count++; });
    bus.emit('stroke:start');

    expect(count).toBe(1);
  });
});
