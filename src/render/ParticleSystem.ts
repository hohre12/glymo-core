import type { EffectStyle, Particle, Stroke, StrokePoint } from '../types.js';
import { EFFECT_PRESETS } from '../types.js';

// ── Constants ────────────────────────────────────────

/** Max particles in pool */
const MAX_PARTICLES = 800;

/** Particle spawn rate (particles per point) */
const PARTICLES_PER_POINT = 4;

/** Extra particles spawned at first and last points of a stroke */
const ENDPOINT_BURST = 15;

/** Particle base decay rate */
const PARTICLE_DECAY = 0.012;

/** Particle base size */
const PARTICLE_SIZE = 3;

/** Particle velocity spread */
const PARTICLE_VELOCITY = 2.5;

// ── ParticleSystem ──────────────────────────────────

/** Manages the particle pool: spawning, updating, and rendering. */
export class ParticleSystem {
  private particles: Particle[] = [];

  /** Spawn particles along a completed stroke with endpoint bursts */
  spawnForStroke(stroke: Stroke): void {
    const style = EFFECT_PRESETS[stroke.effect];
    const points = stroke.smoothed;
    if (points.length === 0) return;

    const step = Math.max(1, Math.floor(points.length / MAX_PARTICLES));

    // Endpoint burst at stroke start
    this.spawnBurst(points[0]!, style, ENDPOINT_BURST);

    for (let i = 0; i < points.length; i += step) {
      if (this.particles.length >= MAX_PARTICLES) break;
      this.spawnAt(points[i]!, style);
    }

    // Endpoint burst at stroke end
    this.spawnBurst(points[points.length - 1]!, style, ENDPOINT_BURST);
  }

  /** Update particle positions and lifetimes, then render survivors */
  updateAndRender(
    ctx: CanvasRenderingContext2D,
    dt: number,
    degraded = false,
  ): void {
    const decay = dt > 0 ? dt / 16 : 1; // Normalize to 60fps

    // In-place removal: iterate backwards and swap-remove dead particles to avoid
    // allocating a new array every frame.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.x += p.vx * decay;
      p.y += p.vy * decay;
      p.life -= p.decay * decay;
      if (p.life <= 0) {
        // Swap with last element and pop (O(1) removal)
        this.particles[i] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
      }
    }

    // In degraded mode, render every other particle to reduce draw calls
    const step = degraded ? 2 : 1;

    ctx.save();
    for (let i = 0; i < this.particles.length; i += step) {
      const p = this.particles[i]!;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Clear all particles */
  clear(): void {
    this.particles = [];
  }

  // ── Private ────────────────────────────────────────

  private spawnBurst(point: StrokePoint, style: EffectStyle, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;

      this.particles.push({
        x: point.x,
        y: point.y,
        vx: (Math.random() - 0.5) * PARTICLE_VELOCITY * 2,
        vy: (Math.random() - 0.5) * PARTICLE_VELOCITY * 2,
        life: 1.0,
        decay: PARTICLE_DECAY * 0.5 + Math.random() * PARTICLE_DECAY,
        size: PARTICLE_SIZE * 1.5 + Math.random() * PARTICLE_SIZE,
        color: style.particleColor,
      });
    }
  }

  private spawnAt(
    point: StrokePoint,
    style: EffectStyle,
    overrides?: { sizeMultiplier?: number; velocityMultiplier?: number },
  ): void {
    const sizeMult = overrides?.sizeMultiplier ?? 1.0;
    const velMult = overrides?.velocityMultiplier ?? 1.0;

    for (let j = 0; j < PARTICLES_PER_POINT; j++) {
      if (this.particles.length >= MAX_PARTICLES) return;

      this.particles.push({
        x: point.x,
        y: point.y,
        vx: (Math.random() - 0.5) * PARTICLE_VELOCITY * velMult,
        vy: (Math.random() - 0.5) * PARTICLE_VELOCITY * velMult,
        life: 1.0,
        decay: PARTICLE_DECAY + Math.random() * PARTICLE_DECAY,
        size: (PARTICLE_SIZE + Math.random() * PARTICLE_SIZE) * sizeMult,
        color: style.particleColor,
      });
    }
  }

  /** Spawn a burst of particles at an arbitrary canvas position (e.g. text overlay centre) */
  spawnBurstAtPosition(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * PARTICLE_VELOCITY * 3,
        vy: (Math.random() - 0.5) * PARTICLE_VELOCITY * 3,
        life: 1.0,
        decay: PARTICLE_DECAY * 0.4 + Math.random() * PARTICLE_DECAY,
        size: PARTICLE_SIZE * 2 + Math.random() * PARTICLE_SIZE,
        color,
      });
    }
  }

  /**
   * Spawn sparkle particles at random positions along a stroke path.
   * Creates bright, short-lived particles that flash in-place — the core of the sparkle effect.
   */
  spawnSparkleAlongStroke(points: StrokePoint[], color: string, count: number = 3): void {
    if (points.length === 0) return;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;

      const idx = Math.floor(Math.random() * points.length);
      const pt = points[idx]!;

      // Randomize size: mix of tiny twinkles and medium flashes
      const isBigFlash = Math.random() < 0.3;
      const size = isBigFlash
        ? PARTICLE_SIZE * 2.5 + Math.random() * PARTICLE_SIZE * 2
        : PARTICLE_SIZE * 0.8 + Math.random() * PARTICLE_SIZE;

      this.particles.push({
        x: pt.x + (Math.random() - 0.5) * 12,
        y: pt.y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4 - 0.2, // slight upward drift
        life: 1.0,
        decay: 0.035 + Math.random() * 0.025, // fast fade — sparkle is brief
        size,
        color: isBigFlash ? '#ffffff' : color, // big flashes are white
      });
    }
  }

  /** Spawn a dense burst of particles along the entire stroke at morph start */
  spawnBurstForMorph(stroke: Pick<Stroke, 'raw' | 'smoothed' | 'effect'>): void {
    const style = EFFECT_PRESETS[stroke.effect];
    if (!style) return;
    const points = stroke.smoothed.length > 0 ? stroke.smoothed : stroke.raw;

    // Dense burst along entire stroke
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const count = 3;
      for (let j = 0; j < count; j++) {
        this.spawnAt(p, style, {
          sizeMultiplier: 1.5 + Math.random(),
          velocityMultiplier: 2.5 + Math.random() * 2,
        });
      }
    }

    // Extra big bursts at endpoints
    if (points.length > 0) {
      this.spawnBurst(points[0]!, style, 20);
      this.spawnBurst(points[points.length - 1]!, style, 20);
    }
  }
}
