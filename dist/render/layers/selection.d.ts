import { ObjectStore } from '../../store/ObjectStore.js';
/**
 * Layer 15 — Selection Highlights
 *
 * Renders animated marching-ants bounding box and corner handles
 * for each selected object. Drawn directly to main canvas (not cached)
 * since it requires per-frame animation.
 */
export declare function renderSelection(ctx: CanvasRenderingContext2D, selectedIds: ReadonlySet<string>, objectStore: ObjectStore, effectColor: string, timestamp: number, dpr: number): void;
