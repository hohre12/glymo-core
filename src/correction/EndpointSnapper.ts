import type { SnapResult, Stroke, StrokePoint } from '../types.js';

/** Default snap threshold in canvas-space pixels */
const DEFAULT_THRESHOLD = 15;

/**
 * Snap a stroke's endpoints to close gaps.
 *
 * For each endpoint:
 * 1. Find the nearest point on the target (self or other stroke)
 * 2. Scan inward to find where the stroke is CLOSEST to the target
 * 3. TRIM excess points beyond that closest approach (overshoot removal)
 * 4. Move the new endpoint to the target
 *
 * This handles both overshoot (trim excess) and gap (move endpoint).
 */
export function snapEndpoints(
  raw: readonly StrokePoint[],
  otherStrokes: readonly Stroke[],
  threshold: number = DEFAULT_THRESHOLD,
): SnapResult {
  if (raw.length < 4) {
    return { snapped: false, end: 'none', targetStrokeIds: [], correctedRaw: [...raw] };
  }

  const t2 = threshold * threshold;
  let correctedRaw = raw.map(p => ({ ...p }));
  const targetStrokeIds: string[] = [];
  let startSnapped = false;
  let endSnapped = false;

  // ── Process END: compete self-close vs cross-stroke ──
  const endPt = correctedRaw[correctedRaw.length - 1]!;
  const startPt = correctedRaw[0]!;
  const selfCloseDist = dist(endPt, startPt);
  const crossEnd = findNearestOnPath(endPt, otherStrokes, t2);
  const crossEndDist = crossEnd?.dist ?? Infinity;

  // Apply 0.8x preference multiplier for self-close to prevent flickery behavior
  if (selfCloseDist > 0 && selfCloseDist * 0.8 < crossEndDist && selfCloseDist * selfCloseDist < t2) {
    // Self-close wins: trim overshoot at end, snap to start
    const trimIdx = findClosestApproach(correctedRaw, startPt, 'end', threshold);
    if (trimIdx !== null && trimIdx < correctedRaw.length - 1) {
      correctedRaw = correctedRaw.slice(0, trimIdx + 1);
    }
    const lastIdx = correctedRaw.length - 1;
    correctedRaw[lastIdx] = { ...correctedRaw[lastIdx]!, x: startPt.x, y: startPt.y };
    endSnapped = true;
  } else if (crossEnd && crossEndDist < selfCloseDist) {
    // Cross-stroke wins: trim + snap
    const endResult = snapOneSide(correctedRaw, otherStrokes, 'end', t2, threshold);
    if (endResult) {
      correctedRaw = endResult.trimmed;
      endSnapped = true;
      if (!targetStrokeIds.includes(endResult.strokeId)) {
        targetStrokeIds.push(endResult.strokeId);
      }
    }
  }

  // ── Process START: cross-stroke only ──
  const startResult = snapOneSide(correctedRaw, otherStrokes, 'start', t2, threshold);
  if (startResult) {
    correctedRaw = startResult.trimmed;
    startSnapped = true;
    if (!targetStrokeIds.includes(startResult.strokeId)) {
      targetStrokeIds.push(startResult.strokeId);
    }
  }

  const snapped = startSnapped || endSnapped;
  const end = startSnapped && endSnapped ? 'both'
    : startSnapped ? 'start'
    : endSnapped ? 'end'
    : 'none';

  return { snapped, end, targetStrokeIds, correctedRaw };
}

interface SideSnapResult {
  trimmed: StrokePoint[];
  trimCount: number;
  dist: number;
  strokeId: string;
}

/**
 * Snap one side (start or end) of a stroke to the nearest other stroke.
 * 1. Find nearest point on any other stroke's path
 * 2. Scan inward to find closest approach to that target
 * 3. Trim overshoot points
 * 4. Move new endpoint to target
 */
function snapOneSide(
  raw: StrokePoint[],
  otherStrokes: readonly Stroke[],
  side: 'start' | 'end',
  thresholdSq: number,
  threshold: number,
): SideSnapResult | null {
  const endpoint = side === 'start' ? raw[0]! : raw[raw.length - 1]!;

  // Find nearest point on other strokes
  const target = findNearestOnPath(endpoint, otherStrokes, thresholdSq);
  if (!target) return null;

  const targetPt: StrokePoint = { x: target.x, y: target.y, t: endpoint.t, pressure: endpoint.pressure };

  // Find closest approach from this side toward the target
  const trimIdx = findClosestApproach(raw, targetPt, side, threshold);
  let trimmed = raw.map(p => ({ ...p }));
  let trimCount = 0;

  if (trimIdx !== null) {
    if (side === 'start' && trimIdx > 0) {
      // Trim points before closest approach
      trimmed = trimmed.slice(trimIdx);
      trimCount = trimIdx;
    } else if (side === 'end' && trimIdx < raw.length - 1) {
      // Trim points after closest approach
      trimmed = trimmed.slice(0, trimIdx + 1);
      trimCount = raw.length - 1 - trimIdx;
    }
  }

  // Move the endpoint to the target
  if (side === 'start') {
    trimmed[0] = { ...trimmed[0]!, x: target.x, y: target.y };
  } else {
    const lastIdx = trimmed.length - 1;
    trimmed[lastIdx] = { ...trimmed[lastIdx]!, x: target.x, y: target.y };
  }

  return { trimmed, trimCount, dist: target.dist, strokeId: target.strokeId };
}

/**
 * Scan from one side inward to find the index where the stroke
 * is closest to a target point. Only scans the outer 40% of the stroke.
 * Returns null if no point is closer than the endpoint itself.
 */
function findClosestApproach(
  raw: readonly StrokePoint[],
  target: StrokePoint,
  side: 'start' | 'end',
  threshold: number,
): number | null {
  const maxScan = Math.ceil(raw.length * 0.4);
  let bestIdx: number | null = null;
  let bestDist = threshold * threshold; // Only consider points within threshold

  for (let i = 0; i < maxScan; i++) {
    const idx = side === 'start' ? i : raw.length - 1 - i;
    const pt = raw[idx]!;
    const dx = pt.x - target.x;
    const dy = pt.y - target.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

/** Find nearest point on other strokes' raw paths */
function findNearestOnPath(
  pt: StrokePoint,
  otherStrokes: readonly Stroke[],
  thresholdSq: number,
): { x: number; y: number; dist: number; strokeId: string } | null {
  let best: { x: number; y: number; dist: number; strokeId: string } | null = null;
  let bestSq = thresholdSq;

  for (const stroke of otherStrokes) {
    for (const p of stroke.raw) {
      const dx = p.x - pt.x;
      const dy = p.y - pt.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = { x: p.x, y: p.y, dist: Math.sqrt(d2), strokeId: stroke.id };
      }
    }
  }

  return best;
}

function dist(a: StrokePoint, b: StrokePoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

