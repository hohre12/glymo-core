// ── StrokeAnimator ──────────────────────────────────
//
// Manages per-stroke animations and computes per-frame transforms.
// Designed to be zero-overhead when no animations are active.

import type { AnimationKeyframe, AnimationParams, AnimationTransform, StrokeAnimation } from './types.js';

// Default amplitude values per animation type
const DEFAULT_AMPLITUDE: Record<string, number> = {
  pulse: 0.15,      // scale factor
  sparkle: 0.1,     // scale spike intensity
  float: 20,        // pixels
  bounce: 30,       // pixels
  fly: 200,         // pixels
  shake: 10,        // pixels
  fadeOut: 0,        // not used
  rotate: 0,        // not used
};

const DEFAULT_SPEED = 90; // degrees per second for rotate

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

/** Linear interpolation */
function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/**
 * StrokeAnimator manages active animations and computes per-frame
 * AnimationTransform for each animated stroke.
 */
export class StrokeAnimator {
  private animations = new Map<string, StrokeAnimation>();
  private nextId = 0;

  /**
   * Add an animation targeting one or more strokes.
   * Returns a unique animation ID for later removal.
   */
  addAnimation(strokeIds: string[], params: AnimationParams): string {
    const id = `anim_${this.nextId++}`;
    const animation: StrokeAnimation = {
      strokeIds,
      params,
      startTime: performance.now(),
      active: true,
    };
    this.animations.set(id, animation);
    return id;
  }

  /** Remove a specific animation by ID */
  removeAnimation(animationId: string): void {
    this.animations.delete(animationId);
  }

  /** Remove all animations targeting a specific stroke ID */
  removeByStrokeId(strokeId: string): void {
    for (const [id, anim] of this.animations) {
      const idx = anim.strokeIds.indexOf(strokeId);
      if (idx !== -1) {
        anim.strokeIds.splice(idx, 1);
        if (anim.strokeIds.length === 0) {
          this.animations.delete(id);
        }
      }
    }
  }

  /**
   * Compute the current transform for a stroke at the given timestamp.
   * Returns null if the stroke has no active animation.
   * When multiple animations target the same stroke, transforms are composed additively.
   */
  getTransform(strokeId: string, now: number): AnimationTransform | null {
    let hasMatch = false;
    let tx = 0;
    let ty = 0;
    let scale = 1;
    let rotation = 0;
    let opacity = 1;
    let glowIntensity = 1;
    const completedIds: string[] = [];

    for (const [animId, anim] of this.animations) {
      if (!anim.active) continue;
      if (!anim.strokeIds.includes(strokeId)) continue;

      const delay = anim.params.delay ?? 0;
      const elapsed = now - anim.startTime - delay;

      // Not yet started (waiting for delay)
      if (elapsed < 0) continue;

      hasMatch = true;

      const duration = anim.params.duration;
      let t: number;

      if (anim.params.repeat) {
        t = (elapsed % duration) / duration;
      } else {
        t = Math.min(elapsed / duration, 1);
        if (t >= 1) {
          anim.active = false;
          completedIds.push(animId);
        }
      }

      const transform = this.computeAnimationTransform(anim.params, t, elapsed);

      // Compose: additive translation, multiplicative scale/opacity/brightness, additive rotation
      tx += transform.translateX;
      ty += transform.translateY;
      scale *= transform.scale;
      rotation += transform.rotation;
      opacity *= transform.opacity;
      glowIntensity *= transform.glowIntensity;
    }

    // Purge completed non-repeating animations to prevent memory leaks
    for (const id of completedIds) {
      this.animations.delete(id);
    }

    if (!hasMatch) return null;

    return { translateX: tx, translateY: ty, scale, rotation, opacity, glowIntensity };
  }

  /** Check if any animations are currently active */
  hasAnimations(): boolean {
    for (const anim of this.animations.values()) {
      if (anim.active) return true;
    }
    return false;
  }

