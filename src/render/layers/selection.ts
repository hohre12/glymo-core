import type { ObjectStore } from '../../store/ObjectStore.js';

/** Padding around object bbox for selection highlight */
const SELECTION_PAD = 8;

/** Corner handle radius */
const HANDLE_RADIUS = 5;

/** Dash pattern for marching ants */
const DASH_PATTERN: [number, number] = [8, 4];

/** Dash animation speed (pixels per ms) */
const DASH_SPEED = 0.05;

/** Total dash cycle length for modulo */
const DASH_CYCLE = DASH_PATTERN[0] + DASH_PATTERN[1];

/**
 * Layer 15 — Selection Highlights
 *
 * Renders animated marching-ants bounding box and corner handles
 * for each selected object. Drawn directly to main canvas (not cached)
 * since it requires per-frame animation.
 */
export function renderSelection(
  ctx: CanvasRenderingContext2D,
  selectedIds: ReadonlySet<string>,
  objectStore: ObjectStore,
  effectColor: string,
  timestamp: number,
  dpr: number,
): void {
  if (selectedIds.size === 0) return;

  ctx.save();

  // Parse effect color and create semi-transparent variant
  const strokeColor = withAlpha(effectColor, 0.7);
  const handleColor = withAlpha(effectColor, 0.9);
  const glowColor = withAlpha(effectColor, 0.3);

  // Marching ants animation offset
  const dashOffset = -(timestamp * DASH_SPEED) % DASH_CYCLE;
  // Pre-compute scaled dash pattern outside loop (avoid per-frame allocation)
  const scaledDash = DASH_PATTERN.map(v => v * dpr);

  for (const objectId of selectedIds) {
    const obj = objectStore.getObject(objectId);
    if (!obj) continue;

    const x = obj.bbox.x - SELECTION_PAD * dpr;
    const y = obj.bbox.y - SELECTION_PAD * dpr;
    const w = obj.bbox.width + SELECTION_PAD * 2 * dpr;
    const h = obj.bbox.height + SELECTION_PAD * 2 * dpr;

    // Glow pass
    ctx.shadowBlur = 6 * dpr;
    ctx.shadowColor = glowColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash(scaledDash);
    ctx.lineDashOffset = dashOffset * dpr;
    ctx.strokeRect(x, y, w, h);

    // Clear shadow for handles
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Corner handles
    ctx.fillStyle = handleColor;
    const r = HANDLE_RADIUS * dpr;
    const corners: [number, number][] = [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ];
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Reset dash
  ctx.setLineDash([]);
  ctx.restore();
}

/** Convert a CSS color string to an rgba string with given alpha */
function withAlpha(color: string, alpha: number): string {
  // Handle hex colors (#rgb, #rrggbb, #rrggbbaa)
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!;
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  // Handle rgb()/rgba() — just replace or add alpha
  if (color.startsWith('rgb')) {
    const match = color.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      return `rgba(${match[0]},${match[1]},${match[2]},${alpha})`;
    }
  }
  // Fallback: return as-is
  return color;
}
