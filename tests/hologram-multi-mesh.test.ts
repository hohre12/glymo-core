// Tests for Hologram3DRenderer multi-mesh API (Task 1.2 — red).
//
// Pins the future contract for managing multiple independent meshes keyed by
// per-object id:
//
//   - getMesh(objectId) returns null for unknown ids.
//   - addMesh(objectId, modelId, descriptor) resolves with an opaque
//     MeshHandle, stores it under objectId, and exposes it via getMesh.
//   - getAllMeshIds() enumerates every stored objectId.
//
// Expected to FAIL at this stage — addMesh / getMesh / getAllMeshIds are
// implemented in Task 1.3. The red failure mode is a TypeError: "renderer.addMesh
// is not a function" (or the equivalent for the sibling getters).
//
// Stub infrastructure mirrors hologram-mesh-mode.test.ts: vi.hoisted() classes
// registered via vi.mock() factories, a mock fetch that returns empty GLB
// buffers, and a createMockCanvas() helper. The mock canvas is required
// because Vitest's jsdom environment has <canvas> but no WebGPU context —
// Three.js WebGPURenderer would blow up on a real jsdom canvas. Using the
// `gltf` descriptor keeps the test self-contained — GLTFLoader already has
// a working stub that parses into a StubGroup + StubMesh tree.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const stubs = vi.hoisted(() => {
  const makeVec3Stub = () => {
    const v: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void; setScalar: (s: number) => void } = {
      x: 0, y: 0, z: 0,
      set(x: number, y: number, z: number) { v.x = x; v.y = y; v.z = z; },
      setScalar(s: number) { v.x = s; v.y = s; v.z = s; },
    };
    return v;
  };
  class StubObject3D {
    position = makeVec3Stub();
    scale = makeVec3Stub();
    rotation = makeVec3Stub();
    children: StubObject3D[] = [];
    visible = true;
    name = '';
    add(o: StubObject3D): void { this.children.push(o); }
    remove(o: StubObject3D): void {
      this.children = this.children.filter((c) => c !== o);
    }
    clear(): void { this.children = []; }
    traverse(cb: (obj: unknown) => void): void {
      cb(this);
      for (const c of this.children) c.traverse(cb);
    }
  }
  class StubGroup extends StubObject3D {}
  class StubMesh extends StubObject3D {
    geometry: { dispose: () => void } = { dispose: () => {} };
    material: { dispose: () => void } | null = null;
  }
  class StubScene extends StubObject3D {}
  class StubPerspectiveCamera extends StubObject3D {
    aspect = 1;
    fov = 35;
    updateProjectionMatrix(): void {}
  }
  class StubBox3 {
    min = { x: -1, y: -1, z: -1 };
    max = { x: 1, y: 1, z: 1 };
    setFromObject(_obj: unknown): this { return this; }
  }
  class StubColor {
    r = 0; g = 0; b = 0;
    constructor(_hex?: number) {}
  }
  class StubMeshBasicMaterial {
    opacity = 0;
    transparent = false;
    depthWrite = true;
    dispose = (): void => {};
  }
  class StubMeshStandardNodeMaterial {
    transparent = false;
    depthWrite = true;
    side = 0;
    colorNode: unknown;
    opacityNode: unknown;
    emissiveNode: unknown;
    dispose = (): void => {};
  }
  class StubPlaneGeometry { dispose = (): void => {}; }
  class StubCircleGeometry { dispose = (): void => {}; }
  class StubVector2 { x = 0; y = 0; }
  class StubRaycaster {
    setFromCamera(_v: unknown, _c: unknown): void {}
    intersectObjects(_objs: unknown[], _r: boolean): unknown[] { return []; }
  }
  class StubClock {
    getDelta(): number { return 0.016; }
  }
  class StubAnimationMixer {
    clipAction(_clip: unknown): { play: () => void } { return { play: () => {} }; }
    update = (_dt: number): void => {};
    stopAllAction = (): void => {};
  }
  class StubDirectionalLight extends StubObject3D {
    constructor(_color?: number, _intensity?: number) { super(); }
  }
  class StubAmbientLight extends StubObject3D {
    constructor(_color?: number, _intensity?: number) { super(); }
  }
  class StubWebGPURenderer {
    domElement: unknown;
    constructor(opts: { canvas: unknown }) { this.domElement = opts.canvas; }
    setPixelRatio = (): void => {};
    setClearColor = (): void => {};
    setSize = (): void => {};
    getPixelRatio = (): number => 1;
    clear = (): void => {};
    render = (): void => {};
    init = async (): Promise<void> => {};
    dispose = (): void => {};
    sortObjects = false;
  }
  class StubPostProcessing {
    outputNode: unknown;
    constructor(_renderer: unknown) {}
    render = (): void => {};
  }

  const makeStubGltf = (): unknown => {
    const root = new StubGroup();
    const mesh = new StubMesh();
    Object.setPrototypeOf(mesh, StubMesh.prototype);
    root.add(mesh);
    return { scene: root, scenes: [root], animations: [] };
  };

  const stubTslNode: Record<string, unknown> = {};
  stubTslNode.mul = (): unknown => stubTslNode;
  stubTslNode.add = (): unknown => stubTslNode;
  stubTslNode.sub = (): unknown => stubTslNode;
  stubTslNode.normalize = (): unknown => stubTslNode;
  Object.defineProperty(stubTslNode, 'y', { get: () => stubTslNode });
  Object.defineProperty(stubTslNode, 'a', { get: () => stubTslNode });

  return {
    StubObject3D,
    StubGroup,
    StubMesh,
    StubScene,
    StubPerspectiveCamera,
    StubBox3,
    StubColor,
    StubMeshBasicMaterial,
    StubMeshStandardNodeMaterial,
    StubPlaneGeometry,
    StubCircleGeometry,
    StubVector2,
    StubRaycaster,
    StubClock,
    StubAnimationMixer,
    StubDirectionalLight,
    StubAmbientLight,
    StubWebGPURenderer,
    StubPostProcessing,
    makeStubGltf,
    stubTslNode,
  };
});

