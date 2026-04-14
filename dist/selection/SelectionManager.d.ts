import { EventBus } from '../state/EventBus.js';
/**
 * Manages object selection state and emits events on changes.
 * Tracks a set of selected GlymoObject IDs.
 */
export declare class SelectionManager {
    private readonly eventBus;
    private selected;
    constructor(eventBus: EventBus);
    /** Select an object. No-op if already selected. */
    select(objectId: string): void;
    /** Deselect an object. No-op if not selected. */
    deselect(objectId: string): void;
    /** Toggle selection: select if not selected, deselect if selected. */
    toggle(objectId: string): void;
    /** Deselect all objects. */
    clearSelection(): void;
    /** Check if an object is selected. */
    isSelected(objectId: string): boolean;
    /** Get a read-only copy of selected object IDs. */
    getSelectedIds(): ReadonlySet<string>;
    /** Number of selected objects. */
    get count(): number;
    /** Remove an object from selection during cleanup (e.g. object deletion). */
    removeIfSelected(objectId: string): void;
    private emitChanged;
}
