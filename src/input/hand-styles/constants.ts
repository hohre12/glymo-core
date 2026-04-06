// ── Shared Hand Style Constants ───────────────────────

/**
 * MediaPipe hand landmark bone connections (pairs of landmark indices).
 * Extracted from HandVisualizer.ts for reuse across all styles.
 */
export const HAND_CONNECTIONS: ReadonlyArray<[number, number]> = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm cross-connections
  [5, 9], [9, 13], [13, 17],
];

/**
 * Landmark index chains per finger, from base to tip.
 * Useful for styles that render continuous curves along each finger.
 */
export const FINGER_CHAINS: ReadonlyArray<ReadonlyArray<number>> = [
  [1, 2, 3, 4],         // Thumb
  [5, 6, 7, 8],         // Index
  [9, 10, 11, 12],      // Middle
  [13, 14, 15, 16],     // Ring
  [17, 18, 19, 20],     // Pinky
];

/** Landmark indices of all 5 fingertips */
export const FINGER_TIPS: ReadonlyArray<number> = [4, 8, 12, 16, 20];

/** Landmark index of the index fingertip — the primary draw cursor */
export const INDEX_TIP = 8;

/** Landmark index of the thumb tip — used for pinch detection */
export const THUMB_TIP = 4;

// ── Neon Skeleton palette (matches original HandVisualizer exactly) ──────────

export const NEON = {
  ACCENT: 'rgba(0, 255, 204, ',
  ACCENT_HEX: '#00ffcc',
  ACCENT_DIM: 'rgba(0, 255, 204, 0.15)',
  PINCH_ACTIVE: 'rgba(0, 255, 204, 1.0)',
  PINCH_INACTIVE: 'rgba(255, 100, 100, 0.6)',
  BONE_WIDTH: 2.5,
  BONE_GLOW_WIDTH: 6,
  JOINT_RADIUS: 4,
  TIP_RADIUS: 6,
  GLOW_RADIUS: 24,
  GLOW_PULSE_SPEED: 0.005,
} as const;

// ── Crystal palette ───────────────────────────────────

export const CRYSTAL = {
  ICE_BLUE: '#88ccff',
  WHITE: '#ffffff',
  PURPLE: '#aa88ff',
  HIGHLIGHT: 'rgba(255, 255, 255, 0.85)',
  SHARD_BASE: 'rgba(136, 204, 255, ',
  SHADOW: 'rgba(170, 136, 255, ',
  BONE_WIDTH: 1.5,
  JOINT_DIAMOND_SIZE: 5,
  TIP_GLOW_RADIUS: 14,
  SHIMMER_SPEED: 3,
} as const;

// ── Flame palette ─────────────────────────────────────

export const FLAME = {
  YELLOW: '#ffcc00',
  ORANGE: '#ff6600',
  RED: '#ff0000',
  BONE_GLOW: 'rgba(255, 80, 0, 0.5)',
  BONE_COLOR: 'rgba(255, 120, 20, 0.7)',
  BONE_WIDTH: 2,
  BONE_GLOW_WIDTH: 5,
  /** Maximum particles across all joints */
  MAX_PARTICLES: 200,
  /** Particles spawned per joint per frame */
  SPAWN_RATE: 5,
  /** Number of active joints that spawn particles (all 21) */
  JOINT_COUNT: 21,
  /** Particle lifetime in frames at 60fps */
  PARTICLE_LIFETIME: 30,
} as const;

// ── Aurora palette ────────────────────────────────────

export const AURORA = {
  HUE_SPEED: 0.05,
  HUE_SHIFT_PER_FINGER: 60,
  SATURATION: 80,
  LIGHTNESS: 60,
  /** Number of rendering passes (layers) per finger */
  LAYER_COUNT: 3,
  /** Base line width */
  LINE_WIDTH_BASE: 3,
  /** Amplitude of the sin wave modulating line width */
  LINE_WIDTH_AMP: 2,
  LINE_WAVE_SPEED: 0.003,
  TIP_GLOW_RADIUS: 16,
  COMPOSITE: 'screen' as GlobalCompositeOperation,
} as const;

// ── Particle Cloud palette ────────────────────────────

export const PCLOUD = {
  WHITE: 'rgba(255, 255, 255, ',
  CYAN: 'rgba(100, 220, 255, ',
  /** Particles per landmark */
  PARTICLES_PER_JOINT: 8,
  /** Hard cap to prevent memory issues */
  MAX_PARTICLES: 300,
  /** How fast particles drift with Brownian noise */
  DRIFT_SPEED: 0.8,
  /** Base size before z-depth scaling */
  BASE_SIZE: 2,
  /** z-depth size multiplier */
  Z_SIZE_SCALE: 3,
  ALPHA_MIN: 0.2,
  ALPHA_MAX: 0.6,
  GLOW_BLUR: 8,
} as const;
