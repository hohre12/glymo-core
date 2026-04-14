import { LandmarkLike } from '../gesture/math.js';
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
export declare class GestureDetector {
    private static readonly ACTIVATE_THRESHOLD;
    private static readonly DEACTIVATE_THRESHOLD;
    private static readonly EMA_ALPHA;
    private static readonly ACTIVATE_DEBOUNCE;
    private static readonly DEACTIVATE_DEBOUNCE;
    private smoothedConfidence;
    private isPointing;
    private deactivateFrames;
    private activateFrames;
    reset(): void;
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
    update(landmarks: Landmark[], worldLandmarks?: Landmark[]): boolean;
    getConfidence(): number;
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
    private computeConfidence;
    /**
     * Unified finger extension score [0, 1] combining two signals:
     *   1. Extension ratio: tip-to-wrist / MCP-to-wrist distance
     *   2. Curl angle: PIP→DIP→TIP angle (straight ≈ 170°, curled ≈ 60°)
     *
     * Returns the average of both signals for robustness against
     * single-metric failures (hand angle, occlusion, etc.)
     */
    private fingerExtensionScore;
}
export {};
