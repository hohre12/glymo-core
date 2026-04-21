import {
  BUNDLED_NEUTRAL_ENVIRONMENT,
  DEFAULT_ATMOSPHERE_COLOR_HEX,
  DEFAULT_AXIAL_TILT_DEG,
  DEFAULT_ENVIRONMENT_INTENSITY,
  DEFAULT_FILL_LIGHT_POSITION,
  DEFAULT_KEY_LIGHT_POSITION,
  DEFAULT_LIGHT_RIG_INTENSITY,
  DEFAULT_ROTATION_BODY,
  DEFAULT_ROTATION_CLOUDS,
  type BundledNeutralEnvironment,
  type LightPosition,
  type LightRigIntensity,
} from './mediaArtDefaults.js';

export type VariantKey = 'gltf' | 'gltf-pbr' | 'procedural-planet';

export type GltfVariantDefaults = {
  readonly kind: 'gltf';
  readonly environment: BundledNeutralEnvironment;
  readonly environmentIntensity: number;
  readonly lightRigIntensity: LightRigIntensity;
  readonly keyLightPosition: LightPosition;
  readonly fillLightPosition: LightPosition;
};

export type GltfPbrVariantDefaults = {
  readonly kind: 'gltf-pbr';
  readonly environmentIntensity: number;
};

export type ProceduralPlanetVariantDefaults = {
  readonly kind: 'procedural-planet';
  readonly axialTiltDeg: number;
  readonly rotationBody: number;
  readonly rotationClouds: number;
  readonly atmosphereColorHex: number;
};

export type VariantDefaults =
  | GltfVariantDefaults
  | GltfPbrVariantDefaults
  | ProceduralPlanetVariantDefaults;

export const VARIANT_DEFAULTS: {
  readonly gltf: GltfVariantDefaults;
  readonly 'gltf-pbr': GltfPbrVariantDefaults;
  readonly 'procedural-planet': ProceduralPlanetVariantDefaults;
} = {
  gltf: {
    kind: 'gltf',
    environment: BUNDLED_NEUTRAL_ENVIRONMENT,
    environmentIntensity: DEFAULT_ENVIRONMENT_INTENSITY,
    lightRigIntensity: DEFAULT_LIGHT_RIG_INTENSITY,
    keyLightPosition: DEFAULT_KEY_LIGHT_POSITION,
    fillLightPosition: DEFAULT_FILL_LIGHT_POSITION,
  },
  'gltf-pbr': {
    kind: 'gltf-pbr',
    environmentIntensity: DEFAULT_ENVIRONMENT_INTENSITY,
  },
  'procedural-planet': {
    kind: 'procedural-planet',
    axialTiltDeg: DEFAULT_AXIAL_TILT_DEG,
    rotationBody: DEFAULT_ROTATION_BODY,
    rotationClouds: DEFAULT_ROTATION_CLOUDS,
    atmosphereColorHex: DEFAULT_ATMOSPHERE_COLOR_HEX,
  },
} as const;

export function getVariantDefaults<K extends VariantKey>(
  variant: K,
): (typeof VARIANT_DEFAULTS)[K] {
  return VARIANT_DEFAULTS[variant];
}