vi.mock('three/webgpu', () => ({
  Object3D: stubs.StubObject3D,
  Group: stubs.StubGroup,
  Mesh: stubs.StubMesh,
  Scene: stubs.StubScene,
  PerspectiveCamera: stubs.StubPerspectiveCamera,
  Box3: stubs.StubBox3,
  Color: stubs.StubColor,
  MeshBasicMaterial: stubs.StubMeshBasicMaterial,
  MeshStandardNodeMaterial: stubs.StubMeshStandardNodeMaterial,
  PlaneGeometry: stubs.StubPlaneGeometry,
  CircleGeometry: stubs.StubCircleGeometry,
  Vector2: stubs.StubVector2,
  Raycaster: stubs.StubRaycaster,
  Clock: stubs.StubClock,
  AnimationMixer: stubs.StubAnimationMixer,
  DirectionalLight: stubs.StubDirectionalLight,
  AmbientLight: stubs.StubAmbientLight,
  WebGPURenderer: stubs.StubWebGPURenderer,
  PostProcessing: stubs.StubPostProcessing,
  FrontSide: 0,
  DoubleSide: 2,
  DataTexture: class {
    mapping = 0;
    needsUpdate = false;
    name = '';
    dispose(): void {}
    constructor(_data: unknown, _w: number, _h: number, _fmt: number, _type: number) {}
  },
  RGBAFormat: 1023,
  FloatType: 1015,
  EquirectangularReflectionMapping: 303,
}));

vi.mock('three/tsl', () => {
  const makeUniformNode = (initial: number): unknown => {
    const node: Record<string, unknown> = {
      value: initial,
      mul: () => stubs.stubTslNode,
      add: () => stubs.stubTslNode,
      sub: () => stubs.stubTslNode,
      normalize: () => stubs.stubTslNode,
    };
    Object.defineProperty(node, 'y', { get: () => stubs.stubTslNode });
    Object.defineProperty(node, 'a', { get: () => stubs.stubTslNode });
    return node;
  };
  return {
    Fn: (cb: () => unknown) => () => cb(),
    float: () => stubs.stubTslNode,
    vec3: () => stubs.stubTslNode,
    uniform: (initial: number) => makeUniformNode(initial),
    color: () => stubs.stubTslNode,
    mix: () => stubs.stubTslNode,
    positionWorld: stubs.stubTslNode,
    normalWorld: stubs.stubTslNode,
    cameraPosition: stubs.stubTslNode,
    sin: () => stubs.stubTslNode,
    smoothstep: () => stubs.stubTslNode,
    abs: () => stubs.stubTslNode,
    dot: () => stubs.stubTslNode,
    pow: () => stubs.stubTslNode,
    clamp: () => stubs.stubTslNode,
    texture: () => stubs.stubTslNode,
    uv: () => stubs.stubTslNode,
    pass: () => ({
      getTextureNode: () => stubs.stubTslNode,
    }),
  };
});

vi.mock('three/addons/tsl/display/BloomNode.js', () => ({
  bloom: () => ({
    threshold: { value: 0 },
    strength: { value: 0 },
    radius: { value: 0 },
  }),
}));

vi.mock('three/examples/jsm/geometries/TextGeometry.js', () => ({
  TextGeometry: class { dispose = (): void => {}; },
}));

