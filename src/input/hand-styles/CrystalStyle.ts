import { HandStyleBase, HandStyleConfig, HandStyleName } from './types.js';
import {
  HAND_CONNECTIONS,
  FINGER_TIPS,
  INDEX_TIP,
  THUMB_TIP,
  CRYSTAL,
} from './constants.js';

/**
 * CrystalStyle — glass/ice hand effect.
 *
 * Visual characteristics:
 *   - Each bone rendered as a translucent crystal shard with sharp gradient edges
 *   - Joints marked with small diamond shapes
 *   - Fingertips have bright point-light flares
 *   - Alpha shimmers with a per-joint sin oscillation based on time
 *   - Colors: ice blue (#88ccff), white highlights, purple (#aa88ff) shadows
 */
export class CrystalStyle extends HandStyleBase {
  readonly name: HandStyleName = 'crystal';

  draw(config: HandStyleConfig): void {
    const { landmarks, isPinching, canvasWidth: w, canvasHeight: h, ctx, time } = config;

    ctx.save();

    this.drawCrystalBones(ctx, landmarks, w, h, time);
    this.drawJointDiamonds(ctx, landmarks, w, h, time);
    this.drawFingertipFlares(ctx, landmarks, w, h, isPinching, time);
    this.drawPinchBridge(ctx, landmarks, w, h, isPinching);

    ctx.restore();
  }

  // ── Crystal shard bones ────────────────────────────────────────────────────

  private drawCrystalBones(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    time: number,
  ): void {
    for (let i = 0; i < HAND_CONNECTIONS.length; i++) {
      const [a, b] = HAND_CONNECTIONS[i]!;
      const la = landmarks[a];
      const lb = landmarks[b];
      if (!la || !lb) continue;

      const ax = (1 - la.x) * w;
      const ay = la.y * h;
      const bx = (1 - lb.x) * w;
      const by = lb.y * h;

      // Shimmer alpha based on time + connection index
      const shimmer = 0.35 + 0.15 * Math.sin(time * CRYSTAL.SHIMMER_SPEED + i * 0.7);

      // Gradient from ice-blue to purple along the bone
      const grad = ctx.createLinearGradient(ax, ay, bx, by);
      grad.addColorStop(0, CRYSTAL.SHARD_BASE + `${shimmer})`);
      grad.addColorStop(0.5, `rgba(255, 255, 255, ${shimmer * 0.6})`);
      grad.addColorStop(1, CRYSTAL.SHADOW + `${shimmer})`);

      // Wide translucent shard (background layer)
      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.shadowColor = CRYSTAL.ICE_BLUE;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();

      // Thin bright highlight edge (foreground layer)
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${shimmer * 0.5})`;
      ctx.lineWidth = CRYSTAL.BONE_WIDTH;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Diamond-shaped joints ──────────────────────────────────────────────────

  private drawJointDiamonds(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    time: number,
  ): void {
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i]!;
      if (FINGER_TIPS.includes(i)) continue; // tips handled separately

      const x = (1 - lm.x) * w;
      const y = lm.y * h;
      const s = CRYSTAL.JOINT_DIAMOND_SIZE;
      const shimmer = 0.5 + 0.3 * Math.sin(time * CRYSTAL.SHIMMER_SPEED + i * 1.1);

      // Draw a diamond (rotated square)
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);

      // Filled diamond
      ctx.fillStyle = `rgba(136, 204, 255, ${shimmer * 0.4})`;
      ctx.shadowColor = CRYSTAL.ICE_BLUE;
      ctx.shadowBlur = 8;
      ctx.fillRect(-s / 2, -s / 2, s, s);

      // Diamond border
      ctx.strokeStyle = `rgba(255, 255, 255, ${shimmer})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(-s / 2, -s / 2, s, s);

      ctx.restore();
    }
  }

  // ── Fingertip point-light flares ───────────────────────────────────────────

  private drawFingertipFlares(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    isPinching: boolean,
    time: number,
  ): void {
    for (let ti = 0; ti < FINGER_TIPS.length; ti++) {
      const tipIdx = FINGER_TIPS[ti]!;
      const lm = landmarks[tipIdx];
      if (!lm) continue;

      const x = (1 - lm.x) * w;
      const y = lm.y * h;
      const isIndex = tipIdx === INDEX_TIP;
      const pulse = 1 + 0.2 * Math.sin(time * 0.004 + ti * 1.2);
      const r = CRYSTAL.TIP_GLOW_RADIUS * pulse * (isIndex ? 1.2 : 0.8);

      // Radial point-light gradient
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, isIndex && isPinching
        ? 'rgba(255, 255, 255, 0.9)'
        : 'rgba(200, 230, 255, 0.7)');
      grad.addColorStop(0.3, 'rgba(136, 204, 255, 0.3)');
      grad.addColorStop(1, 'rgba(170, 136, 255, 0)');

      ctx.save();
      ctx.shadowColor = CRYSTAL.ICE_BLUE;
      ctx.shadowBlur = 16;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Bright center dot
      const shimmer = 0.6 + 0.4 * Math.sin(time * 0.006 + ti * 0.9);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${shimmer})`;
      ctx.fill();
    }
  }

  // ── Pinch bridge (crystalline connection between thumb and index) ──────────

  private drawPinchBridge(
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

    if (isPinching) {
      // Solid bright crystalline bridge
      const grad = ctx.createLinearGradient(tx, ty, ix, iy);
      grad.addColorStop(0, 'rgba(170, 136, 255, 0.9)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(1, 'rgba(136, 204, 255, 0.9)');

      ctx.save();
      ctx.shadowColor = CRYSTAL.WHITE;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ix, iy);
      ctx.stroke();
      ctx.restore();
    } else {
      // Dashed, faint suggestion of connection
      ctx.save();
      ctx.strokeStyle = 'rgba(136, 204, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ix, iy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}
