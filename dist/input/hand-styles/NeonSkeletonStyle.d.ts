import { HandStyleBase, HandStyleConfig, HandStyleName } from './types.js';
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
export declare class NeonSkeletonStyle extends HandStyleBase {
    readonly name: HandStyleName;
    draw(config: HandStyleConfig): void;
    private drawBoneGlow;
    private drawBones;
    private drawJoints;
    private drawFingerTips;
    private drawIndexCursor;
    private drawPinchArc;
}
