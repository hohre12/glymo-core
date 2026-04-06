import { HandStyleBase, HandStyleConfig, HandStyleName } from './types.js';
import { PCLOUD } from './constants.js';

/** A single orbiting cloud particle */
interface CloudParticle {
  /** Current position (canvas pixels) */
  x: number;
  y: number;
  /** Drift velocity (Brownian noise approximation) */
  vx: number;
  vy: number;
  /** Target landmark index this particle belongs to */
  landmarkIdx: number;
  /** Size in pixels (before z-depth scaling) */
  baseSize: number;
  /** Alpha: 0.2–0.6 */
  alpha: number;
  /** Whether to use cyan vs white tint */
  isCyan: boolean;
  /** Life: 1.0 → 0.0 */
  life: number;
  /** Decay per frame */
  decay: number;
}

/**
 * ParticleCloudStyle — soft orbiting cloud of particles around each landmark.
 *
 * Visual characteristics:
 *   - 6-10 particles per landmark orbit with Brownian noise drift
 *   - Size scales with z-coordinate (closer landmarks = larger particles)
 *   - Soft white/cyan particles with varying alpha (0.2–0.6)
 *   - Glow via shadowBlur
 *   - No bone connections — pure particle cloud
 *   - Hard cap: 300 particles total
 */
export class ParticleCloudStyle extends HandStyleBase {
  readonly name: HandStyleName = 'particle-cloud';

  private readonly particles: CloudParticle[] = [];

  draw(config: HandStyleConfig): void {
    const { landmarks, canvasWidth: w, canvasHeight: h, ctx } = config;

    this.updateAndSpawn(landmarks, w, h);
    this.renderParticles(ctx, landmarks, w, h);
  }

  destroy(): void {
    this.particles.length = 0;
  }

  // ── Spawn + update ──────────────────────────────────────────────────────────

  private updateAndSpawn(
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
  ): void {
    const decayRate = 1 / 60; // 1-second lifetime at 60fps

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;

      // Brownian drift
      p.vx += (Math.random() - 0.5) * 0.4;
      p.vy += (Math.random() - 0.5) * 0.4;
      // Drag to keep them near their landmark
      const lm = landmarks[p.landmarkIdx];
      if (lm) {
        const lx = (1 - lm.x) * w;
        const ly = lm.y * h;
        p.vx += (lx - p.x) * 0.04; // spring toward landmark
        p.vy += (ly - p.y) * 0.04;
      }
      p.vx *= 0.88; // drag
      p.vy *= 0.88;
      p.x += p.vx;
      p.y += p.vy;

      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
      }
    }

    // Spawn new particles to maintain steady state
    if (this.particles.length >= PCLOUD.MAX_PARTICLES) return;

    const budget = PCLOUD.MAX_PARTICLES - this.particles.length;
    const perJoint = Math.min(
      Math.floor(budget / Math.max(landmarks.length, 1)),
      PCLOUD.PARTICLES_PER_JOINT,
    );

    for (let i = 0; i < landmarks.length && this.particles.length < PCLOUD.MAX_PARTICLES; i++) {
      const lm = landmarks[i]!;
      const lx = (1 - lm.x) * w;
      const ly = lm.y * h;

      for (let p = 0; p < perJoint; p++) {
        const spread = 12;
        this.particles.push({
          x: lx + (Math.random() - 0.5) * spread,
          y: ly + (Math.random() - 0.5) * spread,
          vx: (Math.random() - 0.5) * PCLOUD.DRIFT_SPEED,
          vy: (Math.random() - 0.5) * PCLOUD.DRIFT_SPEED,
          landmarkIdx: i,
          baseSize: PCLOUD.BASE_SIZE + Math.random() * 1.5,
          alpha: PCLOUD.ALPHA_MIN + Math.random() * (PCLOUD.ALPHA_MAX - PCLOUD.ALPHA_MIN),
          isCyan: Math.random() > 0.4,
          life: 1.0,
          decay: decayRate * (0.8 + Math.random() * 0.4),
        });
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  private renderParticles(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    _w: number,
    _h: number,
  ): void {
    ctx.save();
    ctx.shadowBlur = PCLOUD.GLOW_BLUR;

    for (const p of this.particles) {
      const lm = landmarks[p.landmarkIdx];
      // Size: closer (lower z) = larger
      const zDepth = lm ? Math.max(0, Math.min(1, 1 - lm.z)) : 0.5;
      const size = p.baseSize + zDepth * PCLOUD.Z_SIZE_SCALE;
      const alpha = p.alpha * p.life;

      const color = p.isCyan
        ? PCLOUD.CYAN + `${alpha})`
        : PCLOUD.WHITE + `${alpha})`;

      ctx.shadowColor = p.isCyan ? 'rgba(100, 220, 255, 0.4)' : 'rgba(255, 255, 255, 0.3)';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
