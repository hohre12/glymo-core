import { HandStyleBase, HandStyleConfig, HandStyleName } from './types.js';
import { FINGER_CHAINS, FINGER_TIPS, INDEX_TIP, THUMB_TIP, AURORA } from './constants.js';

/**
 * AuroraStyle — flowing aurora-ribbon hand effect.
 *
 * Visual characteristics:
 *   - Smooth quadratic bezier curves flow along each finger chain
 *   - Three semi-transparent layers rendered per finger for depth
 *   - Hue shifts over time and across fingers for a prismatic ribbon effect
 *   - Line width modulated by a sin wave for organic breathing motion
 *   - Screen compositing for luminous color blending
 *   - Fingertips have soft circular glow matching their current hue
 */
export class AuroraStyle extends HandStyleBase {
  readonly name: HandStyleName = 'aurora';

  draw(config: HandStyleConfig): void {
    const { landmarks, isPinching, canvasWidth: w, canvasHeight: h, ctx, time } = config;

    ctx.save();

    const prevComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = AURORA.COMPOSITE;

    this.drawFingerRibbons(ctx, landmarks, w, h, time);
    this.drawFingertipGlows(ctx, landmarks, w, h, time);
    this.drawPalmWeb(ctx, landmarks, w, h, time);

    ctx.globalCompositeOperation = prevComposite;

    this.drawPinchArc(ctx, landmarks, w, h, isPinching, time);

    ctx.restore();
  }

  // ── Aurora ribbon along each finger ───────────────────────────────────────

  private drawFingerRibbons(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    time: number,
  ): void {
    for (let fi = 0; fi < FINGER_CHAINS.length; fi++) {
      const chain = FINGER_CHAINS[fi]!;
      const baseHue = (time * AURORA.HUE_SPEED + fi * AURORA.HUE_SHIFT_PER_FINGER) % 360;

      for (let layer = 0; layer < AURORA.LAYER_COUNT; layer++) {
        // Each layer: offset hue slightly, lower alpha
        const hue = (baseHue + layer * 20) % 360;
        const alpha = 0.5 - layer * 0.12;
        const lineWidth = (AURORA.LINE_WIDTH_BASE + AURORA.LINE_WIDTH_AMP * Math.sin(time * AURORA.LINE_WAVE_SPEED + fi + layer))
          * (1 - layer * 0.2);

        ctx.strokeStyle = `hsla(${hue}, ${AURORA.SATURATION}%, ${AURORA.LIGHTNESS}%, ${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
        ctx.shadowBlur = 10 + layer * 4;

        // Build the bezier curve path along the finger chain
        ctx.beginPath();

        const firstIdx = chain[0];
        if (firstIdx === undefined) continue;
        const first = landmarks[firstIdx];
        if (!first) continue;

        ctx.moveTo((1 - first.x) * w, first.y * h);

        for (let pi = 0; pi < chain.length - 1; pi++) {
          const currIdx = chain[pi]!;
          const nextIdx = chain[pi + 1]!;
          const curr = landmarks[currIdx];
          const next = landmarks[nextIdx];
          if (!curr || !next) continue;

          const cx = (1 - curr.x) * w;
          const cy = curr.y * h;
          const nx = (1 - next.x) * w;
          const ny = next.y * h;

          // Control point: midpoint between consecutive landmark pairs
          const cpx = (cx + nx) / 2;
          const cpy = (cy + ny) / 2;
          ctx.quadraticCurveTo(cx, cy, cpx, cpy);
        }

        // Draw to the last point explicitly
        const lastIdx = chain[chain.length - 1];
        if (lastIdx !== undefined) {
          const last = landmarks[lastIdx];
          if (last) {
            ctx.lineTo((1 - last.x) * w, last.y * h);
          }
        }

        ctx.stroke();
      }
    }
  }

  // ── Soft circular glow at each fingertip ──────────────────────────────────

  private drawFingertipGlows(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    time: number,
  ): void {
    for (let ti = 0; ti < FINGER_TIPS.length; ti++) {
      const tipIdx = FINGER_TIPS[ti]!;
      const lm = landmarks[tipIdx];
      if (!lm) continue;

      const x = (1 - lm.x) * w;
      const y = lm.y * h;
      const hue = (time * AURORA.HUE_SPEED + ti * AURORA.HUE_SHIFT_PER_FINGER) % 360;
      const pulse = 1 + 0.25 * Math.sin(time * 0.004 + ti * 1.3);
      const r = AURORA.TIP_GLOW_RADIUS * pulse;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `hsla(${hue}, 100%, 80%, 0.7)`);
      grad.addColorStop(0.5, `hsla(${hue}, 90%, 60%, 0.3)`);
      grad.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Subtle aurora web across the palm base ────────────────────────────────

  private drawPalmWeb(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    time: number,
  ): void {
    // Connect finger base joints (indices 5, 9, 13, 17) with a flowing band
    const palmBases = [5, 9, 13, 17];
    const hue = (time * AURORA.HUE_SPEED * 0.5 + 180) % 360;

    ctx.strokeStyle = `hsla(${hue}, 70%, 65%, 0.25)`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 6;
    ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;

    ctx.beginPath();
    let started = false;
    for (const idx of palmBases) {
      const lm = landmarks[idx];
      if (!lm) continue;
      const x = (1 - lm.x) * w;
      const y = lm.y * h;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  // ── Pinch arc (aurora colored) ─────────────────────────────────────────────

  private drawPinchArc(
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number; z: number }>,
    w: number,
    h: number,
    isPinching: boolean,
    time: number,
  ): void {
    const thumb = landmarks[THUMB_TIP];
    const index = landmarks[INDEX_TIP];
    if (!thumb || !index) return;

    const tx = (1 - thumb.x) * w;
    const ty = thumb.y * h;
    const ix = (1 - index.x) * w;
    const iy = index.y * h;
    const hue = (time * AURORA.HUE_SPEED) % 360;

    if (isPinching) {
      const grad = ctx.createLinearGradient(tx, ty, ix, iy);
      grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.9)`);
      grad.addColorStop(1, `hsla(${(hue + 60) % 360}, 100%, 70%, 0.9)`);

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ix, iy);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.3)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
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
    }
  }
}
