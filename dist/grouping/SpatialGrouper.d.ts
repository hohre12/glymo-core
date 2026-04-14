/**
 * SpatialGrouper — groups strokes by spatial proximity.
 *
 * Shared by text mode (CascadingRecognizer) and drawing mode (Gemma).
 * Pure grouping logic — no recognition or rendering.
 */
export interface Bbox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface GroupedStroke {
    id: string;
    raw: Array<{
        x: number;
        y: number;
        pressure?: number;
    }>;
    bbox: Bbox;
}
export interface SpatialGroup {
    id: number;
    strokes: GroupedStroke[];
    bbox: Bbox;
    finalized: boolean;
}
export interface SpatialGrouperOptions {
    proximityFactor: number;
    minProximityPx: number;
    maxProximityPx: number;
    finalizeDelay: number;
    onGroupFinalized: (group: SpatialGroup) => void;
    onGroupUpdated?: (group: SpatialGroup) => void;
}
export declare function combineBbox(a: Bbox, b: Bbox): Bbox;
export declare function bboxNear(a: Bbox, b: Bbox, threshold: number): boolean;
export declare class SpatialGrouper {
    private groups;
    private idCounter;
    private destroyed;
    private opts;
    constructor(opts: SpatialGrouperOptions);
    /** Update proximity parameters (e.g. when language changes) */
    setParams(params: Pick<SpatialGrouperOptions, 'proximityFactor' | 'minProximityPx' | 'maxProximityPx' | 'finalizeDelay'>): void;
    /** Signal that a new stroke started.
     *  If enough time has passed (>= finalizeDelay), the group is finalized
     *  immediately — the user has moved on to a new character.
     *  Otherwise, cancels the timer (NOT reschedule) so it won't fire while
     *  the user is mid-stroke. Timer resumes when feedStroke is called. */
    notifyStrokeStart(): void;
    /** Feed a completed stroke — will be assigned to existing or new group */
    feedStroke(stroke: GroupedStroke, dpr?: number): void;
    /**
     * Split a group: keep first `keepCount` strokes, finalize them,
     * return the remaining strokes for re-feeding.
     * Used when recognition detects a character boundary mid-group.
     */
    splitGroup(groupId: number, keepCount: number): GroupedStroke[] | null;
    /**
     * Create a new group with multiple strokes at once (already in CSS coords).
     * Used to re-feed overflow strokes after a split — they must stay together.
     */
    createGroup(strokes: GroupedStroke[]): void;
    /**
     * Force-finalize a specific group by ID immediately.
     * No timer, no proximity check. Used by the recognizer for early-commit
     * when a group is unambiguously recognized — prevents the next character's
     * first stroke from merging into this group (stroke-loss bug).
     */
    finalizeGroupById(groupId: number): void;
    /** Force-finalize all pending groups immediately */
    flushAll(): void;
    /** Clear all groups and timers */
    clear(): void;
    /** Destroy — clears and prevents further use */
    destroy(): void;
    /** Get count of active (non-finalized) groups */
    get activeGroupCount(): number;
    /** Get the last active (non-finalized) group's id, or undefined */
    getActiveGroupId(): number | undefined;
    /** Get the last active group's lastStrokeEndMs, or 0 */
    getActiveGroupLastStrokeMs(): number;
    private lastActiveGroup;
    private scheduleFinalizeTimer;
    private doFinalize;
}
