// ── Animation Types ─────────────────────────────────

export type AnimationType = 'pulse' | 'sparkle' | 'float' | 'bounce' | 'rotate' | 'fly' | 'shake' | 'fadeOut' | 'keyframe';

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
