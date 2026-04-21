import type { Object3D } from 'three/webgpu';
import {
  DEFAULT_FILL_LIGHT_POSITION,
  DEFAULT_KEY_LIGHT_POSITION,
  DEFAULT_LIGHT_RIG_INTENSITY,
  type LightPosition,
  type LightRigIntensity,
} from './mediaArtDefaults.js';

type ThreeWebGPU = typeof import('three/webgpu');

export type NeutralLightRigConfig = {
  readonly intensity?: Partial<LightRigIntensity>;
  readonly keyPosition?: LightPosition;
  readonly fillPosition?: LightPosition;
};

export type NeutralLightRig = {
  readonly group: Object3D;
  dispose(): void;
};

export function createNeutralLightRig(
  THREE: ThreeWebGPU,
  config: NeutralLightRigConfig = {},
): NeutralLightRig {
  const intensity: LightRigIntensity = {
    ...DEFAULT_LIGHT_RIG_INTENSITY,
    ...(config.intensity ?? {}),
  };
  const keyPos = config.keyPosition ?? DEFAULT_KEY_LIGHT_POSITION;
  const fillPos = config.fillPosition ?? DEFAULT_FILL_LIGHT_POSITION;

  const group = new THREE.Group();
  group.name = '@glymo/core:neutral-light-rig';

  const keyLight = new THREE.DirectionalLight(0xffffff, intensity.key);
  keyLight.position.set(keyPos.x, keyPos.y, keyPos.z);
  keyLight.name = 'neutral-key';
  group.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, intensity.fill);
  fillLight.position.set(fillPos.x, fillPos.y, fillPos.z);
  fillLight.name = 'neutral-fill';
  group.add(fillLight);

  const ambient = new THREE.AmbientLight(0xffffff, intensity.ambient);
  ambient.name = 'neutral-ambient';
  group.add(ambient);

  return {
    group,
    dispose() {
      // DirectionalLight / AmbientLight own no GPU resources — removal is
      // sufficient; .clear() detaches children from the group so a future
      // scene re-use does not reference disposed handles.
      group.clear();
    },
  };
}
