import { GlymoEventMap } from '../types.js';
type EventHandler<T extends any[] = any[]> = (...args: T) => void;
/**
 * Simple typed event emitter for internal pipeline communication.
 * Supports on/off/once/emit pattern.
 */
export declare class EventBus {
    private listeners;
    /** Register a listener for an event. Returns unsubscribe function. */
    on<K extends keyof GlymoEventMap>(event: K, handler: (...args: GlymoEventMap[K]) => void): () => void;
    on(event: string, handler: EventHandler): () => void;
    /** Register a one-time listener. Fires once then auto-removes. */
    once<K extends keyof GlymoEventMap>(event: K, handler: (...args: GlymoEventMap[K]) => void): () => void;
    once(event: string, handler: EventHandler): () => void;
    /** Remove a specific listener for an event */
    off(event: string, handler: EventHandler): void;
    /** Emit an event to all registered listeners */
    emit<K extends keyof GlymoEventMap>(event: K, ...args: GlymoEventMap[K]): void;
    emit(event: string, ...args: unknown[]): void;
    /** Remove all listeners for all events */
    clear(): void;
}
export {};
