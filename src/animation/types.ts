// ── Animation Types ─────────────────────────────────

/**
 * All animation types understood by StrokeAnimator.
 *
 * Legacy types (in use by shapeAnimations.ts text-mode path):
 *   pulse, sparkle, float, bounce, rotate, fly, shake, fadeOut, keyframe
 *
 * New types added for the Locomotion × Modulation drawing-mode system
 * (task #112). Locomotion primitives: drift, traverse, oscillate, orbit,
 * swim, flutter, fall, rise, random. Modulation primitives: shine, bend,
 * bloom, drip, glow. (pulse, sparkle, rotate, shake are shared between
 * the old and new systems — no duplication.)
 */
export type AnimationType =
  // ── Legacy (text-mode / shapeAnimations.ts) ──────────────────────────────
  | 'pulse'
  | 'sparkle'
  | 'float'
  | 'bounce'
  | 'rotate'
  | 'fly'
  | 'shake'
  | 'fadeOut'
  | 'keyframe'
  // ── Locomotion primitives (drawing-mode, task #112) ──────────────────────
  | 'drift'
  | 'traverse'
  | 'oscillate'
  | 'orbit'
  | 'swim'
  | 'flutter'
  | 'fall'
  | 'rise'
  | 'random'
  // ── Modulation primitives (drawing-mode, task #112) ──────────────────────
  | 'shine'
  | 'bend'
  | 'bloom'
  | 'drip'
  | 'glow';

/** A single keyframe in a keyframe-based animation */
export interface AnimationKeyframe {
  t: number;            // 0.0 ~ 1.0 — position in the animation timeline
  x?: number;           // translateX in pixels (default 0)
  y?: number;           // translateY in pixels (default 0)
  scale?: number;       // scale factor (default 1)
  rotation?: number;    // rotation in radians (default 0)
  opacity?: number;     // 0.0 ~ 1.0 (default 1)
  glow?: number;        // glowIntensity (default 1)
}

export interface AnimationParams {
  type: AnimationType;
  duration: number;        // ms for one cycle
  repeat?: boolean;        // loop animation
  delay?: number;          // ms before start
  // Type-specific params (preset animations)
  direction?: 'up' | 'down' | 'left' | 'right';  // for fly
  amplitude?: number;      // for pulse/bounce/shake (pixels or scale factor)
  speed?: number;          // for rotate (degrees per second)
  particleCount?: number;  // for sparkle
  // Keyframe animation — when type === 'keyframe'
  keyframes?: AnimationKeyframe[];
}

export interface StrokeAnimation {
  strokeIds: string[];         // which strokes to animate
  params: AnimationParams;
  startTime: number;           // performance.now() when started
  active: boolean;
}

export interface AnimationTransform {
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;     // radians
  opacity: number;
  glowIntensity: number; // Glow pass intensityScale (1.0 = normal, >1 = brighter glow)
}
