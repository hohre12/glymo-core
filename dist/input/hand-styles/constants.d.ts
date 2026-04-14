import { INDEX_TIP, THUMB_TIP } from '../../gesture/constants.js';
export { INDEX_TIP, THUMB_TIP };
/**
 * MediaPipe hand landmark bone connections (pairs of landmark indices).
 * Extracted from HandVisualizer.ts for reuse across all styles.
 */
export declare const HAND_CONNECTIONS: ReadonlyArray<[number, number]>;
/**
 * Landmark index chains per finger, from base to tip.
 * Useful for styles that render continuous curves along each finger.
 */
export declare const FINGER_CHAINS: ReadonlyArray<ReadonlyArray<number>>;
/** Landmark indices of all 5 fingertips */
export declare const FINGER_TIPS: ReadonlyArray<number>;
export declare const NEON: {
    readonly ACCENT: "rgba(0, 255, 204, ";
    readonly ACCENT_HEX: "#00ffcc";
    readonly ACCENT_DIM: "rgba(0, 255, 204, 0.15)";
    readonly PINCH_ACTIVE: "rgba(0, 255, 204, 1.0)";
    readonly PINCH_INACTIVE: "rgba(255, 100, 100, 0.6)";
    readonly BONE_WIDTH: 2.5;
    readonly BONE_GLOW_WIDTH: 6;
    readonly JOINT_RADIUS: 4;
    readonly TIP_RADIUS: 6;
    readonly GLOW_RADIUS: 24;
    readonly GLOW_PULSE_SPEED: 0.005;
};
export declare const CRYSTAL: {
    readonly ICE_BLUE: "#88ccff";
    readonly WHITE: "#ffffff";
    readonly PURPLE: "#aa88ff";
    readonly HIGHLIGHT: "rgba(255, 255, 255, 0.85)";
    readonly SHARD_BASE: "rgba(136, 204, 255, ";
    readonly SHADOW: "rgba(170, 136, 255, ";
    readonly BONE_WIDTH: 1.5;
    readonly JOINT_DIAMOND_SIZE: 5;
    readonly TIP_GLOW_RADIUS: 14;
    readonly SHIMMER_SPEED: 3;
};
export declare const FLAME: {
    readonly YELLOW: "#ffcc00";
    readonly ORANGE: "#ff6600";
    readonly RED: "#ff0000";
    readonly BONE_GLOW: "rgba(255, 80, 0, 0.5)";
    readonly BONE_COLOR: "rgba(255, 120, 20, 0.7)";
    readonly BONE_WIDTH: 2;
    readonly BONE_GLOW_WIDTH: 5;
    /** Maximum particles across all joints */
    readonly MAX_PARTICLES: 200;
    /** Particles spawned per joint per frame */
    readonly SPAWN_RATE: 5;
    /** Number of active joints that spawn particles (all 21) */
    readonly JOINT_COUNT: 21;
    /** Particle lifetime in frames at 60fps */
    readonly PARTICLE_LIFETIME: 30;
};
export declare const AURORA: {
    readonly HUE_SPEED: 0.05;
    readonly HUE_SHIFT_PER_FINGER: 60;
    readonly SATURATION: 80;
    readonly LIGHTNESS: 60;
    /** Number of rendering passes (layers) per finger */
    readonly LAYER_COUNT: 3;
    /** Base line width */
    readonly LINE_WIDTH_BASE: 3;
    /** Amplitude of the sin wave modulating line width */
    readonly LINE_WIDTH_AMP: 2;
    readonly LINE_WAVE_SPEED: 0.003;
    readonly TIP_GLOW_RADIUS: 16;
    readonly COMPOSITE: GlobalCompositeOperation;
};
export declare const PCLOUD: {
    readonly WHITE: "rgba(255, 255, 255, ";
    readonly CYAN: "rgba(100, 220, 255, ";
    /** Particles per landmark */
    readonly PARTICLES_PER_JOINT: 8;
    /** Hard cap to prevent memory issues */
    readonly MAX_PARTICLES: 300;
    /** How fast particles drift with Brownian noise */
    readonly DRIFT_SPEED: 0.8;
    /** Base size before z-depth scaling */
    readonly BASE_SIZE: 2;
    /** z-depth size multiplier */
    readonly Z_SIZE_SCALE: 3;
    readonly ALPHA_MIN: 0.2;
    readonly ALPHA_MAX: 0.6;
    readonly GLOW_BLUR: 8;
};
