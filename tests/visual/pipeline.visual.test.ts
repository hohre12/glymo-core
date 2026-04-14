// ── End-to-end visual regression tests for the core pipeline ─────────
//
// Each case pushes a deterministic fixture through stages 1-5
// (Capture → Stabilize → Pressure → Segment → Smooth) and compares the
// rendered variable-width polyline against a golden PNG under
// tests/visual/__snapshots__/. To refresh the goldens intentionally,
// run the suite with UPDATE_SNAPSHOTS=1.

import {
  circleFixture,
  letterAFixture,
  matchSnapshot,
  renderStrokeToPng,
  runPipeline,
  signatureFixture,
} from './helpers.js';

describe('visual: pipeline end-to-end', () => {
  it('circle renders consistently through the full pipeline', () => {
    const smoothed = runPipeline(circleFixture());
    expect(smoothed.length).toBeGreaterThan(0);
    const png = renderStrokeToPng(smoothed);
    matchSnapshot(png, 'circle');
  });

  it('letter "A" smooths consistently', () => {
    const smoothed = runPipeline(letterAFixture());
    expect(smoothed.length).toBeGreaterThan(0);
    const png = renderStrokeToPng(smoothed);
    matchSnapshot(png, 'letter-a');
  });

  it('short signature renders consistently', () => {
    const smoothed = runPipeline(signatureFixture());
    expect(smoothed.length).toBeGreaterThan(0);
    const png = renderStrokeToPng(smoothed);
    matchSnapshot(png, 'signature');
  });
});
