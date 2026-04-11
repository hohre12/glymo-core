import type { EventBus } from '../state/EventBus.js';

/**
 * Manages object selection state and emits events on changes.
 * Tracks a set of selected GlymoObject IDs.
 */
export class SelectionManager {
  private selected = new Set<string>();

  constructor(private readonly eventBus: EventBus) {}

  /** Select an object. No-op if already selected. */
  select(objectId: string): void {
    if (this.selected.has(objectId)) return;
    this.selected.add(objectId);
    this.eventBus.emit('object:selected', { objectId });
    this.emitChanged();
  }

  /** Deselect an object. No-op if not selected. */
  deselect(objectId: string): void {
    if (!this.selected.delete(objectId)) return;
    this.eventBus.emit('object:deselected', { objectId });
    this.emitChanged();
  }

  /** Toggle selection: select if not selected, deselect if selected. */
  toggle(objectId: string): void {
    if (this.selected.has(objectId)) {
      this.deselect(objectId);
    } else {
      this.select(objectId);
    }
  }

  /** Deselect all objects. */
  clearSelection(): void {
    if (this.selected.size === 0) return;
    for (const id of this.selected) {
      this.eventBus.emit('object:deselected', { objectId: id });
    }
    this.selected.clear();
    this.emitChanged();
  }

  /** Check if an object is selected. */
  isSelected(objectId: string): boolean {
    return this.selected.has(objectId);
  }

  /** Get a read-only copy of selected object IDs. */
  getSelectedIds(): ReadonlySet<string> {
    return this.selected;
  }

  /** Number of selected objects. */
  get count(): number {
    return this.selected.size;
  }

  /** Remove an object from selection during cleanup (e.g. object deletion). */
  removeIfSelected(objectId: string): void {
    if (!this.selected.delete(objectId)) return;
    this.eventBus.emit('object:deselected', { objectId });
    this.emitChanged();
  }

  private emitChanged(): void {
    this.eventBus.emit('selection:changed', { selectedIds: [...this.selected] });
  }
}
