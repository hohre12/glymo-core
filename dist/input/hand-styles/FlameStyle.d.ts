import { HandStyleBase, HandStyleConfig, HandStyleName } from './types.js';
/**
 * FlameStyle — fire hand effect using additive particle blending.
 *
 * Visual characteristics:
 *   - Per-joint CPU particle system with upward drift
 *   - Particles color from yellow → orange → red as they age
 *   - Additive compositing (globalCompositeOperation = 'lighter') for hot glow
 *   - Bone lines rendered with orange-red glow
 *   - Hard cap of 200 particles total to keep memory stable
 */
export declare class FlameStyle extends HandStyleBase {
    readonly name: HandStyleName;
    /** Active particle pool — reused across frames */
    private readonly particles;
    draw(config: HandStyleConfig): void;
    destroy(): void;
    private spawnParticles;
    private updateParticles;
    private drawParticles;
    private drawFlameBones;
    private drawPinchFlare;
}
