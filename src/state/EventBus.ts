import type { GlymoEvent } from '../types.js';

type EventHandler = (...args: unknown[]) => void;

/**
 * Simple typed event emitter for internal pipeline communication.
 * Supports on/off/once/emit pattern.
 */
export class EventBus {
  private listeners = new Map<GlymoEvent, Set<EventHandler>>();

  /** Register a listener for an event. Returns unsubscribe function. */
  on(event: GlymoEvent, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => this.off(event, handler);
  }

  /** Register a one-time listener. Fires once then auto-removes. */
  once(event: GlymoEvent, handler: EventHandler): () => void {
    const wrapper: EventHandler = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    return this.on(event, wrapper);
  }

  /** Remove a specific listener for an event */
  off(event: GlymoEvent, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  /** Emit an event to all registered listeners */
  emit(event: GlymoEvent, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      handler(...args);
    }
  }

  /** Remove all listeners for all events */
  clear(): void {
    this.listeners.clear();
  }
}
