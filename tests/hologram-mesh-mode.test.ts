// Tests for Hologram3DRenderer mesh mode (P3 / D5).
//
// We mock the three/webgpu + three/tsl + three/addons stack to keep the test
// in pure node, exercising:
//   - mode flag starts as 'text'
//   - setModel switches mode and attaches the loaded scene to charContainer
//   - setModel(null) returns to text mode and disposes the prior mesh
//   - in-flight setModel races are decided by token (latest wins)
//   - dispose() during in-flight load aborts cleanly (no throw, no late attach)
//   - setModel after dispose throws (consumer programming error)
//
// Implementation note: vi.mock factories are HOISTED to the top of the file
// before any other code runs, so any class/value referenced inside a factory
// must be created via vi.hoisted() (also hoisted) — otherwise the factory
// captures `undefined` at registration time and the renderer ends up with
// real `three/webgpu`, which then tries to call WebGPU on a node-side fake
// canvas. The hoisted block below sets up the entire stub graph.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const stubs = vi.hoisted(() => {
  // Position/scale/rotation stubs track writes so hit-test / translate-mesh
  // tests can assert the renderer reached through to charContainer.position.
  // Existing mesh-mode-basic tests do not read these values, so promoting
  // from no-op to tracking is backward-compatible.
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
  // Lights — added when the renderer init() started provisioning scene lights
  // for PBR irradiance (commit e1a1605). Position is exposed because the
  // renderer's init writes sunLight.position.set(...).
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

  // Mock GLB scene returned by GLTFLoader: a single Mesh under a Group, wired
  // so applyMediaArtShaderTreatment finds and replaces its material.
  const makeStubGltf = (): unknown => {
    const root = new StubGroup();
    const mesh = new StubMesh();
    Object.setPrototypeOf(mesh, StubMesh.prototype);
    root.add(mesh);
    return { scene: root, scenes: [root], animations: [] };
  };

  // TSL stub graph — every node returns a chainable `stubTslNode` so the
  // renderer's TSL chains (e.g. `positionWorld.y.mul(60.0).sub(...)`) compose
  // without throwing.
  const stubTslNode: Record<string, unknown> = {};
  // Methods that compose into more nodes — close over stubTslNode so chains
  // resolve back to the same shape.
  stubTslNode.mul = (): unknown => stubTslNode;
  stubTslNode.add = (): unknown => stubTslNode;
  stubTslNode.sub = (): unknown => stubTslNode;
  stubTslNode.normalize = (): unknown => stubTslNode;
  // Some chains access .y / .a — return a sub-node that's also chainable.
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
  // v0.13.0 — neutral environment texture stubs consumed by the bundled
  // rendering defaults installed in GltfMeshSource.attachToScene.
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
  // uniform() returns a value-bearing chainable node — has .value (Three.js
  // uniform contract) AND .mul/.add/.sub/.normalize so TSL chains on
  // uniforms (`uTime.mul(4.0)` etc.) compose without throwing.
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
    // KTX2/Draco extension wires registered by GltfMeshSource.parseGlb.
    // No-op stubs keep stderr clean during the test run; the production
    // code path is identical (try/catch around the registration).
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
// KTX2Loader / DRACOLoader are dynamically imported by `loaders.ts` on first
// use — stub them so the imports resolve in jsdom.
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

describe('Hologram3DRenderer mesh mode', () => {
  beforeEach(() => {
    stubFetch.mockClear();
  });

  it('starts in text mode', () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    expect(r.getMode()).toBe('text');
    expect(r.getMeshState()).toBeNull();
    r.dispose();
  });

  it('setModel(null) on a fresh renderer is a no-op', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const result = await r.setModel(null);
    expect(result).toBeNull();
    expect(r.getMode()).toBe('text');
    r.dispose();
  });

  it('setModel switches to mesh mode and attaches the loaded scene', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const state = await r.setModel({
      type: 'gltf',
      id: 'test-asset',
      url: 'https://cdn.test/asset.glb',
    });
    expect(state).not.toBeNull();
    expect(state?.id).toBe('test-asset');
    expect(r.getMode()).toBe('mesh');
    expect(r.getMeshState()).toBe(state);
    r.dispose();
  });

  it('setModel(null) after a mesh load returns to text mode and disposes', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const state = await r.setModel({
      type: 'gltf',
      id: 'test-asset',
      url: 'https://cdn.test/asset.glb',
    });
    const disposeSpy = vi.spyOn(state!, 'dispose');
    const result = await r.setModel(null);
    expect(result).toBeNull();
    expect(r.getMode()).toBe('text');
    expect(r.getMeshState()).toBeNull();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    r.dispose();
  });

  it('setModel race: only the latest call wins, prior load is disposed', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const first = r.setModel({ type: 'gltf', id: 'first', url: 'https://cdn/a.glb' });
    const second = r.setModel({ type: 'gltf', id: 'second', url: 'https://cdn/b.glb' });
    const [r1, r2] = await Promise.all([first, second]);
    expect(r1).toBeNull();
    expect(r2?.id).toBe('second');
    expect(r.getMeshState()?.id).toBe('second');
    r.dispose();
  });

  it('dispose during in-flight load swallows the load and disposes resources', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const inflight = r.setModel({ type: 'gltf', id: 'doomed', url: 'https://cdn/x.glb' });
    r.dispose();
    const result = await inflight;
    expect(result).toBeNull();
    expect(r.getMeshState()).toBeNull();
  });

  it('setModel after dispose throws', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    r.dispose();
    await expect(
      r.setModel({ type: 'gltf', id: 'late', url: 'https://cdn/late.glb' }),
    ).rejects.toThrow(/disposed/);
  });

  it('renderFrame in mesh mode does not throw', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.setModel({
      type: 'gltf',
      id: 'rendered',
      url: 'https://cdn.test/r.glb',
    });
    r.setTransition(1);
    expect(() => r.renderFrame()).not.toThrow();
    r.dispose();
  });
});

