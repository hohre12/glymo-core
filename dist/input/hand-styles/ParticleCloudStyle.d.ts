import { HandStyleBase, HandStyleConfig, HandStyleName } from './types.js';
/**
 * ParticleCloudStyle — soft orbiting cloud of particles around each landmark.
 *
 * Visual characteristics:
 *   - 6-10 particles per landmark orbit with Brownian noise drift
 *   - Size scales with z-coordinate (closer landmarks = larger particles)
 *   - Soft white/cyan particles with varying alpha (0.2–0.6)
 *   - Glow via shadowBlur
 *   - No bone connections — pure particle cloud
 *   - Hard cap: 300 particles total
 */
export declare class ParticleCloudStyle extends HandStyleBase {
    readonly name: HandStyleName;
    private readonly particles;
    draw(config: HandStyleConfig): void;
    destroy(): void;
    private updateAndSpawn;
    private renderParticles;
}
