export const DEFAULT_ENVIRONMENT_INTENSITY = 0.6;

export const DEFAULT_LIGHT_RIG_INTENSITY = {
  key: 1.6,
  fill: 0.4,
  ambient: 0.2,
} as const;

export const DEFAULT_KEY_LIGHT_POSITION = { x: 3, y: 5, z: 4 } as const;
export const DEFAULT_FILL_LIGHT_POSITION = { x: -4, y: 2, z: -3 } as const;

export const DEFAULT_AXIAL_TILT_DEG = 23.4;
export const DEFAULT_ROTATION_BODY = 0.10;
export const DEFAULT_ROTATION_CLOUDS = 0.13;

export const DEFAULT_ATMOSPHERE_COLOR_HEX = 0x00ccff;

// GltfMeshSource generates a PMREM via THREE.RoomEnvironment when no per-asset
// HDRI is supplied, so no binary HDR ships with @glymo/core.
export const BUNDLED_NEUTRAL_ENVIRONMENT = {
  kind: 'room-environment',
  cacheKey: '@core:neutral-env',
} as const;

export type BundledNeutralEnvironment = typeof BUNDLED_NEUTRAL_ENVIRONMENT;

export type LightRigIntensity = {
  readonly key: number;
  readonly fill: number;
  readonly ambient: number;
};

export type LightPosition = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};
