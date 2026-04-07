import type { GlymoEventMap } from '../types.js';

type EventHandler<T extends unknown[] = unknown[]> = (...args: T) => void;

/**
 * Simple typed event emitter for internal pipeline communication.
 * Supports on/off/once/emit pattern.
 */
export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  /** Register a listener for an event. Returns unsubscribe function. */
  on<K extends keyof GlymoEventMap>(event: K, handler: (...args: GlymoEventMap[K]) => void): () => void;
  on(event: string, handler: EventHandler): () => void;
  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => this.off(event, handler);
  }

  /** Register a one-time listener. Fires once then auto-removes. */
  once<K extends keyof GlymoEventMap>(event: K, handler: (...args: GlymoEventMap[K]) => void): () => void;
  once(event: string, handler: EventHandler): () => void;
  once(event: string, handler: EventHandler): () => void {
    const wrapper: EventHandler = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    return this.on(event, wrapper);
  }

  /** Remove a specific listener for an event */
  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  /** Emit an event to all registered listeners */
  emit<K extends keyof GlymoEventMap>(event: K, ...args: GlymoEventMap[K]): void;
  emit(event: string, ...args: unknown[]): void;
  emit(event: string, ...args: unknown[]): void {
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