// ── Mesh single-hand pinch-grab API (#26) ────────────────────────────────────
//
// Pins the contract exposed by Hologram3DRenderer for media-art mesh mode:
//
//   - hitTestMesh returns null in text mode, {hit:false|true} in mesh mode.
//   - grabMesh is a mode gate (false in text, true once setModel resolves).
//   - translateMeshTo writes charContainer.position using the same
//     CSS→world projection the text-mode active-drag path uses, so rotation
//     around the mesh's own center is preserved after translation.
//   - releaseMesh clears the drag flag but leaves the final position on the
//     Three.js group — the mesh stays where the user released it.
//   - resetTransform is the escape hatch that returns position to origin.
//
// The pivot-indicator fade channel (applyContainerRotationAndZoom) is not
// asserted here — it is verified indirectly through activeMeshDrag wiring
// and exercised live in the landing/app studio flow. The StubRaycaster is
// swapped per-test via prototype patching when hit-vs-miss distinction
// matters; the default empty-intersection stub serves the common case.

describe('Hologram3DRenderer mesh single-hand pinch-grab', () => {
  it('hitTestMesh returns null in text mode (no mesh loaded)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    expect(r.hitTestMesh(400, 300)).toBeNull();
    r.dispose();
  });

  it('hitTestMesh returns {hit:false} when the raycast misses in mesh mode', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.setModel({ type: 'gltf', id: 'miss', url: 'https://cdn/m.glb' });
    // Default StubRaycaster.intersectObjects returns [] → miss.
    expect(r.hitTestMesh(400, 300)).toEqual({ hit: false });
    r.dispose();
  });

  it('hitTestMesh returns {hit:true} when the raycast intersects the mesh group', async () => {
    const orig = stubs.StubRaycaster.prototype.intersectObjects;
    stubs.StubRaycaster.prototype.intersectObjects = function () {
      return [{ object: {}, distance: 1 }];
    };
    try {
      const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
      await r.setModel({ type: 'gltf', id: 'hit', url: 'https://cdn/m.glb' });
      expect(r.hitTestMesh(400, 300)).toEqual({ hit: true });
      r.dispose();
    } finally {
      stubs.StubRaycaster.prototype.intersectObjects = orig;
    }
  });

  it('grabMesh returns false in text mode and true once mesh is loaded', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    expect(r.grabMesh()).toBe(false);
    await r.setModel({ type: 'gltf', id: 'grab', url: 'https://cdn/m.glb' });
    expect(r.grabMesh()).toBe(true);
    r.dispose();
  });

  it('translateMeshTo moves charContainer.position in mesh mode', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.setModel({ type: 'gltf', id: 'translate', url: 'https://cdn/m.glb' });
    r.grabMesh();
    // Upper-right of the 800×600 mock canvas — positive NDC X, positive NDC Y.
    r.translateMeshTo(700, 100);
    const container = (r as unknown as { charContainer: { position: { x: number; y: number; z: number } } }).charContainer;
    expect(container.position.x).toBeGreaterThan(0);
    expect(container.position.y).toBeGreaterThan(0);
    expect(container.position.z).toBe(0);
    r.dispose();
  });

  it('translateMeshTo is a no-op in text mode', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    const container = (r as unknown as { charContainer: { position: { x: number; y: number; z: number } } | null }).charContainer;
    const before = { x: container?.position.x ?? 0, y: container?.position.y ?? 0 };
    r.translateMeshTo(500, 200);
    expect(container?.position.x).toBe(before.x);
    expect(container?.position.y).toBe(before.y);
    r.dispose();
  });

  it('grab → translate → release keeps the final position on the group', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.setModel({ type: 'gltf', id: 'seq', url: 'https://cdn/m.glb' });
    expect(r.grabMesh()).toBe(true);
    r.translateMeshTo(600, 200);
    const container = (r as unknown as { charContainer: { position: { x: number; y: number; z: number } } }).charContainer;
    const committed = { x: container.position.x, y: container.position.y };
    expect(committed.x).not.toBe(0);
    r.releaseMesh();
    // Position is persisted by the Three.js Group — release only clears the
    // internal drag flag, it does not rewind translation.
    expect(container.position.x).toBe(committed.x);
    expect(container.position.y).toBe(committed.y);
    r.dispose();
  });

  it('resetTransform clears mesh drag state and returns container to origin', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.setModel({ type: 'gltf', id: 'reset', url: 'https://cdn/m.glb' });
    r.grabMesh();
    r.translateMeshTo(700, 100);
    r.resetTransform();
    const container = (r as unknown as { charContainer: { position: { x: number; y: number; z: number } } }).charContainer;
    expect(container.position.x).toBe(0);
    expect(container.position.y).toBe(0);
    expect(container.position.z).toBe(0);
    r.dispose();
  });

  it('renderFrame after grab + translate still does not throw (rotation pipeline intact)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.setModel({ type: 'gltf', id: 'no-regress', url: 'https://cdn/m.glb' });
    r.setTransition(1);
    r.grabMesh();
    r.translateMeshTo(500, 300);
    r.setRotation(0.3, -0.2, 0.1);
    r.setZoom(1.5);
    expect(() => r.renderFrame()).not.toThrow();
    r.releaseMesh();
    expect(() => r.renderFrame()).not.toThrow();
    r.dispose();
  });
});

