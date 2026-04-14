export type AnimationType = 'pulse' | 'sparkle' | 'float' | 'bounce' | 'rotate' | 'fly' | 'shake' | 'fadeOut' | 'keyframe';
/** A single keyframe in a keyframe-based animation */
export interface AnimationKeyframe {
    t: number;
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
    opacity?: number;
    glow?: number;
}
export interface AnimationParams {
    type: AnimationType;
    duration: number;
    repeat?: boolean;
    delay?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
    amplitude?: number;
    speed?: number;
    particleCount?: number;
    keyframes?: AnimationKeyframe[];
}
export interface StrokeAnimation {
    strokeIds: string[];
    params: AnimationParams;
    startTime: number;
    active: boolean;
}
export interface AnimationTransform {
    translateX: number;
    translateY: number;
    scale: number;
    rotation: number;
    opacity: number;
    glowIntensity: number;
}
