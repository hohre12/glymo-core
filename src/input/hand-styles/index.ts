// ── Hand Style Registry ───────────────────────────────

import type { HandStyleName } from './types.js';
import { HandStyleBase } from './types.js';
import { NeonSkeletonStyle } from './NeonSkeletonStyle.js';
import { CrystalStyle } from './CrystalStyle.js';
import { FlameStyle } from './FlameStyle.js';
import { AuroraStyle } from './AuroraStyle.js';
import { ParticleCloudStyle } from './ParticleCloudStyle.js';

/** Factory map — each entry creates a fresh style instance */
const STYLE_FACTORIES: Record<HandStyleName, () => HandStyleBase> = {
  'neon-skeleton': () => new NeonSkeletonStyle(),
  'crystal': () => new CrystalStyle(),
  'flame': () => new FlameStyle(),
  'aurora': () => new AuroraStyle(),
  'particle-cloud': () => new ParticleCloudStyle(),
};

/**
 * Create a new hand style instance by name.
 * Each call returns a fresh instance with independent state.
 */
export function createHandStyle(name: HandStyleName): HandStyleBase {
  const factory = STYLE_FACTORIES[name];
  return factory();
}

export type { HandStyleName, HandStyleConfig } from './types.js';
export { HandStyleBase } from './types.js';
