import type { Texture } from 'three/webgpu';

type ThreeWebGPU = typeof import('three/webgpu');

const WIDTH = 128;
const HEIGHT = 64;

// 3-tone vertical gradient approximating a softbox studio: warm floor, bright
// horizon, cool ceiling. Assigned to scene.environment with EquirectangularReflectionMapping;
// three generates the PMREM internally on first use, so no PMREMGenerator or
// binary HDR ships with @glymo/core.
export function createNeutralEnvironmentTexture(THREE: ThreeWebGPU): Texture {
  const data = new Float32Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    const v = y / (HEIGHT - 1);
    let r: number;
    let g: number;
    let b: number;
    if (v < 0.45) {
      const t = v / 0.45;
      r = 0.30 + 0.10 * t;
      g = 0.25 + 0.10 * t;
      b = 0.22 + 0.08 * t;
    } else if (v < 0.60) {
      const t = (v - 0.45) / 0.15;
      r = 0.40 + 0.40 * t;
      g = 0.35 + 0.40 * t;
      b = 0.30 + 0.40 * t;
    } else {
      const t = (v - 0.60) / 0.40;
      r = 0.80 - 0.25 * t;
      g = 0.75 - 0.10 * t;
      b = 0.70 + 0.10 * t;
    }
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 1.0;
    }
  }
  const texture = new THREE.DataTexture(
    data,
    WIDTH,
    HEIGHT,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  texture.name = '@glymo/core:neutral-environment';
  return texture;
}
