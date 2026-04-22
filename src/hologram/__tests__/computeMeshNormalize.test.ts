import { describe, expect, it } from 'vitest';
import { computeMeshNormalize } from '../Hologram3DRenderer.js';

// ── Fixture helpers ──────────────────────────────────────────────────────────

function bb(w: number, h: number, d: number) {
  return {
    min: { x: -w / 2, y: -h / 2, z: -d / 2 },
    max: { x: w / 2, y: h / 2, z: d / 2 },
  };
}

// Representative camera-frustum projection at zoom=1, aspect=1, fov=35.
const DEFAULT_FRUSTUM = {
  canvasCssW: 1000,
  canvasCssH: 1000,
  visibleHalfW: 1.892,
  visibleHalfH: 1.892,
};

describe('computeMeshNormalize', () => {
  it('falls back to 2/maxDim when sizeCss is null (pre-0.18 behaviour)', () => {
    const n = computeMeshNormalize({
      sizeCss: null,
      ...DEFAULT_FRUSTUM,
      bb: bb(1, 1, 1),
    });
    expect(n).toBeCloseTo(2.0, 6);
  });

  it('falls back to 1.0 when the bbox is degenerate (zero volume)', () => {
    const n = computeMeshNormalize({
      sizeCss: null,
      ...DEFAULT_FRUSTUM,
      bb: bb(0, 0, 0),
    });
    expect(n).toBe(1.0);
  });

  it('scales by chosen-axis mesh extent when the stroke is wider than tall', () => {
    // Stroke bbox is 400x200 CSS px → useWidthAxis=true.
    // Mesh bbox width = 2, mesh bbox height = 1, mesh bbox depth = 1.
    // targetWorld = (400/1000) * 2 * 1.892 = 1.5136
    // normalize = targetWorld / meshAxisX = 1.5136 / 2 = 0.7568
    const n = computeMeshNormalize({
      sizeCss: { width: 400, height: 200 },
      ...DEFAULT_FRUSTUM,
      bb: bb(2, 1, 1),
    });
    expect(n).toBeCloseTo(0.7568, 4);
  });

  it('scales by chosen-axis mesh extent when the stroke is taller than wide', () => {
    // Stroke bbox is 200x400 → useWidthAxis=false (use height axis).
    // Mesh bbox height = 1, mesh bbox width = 2.
    // targetWorld = (400/1000) * 2 * 1.892 = 1.5136
    // normalize = targetWorld / meshAxisY = 1.5136 / 1 = 1.5136
    const n = computeMeshNormalize({
      sizeCss: { width: 200, height: 400 },
      ...DEFAULT_FRUSTUM,
      bb: bb(2, 1, 1),
    });
    expect(n).toBeCloseTo(1.5136, 4);
  });

  it('regression: deep-Z mesh (standing avocado) uses width axis — NOT maxDim', () => {
    // This is the 0.19.0 fix. Pre-0.19 normalized by max(x,y,z) = z,
    // shrinking the mesh well below the user's stroke. Post-0.19
    // picks the same axis the user drew (x) and ignores z entirely.
    //
    // Stroke: square 300x300 CSS → useWidthAxis=true.
    // Mesh: 1 wide, 1 tall, 5 deep — bb depth is the longest axis.
    //
    // Buggy 0.18 behaviour would have been: 2/maxDim * (3/10) ≈ 2/5 * 0.3 = 0.12.
    // (This formula isn't exactly what 0.18 did but captures the shape: the mesh
    //  shrank inversely to its depth.)
    //
    // Correct 0.19 behaviour: normalize = targetWorld / meshAxisX =
    //   ((300/1000) * 2 * 1.892) / 1 = 1.1352
    const n = computeMeshNormalize({
      sizeCss: { width: 300, height: 300 },
      ...DEFAULT_FRUSTUM,
      bb: bb(1, 1, 5),
    });
    expect(n).toBeCloseTo(1.1352, 4);
    // And explicitly assert we are NOT dividing by the Z extent (the bug).
    const buggyMaxDimNormalize =
      ((300 / DEFAULT_FRUSTUM.canvasCssW) * 2 * DEFAULT_FRUSTUM.visibleHalfW) /
      Math.max(1, 1, 5);
    expect(n).not.toBeCloseTo(buggyMaxDimNormalize, 4);
  });

  it('uses height axis on aspect-rectangular canvases when stroke is portrait', () => {
    // Landscape canvas 1600x900 — visibleHalfW ≠ visibleHalfH.
    // Stroke portrait 200x400 → useWidthAxis=false.
    // targetWorld = (400/900) * 2 * 1.892 = 1.68177...
    // Mesh: 2 wide, 1.2 tall, 3 deep. meshAxisY = 1.2.
    // normalize = 1.68177... / 1.2 = 1.40148
    const n = computeMeshNormalize({
      sizeCss: { width: 200, height: 400 },
      canvasCssW: 1600,
      canvasCssH: 900,
      visibleHalfW: (1.892 * 1600) / 900,
      visibleHalfH: 1.892,
      bb: bb(2, 1.2, 3),
    });
    const expected = ((400 / 900) * 2 * 1.892) / 1.2;
    expect(n).toBeCloseTo(expected, 6);
  });

  it('falls back to targetWorld/maxDim only when the chosen mesh axis is zero', () => {
    // Degenerate mesh along the chosen axis (x=0) but not overall.
    // useWidthAxis=true (stroke is wider), meshAxisX=0 → falls back to
    // targetWorld / maxDim = targetWorld / max(0, 2, 2) = targetWorld / 2.
    const sizeCss = { width: 400, height: 200 };
    const targetWorld =
      (sizeCss.width / DEFAULT_FRUSTUM.canvasCssW) * 2 * DEFAULT_FRUSTUM.visibleHalfW;
    const n = computeMeshNormalize({
      sizeCss,
      ...DEFAULT_FRUSTUM,
      bb: bb(0, 2, 2),
    });
    expect(n).toBeCloseTo(targetWorld / 2, 6);
  });

  it('ignores sizeCss when the canvas is not yet measured (SSR / first tick)', () => {
    // Before the first layout pass canvasCssW/H is 0 — must fall back to the
    // historical world-size-2 path so a freshly-mounted mesh is not invisible.
    const n = computeMeshNormalize({
      sizeCss: { width: 400, height: 200 },
      canvasCssW: 0,
      canvasCssH: 0,
      visibleHalfW: 1.892,
      visibleHalfH: 1.892,
      bb: bb(1, 1, 1),
    });
    expect(n).toBeCloseTo(2.0, 6);
  });
});
