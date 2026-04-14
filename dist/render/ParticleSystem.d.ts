import { Stroke, StrokePoint } from '../types.js';
/** Manages the particle pool: spawning, updating, and rendering. */
export declare class ParticleSystem {
    private particles;
    /** Spawn particles along a completed stroke with endpoint bursts */
    spawnForStroke(stroke: Stroke): void;
    /** Update particle positions and lifetimes, then render survivors */
    updateAndRender(ctx: CanvasRenderingContext2D, dt: number, degraded?: boolean): void;
    /** Clear all particles */
    clear(): void;
    private spawnBurst;
    private spawnAt;
    /** Spawn a burst of particles at an arbitrary canvas position (e.g. text overlay centre) */
    spawnBurstAtPosition(x: number, y: number, color: string, count: number): void;
    /**
     * Spawn sparkle particles at random positions along a stroke path.
     * Creates bright, short-lived particles that flash in-place — the core of the sparkle effect.
     */
    spawnSparkleAlongStroke(points: StrokePoint[], color: string, count?: number): void;
    /** Spawn a dense burst of particles along the entire stroke at morph start */
    spawnBurstForMorph(stroke: Pick<Stroke, 'raw' | 'smoothed' | 'effect'>): void;
}
