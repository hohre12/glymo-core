import { SnapResult, Stroke, StrokePoint } from '../types.js';
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
export declare function snapEndpoints(raw: readonly StrokePoint[], otherStrokes: readonly Stroke[], threshold?: number): SnapResult;
