import { HandStyleBase, HandStyleConfig, HandStyleName } from './types.js';
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
export declare class AuroraStyle extends HandStyleBase {
    readonly name: HandStyleName;
    draw(config: HandStyleConfig): void;
    private drawFingerRibbons;
    private drawFingertipGlows;
    private drawPalmWeb;
    private drawPinchArc;
}
