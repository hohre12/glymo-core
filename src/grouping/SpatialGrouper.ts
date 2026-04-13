/**
 * SpatialGrouper — groups strokes by spatial proximity.
 *
 * Shared by text mode (CascadingRecognizer) and drawing mode (Gemma).
 * Pure grouping logic — no recognition or rendering.
 */

// ── Public types ─────────────────────────────────────────────────────────

export interface Bbox { x: number; y: number; width: number; height: number }

export interface GroupedStroke {
  id: string;
  raw: Array<{ x: number; y: number; pressure?: number }>;
  bbox: Bbox;
}

export interface SpatialGroup {
  id: number;
  strokes: GroupedStroke[];
  bbox: Bbox;
  finalized: boolean;
}

export interface SpatialGrouperOptions {
  proximityFactor: number;    // bbox size multiplier for proximity threshold
  minProximityPx: number;     // minimum proximity threshold in pixels
  maxProximityPx: number;     // maximum proximity threshold cap (prevents snowball growth)
  finalizeDelay: number;      // ms of inactivity before group finalizes
  onGroupFinalized: (group: SpatialGroup) => void;
  onGroupUpdated?: (group: SpatialGroup) => void;  // called each time a stroke is added
}

// ── Internal types ───────────────────────────────────────────────────────

interface InternalGroup extends SpatialGroup {
  finalizeTimer: ReturnType<typeof setTimeout> | null;
  /** performance.now() timestamp when the most recent stroke joined this group */
  lastStrokeEndMs: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function combineBbox(a: Bbox, b: Bbox): Bbox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

export function bboxNear(a: Bbox, b: Bbox, threshold: number): boolean {
  // Expand b by threshold and check overlap with a
  const ex = b.x - threshold;
  const ey = b.y - threshold;
  const ew = b.width + threshold * 2;
  const eh = b.height + threshold * 2;

  return !(a.x + a.width < ex || a.x > ex + ew ||
           a.y + a.height < ey || a.y > ey + eh);
}

// ── Class ────────────────────────────────────────────────────────────────

export class SpatialGrouper {
  private groups: InternalGroup[] = [];
  private idCounter = 0;
  private destroyed = false;
  private opts: SpatialGrouperOptions;

  constructor(opts: SpatialGrouperOptions) {
    this.opts = opts;
  }

  /** Update proximity parameters (e.g. when language changes) */
  setParams(params: Pick<SpatialGrouperOptions, 'proximityFactor' | 'minProximityPx' | 'maxProximityPx' | 'finalizeDelay'>): void {
    this.opts.proximityFactor = params.proximityFactor;
    this.opts.minProximityPx = params.minProximityPx;
    this.opts.maxProximityPx = params.maxProximityPx;
    this.opts.finalizeDelay = params.finalizeDelay;
    // Reschedule active group timers under new delay
    for (const g of this.groups) {
      if (!g.finalized && g.finalizeTimer) {
        this.scheduleFinalizeTimer(g);
      }
    }
  }

  /** Cancel all pending finalize timers — call when a new stroke STARTS drawing */
  notifyStrokeStart(): void {
    if (this.destroyed) return;
    for (const g of this.groups) {
      if (!g.finalized && g.finalizeTimer) {
        clearTimeout(g.finalizeTimer);
        g.finalizeTimer = null;
      }
    }
  }

  /** Feed a completed stroke — will be assigned to existing or new group */
  feedStroke(stroke: GroupedStroke, dpr = 1): void {
    if (this.destroyed) return;

    // Convert bbox to CSS coords
    const cssBbox: Bbox = {
      x: stroke.bbox.x / dpr,
      y: stroke.bbox.y / dpr,
      width: stroke.bbox.width / dpr,
      height: stroke.bbox.height / dpr,
    };
    const cssStroke: GroupedStroke = { id: stroke.id, raw: stroke.raw, bbox: cssBbox };

    const active = this.lastActiveGroup();

    if (active) {
      // Time-based boundary: if the inter-stroke pause exceeds half the
      // finalize delay, the user has visibly paused and is probably starting
      // a new character. Finalize the current group immediately and fall
      // through to the "start new group" branch, regardless of spatial
      // proximity. This prevents the first stroke of the next character
      // from being merged into the previous group (stroke-loss bug).
      const nowMs = performance.now();
      const gapMs = nowMs - active.lastStrokeEndMs;
      // When finalizeDelay is 0, the boundary is effectively disabled (no time
      // gap ever exceeds zero) — keep accumulation working for callers that
      // opt out of time-based boundaries.
      const boundaryGapMs = this.opts.finalizeDelay > 0
        ? this.opts.finalizeDelay / 2
        : Infinity;

      if (gapMs > boundaryGapMs) {
        this.doFinalize(active);
        // fall through to "start new group" below
      } else {
        // Check if new stroke is near the active group
        // Capped to prevent snowball: bigger group → bigger threshold → catches more → repeat
        const threshold = Math.min(
          Math.max(
            Math.max(active.bbox.width, active.bbox.height) * this.opts.proximityFactor,
            this.opts.minProximityPx,
          ),
          this.opts.maxProximityPx,
        );

        const near = bboxNear(cssBbox, active.bbox, threshold);

        if (near) {
          // Add to existing group
          active.strokes.push(cssStroke);
          active.bbox = combineBbox(active.bbox, cssBbox);
          active.lastStrokeEndMs = nowMs;
          // Cancel pending finalize timer
          if (active.finalizeTimer) {
            clearTimeout(active.finalizeTimer);
            active.finalizeTimer = null;
          }
          this.opts.onGroupUpdated?.(active);
          this.scheduleFinalizeTimer(active);
          return;
        }

        // New stroke is far away — finalize previous group immediately
        this.doFinalize(active);
      }
    }

    // Start new group
    const newGroup: InternalGroup = {
      id: ++this.idCounter,
      strokes: [cssStroke],
      bbox: { ...cssBbox },
      finalized: false,
      finalizeTimer: null,
      lastStrokeEndMs: performance.now(),
    };
    this.groups.push(newGroup);
    this.opts.onGroupUpdated?.(newGroup);
    this.scheduleFinalizeTimer(newGroup);
  }

