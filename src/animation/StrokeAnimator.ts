// ── StrokeAnimator ──────────────────────────────────
//
// Manages per-stroke animations and computes per-frame transforms.
// Designed to be zero-overhead when no animations are active.

import type { AnimationKeyframe, AnimationParams, AnimationTransform, StrokeAnimation } from './types.js';

// Default amplitude values per animation type
const DEFAULT_AMPLITUDE: Record<string, number> = {
  // ── Legacy types ────────────────────────────────────────────────────────
  pulse: 0.15,      // scale factor
  float: 20,        // pixels
  bounce: 30,       // pixels
  fly: 200,         // pixels
  shake: 10,        // pixels
  fadeOut: 0,       // not used
  rotate: 0,        // not used
  // ── Locomotion primitives (drawing-mode, task #112) ──────────────────────
  drift: 0.02,      // NDC fraction per second
  traverse: 0.5,    // fraction of canvas width per cycle
  oscillate: 20,    // pixels peak displacement
  orbit: 30,        // pixels orbit radius
  swim: 18,         // pixels lateral sinusoid amplitude
  flutter: 14,      // pixels irregular sinusoid amplitude
  fall: 0.3,        // fraction of canvas height per cycle
  rise: 0.3,        // fraction of canvas height per cycle
  random: 15,       // pixels Brownian step
  // ── Modulation primitives (drawing-mode, task #112) ──────────────────────
  // shine/glow/sparkle drive glowIntensity as their primary signal, but they
  // also now modulate scale + opacity so that `static + modulation` profiles
  // (e.g. house, civic buildings) read as visible breathing motion instead of
  // looking frozen. Amplitudes below are the scale amplitude the switch-cases
  // treat as "default" when params.amplitude is not provided; the glowIntensity
  // amplitude is hard-coded inside each case because it is tuned to the
  // renderer's shadowBlur + globalAlpha curve.
  sparkle: 0.03,    // scale breathing amplitude (±3%) — particle twinkle (primary signal is ParticleSystem emission)
  shine: 0.03,      // scale breathing amplitude (±3%) — gentle luminance pulse
  bend: 6,          // pixels lateral bend displacement
  bloom: 0.12,      // scale expansion factor
  drip: 0,          // renderer-side effect; no core translation
  glow: 0.04,       // scale breathing amplitude (±4%) — edge-emissive breathing
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
 *
 * Phase 2 of rendering-pipeline-v2 (docs/plans/rendering-pipeline-v2.md §6
 * Phase 2) collapses this class's hot path to zero-allocation under the
 * out-param overload. The three machinery pieces:
 *
 *   1. `strokeIndex: Map<strokeId, Set<animId>>` — reverse index maintained
 *      in `addAnimation` / `removeAnimation` / `removeByStrokeId` + on-the-
 *      fly completed-animation purge. Lets `getTransform(strokeId, …)`
 *      visit ONLY the animations targeting `strokeId` instead of scanning
 *      every registered animation with `.includes()`.
 *
 *   2. `transformBuffer` — module-scoped scratch `AnimationTransform`
 *      passed into `computeAnimationTransform(params, t, elapsed, out)`
 *      so the per-call computation writes in place instead of returning a
 *      fresh object.
 *
 *   3. `completedIdsBuffer` — class field drained via `.length = 0` so the
 *      per-frame temporary no longer allocates.
 *
 * Callers that opt into the out-param overload
 * (`getTransform(strokeId, now, out): boolean`) get the full zero-alloc
 * hot path; callers holding the legacy `getTransform(strokeId, now)`
 * signature continue to receive a freshly allocated `AnimationTransform`
 * object (or `null`). The legacy signature is retained verbatim so every
 * pre-Phase-2 test and consumer keeps working bit-identically.
 */
export class StrokeAnimator {
  private animations = new Map<string, StrokeAnimation>();
  /** Phase 2: `strokeId → Set<animId>` reverse index. */
  private strokeIndex = new Map<string, Set<string>>();
  /** Phase 2: pre-allocated buffer for `computeAnimationTransform`. */
  private readonly transformBuffer: AnimationTransform = {
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    glowIntensity: 1,
  };
  /** Phase 2: class-field ids buffer drained via `.length = 0`. */
  private readonly completedIdsBuffer: string[] = [];
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
    // Phase 2: reverse index so `getTransform(strokeId, …)` is O(1) on
    // strokeId + O(K) on matching animations, instead of O(A × K) scanning
    // every animation with `.includes(strokeId)`.
    for (const sid of strokeIds) {
      let set = this.strokeIndex.get(sid);
      if (!set) {
        set = new Set();
        this.strokeIndex.set(sid, set);
      }
      set.add(id);
    }
    return id;
  }

  /** Remove a specific animation by ID */
  removeAnimation(animationId: string): void {
    const anim = this.animations.get(animationId);
    if (anim) {
      // Phase 2: detach from strokeIndex entries for every stroke this
      // animation was targeting. Empty sets collapse so `getTransform`'s
      // "no match" path stays O(1).
      for (const sid of anim.strokeIds) {
        const set = this.strokeIndex.get(sid);
        if (set) {
          set.delete(animationId);
          if (set.size === 0) this.strokeIndex.delete(sid);
        }
      }
    }
    this.animations.delete(animationId);
  }

  /** Remove all animations targeting a specific stroke ID */
  removeByStrokeId(strokeId: string): void {
    // Phase 2: walk through strokeIndex instead of scanning every
    // animation — keeps this path O(#anims-on-stroke), not O(total).
    const animIds = this.strokeIndex.get(strokeId);
    if (!animIds || animIds.size === 0) return;
    // Snapshot to avoid mutating the set we're iterating.
    const ids = Array.from(animIds);
    for (const animId of ids) {
      const anim = this.animations.get(animId);
      if (!anim) continue;
      const idx = anim.strokeIds.indexOf(strokeId);
      if (idx !== -1) anim.strokeIds.splice(idx, 1);
      if (anim.strokeIds.length === 0) {
        this.animations.delete(animId);
      }
    }
    // The reverse index entry for this strokeId is entirely gone.
    // Entries for other strokeIds (if the animation targeted multiple)
    // still correctly reference the surviving animation.
    this.strokeIndex.delete(strokeId);
  }

  /**
   * Compute the current transform for a stroke at the given timestamp.
   * When multiple animations target the same stroke, transforms are
   * composed additively for translation/rotation and multiplicatively
   * for scale/opacity/brightness.
   *
   * Two signatures (Phase 2 additive overload):
   *
   *   `getTransform(strokeId, now)` — legacy shape; returns a freshly
   *   allocated `AnimationTransform | null`. Preserved bit-for-bit so
   *   every pre-Phase-2 consumer keeps working without migration.
   *
   *   `getTransform(strokeId, now, out)` — hot-path shape; writes the
   *   composed transform into `out` in place and returns `true` when a
   *   match is found, `false` otherwise. Zero object allocation per
   *   call once the caller pre-allocates `out`.
   */
  getTransform(strokeId: string, now: number): AnimationTransform | null;
  getTransform(strokeId: string, now: number, out: AnimationTransform): boolean;
  getTransform(
    strokeId: string,
    now: number,
    out?: AnimationTransform,
  ): AnimationTransform | null | boolean {
    const animIds = this.strokeIndex.get(strokeId);
    if (!animIds || animIds.size === 0) {
      return out !== undefined ? false : null;
    }

    let hasMatch = false;
    let tx = 0;
    let ty = 0;
    let scale = 1;
    let rotation = 0;
    let opacity = 1;
    let glowIntensity = 1;
    const buf = this.transformBuffer;

    for (const animId of animIds) {
      const anim = this.animations.get(animId);
      if (!anim || !anim.active) continue;

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
          this.completedIdsBuffer.push(animId);
        }
      }

      this.computeAnimationTransform(anim.params, t, elapsed, buf);

      // Compose: additive translation, multiplicative scale/opacity/brightness, additive rotation
      tx += buf.translateX;
      ty += buf.translateY;
      scale *= buf.scale;
      rotation += buf.rotation;
      opacity *= buf.opacity;
      glowIntensity *= buf.glowIntensity;
    }

    // Purge completed non-repeating animations to prevent memory leaks
    // AND keep the reverse index consistent so a later getTransform on the
    // same stroke doesn't spend time revisiting a corpse entry.
    if (this.completedIdsBuffer.length > 0) {
      for (const id of this.completedIdsBuffer) {
        const anim = this.animations.get(id);
        if (anim) {
          for (const sid of anim.strokeIds) {
            const set = this.strokeIndex.get(sid);
            if (set) {
              set.delete(id);
              if (set.size === 0) this.strokeIndex.delete(sid);
            }
          }
          this.animations.delete(id);
        }
      }
      this.completedIdsBuffer.length = 0;
    }

    if (!hasMatch) return out !== undefined ? false : null;

    if (out !== undefined) {
      out.translateX = tx;
      out.translateY = ty;
      out.scale = scale;
      out.rotation = rotation;
      out.opacity = opacity;
      out.glowIntensity = glowIntensity;
      return true;
    }
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
    this.strokeIndex.clear();
    this.completedIdsBuffer.length = 0;
  }

  /**
   * Serialize all active animations into a wire-safe form. Live state
   * (`startTime`, `active`) is intentionally omitted — animations restart
   * at t=0 when {@link StrokeAnimator.restore} replays them.
   */
  serialize(): Array<{ strokeIds: string[]; params: AnimationParams }> {
    const out: Array<{ strokeIds: string[]; params: AnimationParams }> = [];
    for (const anim of this.animations.values()) {
      if (!anim.active) continue;
      out.push({
        strokeIds: [...anim.strokeIds],
        params: { ...anim.params },
      });
    }
    return out;
  }

  /**
   * Restore animations from a serialized snapshot. Clears any existing
   * animations first. Each entry becomes a fresh animation with its
   * `startTime` set to the current `performance.now()`.
   */
  restore(entries: Array<{ strokeIds: string[]; params: AnimationParams }>): void {
    // Phase 2: reuse `clear()` so the reverse index is cleared too. A bare
    // `this.animations.clear()` would leave the index pointing at stale
    // animIds, producing silent misses on the next getTransform.
    this.clear();
    for (const entry of entries) {
      this.addAnimation(entry.strokeIds, entry.params);
    }
  }

  // ── Private: Animation Calculations ─────────────────

  /** Phase 2: writes the per-animation transform in place into `identity`.
   *  Every switch case that previously allocated an `identity` object at
   *  the top of the function now reuses the caller-provided buffer. The
   *  parameter name `identity` is preserved so the body of every switch
   *  case stays textually unchanged, minimising diff surface for the
   *  per-type animation math (which is locked by the primitive-amplitude
   *  regression tests). */
  private computeAnimationTransform(
    params: AnimationParams,
    t: number,
    elapsed: number,
    identity: AnimationTransform,
  ): void {
    // In-place reset — starts every call from the neutral transform.
    identity.translateX = 0;
    identity.translateY = 0;
    identity.scale = 1;
    identity.rotation = 0;
    identity.opacity = 1;
    identity.glowIntensity = 1;

    const amplitude = params.amplitude ?? DEFAULT_AMPLITUDE[params.type] ?? 0;

    switch (params.type) {
      case 'pulse':
        // Scale oscillates between 1.0 and 1.0+amplitude using sin(t * 2pi)
        // Also subtle opacity pulse for a "breathing" effect
        identity.scale = 1 + amplitude * Math.sin(t * TWO_PI);
        identity.opacity = 0.8 + 0.2 * Math.sin(t * TWO_PI);
        break;

      case 'sparkle': {
        // Gentle breathing + glow twinkle. The primary visual is the
        // ParticleSystem emission (sparkle particles), but the stroke itself
        // also breathes subtly (±3% scale + ±10% opacity) so that even if
        // particles are culled / disabled the stroke never looks frozen.
        const phase = Math.sin(t * TWO_PI);
        identity.scale = 1 + 0.03 * phase;
        identity.opacity = 0.9 + 0.1 * phase;
        identity.glowIntensity = 1 + 0.4 * phase;
        break;
      }

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

      // ── Locomotion primitives (drawing-mode, task #112) ─────────────────

      case 'drift': {
        // Slow directional translation. Direction encoded in params.direction
        // (horizontal = X axis, vertical = Y axis). Uses elapsed time so
        // displacement accumulates — non-looping callers should control
        // duration to reset via repeat.
        const driftAmp = amplitude;
        const dir = params.direction ?? 'horizontal';
        const cyclePos = Math.sin(t * TWO_PI);
        if (dir === 'horizontal') {
          identity.translateX = driftAmp * cyclePos;
        } else {
          identity.translateY = driftAmp * cyclePos;
        }
        break;
      }

      case 'traverse': {
        // One-shot end-to-end travel across the canvas. Uses linear progress.
        // amplitude = travel distance in pixels. Fades in first 10%, out last 20%.
        const dir = params.direction ?? 'horizontal';
        const travelAmp = amplitude;
        const progress = t; // linear 0→1
        if (dir === 'horizontal') {
          identity.translateX = -travelAmp * 0.5 + travelAmp * progress;
        } else {
          identity.translateY = -travelAmp * 0.5 + travelAmp * progress;
        }
        if (t < 0.1) {
          identity.opacity = t / 0.1;
        } else if (t > 0.8) {
          identity.opacity = 1 - (t - 0.8) / 0.2;
        }
        break;
      }

      case 'oscillate': {
        // Back-and-forth pendulum swing around the origin. Symmetric sine.
        const dir = params.direction ?? 'horizontal';
        const oscAmp = amplitude;
        const oscVal = oscAmp * Math.sin(t * TWO_PI);
        if (dir === 'horizontal') {
          identity.translateX = oscVal;
        } else {
          identity.translateY = oscVal;
        }
        break;
      }

      case 'orbit': {
        // Circular path around the origin. t maps 0→1 to full revolution.
        const orbitR = amplitude;
        identity.translateX = orbitR * Math.cos(t * TWO_PI);
        identity.translateY = orbitR * Math.sin(t * TWO_PI);
        break;
      }

      case 'swim': {
        // Horizontal advance with lateral sinusoidal undulation (fish motion).
        // X = forward progress, Y = sinusoid side-to-side.
        const swimAmp = amplitude;
        const swimX = swimAmp * t; // forward drift
        const swimY = swimAmp * 0.4 * Math.sin(t * TWO_PI * 2);
        identity.translateX = swimX;
        identity.translateY = swimY;
        break;
      }

      case 'flutter': {
        // Irregular-feeling sinusoid: combines two sine waves at coprime
        // frequencies to produce the unpredictable quality of insect flight.
        const flutterAmp = amplitude;
        identity.translateX = flutterAmp * 0.6 * Math.sin(t * TWO_PI * 1.7);
        identity.translateY = flutterAmp * Math.sin(t * TWO_PI) + flutterAmp * 0.3 * Math.sin(t * TWO_PI * 2.3);
        break;
      }

      case 'fall': {
        // Gravity-aligned descent with slight horizontal sway (leaf / raindrop).
        const fallAmp = amplitude;
        identity.translateY = fallAmp * t;
        identity.translateX = fallAmp * 0.15 * Math.sin(t * TWO_PI * 2.5);
        if (t > 0.85) {
          identity.opacity = 1 - (t - 0.85) / 0.15;
        }
        break;
      }

      case 'rise': {
        // Anti-gravity ascent with gentle sway (balloon / smoke / bubble).
        const riseAmp = amplitude;
        identity.translateY = -riseAmp * t;
        identity.translateX = riseAmp * 0.12 * Math.sin(t * TWO_PI * 1.8);
        if (t > 0.85) {
          identity.opacity = 1 - (t - 0.85) / 0.15;
        }
        break;
      }

      case 'random': {
        // Brownian walk: deterministic per-frame noise derived from elapsed ms
        // so it is reproducible for a given startTime (no real RNG per frame).
        // Uses a pair of Lissajous-like functions at irrational-ratio frequencies
        // to approximate Brownian character without actual randomness.
        const randAmp = amplitude;
        const phi1 = elapsed * 0.003;
        const phi2 = elapsed * 0.00517;
        identity.translateX = randAmp * Math.sin(phi1) * Math.cos(phi2 * 1.3);
        identity.translateY = randAmp * Math.cos(phi1 * 0.7) * Math.sin(phi2);
        break;
      }

      // ── Modulation primitives (drawing-mode, task #112) ──────────────────

      case 'shine': {
        // Luminance pulsing — the stroke brightens and dims rhythmically.
        // Drives glowIntensity (shadowBlur + outer-pass alpha) as the primary
        // signal, and modulates scale + opacity subtly so the stroke reads as
        // "breathing" even when strokes have no glow style configured or when
        // the effect preset uses a flat shadow. amplitude (DEFAULT 0.03) is
        // the scale breathing band; glowIntensity amp is fixed at 1.2.
        const phase = Math.sin(t * TWO_PI);
        const shineGlowAmp = 1.2;
        identity.glowIntensity = 1 + shineGlowAmp * (0.5 + 0.5 * phase);
        identity.scale = 1 + amplitude * phase;
        identity.opacity = 0.9 + 0.1 * phase;
        break;
      }

      case 'bend': {
        // Lateral flex deformation — simulates a branch swaying in wind.
        // Expressed as a translateX oscillation; the renderer may apply
        // additional shear if it supports per-stroke warp.
        const bendAmp = amplitude;
        identity.translateX = bendAmp * Math.sin(t * TWO_PI);
        identity.translateY = bendAmp * 0.2 * Math.sin(t * TWO_PI * 2);
        break;
      }

      case 'bloom': {
        // Radial expansion — scale pulses outward then returns.
        // Models a flower opening or an explosion.
        const bloomAmp = amplitude;
        const bloomPeak = Math.sin(t * Math.PI); // 0→1→0 single arch
        identity.scale = 1 + bloomAmp * bloomPeak;
        identity.opacity = 1 - 0.3 * (1 - bloomPeak); // slightly fades at extremes
        break;
      }

      case 'drip': {
        // Liquid drip: a subtle downward displacement pulse.
        // Renderer-side particle emission (droplets) is signalled via
        // glowIntensity > 1.5 as a cheap sideband; the main transform is
        // a small periodic Y nudge to convey the "about to drip" tension.
        identity.translateY = amplitude * 0.5 * Math.abs(Math.sin(t * TWO_PI));
        // Signal renderer to emit a drip particle near the peak
        if (t > 0.45 && t < 0.55) {
          identity.glowIntensity = 2.0; // drip emission signal
        }
        break;
      }

      case 'glow': {
        // Edge-emissive "breathing neon" pulse. Historically this primitive
        // only modulated glowIntensity, which drives shadowBlur + the outer
        // glow-pass alpha — a channel the renderer's main stroke pass ignores
        // entirely. On effect presets with a minimal glow style, the stroke
        // therefore looked frozen. We now also modulate scale (±amplitude,
        // default ±4%) and opacity (0.85 → 1.0) so the stroke itself breathes
        // with the glow. amplitude is the scale breathing band; the glow
        // intensity swing is fixed at ±0.5 around 1.3 to match the historical
        // look.
        const phase = Math.sin(t * TWO_PI);
        identity.glowIntensity = 1.3 + 0.5 * phase;
        identity.scale = 1 + amplitude * phase;
        identity.opacity = 0.85 + 0.15 * (0.5 + 0.5 * phase);
        break;
      }
    }
    // In-place write — no return value, the caller owns the buffer.
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