// ── Mesh-animation pause API (0.15.0) ───────────────────────────────────────
//
// Pins the contract added for the 2026-04-21 Studio ADR that removed
// drawing-mode auto-animation and froze media-art by default:
//
//   - setModel() leaves a freshly loaded mesh paused (isMeshAnimationPaused()
//     returns true) — no auto-play, matching the drawing-mode policy.
//   - toggleMeshAnimation() flips the flag and returns the new paused state;
//     a pair of toggles returns to the initial paused state (idempotent).
//   - In text mode (no mesh loaded) both getters return true and toggling is
//     a no-op — defensive against hosts that call the API pre-setModel.
//   - renderFrame while paused does not throw (clock drains are safe even
//     when no animation is active).

describe('Hologram3DRenderer mesh-animation pause', () => {
  it('isMeshAnimationPaused returns true in text mode (no mesh loaded)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    expect(r.isMeshAnimationPaused()).toBe(true);
    r.dispose();
  });

  it('freshly loaded mesh is paused (no auto-play)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.setModel({ type: 'gltf', id: 'fresh', url: 'https://cdn/m.glb' });
    expect(r.isMeshAnimationPaused()).toBe(true);
    r.dispose();
  });

  it('toggleMeshAnimation flips paused → playing → paused', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.setModel({ type: 'gltf', id: 'toggle', url: 'https://cdn/m.glb' });
    // Starts paused.
    expect(r.isMeshAnimationPaused()).toBe(true);
    // First toggle → playing (returns false).
    expect(r.toggleMeshAnimation()).toBe(false);
    expect(r.isMeshAnimationPaused()).toBe(false);
    // Second toggle → paused again (returns true).
    expect(r.toggleMeshAnimation()).toBe(true);
    expect(r.isMeshAnimationPaused()).toBe(true);
    r.dispose();
  });

  it('toggleMeshAnimation is a no-op in text mode (returns true, state unchanged)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    expect(r.toggleMeshAnimation()).toBe(true);
    expect(r.isMeshAnimationPaused()).toBe(true);
    r.dispose();
  });

  it('setModel re-pauses even when called while currently playing', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.setModel({ type: 'gltf', id: 'first', url: 'https://cdn/m1.glb' });
    r.toggleMeshAnimation(); // → playing
    expect(r.isMeshAnimationPaused()).toBe(false);
    // Loading a second model must return to the frozen default so the user
    // has to opt-in to animation on every new media-art selection.
    await r.setModel({ type: 'gltf', id: 'second', url: 'https://cdn/m2.glb' });
    expect(r.isMeshAnimationPaused()).toBe(true);
    r.dispose();
  });

  it('renderFrame does not throw while paused', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.setModel({ type: 'gltf', id: 'render-paused', url: 'https://cdn/m.glb' });
    r.setTransition(1);
    expect(r.isMeshAnimationPaused()).toBe(true);
    expect(() => r.renderFrame()).not.toThrow();
    // After resume renderFrame must also remain safe.
    r.toggleMeshAnimation();
    expect(() => r.renderFrame()).not.toThrow();
    r.dispose();
  });
});
