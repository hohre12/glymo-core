// Canonical types for the @glymo/core/classifier subpath.
//
// `StrokePoint` here is the input contract for `strokesToImage` and every
// classifier consumer that wants to feed raw stroke data into the ONNX
// pipeline. It is intentionally distinct from the capture-time
// `StrokePoint` in `@glymo/core/types` (which uses `t` instead of
// `timestamp` and is part of the pipeline / capture invariants).
//
// Why two shapes:
//   - The pipeline's `StrokePoint` was authored for the
//     Capture → Stabilize → Pressure → Segment → Smooth → Effect chain
//     and uses `t` for performance.now() millisecond timestamps.
//   - The classifier's `StrokePoint` was authored at the game / drawing
//     layer (originally `glymo-landing/hooks/useGameState.ts`) and uses
//     `timestamp` for the same conceptual value.
//
// Unifying the two would be a larger refactor across the renderer,
// pipeline, exporter, and classifier consumer surfaces — out of scope for
// the classifier extraction. Both shapes are stable contracts at their
// respective layers; landing's `useGameState.ts` re-exports this type so
// existing call sites continue to type-check without code edits.

/**
 * A single point on a hand-drawn stroke as consumed by the classifier
 * pipeline (`strokesToImage` and downstream).
 *
 * Coordinates are in arbitrary units — `strokesToImage` normalises them
 * via the bounding box before rasterising to the 64×64 model input.
 */
export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  /** Capture-time timestamp in ms (e.g. `performance.now()` or `Date.now()`). */
  timestamp: number;
}

/** Convenience alias mirroring the landing-side shape (`StrokePoint[][]`). */
export type StrokeData = StrokePoint[][];
