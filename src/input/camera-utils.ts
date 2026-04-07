// ── Camera Helper Functions ─────────────────────────
// Pure utility functions for camera input processing.
// Extracted from CameraCapture.ts for modularity.
// NOTE: No imports from CameraCapture.ts to avoid circular dependencies.

/** Euclidean distance between thumb tip and index tip (normalized coords) */
export function computePinchDistance(thumb: { x: number; y: number }, index: { x: number; y: number }): number {
  return Math.sqrt(
    (thumb.x - index.x) ** 2 +
    (thumb.y - index.y) ** 2,
  );
}

/** Compute movement speed in canvas-px per ms */
export function computeSpeed(
  prev: { x: number; y: number; t: number },
  curr: { x: number; y: number },
  now: number,
): number {
  const dt = now - prev.t;
  if (dt <= 0) return Infinity;
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;
  return Math.sqrt(dx * dx + dy * dy) / dt;
}

/** Map Z-depth to pressure (closer to camera = higher pressure) */
export function zToPressure(z: number): number {
  // z is in meters, negative = closer to camera
  // Map range [-0.15, 0] → [1.0, 0.6]
  // Raised floor from 0.3 to 0.6 so camera strokes are never too thin.
  const normalized = Math.max(0, Math.min(1, -z / 0.15));
  return 0.6 + normalized * 0.4;
}