vi.mock('three/examples/jsm/loaders/FontLoader.js', () => ({
  Font: class { constructor(_data: unknown) {} },
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setKTX2Loader(_l: unknown): this { return this; }
    setDRACOLoader(_l: unknown): this { return this; }
    parse(
      _buffer: ArrayBuffer,
      _path: string,
      onLoad: (gltf: unknown) => void,
      _onError: unknown,
    ): void {
      onLoad(stubs.makeStubGltf());
    }
  },
}));
vi.mock('three/examples/jsm/loaders/KTX2Loader.js', () => ({
  KTX2Loader: class {
    setTranscoderPath(_p: string): this { return this; }
  },
}));
vi.mock('three/examples/jsm/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class {
    setDecoderPath(_p: string): this { return this; }
  },
}));

const stubFetch = vi.fn(async (url: string) => {
  if (typeof url === 'string' && url.includes('typeface.json')) {
    return new Response(JSON.stringify({ glyphs: {} }), { status: 200 });
  }
  return new Response(new ArrayBuffer(8), { status: 200 });
});
vi.stubGlobal('fetch', stubFetch);
vi.stubGlobal('window', { devicePixelRatio: 1 });
vi.stubGlobal('performance', { now: () => 0 });

import { Hologram3DRenderer } from '../src/hologram/Hologram3DRenderer.js';
import type { MeshSourceDescriptor } from '../src/hologram/types.js';

function createMockCanvas(): HTMLCanvasElement {
  return {
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  } as unknown as HTMLCanvasElement;
}

// Shared descriptor factory for multi-mesh tests. Uses the `gltf` variant
// because it matches the existing GLTFLoader stub (StubGroup + StubMesh tree)
// and keeps each test self-contained — every call returns a fresh descriptor
// with the same stable id so the cache key is consistent across mounts.
function earthDescriptor(): MeshSourceDescriptor {
  return {
    type: 'gltf',
    id: 'earth',
    url: 'https://cdn.test/earth.glb',
  };
}

describe('Hologram3DRenderer multi-mesh', () => {
  let renderer: Hologram3DRenderer;

  beforeEach(() => {
    stubFetch.mockClear();
    renderer = new Hologram3DRenderer({ canvas: createMockCanvas() });
  });

  it('returns null for unknown objectId', () => {
    expect(renderer.getMesh('unknown')).toBeNull();
    renderer.dispose();
  });

  it('stores a mesh under its objectId after addMesh resolves', async () => {
    const descriptor: MeshSourceDescriptor = {
      type: 'gltf',
      id: 'earth',
      url: 'https://cdn.test/earth.glb',
    };
    const handle = await renderer.addMesh('obj-1', 'earth', descriptor);
    expect(handle).not.toBeNull();
    expect(renderer.getMesh('obj-1')).toBe(handle);
    expect(renderer.getAllMeshIds()).toEqual(['obj-1']);
    renderer.dispose();
  });

  it('removes a mesh and returns true; second call returns false', async () => {
    await renderer.addMesh('obj-1', 'earth', earthDescriptor());
    expect(await renderer.removeMesh('obj-1')).toBe(true);
    expect(renderer.getMesh('obj-1')).toBeNull();
    expect(await renderer.removeMesh('obj-1')).toBe(false);
    renderer.dispose();
  });

  it('removing one mesh leaves others intact', async () => {
    await renderer.addMesh('obj-1', 'earth', earthDescriptor());
    await renderer.addMesh('obj-2', 'earth', earthDescriptor());
    await renderer.removeMesh('obj-1');
    expect(renderer.getAllMeshIds()).toEqual(['obj-2']);
    renderer.dispose();
  });

  // ── hitTestMeshForSelection (Task 1.6) ─────────────────────────────────────
  //
  // Raycast outcome is driven by the stubbed StubRaycaster. The default
  // `intersectObjects` returns `[]` (miss) — we swap its prototype in the
  // "hit" test to force a hit, mirroring the idiom already used by
  // hologram-mesh-mode.test.ts for the legacy `hitTestMesh` path. The
  // actual CSS coords passed in do not matter because the stub does not
  // interpret them.

  it('hitTestMeshForSelection returns objectId when a mesh is hit', async () => {
    await renderer.addMesh('obj-1', 'earth', earthDescriptor());
    const orig = stubs.StubRaycaster.prototype.intersectObjects;
    stubs.StubRaycaster.prototype.intersectObjects = function () {
      return [{ object: {}, distance: 1 }];
    };
    try {
      // Arbitrary CSS coord (canvas center) — raycast outcome is stubbed.
      const hitId = renderer.hitTestMeshForSelection(400, 300);
      expect(hitId).toBe('obj-1');
    } finally {
      stubs.StubRaycaster.prototype.intersectObjects = orig;
    }
    renderer.dispose();
  });

  it('hitTestMeshForSelection returns null when no mesh is hit', async () => {
    await renderer.addMesh('obj-1', 'earth', earthDescriptor());
    // Raycast stubbed to miss (default [] return) — stands in for the
    // no-intersection case.
    const hitId = renderer.hitTestMeshForSelection(0, 0);
    expect(hitId).toBeNull();
    renderer.dispose();
  });
});
