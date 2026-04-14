import { GlymoObject } from '../types.js';
export declare class ObjectStore {
    private objects;
    private strokeToObject;
    private fillToObject;
    private creationOrder;
    /** Create a new object from a set of stroke IDs and a bounding box */
    createObject(strokeIds: string[], bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
    }): GlymoObject;
    /** Associate a fill with an existing object */
    addFillToObject(objectId: string, fillId: string): boolean;
    /** Get an object by its ID */
    getObject(id: string): GlymoObject | undefined;
    /** Find the object containing a specific stroke */
    getObjectByStrokeId(strokeId: string): GlymoObject | undefined;
    /** Find the object containing a specific fill */
    getObjectByFillId(fillId: string): GlymoObject | undefined;
    /** Get the most recently created object */
    getLastObject(): GlymoObject | undefined;
    /** Get all objects in creation order */
    getAllObjects(): GlymoObject[];
    /** Remove an object by ID. Returns the removed object or undefined. */
    removeObject(id: string): GlymoObject | undefined;
    /** Remove the most recently created object */
    removeLastObject(): GlymoObject | undefined;
    /** Add a stroke to an existing object (used when restoring removed strokes on revert) */
    addStrokeToObject(objectId: string, strokeId: string): boolean;
    /** Remove a single stroke from its owning object (used when undo/fadeOut removes a stroke) */
    removeStrokeFromObject(strokeId: string): void;
    /** Update the animation ID for an object */
    setAnimationId(objectId: string, animationId: string | undefined): void;
    /** Number of objects */
    get size(): number;
    /** Update a metadata key on an object */
    updateMetadata(objectId: string, key: string, value: unknown): boolean;
    /** Clear all objects and index maps */
    clear(): void;
}