  /** Return stroke IDs that have an active sparkle-type animation */
  getSparkleStrokeIds(now: number): string[] {
    const ids: string[] = [];
    for (const anim of this.animations.values()) {
      if (!anim.active) continue;
      if (anim.params.type !== 'sparkle') continue;
      const delay = anim.params.delay ?? 0;
      if (now - anim.startTime - delay < 0) continue;
      for (const id of anim.strokeIds) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
    return ids;
  }

  /** Get the animation params for a stroke (first active animation found) */
  getAnimationParams(strokeId: string): AnimationParams | null {
    for (const [, anim] of this.animations) {
      if (!anim.active) continue;
      if (anim.strokeIds.includes(strokeId)) {
        return anim.params;
      }
    }
    return null;
  }

  /** Remove all animations */
  clear(): void {
    this.animations.clear();
  }

  // ── Private: Animation Calculations ─────────────────

  private computeAnimationTransform(
    params: AnimationParams,
    t: number,
    elapsed: number,
  ): AnimationTransform {
    const identity: AnimationTransform = {
      translateX: 0,
      translateY: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      glowIntensity: 1,
    };

    const amplitude = params.amplitude ?? DEFAULT_AMPLITUDE[params.type] ?? 0;

    switch (params.type) {
      case 'pulse':
        // Scale oscillates between 1.0 and 1.0+amplitude using sin(t * 2pi)
        // Also subtle opacity pulse for a "breathing" effect
        identity.scale = 1 + amplitude * Math.sin(t * TWO_PI);
        identity.opacity = 0.8 + 0.2 * Math.sin(t * TWO_PI);
        break;

      case 'sparkle':
        // Gentle glow breathing — the real sparkle comes from ParticleSystem
        identity.glowIntensity = 1 + 0.4 * Math.sin(t * TWO_PI);
        break;

      case 'float':
        // Gentle upward bobbing using sin wave
        identity.translateY = -amplitude * Math.sin(t * TWO_PI);
        break;

      case 'bounce':
        // Bounce using absolute sine — always moves upward
        identity.translateY = -amplitude * Math.abs(Math.sin(t * Math.PI));
        break;

      case 'rotate': {
        // Continuous rotation at specified degrees per second
        const speed = params.speed ?? DEFAULT_SPEED;
        identity.rotation = speed * DEG_TO_RAD * elapsed / 1000;
        break;
      }

      case 'fly': {
        // Linear translation in the specified direction with fadeOut at end
        const dir = params.direction ?? 'up';
        const progress = t; // linear interpolation
        switch (dir) {
          case 'up':    identity.translateY = -amplitude * progress; break;
          case 'down':  identity.translateY = amplitude * progress; break;
          case 'left':  identity.translateX = -amplitude * progress; break;
          case 'right': identity.translateX = amplitude * progress; break;
        }
        // Fade out in the last 30% of the animation
        if (t > 0.7) {
          identity.opacity = 1 - (t - 0.7) / 0.3;
        }
        break;
      }

      case 'shake':
        // Rapid diminishing oscillation
        identity.translateX = amplitude * Math.sin(t * 20 * Math.PI) * (1 - t);
        break;

      case 'fadeOut':
        // Linear fade from 1 to 0
        identity.opacity = 1 - t;
        break;

      case 'keyframe': {
        if (!params.keyframes || params.keyframes.length === 0) break;
        const kf = this.interpolateKeyframes(params.keyframes, t);
        identity.translateX = kf.x ?? 0;
        identity.translateY = kf.y ?? 0;
        identity.scale = kf.scale ?? 1;
        identity.rotation = kf.rotation ?? 0;
        identity.opacity = kf.opacity ?? 1;
        identity.glowIntensity = kf.glow ?? 1;
        break;
      }
    }

    return identity;
  }

  /**
   * Linearly interpolate between keyframes at time t (0-1).
   * Keyframes must be sorted by t. Values between keyframes are lerped.
   */
  private interpolateKeyframes(
    keyframes: AnimationKeyframe[],
    t: number,
  ): AnimationKeyframe {
    if (keyframes.length === 1) return keyframes[0]!;

    // Find the two surrounding keyframes
    let prev = keyframes[0]!;
    let next = keyframes[keyframes.length - 1]!;

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i]!.t && t <= keyframes[i + 1]!.t) {
        prev = keyframes[i]!;
        next = keyframes[i + 1]!;
        break;
      }
    }

    // Compute lerp factor between prev and next
    const span = next.t - prev.t;
    const f = span > 0 ? (t - prev.t) / span : 0;

    return {
      t,
      x: lerp(prev.x ?? 0, next.x ?? 0, f),
      y: lerp(prev.y ?? 0, next.y ?? 0, f),
      scale: lerp(prev.scale ?? 1, next.scale ?? 1, f),
      rotation: lerp(prev.rotation ?? 0, next.rotation ?? 0, f),
      opacity: lerp(prev.opacity ?? 1, next.opacity ?? 1, f),
      glow: lerp(prev.glow ?? 1, next.glow ?? 1, f),
    };
  }
}
