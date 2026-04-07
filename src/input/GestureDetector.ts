// ── GestureDetector ─────────────────────────────────
// Multi-signal pointing gesture detector with hysteresis + EMA smoothing + debounce.
// Determines whether the user is making a "pointing" gesture (pen down)
// vs any other hand pose (pen up).
//
// This is NOT the same as GestureEngine (src/gesture/GestureEngine.ts) which
// handles named gestures (fist, peace, etc.). GestureDetector is specifically
// for binary pen up/down classification.
//
// Extracted from CameraCapture.ts for modularity.

import type { LandmarkLike } from '../gesture/math.js';
import { dist3d, angleDeg, clamp01 } from '../gesture/math.js';

// Use the same shape as CameraCapture.Landmark but avoid circular import
type Landmark = LandmarkLike;

/**
 * Multi-signal gesture detector with hysteresis and EMA smoothing.
 *
 * Instead of a single binary check, this fuses 3 signals into a confidence
 * score [0,1], smooths it with an exponential moving average, then applies
 * hysteresis thresholds to produce a stable on/off state.
 *
 * Signals:
 *   1. Extension ratio — index tip distance from wrist vs MCP distance
 *   2. Curl angle — PIP-DIP-TIP angle (straight ≈ 180°, curled ≈ 60°)
 *   3. Other-fingers curl — middle+ring+pinky should be curled for ☝️ point
 *
 * This eliminates chattering at threshold boundaries and handles
 * transitional hand poses gracefully.
 */
export class GestureDetector {
  // ── Hysteresis thresholds on the smoothed confidence ──
  private static readonly ACTIVATE_THRESHOLD = 0.50;
  private static readonly DEACTIVATE_THRESHOLD = 0.15;

  // ── Fixed EMA factor ──
  // 0.40 = responsive to deliberate gestures. The 4-frame debounce alone provides
  // noise immunity — a single garbage frame drops to 0.51, still above 0.15.
  // Fist detection: ~8 frames ≈ 270ms (was 15 frames ≈ 500ms with alpha=0.15)
  private static readonly EMA_ALPHA = 0.40;

  // ── Debounce: require N consecutive frames wanting state change ──
  // Balanced: pen-down responsive (2 frames), pen-up moderate (4 frames)
  // 4 frames ≈ 130ms at 30fps — filters single-frame noise but allows
  // the user to intentionally stop drawing by making a fist
  private static readonly ACTIVATE_DEBOUNCE = 2;
  private static readonly DEACTIVATE_DEBOUNCE = 4;

  private smoothedConfidence = 0;
  private isPointing = false;
  private deactivateFrames = 0;
  private activateFrames = 0;

  reset(): void {
    this.smoothedConfidence = 0;
    this.isPointing = false;
    this.deactivateFrames = 0;
    this.activateFrames = 0;
  }

  /**
   * Process one frame of landmarks. Returns stable pointing state.
   * Uses worldLandmarks (3D, meters) for gesture classification —
   * immune to camera perspective foreshortening.
   * Falls back to 2D landmarks if worldLandmarks unavailable.
   *
   * Stability strategy (3 layers):
   *   Layer 1: Fixed EMA (α=0.15) — single bad frames can't move the average
   *   Layer 2: Wide hysteresis gap (0.50 / 0.15) — needs sustained low confidence
   *   Layer 3: Frame debounce (8 frames for deactivation) — final safety net
   */
  update(landmarks: Landmark[], worldLandmarks?: Landmark[]): boolean {
    const gestureMarks = worldLandmarks ?? landmarks;
    const rawConfidence = this.computeConfidence(gestureMarks);

    // Fixed-rate EMA: immune to single-frame noise spikes
    this.smoothedConfidence =
      GestureDetector.EMA_ALPHA * rawConfidence +
      (1 - GestureDetector.EMA_ALPHA) * this.smoothedConfidence;

    // Hysteresis + frame-based debounce
    if (!this.isPointing) {
      // Trying to activate (pen down)
      if (this.smoothedConfidence >= GestureDetector.ACTIVATE_THRESHOLD) {
        this.activateFrames++;
        if (this.activateFrames >= GestureDetector.ACTIVATE_DEBOUNCE) {
          this.isPointing = true;
          this.activateFrames = 0;
          this.deactivateFrames = 0;
        }
      } else {
        this.activateFrames = 0;
      }
    } else {
      // Trying to deactivate (pen up) — must be sustained and deliberate
      if (this.smoothedConfidence <= GestureDetector.DEACTIVATE_THRESHOLD) {
        this.deactivateFrames++;
        if (this.deactivateFrames >= GestureDetector.DEACTIVATE_DEBOUNCE) {
          this.isPointing = false;
          this.deactivateFrames = 0;
          this.activateFrames = 0;
        }
      } else {
        this.deactivateFrames = 0;
      }
    }

    return this.isPointing;
  }

