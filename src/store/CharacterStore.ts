// ── CharacterStore ──────────────────────────────────
//
// Pure data layer for recognised characters — the typography output produced
// by CascadingRecognizer once a handwritten stroke group finalises into a
// glyph. Mirrors the `ObjectStore` shape so `exportSession` / `loadSession`
// treat characters with the same round-trip contract as objects.
//
// Authoritative storage moved out of the React layer
// (`useTextRecognition` previously held chars in `useState`) for session
// persistence Revision 2 — core owns the data because both exportSession
// (serialisation) and the renderer (hologram / morph effects) must read
// char geometry without touching React. See
// `docs/plans/session-persistence-round-trip.md` §11.2 for the rationale
// and rejected alternatives.
//
// Transient UI state (entryTime, isDeleting, isGrabbed, strokePoints) is
// intentionally NOT stored here — the hook retains those as render-only
// overlays on top of the core-owned `CharacterDoc` list.

import type { CharacterDoc } from '../types.js';

export class CharacterStore {
  private characters = new Map<string, CharacterDoc>();
  /** Insertion order for stable export / render sequencing. */
  private insertionOrder: string[] = [];

  /**
   * Add a freshly-recognised character. Duplicate ids trigger an update
   * rather than a second insert, matching the `onCorrection` semantics of
   * `CascadingRecognizer` (same id, new char).
   */
  addCharacter(doc: CharacterDoc): void {
    if (this.characters.has(doc.id)) {
      this.characters.set(doc.id, { ...doc });
      return;
    }
    this.characters.set(doc.id, { ...doc });
    this.insertionOrder.push(doc.id);
  }

  /**
   * Patch an existing character — used when `CascadingRecognizer` issues a
   * correction (net2 sweep overrides net1's tentative glyph). Unknown ids
   * are ignored with a `console.warn` so corrupt upstream events don't
   * throw the engine.
   */
  updateCharacter(id: string, patch: Partial<Omit<CharacterDoc, 'id'>>): void {
    const existing = this.characters.get(id);
    if (!existing) {
      console.warn(`[CharacterStore] updateCharacter: unknown id "${id}"`);
      return;
    }
    this.characters.set(id, { ...existing, ...patch });
  }

  /**
   * Remove a character by id. Returns the removed doc for parity with
   * `ObjectStore.removeObject`, or `undefined` when the id was unknown.
   */
  removeCharacter(id: string): CharacterDoc | undefined {
    const existing = this.characters.get(id);
    if (!existing) return undefined;
    this.characters.delete(id);
    this.insertionOrder = this.insertionOrder.filter((cid) => cid !== id);
    return existing;
  }

  /** Lookup by id. */
  getCharacter(id: string): CharacterDoc | undefined {
    return this.characters.get(id);
  }

  /**
   * All characters in insertion order. Returns fresh shallow copies so
   * mutations on the result never leak back into the store.
   */
  getAllCharacters(): CharacterDoc[] {
    return this.insertionOrder
      .map((id) => this.characters.get(id))
      .filter((c): c is CharacterDoc => c != null)
      .map((c) => ({ ...c }));
  }

  /**
   * Bulk-restore characters during `loadSession`. Preserves the wire-order
   * so typography renders in the same sequence the user produced it.
   * Duplicate ids within the payload are rejected with a `console.warn`
   * — surfaces corrupt wire data without throwing, matching the
   * referential-integrity philosophy in §4 D6.
   */
  loadCharacters(docs: CharacterDoc[]): void {
    this.clear();
    for (const doc of docs) {
      if (this.characters.has(doc.id)) {
        console.warn(
          `[CharacterStore] loadCharacters: duplicate id "${doc.id}"; skipping.`,
        );
        continue;
      }
      this.characters.set(doc.id, { ...doc });
      this.insertionOrder.push(doc.id);
    }
  }

  /** Count of stored characters. */
  get size(): number {
    return this.characters.size;
  }

  /** Remove every character — called from `Glymo.resetSessionState`. */
  clear(): void {
    this.characters.clear();
    this.insertionOrder = [];
  }
}
