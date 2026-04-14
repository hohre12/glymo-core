import { HandStyleBase, HandStyleConfig, HandStyleName } from './types.js';
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
export declare class CrystalStyle extends HandStyleBase {
    readonly name: HandStyleName;
    draw(config: HandStyleConfig): void;
    private drawCrystalBones;
    private drawJointDiamonds;
    private drawFingertipFlares;
    private drawPinchBridge;
}
