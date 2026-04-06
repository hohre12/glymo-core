import { HandStyleBase, HandStyleConfig, HandStyleName } from './types.js';
import {
  HAND_CONNECTIONS,
  FINGER_TIPS,
  INDEX_TIP,
  THUMB_TIP,
  NEON,
} from './constants.js';

/**
 * NeonSkeletonStyle — exact replica of the original HandVisualizer rendering.
 *
 * Produces IDENTICAL visual output to the pre-styles HandVisualizer:
 *   - Glowing bone glow pass (wide, dim)
 *   - Bone lines (medium, 60% opacity)
 *   - Joint outer ring + inner dot
 *   - Fingertip circles with glow
 *   - Index cursor (pulsing radial gradient + optional crosshair)
 *   - Pinch arc (solid line when pinching, dashed curve when open)
 */
export class NeonSkeletonStyle extends HandStyleBase {
  readonly name: HandStyleName = 'neon-skeleton';

  draw(config: HandStyleConfig): void {
    const { landmarks, isPinching, canvasWidth: w, canvasHeight: h, ctx, time } = config;

    this.drawBoneGlow(ctx, landmarks, w, h);
    this.drawBones(ctx, landmarks, w, h);
    this.drawJoints(ctx, landmarks, w, h);
    this.drawFingerTips(ctx, landmarks, w, h, isPinching);
    this.drawIndexCursor(ctx, landmarks, w, h, isPinching, time);
    this.drawPinchArc(ctx, landmarks, w, h, isPinching);
  }

  // ── Bone glow (wide, dim pass behind everything) ───────────────────────────

  private drawBoneGlow(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = NEON.ACCENT_DIM;
    ctx.lineWidth = NEON.BONE_GLOW_WIDTH;
    ctx.lineCap = 'round';
    ctx.shadowColor = NEON.ACCENT_HEX;
    ctx.shadowBlur = 12;

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
  }

  // ── Main skeleton lines ────────────────────────────────────────────────────

  private drawBones(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
  ): void {
    ctx.strokeStyle = NEON.ACCENT + '0.6)';
    ctx.lineWidth = NEON.BONE_WIDTH;
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

  // ── Joint rings + inner dots ───────────────────────────────────────────────

  private drawJoints(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
  ): void {
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i]!;
      const x = (1 - lm.x) * w;
      const y = lm.y * h;

      if (FINGER_TIPS.includes(i)) continue; // tips rendered separately

      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, NEON.JOINT_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = NEON.ACCENT + '0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = NEON.ACCENT + '0.8)';
      ctx.fill();
    }
  }

  // ── Fingertip circles with glow ────────────────────────────────────────────

  private drawFingerTips(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    isPinching: boolean,
  ): void {
    for (const tipIdx of FINGER_TIPS) {
      const lm = landmarks[tipIdx];
      if (!lm) continue;
      const x = (1 - lm.x) * w;
      const y = lm.y * h;
      const isIndex = tipIdx === INDEX_TIP;

      const radius = isIndex ? NEON.TIP_RADIUS : NEON.TIP_RADIUS * 0.7;
      const alpha = isIndex ? (isPinching ? 1.0 : 0.7) : 0.4;

      // Glow fill
      ctx.save();
      ctx.shadowColor = NEON.ACCENT_HEX;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = NEON.ACCENT + `${alpha * 0.3})`;
      ctx.fill();
      ctx.restore();

      // Ring
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = NEON.ACCENT + `${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = NEON.ACCENT + `${alpha})`;
      ctx.fill();
    }
  }

  // ── Index cursor (pulsing radial gradient + crosshair) ─────────────────────

  private drawIndexCursor(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    isPinching: boolean,
    time: number,
  ): void {
    const tip = landmarks[INDEX_TIP];
    if (!tip) return;

    const x = (1 - tip.x) * w;
    const y = tip.y * h;

    const pulse = 1 + 0.25 * Math.sin(time * NEON.GLOW_PULSE_SPEED);
    const radius = NEON.GLOW_RADIUS * pulse;
    const color = isPinching ? NEON.PINCH_ACTIVE : NEON.PINCH_INACTIVE;

    const gradient = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (isPinching) {
      ctx.save();
      ctx.strokeStyle = NEON.ACCENT + '0.3)';
      ctx.lineWidth = 1;
      const len = 15;
      ctx.beginPath();
      // Horizontal gap crosshair
      ctx.moveTo(x - len, y);
      ctx.lineTo(x - 6, y);
      ctx.moveTo(x + 6, y);
      ctx.lineTo(x + len, y);
      // Vertical gap crosshair
      ctx.moveTo(x, y - len);
      ctx.lineTo(x, y - 6);
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x, y + len);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Pinch arc ──────────────────────────────────────────────────────────────

  private drawPinchArc(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    isPinching: boolean,
  ): void {
    const thumb = landmarks[THUMB_TIP];
    const index = landmarks[INDEX_TIP];
    if (!thumb || !index) return;

    const tx = (1 - thumb.x) * w;
    const ty = thumb.y * h;
    const ix = (1 - index.x) * w;
    const iy = index.y * h;
    const dist = Math.sqrt((tx - ix) ** 2 + (ty - iy) ** 2);

    if (isPinching) {
      ctx.save();
      ctx.shadowColor = NEON.ACCENT_HEX;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = NEON.PINCH_ACTIVE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ix, iy);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = NEON.PINCH_INACTIVE;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);

      const mx = (tx + ix) / 2;
      const my = (ty + iy) / 2;
      const perpX = -(iy - ty) * 0.3;
      const perpY = (ix - tx) * 0.3;

      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(mx + perpX, my + perpY, ix, iy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if (dist > 30) {
        ctx.save();
        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(dist)}px`, (tx + ix) / 2, (ty + iy) / 2 - 8);
        ctx.restore();
      }
    }
  }
}