  /**
   * Split a group: keep first `keepCount` strokes, finalize them,
   * return the remaining strokes for re-feeding.
   * Used when recognition detects a character boundary mid-group.
   */
  splitGroup(groupId: number, keepCount: number): GroupedStroke[] | null {
    const group = this.groups.find(g => g.id === groupId && !g.finalized);
    if (!group || keepCount <= 0 || keepCount >= group.strokes.length) return null;

    // Extract strokes to move to a new group
    const removed = group.strokes.splice(keepCount);

    // Recalculate bbox for remaining strokes
    group.bbox = { ...group.strokes[0]!.bbox };
    for (let i = 1; i < group.strokes.length; i++) {
      group.bbox = combineBbox(group.bbox, group.strokes[i]!.bbox);
    }

    // Finalize the trimmed group
    this.doFinalize(group);

    return removed;
  }

  /**
   * Create a new group with multiple strokes at once (already in CSS coords).
   * Used to re-feed overflow strokes after a split — they must stay together.
   */
  createGroup(strokes: GroupedStroke[]): void {
    if (this.destroyed || strokes.length === 0) return;

    // Finalize any current active group first
    const active = this.lastActiveGroup();
    if (active) this.doFinalize(active);

    let bbox = { ...strokes[0]!.bbox };
    for (let i = 1; i < strokes.length; i++) {
      bbox = combineBbox(bbox, strokes[i]!.bbox);
    }

    const newGroup: InternalGroup = {
      id: ++this.idCounter,
      strokes: [...strokes],
      bbox,
      finalized: false,
      finalizeTimer: null,
      lastStrokeEndMs: performance.now(),
    };
    this.groups.push(newGroup);
    this.opts.onGroupUpdated?.(newGroup);
    this.scheduleFinalizeTimer(newGroup);
  }

  /**
   * Force-finalize a specific group by ID immediately.
   * No timer, no proximity check. Used by the recognizer for early-commit
   * when a group is unambiguously recognized — prevents the next character's
   * first stroke from merging into this group (stroke-loss bug).
   */
  finalizeGroupById(groupId: number): void {
    const group = this.groups.find(g => g.id === groupId && !g.finalized);
    if (group) this.doFinalize(group);
  }

  /** Force-finalize all pending groups immediately */
  flushAll(): void {
    if (this.destroyed) return;
    for (const g of [...this.groups]) {
      if (!g.finalized) this.doFinalize(g);
    }
  }

  /** Clear all groups and timers */
  clear(): void {
    for (const g of this.groups) {
      if (g.finalizeTimer) clearTimeout(g.finalizeTimer);
    }
    this.groups = [];
  }

  /** Destroy — clears and prevents further use */
  destroy(): void {
    this.destroyed = true;
    this.clear();
  }

  /** Get count of active (non-finalized) groups */
  get activeGroupCount(): number {
    return this.groups.filter(g => !g.finalized).length;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private lastActiveGroup(): InternalGroup | undefined {
    const last = this.groups[this.groups.length - 1];
    return last && !last.finalized ? last : undefined;
  }

  private scheduleFinalizeTimer(group: InternalGroup): void {
    if (group.finalizeTimer) clearTimeout(group.finalizeTimer);
    group.finalizeTimer = setTimeout(() => {
      group.finalizeTimer = null;
      this.doFinalize(group);
    }, this.opts.finalizeDelay);
  }

  private doFinalize(group: InternalGroup): void {
    if (group.finalized) return;
    group.finalized = true;

    if (group.finalizeTimer) {
      clearTimeout(group.finalizeTimer);
      group.finalizeTimer = null;
    }

    this.opts.onGroupFinalized(group);

    // Remove finalized group from array to prevent memory leak
    this.groups = this.groups.filter(g => g !== group);
  }
}
