import { HandStyleBase, HandStyleConfig, HandStyleName } from './types.js';
import { HAND_CONNECTIONS, INDEX_TIP, THUMB_TIP, FLAME } from './constants.js';

/** A single flame particle */
interface FlameParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Remaining life: 1.0 (fresh) → 0.0 (dead) */
  life: number;
}

/**
 * FlameStyle — fire hand effect using additive particle blending.
 *
 * Visual characteristics:
 *   - Per-joint CPU particle system with upward drift
 *   - Particles color from yellow → orange → red as they age
 *   - Additive compositing (globalCompositeOperation = 'lighter') for hot glow
 *   - Bone lines rendered with orange-red glow
 *   - Hard cap of 200 particles total to keep memory stable
 */
export class FlameStyle extends HandStyleBase {
  readonly name: HandStyleName = 'flame';

  /** Active particle pool — reused across frames */
  private readonly particles: FlameParticle[] = [];

  draw(config: HandStyleConfig): void {
    const { landmarks, canvasWidth: w, canvasHeight: h, ctx, isPinching } = config;

    this.spawnParticles(landmarks, w, h);
    this.updateParticles();

    ctx.save();

    this.drawFlameBones(ctx, landmarks, w, h);
    this.drawParticles(ctx);
    this.drawPinchFlare(ctx, landmarks, w, h, isPinching);

    ctx.restore();
  }

  destroy(): void {
    this.particles.length = 0;
  }

  // ── Particle spawning ──────────────────────────────────────────────────────

  private spawnParticles(
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
  ): void {
    if (this.particles.length >= FLAME.MAX_PARTICLES) return;

    const budget = FLAME.MAX_PARTICLES - this.particles.length;
    const spawnTotal = Math.min(budget, landmarks.length * FLAME.SPAWN_RATE);
    const perJoint = Math.max(1, Math.floor(spawnTotal / Math.max(landmarks.length, 1)));

    for (let i = 0; i < landmarks.length && this.particles.length < FLAME.MAX_PARTICLES; i++) {
      const lm = landmarks[i]!;
      const jx = (1 - lm.x) * w;
      const jy = lm.y * h;

      for (let p = 0; p < perJoint; p++) {
        this.particles.push({
          x: jx + (Math.random() - 0.5) * 8,
          y: jy + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -(Math.random() * 2 + 0.5), // upward drift
          life: 1.0,
        });
      }
    }
  }

  // ── Particle physics update ────────────────────────────────────────────────

  private updateParticles(): void {
    const decayPerFrame = 1.0 / FLAME.PARTICLE_LIFETIME;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96; // slight horizontal drag
      p.life -= decayPerFrame;

      if (p.life <= 0) {
        // Swap-remove for O(1) deletion
        this.particles[i] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
      }
    }
  }

  // ── Particle rendering (additive blending) ─────────────────────────────────

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    const prevComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';

    for (const p of this.particles) {
      // Interpolate color: yellow (life=1) → orange (life=0.5) → red (life=0)
      const r = 255;
      const g = Math.round(p.life > 0.5
        ? 204 * ((p.life - 0.5) * 2) + 102 * (1 - (p.life - 0.5) * 2)  // yellow→orange
        : 102 * (p.life * 2));                                             // orange→red
      const b = 0;
      const alpha = p.life * 0.8;
      const size = 2 + p.life * 3;

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fill();
    }

    ctx.globalCompositeOperation = prevComposite;
  }

  // ── Flame bone lines ───────────────────────────────────────────────────────

  private drawFlameBones(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
  ): void {
    // Glow pass
    ctx.save();
    ctx.strokeStyle = FLAME.BONE_GLOW;
    ctx.lineWidth = FLAME.BONE_GLOW_WIDTH;
    ctx.lineCap = 'round';
    ctx.shadowColor = FLAME.ORANGE;
    ctx.shadowBlur = 14;

    for (const [a, b] of HAND_CONNECTIONS) {
      const la = landmarks[a];
      const lb = landmarks[b];
      if (!la || !lb) continue;
      ctx.beginPath();
      ctx.moveTo((1 - la.x) * w, la.y * h);
      ctx.lineTo((1 - lb.x) * w, lb.y * h);
      ctx.stroke();
    }
    ctx.restore();

    // Core line pass
    ctx.strokeStyle = FLAME.BONE_COLOR;
    ctx.lineWidth = FLAME.BONE_WIDTH;
    ctx.lineCap = 'round';

    for (const [a, b] of HAND_CONNECTIONS) {
      const la = landmarks[a];
      const lb = landmarks[b];
      if (!la || !lb) continue;
      ctx.beginPath();
      ctx.moveTo((1 - la.x) * w, la.y * h);
      ctx.lineTo((1 - lb.x) * w, lb.y * h);
      ctx.stroke();
    }
  }

  // ── Pinch flare (extra burst when pinching) ────────────────────────────────

  private drawPinchFlare(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    isPinching: boolean,
  ): void {
    if (!isPinching) return;

    const thumb = landmarks[THUMB_TIP];
    const index = landmarks[INDEX_TIP];
    if (!thumb || !index) return;

    const tx = (1 - thumb.x) * w;
    const ty = thumb.y * h;
    const ix = (1 - index.x) * w;
    const iy = index.y * h;
    const mx = (tx + ix) / 2;
    const my = (ty + iy) / 2;

    const prevComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';

    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 24);
    grad.addColorStop(0, 'rgba(255, 220, 0, 0.9)');
    grad.addColorStop(0.4, 'rgba(255, 80, 0, 0.5)');
    grad.addColorStop(1, 'rgba(255, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mx, my, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = prevComposite;
  }
}
