// ── ObjectStore ─────────────────────────────────────
//
// Manages GlymoObject instances — groups of strokes + fills
// that are treated as a single unit for animation, undo, and interaction.
// Pure data layer — no rendering or recognition logic.

import type { GlymoObject } from '../types.js';

export class ObjectStore {
  private objects = new Map<string, GlymoObject>();
  private strokeToObject = new Map<string, string>();
  private fillToObject = new Map<string, string>();
  private creationOrder: string[] = [];

  /** Create a new object from a set of stroke IDs and a bounding box */
  createObject(
    strokeIds: string[],
    bbox: { x: number; y: number; width: number; height: number },
  ): GlymoObject {
    const id = crypto.randomUUID();
    const obj: GlymoObject = {
      id,
      strokeIds: [...strokeIds],
      fillIds: [],
      bbox: { ...bbox },
      createdAt: Date.now(),
    };
    this.objects.set(id, obj);
    this.creationOrder.push(id);
    for (const sid of strokeIds) {
      // If stroke already belongs to another object, remove it from the old one
      const existingOid = this.strokeToObject.get(sid);
      if (existingOid && existingOid !== id) {
        const existingObj = this.objects.get(existingOid);
        if (existingObj) {
          existingObj.strokeIds = existingObj.strokeIds.filter(s => s !== sid);
        }
      }
      this.strokeToObject.set(sid, id);
    }
    return obj;
  }

  /** Associate a fill with an existing object */
  addFillToObject(objectId: string, fillId: string): boolean {
    const obj = this.objects.get(objectId);
    if (!obj) return false;
    obj.fillIds.push(fillId);
    this.fillToObject.set(fillId, objectId);
    return true;
  }

  /** Get an object by its ID */
  getObject(id: string): GlymoObject | undefined {
    return this.objects.get(id);
  }

  /** Find the object containing a specific stroke */
  getObjectByStrokeId(strokeId: string): GlymoObject | undefined {
    const oid = this.strokeToObject.get(strokeId);
    return oid ? this.objects.get(oid) : undefined;
  }

  /** Find the object containing a specific fill */
  getObjectByFillId(fillId: string): GlymoObject | undefined {
    const oid = this.fillToObject.get(fillId);
    return oid ? this.objects.get(oid) : undefined;
  }

  /** Get the most recently created object */
  getLastObject(): GlymoObject | undefined {
    const lastId = this.creationOrder[this.creationOrder.length - 1];
    return lastId ? this.objects.get(lastId) : undefined;
  }

  /** Get all objects in creation order */
  getAllObjects(): GlymoObject[] {
    return this.creationOrder
      .map(id => this.objects.get(id))
      .filter((obj): obj is GlymoObject => obj != null);
  }

  /** Remove an object by ID. Returns the removed object or undefined. */
  removeObject(id: string): GlymoObject | undefined {
    const obj = this.objects.get(id);
    if (!obj) return undefined;

    for (const sid of obj.strokeIds) {
      this.strokeToObject.delete(sid);
    }
    for (const fid of obj.fillIds) {
      this.fillToObject.delete(fid);
    }
    this.objects.delete(id);
    this.creationOrder = this.creationOrder.filter(oid => oid !== id);
    return obj;
  }

  /** Remove the most recently created object */
  removeLastObject(): GlymoObject | undefined {
    const lastId = this.creationOrder[this.creationOrder.length - 1];
    if (!lastId) return undefined;
    return this.removeObject(lastId);
  }

  /** Add a stroke to an existing object (used when restoring removed strokes on revert) */
  addStrokeToObject(objectId: string, strokeId: string): boolean {
    const obj = this.objects.get(objectId);
    if (!obj) return false;
    // Remove from any previous owner
    const existingOid = this.strokeToObject.get(strokeId);
    if (existingOid && existingOid !== objectId) {
      const existingObj = this.objects.get(existingOid);
      if (existingObj) {
        existingObj.strokeIds = existingObj.strokeIds.filter(s => s !== strokeId);
      }
    }
    if (!obj.strokeIds.includes(strokeId)) {
      obj.strokeIds.push(strokeId);
    }
    this.strokeToObject.set(strokeId, objectId);
    return true;
  }

  /** Remove a single stroke from its owning object (used when undo/fadeOut removes a stroke) */
  removeStrokeFromObject(strokeId: string): void {
    const oid = this.strokeToObject.get(strokeId);
    if (!oid) return;
    const obj = this.objects.get(oid);
    if (obj) {
      obj.strokeIds = obj.strokeIds.filter(s => s !== strokeId);
    }
    this.strokeToObject.delete(strokeId);
  }

  /** Update the animation ID for an object */
  setAnimationId(objectId: string, animationId: string | undefined): void {
    const obj = this.objects.get(objectId);
    if (obj) obj.animationId = animationId;
  }

  /** Number of objects */
  get size(): number {
    return this.objects.size;
  }

  /** Update a metadata key on an object */
  updateMetadata(objectId: string, key: string, value: unknown): boolean {
    const obj = this.objects.get(objectId);
    if (!obj) return false;
    if (!obj.metadata) obj.metadata = {};
    obj.metadata[key] = value;
    return true;
  }

  /** Clear all objects and index maps */
  clear(): void {
    this.objects.clear();
    this.strokeToObject.clear();
    this.fillToObject.clear();
    this.creationOrder = [];
  }
}