  getConfidence(): number {
    return this.smoothedConfidence;
  }

  /**
   * Multiplicative confidence: index must be extended AND middle must NOT be.
   *
   * Formula:
   *   confidence = indexScore × middleGate × othersBonus
   *
   * Results per gesture:
   *   ☝️ Point:     1.0 × 1.0 × 1.0 = 1.00  ✓ draw
   *   ✌️ Peace:     1.0 × 0.15 × 0.8 = 0.12  ✗ no draw
   *   ✊ Fist:      0.0 × 1.0 × 1.0  = 0.00  ✗ no draw
   *   ✋ Open hand: 1.0 × 0.15 × 0.6 = 0.09  ✗ no draw
   *   👆 Thumb+index: 1.0 × 1.0 × 0.8 = 0.80 ✓ draw (ok, natural pointing)
   */
  private computeConfidence(landmarks: Landmark[]): number {
    const indexScore = this.fingerExtensionScore(landmarks, 8, 6, 7, 5);
    const middleScore = this.fingerExtensionScore(landmarks, 12, 10, 11, 9);

    // Middle finger gate: if middle is extended, kill confidence
    // middleScore=0 (curled) → gate=1.0, middleScore=1 (extended) → gate=0.15
    const middleGate = 1.0 - middleScore * 0.85;

    // Ring + pinky curl bonus: more curled = more likely deliberate point
    const ringScore = this.fingerExtensionScore(landmarks, 16, 14, 15, 13);
    const pinkyScore = this.fingerExtensionScore(landmarks, 20, 18, 19, 17);
    const curledCount = (ringScore < 0.4 ? 1 : 0) + (pinkyScore < 0.4 ? 1 : 0);
    // 0 curled → 0.6, 1 curled → 0.8, 2 curled → 1.0
    const othersBonus = 0.6 + curledCount * 0.2;

    return indexScore * middleGate * othersBonus;
  }

  /**
   * Unified finger extension score [0, 1] combining two signals:
   *   1. Extension ratio: tip-to-wrist / MCP-to-wrist distance
   *   2. Curl angle: PIP→DIP→TIP angle (straight ≈ 170°, curled ≈ 60°)
   *
   * Returns the average of both signals for robustness against
   * single-metric failures (hand angle, occlusion, etc.)
   */
  private fingerExtensionScore(
    landmarks: Landmark[],
    tipIdx: number, pipIdx: number, dipIdx: number, mcpIdx: number,
  ): number {
    const wrist = landmarks[0]!;
    const tip = landmarks[tipIdx]!;
    const mcp = landmarks[mcpIdx]!;
    const pip = landmarks[pipIdx]!;
    const dip = landmarks[dipIdx]!;

    // Signal A: extension ratio (3D distance — immune to foreshortening)
    const tipDist = dist3d(tip, wrist);
    const mcpDist = dist3d(mcp, wrist);
    const ratio = mcpDist > 0.001 ? tipDist / mcpDist : 0;
    const extensionSignal = clamp01((ratio - 1.0) / 0.5);

    // Signal B: curl angle at DIP joint
    const angle = angleDeg(pip, dip, tip);
    const angleSignal = clamp01((angle - 80) / 80);

    // Average: robust against single-signal noise
    return (extensionSignal + angleSignal) / 2;
  }
}
