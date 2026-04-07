// ── Animation Types ─────────────────────────────────

export type AnimationType = 'pulse' | 'sparkle' | 'float' | 'bounce' | 'rotate' | 'fly' | 'shake' | 'fadeOut';

export interface AnimationParams {
  type: AnimationType;
  duration: number;        // ms for one cycle
  repeat?: boolean;        // loop animation
  delay?: number;          // ms before start
  // Type-specific params
  direction?: 'up' | 'down' | 'left' | 'right';  // for fly
  amplitude?: number;      // for pulse/bounce/shake (pixels or scale factor)
  speed?: number;          // for rotate (degrees per second)
  particleCount?: number;  // for sparkle
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
