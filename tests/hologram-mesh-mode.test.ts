// Tests for Hologram3DRenderer media-art mesh lifecycle (P3 / D5).
//
// Canonical multi-mesh API (0.16.0+, Task 1.7 of docs/plans/media-art-multi-mesh.md):
//   - addMesh(objectId, modelId, descriptor, ctx?) loads and attaches a mesh
//     under a caller-assigned objectId; returns a stable MeshHandle.
//   - removeMesh(objectId) disposes the slot and removes it from the map.
//   - in-flight addMesh races are decided by token (latest wins) per-objectId.
//   - dispose() during in-flight load aborts cleanly (no throw, no late attach).
//   - addMesh after dispose is a no-op that resolves to null.
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
  // Some chains access .y / .a / .rgb — return a sub-node that's also chainable.
  Object.defineProperty(stubTslNode, 'y', { get: () => stubTslNode });
  Object.defineProperty(stubTslNode, 'a', { get: () => stubTslNode });
  Object.defineProperty(stubTslNode, 'rgb', { get: () => stubTslNode });

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
    vec4: () => stubs.stubTslNode,
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

describe('Hologram3DRenderer media-art mesh lifecycle', () => {
  beforeEach(() => {
    stubFetch.mockClear();
  });

  it('starts with no meshes', () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    expect(r.hasAnyMesh()).toBe(false);
    expect(r.getMesh('obj-1')).toBeNull();
    r.dispose();
  });

  it('removeMesh on a fresh renderer is a no-op', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const removed = await r.removeMesh('obj-1');
    expect(removed).toBe(false);
    expect(r.hasAnyMesh()).toBe(false);
    r.dispose();
  });

  it('addMesh loads, attaches, and exposes a stable handle via getMesh', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'test-asset', {
      type: 'gltf',
      id: 'test-asset',
      url: 'https://cdn.test/asset.glb',
    });
    expect(handle).not.toBeNull();
    expect(handle?.objectId).toBe('obj-1');
    expect(handle?.modelId).toBe('test-asset');
    expect(handle?.state.id).toBe('test-asset');
    expect(r.hasAnyMesh()).toBe(true);
    // Stable reference — same object on subsequent gets.
    expect(r.getMesh('obj-1')).toBe(handle);
    r.dispose();
  });

  it('removeMesh after addMesh disposes the prior mesh and clears the slot', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'test-asset', {
      type: 'gltf',
      id: 'test-asset',
      url: 'https://cdn.test/asset.glb',
    });
    const disposeSpy = vi.spyOn(handle!.state, 'dispose');
    const removed = await r.removeMesh('obj-1');
    expect(removed).toBe(true);
    expect(r.hasAnyMesh()).toBe(false);
    expect(r.getMesh('obj-1')).toBeNull();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    r.dispose();
  });

  it('addMesh race: only the latest call wins for the same objectId, prior load is disposed', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const first = r.addMesh('obj-1', 'first', { type: 'gltf', id: 'first', url: 'https://cdn/a.glb' });
    const second = r.addMesh('obj-1', 'second', { type: 'gltf', id: 'second', url: 'https://cdn/b.glb' });
    const [r1, r2] = await Promise.all([first, second]);
    expect(r1).toBeNull();
    expect(r2?.state.id).toBe('second');
    expect(r.getMesh('obj-1')?.state.id).toBe('second');
    r.dispose();
  });

  it('dispose during in-flight load swallows the load and disposes resources', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const inflight = r.addMesh('obj-1', 'doomed', { type: 'gltf', id: 'doomed', url: 'https://cdn/x.glb' });
    r.dispose();
    const result = await inflight;
    expect(result).toBeNull();
    expect(r.getMesh('obj-1')).toBeNull();
  });

  it('addMesh after dispose is a no-op and resolves to null', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    r.dispose();
    const result = await r.addMesh('obj-1', 'late', {
      type: 'gltf',
      id: 'late',
      url: 'https://cdn/late.glb',
    });
    expect(result).toBeNull();
  });

  it('renderFrame with a loaded mesh does not throw', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'rendered', {
      type: 'gltf',
      id: 'rendered',
      url: 'https://cdn.test/r.glb',
    });
    r.setTransition(1);
    expect(() => r.renderFrame()).not.toThrow();
    r.dispose();
  });
});

// ── Phase 6 6a-5a — I10 (Issue #3) coexistence regression gate ──────────────
//
// Pre-Phase-6 the renderer had an exclusivity branch in `renderFrame`:
//
//   if (this.meshes.size > 0) {
//     this.renderMeshFrame(elapsed);
//     this.applyContainerRotationAndZoom(...);
//     this.postProcessing!.render();
//     return;   //  ← skipped the char-sync loop below
//   }
//
// User-visible consequence: "apply MediaArt → switch to text mode → type a
// character → select the hologram tool" rendered nothing for the typed
// glyph because the mesh-loaded gate short-circuited the char loop. The
// 6a-5a fix drops the early-return; both loops now coexist (renderMeshFrame
// is internally guarded by `loadedSlots.length === 0 → return`).
//
// This regression suite asserts the post-fix behaviour: with mesh slots
// loaded AND chars queued via `setText`, `renderFrame` materialises char
// meshes via the char-sync loop, leaving both registries populated.
//
// `getRenderedCharIds()` (added in 0.27.0) is the load-bearing probe — it
// surfaces the post-`renderFrame` `charMeshes` registry without exposing
// the private map.

describe('Hologram3DRenderer I10 (Issue #3) coexistence — Phase 6 6a-5a', () => {
  // The load-bearing assertion: with mesh slots loaded AND chars queued via
  // `setText`, `renderFrame` walks the chars and CALLS `createCharMesh` for
  // each new id. Pre-fix the `if (this.meshes.size > 0) {…; return;}`
  // exclusivity gate skipped this loop entirely; the fix removed the gate
  // and now `createCharMesh` MUST be invoked.
  //
  // We spy on `createCharMesh` rather than asserting `getRenderedCharIds()`
  // includes the char because `createCharMesh` returns `null` whenever
  // `this.loadedFont` is unset (font load races with the test's
  // `renderFrame` call — incidental to the I10 contract). The spy
  // observation is unambiguous: pre-fix it would NOT be called when meshes
  // are loaded; post-fix it IS called.
  //
  // Type cast to `any` for the private method spy is the canonical Vitest
  // pattern for asserting on inaccessible-by-design APIs that are still
  // load-bearing for behaviour. The fix surface (`renderFrame`) is public.

  it('renderFrame with mesh slots AND chars walks the char loop (createCharMesh invoked)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    // Wait for init() — guarantees `loadedFont` is set so the char loop's
    // first guard (`if (!THREE || !this.loadedFont) return null`) inside
    // createCharMesh does not short-circuit unrelated to the I10 contract.
    await r.ready;

    // 1. Apply MediaArt — mesh slot loaded.
    await r.addMesh('obj-1', 'mesh-asset', {
      type: 'gltf',
      id: 'mesh-asset',
      url: 'https://cdn.test/mesh.glb',
    });
    expect(r.hasAnyMesh()).toBe(true);

    // 2. Add a text-mode char (the Hologram tool target).
    r.setText([
      {
        id: 'char-A',
        char: 'A',
        x: 100,
        y: 100,
        height: 60,
        entryTime: 0,
        isDeleting: false,
      } as never,
    ]);

    // 3. Spy on the private char-mesh factory BEFORE driving the frame.
    //    `mockImplementation(() => null)` short-circuits the original body
    //    (which depends on `TextGeometry.computeBoundingBox`, not provided
    //    by the StubPlaneGeometry). The I10 contract is "the loop CALLS
    //    createCharMesh"; whether the stubbed factory yields a real mesh
    //    is incidental.
    const createCharSpy = vi
      .spyOn(r as any, 'createCharMesh')
      .mockImplementation(() => null);

    // 4. Drive a frame at full transition.
    r.setTransition(1);
    expect(() => r.renderFrame()).not.toThrow();

    // 5. Load-bearing post-fix assertion: the char loop ran and asked the
    //    factory to materialise 'A'.
    expect(createCharSpy).toHaveBeenCalledTimes(1);
    expect(createCharSpy).toHaveBeenCalledWith('A', expect.any(Number), expect.any(Number));
    // Mesh slot still loaded (renderMeshFrame is internally guarded but
    // does not delete slots).
    expect(r.hasAnyMesh()).toBe(true);

    r.dispose();
  });

  it('renderFrame with mesh slots and NO chars does NOT call createCharMesh', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    await r.addMesh('obj-1', 'mesh-only', {
      type: 'gltf',
      id: 'mesh-only',
      url: 'https://cdn.test/mesh.glb',
    });
    r.setText([]);

    const createCharSpy = vi
      .spyOn(r as any, 'createCharMesh')
      .mockImplementation(() => null);
    r.setTransition(1);
    expect(() => r.renderFrame()).not.toThrow();

    expect(r.hasAnyMesh()).toBe(true);
    // Empty char set → factory never called even though the loop walks.
    expect(createCharSpy).not.toHaveBeenCalled();

    r.dispose();
  });

  it('renderFrame with chars and NO mesh slots still walks the char loop (regression: char-only path unchanged)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    expect(r.hasAnyMesh()).toBe(false);

    r.setText([
      {
        id: 'char-B',
        char: 'B',
        x: 50,
        y: 50,
        height: 60,
        entryTime: 0,
        isDeleting: false,
      } as never,
    ]);

    const createCharSpy = vi
      .spyOn(r as any, 'createCharMesh')
      .mockImplementation(() => null);
    r.setTransition(1);
    expect(() => r.renderFrame()).not.toThrow();

    expect(r.hasAnyMesh()).toBe(false);
    expect(createCharSpy).toHaveBeenCalledTimes(1);
    expect(createCharSpy).toHaveBeenCalledWith('B', expect.any(Number), expect.any(Number));

    r.dispose();
  });

  it('getRenderedCharIds() exposes empty registry on a fresh renderer', () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    expect(r.getRenderedCharIds()).toEqual([]);
    r.dispose();
  });
});

// ── Mesh single-hand pinch-grab API (#26) ────────────────────────────────────
//
// Pins the contract exposed by Hologram3DRenderer for media-art single-hand
// pinch manipulation (0.16.0+ per-object signatures):
//
//   - hitTestMeshForSelection returns the objectId when the ray hits a mesh
//     descendant and null otherwise.
//   - grabMesh(objectId) gates on slot existence + loaded state.
//   - translateMeshTo(objectId, x, y) writes charContainer.position using the
//     same CSS→world projection the text-mode active-drag path uses, so
//     rotation around the mesh's own center is preserved after translation.
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
  it('hitTestMeshForSelection returns null with no mesh loaded', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    expect(r.hitTestMeshForSelection(400, 300)).toBeNull();
    r.dispose();
  });

  it('hitTestMeshForSelection returns null when the raycast misses a loaded mesh', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'miss', { type: 'gltf', id: 'miss', url: 'https://cdn/m.glb' });
    // Default StubRaycaster.intersectObjects returns [] → miss.
    expect(r.hitTestMeshForSelection(400, 300)).toBeNull();
    r.dispose();
  });

  it('hitTestMeshForSelection returns the objectId when the raycast intersects', async () => {
    const orig = stubs.StubRaycaster.prototype.intersectObjects;
    stubs.StubRaycaster.prototype.intersectObjects = function () {
      return [{ object: {}, distance: 1 }];
    };
    try {
      const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
      await r.addMesh('obj-1', 'hit', { type: 'gltf', id: 'hit', url: 'https://cdn/m.glb' });
      expect(r.hitTestMeshForSelection(400, 300)).toBe('obj-1');
      r.dispose();
    } finally {
      stubs.StubRaycaster.prototype.intersectObjects = orig;
    }
  });

  it('grabMesh returns false when the slot is absent and true once loaded', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    expect(r.grabMesh('obj-1')).toBe(false);
    await r.addMesh('obj-1', 'grab', { type: 'gltf', id: 'grab', url: 'https://cdn/m.glb' });
    expect(r.grabMesh('obj-1')).toBe(true);
    r.dispose();
  });

  it('translateMeshTo stores a per-slot CSS offset for a loaded mesh (no charContainer mutation)', async () => {
    // v0.17 per-mesh positioning: the offset is stored on the InternalMeshSlot
    // and applied inside renderMeshFrame. charContainer.position MUST stay at
    // origin so other meshes — which share the same parent container — are
    // not dragged along with this one.
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'translate', { type: 'gltf', id: 'translate', url: 'https://cdn/m.glb' });
    r.grabMesh('obj-1');
    r.translateMeshTo('obj-1', 700, 100);
    const offset = r.getMeshOffsetCss('obj-1');
    expect(offset).not.toBeNull();
    expect(offset!.x).toBe(700);
    expect(offset!.y).toBe(100);
    const container = (r as unknown as { charContainer: { position: { x: number; y: number; z: number } } }).charContainer;
    expect(container.position.x).toBe(0);
    expect(container.position.y).toBe(0);
    expect(container.position.z).toBe(0);
    r.dispose();
  });

  it('translateMeshTo is a no-op when the slot is absent', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    r.translateMeshTo('obj-1', 500, 200);
    expect(r.getMeshOffsetCss('obj-1')).toBeNull();
    const container = (r as unknown as { charContainer: { position: { x: number; y: number; z: number } } | null }).charContainer;
    expect(container?.position.x ?? 0).toBe(0);
    expect(container?.position.y ?? 0).toBe(0);
    r.dispose();
  });

  it('grab → translate → release keeps the slot offset intact (not cleared by release)', async () => {
    // Release only drops the renderer-wide `activeMeshDrag` flag. The slot's
    // offsetCss is deliberately preserved so the mesh stays where the user
    // dropped it — future grabs re-anchor on translateMeshTo, and
    // resetTransform is the escape hatch that clears every slot's offset.
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'seq', { type: 'gltf', id: 'seq', url: 'https://cdn/m.glb' });
    expect(r.grabMesh('obj-1')).toBe(true);
    r.translateMeshTo('obj-1', 600, 200);
    const committed = r.getMeshOffsetCss('obj-1');
    expect(committed).toEqual({ x: 600, y: 200 });
    r.releaseMesh();
    expect(r.getMeshOffsetCss('obj-1')).toEqual(committed);
    r.dispose();
  });

  it('translateMeshTo on one mesh does NOT move another mesh on the same renderer', async () => {
    // Regression lock for the 2026-04-22 "center-of-screen" bug: prior to
    // v0.17 translateMeshTo mutated the shared charContainer.position, which
    // dragged every mesh together. This test spawns two meshes and asserts
    // that moving one leaves the other's offset untouched.
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-a', 'multi-a', { type: 'gltf', id: 'multi-a', url: 'https://cdn/a.glb' });
    await r.addMesh('obj-b', 'multi-b', { type: 'gltf', id: 'multi-b', url: 'https://cdn/b.glb' });
    r.translateMeshTo('obj-a', 200, 150);
    expect(r.getMeshOffsetCss('obj-a')).toEqual({ x: 200, y: 150 });
    expect(r.getMeshOffsetCss('obj-b')).toBeNull();
    r.translateMeshTo('obj-b', 600, 450);
    expect(r.getMeshOffsetCss('obj-a')).toEqual({ x: 200, y: 150 });
    expect(r.getMeshOffsetCss('obj-b')).toEqual({ x: 600, y: 450 });
    r.dispose();
  });

  it('resetTransform clears mesh drag state and returns container to origin', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'reset', { type: 'gltf', id: 'reset', url: 'https://cdn/m.glb' });
    r.grabMesh('obj-1');
    r.translateMeshTo('obj-1', 700, 100);
    r.resetTransform();
    const container = (r as unknown as { charContainer: { position: { x: number; y: number; z: number } } }).charContainer;
    expect(container.position.x).toBe(0);
    expect(container.position.y).toBe(0);
    expect(container.position.z).toBe(0);
    r.dispose();
  });

  it('renderFrame after grab + translate still does not throw (rotation pipeline intact)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'no-regress', { type: 'gltf', id: 'no-regress', url: 'https://cdn/m.glb' });
    r.setTransition(1);
    r.grabMesh('obj-1');
    r.translateMeshTo('obj-1', 500, 300);
    r.setRotation(0.3, -0.2, 0.1);
    r.setZoom(1.5);
    expect(() => r.renderFrame()).not.toThrow();
    r.releaseMesh();
    expect(() => r.renderFrame()).not.toThrow();
    r.dispose();
  });
});

// ── Pivot indicator screen-constant size (0.22.1) ────────────────────────────
//
// Pins the 1/zoom counter-scale in applyContainerRotationAndZoom. The pivot
// cross + dot are fixed world-space geometry (0.6 + 0.04 units); camera.z =
// 6 / zoom brings the camera arbitrarily close as zoom grows, so without
// counter-scaling the indicator fills the viewport. Added after 0.22.0
// removed the zoom upper clamp — prior versions capped zoom at 3× by accident
// which kept the pivot's apparent size tolerable, but the cap is now gone.
//
// Regression gate: pivotGroup.scale must be 1/zoom on every frame.

describe('Hologram3DRenderer pivot screen-constant scaling', () => {
  it('pivotGroup.scale equals 1/zoom at zoom=1 (baseline)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'pivot-baseline', {
      type: 'gltf',
      id: 'pivot-baseline',
      url: 'https://cdn/p.glb',
    });
    r.setTransition(1);
    r.setZoom(1);
    r.renderFrame();
    const pivot = (r as unknown as { pivotGroup: { scale: { x: number; y: number; z: number } } }).pivotGroup;
    expect(pivot.scale.x).toBeCloseTo(1, 5);
    expect(pivot.scale.y).toBeCloseTo(1, 5);
    expect(pivot.scale.z).toBeCloseTo(1, 5);
    r.dispose();
  });

  it('pivotGroup.scale shrinks to 0.1 at zoom=10 (large zoom compensates)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'pivot-zoom-in', {
      type: 'gltf',
      id: 'pivot-zoom-in',
      url: 'https://cdn/p.glb',
    });
    r.setTransition(1);
    r.setZoom(10);
    r.renderFrame();
    const pivot = (r as unknown as { pivotGroup: { scale: { x: number; y: number; z: number } } }).pivotGroup;
    expect(pivot.scale.x).toBeCloseTo(0.1, 5);
    expect(pivot.scale.y).toBeCloseTo(0.1, 5);
    expect(pivot.scale.z).toBeCloseTo(0.1, 5);
    r.dispose();
  });

  it('pivotGroup.scale grows to 2 at zoom=0.5 (small zoom expands proportionally)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'pivot-zoom-out', {
      type: 'gltf',
      id: 'pivot-zoom-out',
      url: 'https://cdn/p.glb',
    });
    r.setTransition(1);
    r.setZoom(0.5);
    r.renderFrame();
    const pivot = (r as unknown as { pivotGroup: { scale: { x: number; y: number; z: number } } }).pivotGroup;
    expect(pivot.scale.x).toBeCloseTo(2, 5);
    expect(pivot.scale.y).toBeCloseTo(2, 5);
    expect(pivot.scale.z).toBeCloseTo(2, 5);
    r.dispose();
  });

  it('pivotGroup.scale follows zoom changes across successive frames', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'pivot-sweep', {
      type: 'gltf',
      id: 'pivot-sweep',
      url: 'https://cdn/p.glb',
    });
    r.setTransition(1);
    const pivot = (r as unknown as { pivotGroup: { scale: { x: number; y: number; z: number } } }).pivotGroup;
    for (const z of [1, 2, 5, 20, 100, 0.3]) {
      r.setZoom(z);
      r.renderFrame();
      expect(pivot.scale.x).toBeCloseTo(1 / z, 4);
      expect(pivot.scale.y).toBeCloseTo(1 / z, 4);
      expect(pivot.scale.z).toBeCloseTo(1 / z, 4);
    }
    r.dispose();
  });
});

// ── Mesh two-hand gesture response (0.22.2) ──────────────────────────────────
//
// Pins the two canonical fixes for the "mesh frozen under two-hand gesture"
// bug surfaced immediately after 0.22.0 removed the zoom upper clamp:
//
//   1. Zoom must produce a visible mesh size change. `computeMeshNormalize`
//      cancels zoom when `sizeCss` is set (so the initial apply lands at the
//      stroke CSS bbox), but that cancellation also neutralised the camera
//      dolly. The `renderMeshFrame` path now multiplies `baseScale * zoom`
//      when `sizeCss` is set, restoring linear zoom response. When `sizeCss`
//      is null the multiplier is 1 — the camera dolly alone gives linear
//      response (multiplying would be quadratic).
//
//   2. Rotation must reach the mesh. Meshes live on `meshRoot` (0.18.0)
//      which does NOT inherit `charContainer.rotation`, so two-hand X/Y/Z
//      rotation was silently dropped on the floor. `renderMeshFrame` now
//      writes `this.rot{X,Y,Z}` onto each mesh slot's group.rotation every
//      frame.
//
// The 0.22.2 regression gate keeps both fixes green going forward.

describe('Hologram3DRenderer mesh two-hand gesture response', () => {
  it('with sizeCss set, mesh visual size grows linearly with setZoom (via scale*zoom proxy)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'zoom-sized', {
      type: 'gltf',
      id: 'zoom-sized',
      url: 'https://cdn/z.glb',
    });
    r.setTransition(1);
    r.setMeshSizeCss('obj-1', 100, 100);
    const group = handle!.state.group as unknown as { scale: { x: number; y: number; z: number } };

    // In the sizeCss branch, `normalize` is proportional to `visibleHalf`,
    // which is proportional to `1/zoom` (because `camera.z = 6/zoom`). The
    // zoom multiplier cancels that so `group.scale` stays constant across
    // zoom values, and the camera dolly alone provides the linear visual
    // response. The externally-observable invariant is therefore:
    //   scale * zoom  ∝  zoom   (linear in zoom)
    // which is exactly what the screen projection formula reduces to when
    // the camera is at `z = 6/zoom`.

    r.setZoom(1);
    r.renderFrame();
    const effectiveAtZoom1 = group.scale.x * 1;
    expect(effectiveAtZoom1).toBeGreaterThan(0);

    r.setZoom(2);
    r.renderFrame();
    expect(group.scale.x * 2).toBeCloseTo(effectiveAtZoom1 * 2, 5);

    r.setZoom(5);
    r.renderFrame();
    expect(group.scale.x * 5).toBeCloseTo(effectiveAtZoom1 * 5, 5);

    r.setZoom(0.5);
    r.renderFrame();
    expect(group.scale.x * 0.5).toBeCloseTo(effectiveAtZoom1 * 0.5, 5);

    r.dispose();
  });

  it('with sizeCss set, group.scale itself is zoom-invariant (the cancellation is the fix)', async () => {
    // This is the direct regression gate on the 0.22.2 change: without the
    // `* this.zoom` multiplier in `renderMeshFrame`, `group.scale` scaled
    // as 1/zoom and the camera dolly cancelled out. With the multiplier,
    // the two cancellations compose to a CONSTANT `group.scale` plus a
    // linear camera dolly — net-linear visual response.
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'zoom-invariant', {
      type: 'gltf',
      id: 'zoom-invariant',
      url: 'https://cdn/zi.glb',
    });
    r.setTransition(1);
    r.setMeshSizeCss('obj-1', 100, 100);
    const group = handle!.state.group as unknown as { scale: { x: number } };

    r.setZoom(1);
    r.renderFrame();
    const s1 = group.scale.x;

    for (const z of [0.3, 2, 5, 20]) {
      r.setZoom(z);
      r.renderFrame();
      // scale stays constant in world — camera dolly does the zooming.
      expect(group.scale.x).toBeCloseTo(s1, 5);
    }

    r.dispose();
  });

  it('mesh rotation reflects setRotation every frame', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'rot', {
      type: 'gltf',
      id: 'rot',
      url: 'https://cdn/r.glb',
    });
    r.setTransition(1);
    const group = handle!.state.group as unknown as { rotation: { x: number; y: number; z: number } };

    r.setRotation(0, 0, 0);
    r.renderFrame();
    expect(group.rotation.x).toBeCloseTo(0, 5);
    expect(group.rotation.y).toBeCloseTo(0, 5);
    expect(group.rotation.z).toBeCloseTo(0, 5);

    r.setRotation(0.5, -0.3, 0.7);
    r.renderFrame();
    expect(group.rotation.x).toBeCloseTo(0.5, 5);
    expect(group.rotation.y).toBeCloseTo(-0.3, 5);
    expect(group.rotation.z).toBeCloseTo(0.7, 5);

    r.setRotation(1.2, 0.8, -0.4);
    r.renderFrame();
    expect(group.rotation.x).toBeCloseTo(1.2, 5);
    expect(group.rotation.y).toBeCloseTo(0.8, 5);
    expect(group.rotation.z).toBeCloseTo(-0.4, 5);

    r.dispose();
  });

  it('zoom and rotation compose per-mesh across successive frames', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'combo', {
      type: 'gltf',
      id: 'combo',
      url: 'https://cdn/c.glb',
    });
    r.setTransition(1);
    r.setMeshSizeCss('obj-1', 80, 120);
    const group = handle!.state.group as unknown as {
      scale: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
    };

    r.setZoom(1);
    r.setRotation(0, 0, 0);
    r.renderFrame();
    const baseScale = group.scale.x;

    // Compose: zoom 3x, yaw quarter turn.
    r.setZoom(3);
    r.setRotation(0.1, Math.PI / 2, 0.05);
    r.renderFrame();
    // scale stays constant (zoom cancellation); camera dolly delivers
    // the visual response — same invariant as the zoom-invariant test.
    expect(group.scale.x).toBeCloseTo(baseScale, 5);
    expect(group.rotation.x).toBeCloseTo(0.1, 5);
    expect(group.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    expect(group.rotation.z).toBeCloseTo(0.05, 5);

    r.dispose();
  });
});

// ── Mesh-animation pause API (0.16.0 per-object) ─────────────────────────────
//
// Pins the contract added for the 2026-04-21 Studio ADR that removed
// drawing-mode auto-animation and froze media-art by default; reparameterised
// in 0.16.0 (Task 1.7) so every slot has its own pause state:
//
//   - addMesh() leaves a freshly loaded mesh paused (isMeshAnimationPaused()
//     returns true) — no auto-play, matching the drawing-mode policy.
//   - toggleMeshAnimation(objectId) flips the flag and returns the new paused
//     state; a pair of toggles returns to the initial paused state.
//   - With no loaded slot both getters return null — symmetric contract.
//   - renderFrame while paused does not throw (clock drains are safe even
//     when no animation is active).

describe('Hologram3DRenderer mesh-animation pause', () => {
  it('isMeshAnimationPaused returns null when no mesh is loaded', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    expect(r.isMeshAnimationPaused('obj-1')).toBeNull();
    r.dispose();
  });

  it('freshly loaded mesh is paused (no auto-play)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'fresh', { type: 'gltf', id: 'fresh', url: 'https://cdn/m.glb' });
    expect(r.isMeshAnimationPaused('obj-1')).toBe(true);
    r.dispose();
  });

  it('toggleMeshAnimation flips paused → playing → paused', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'toggle', { type: 'gltf', id: 'toggle', url: 'https://cdn/m.glb' });
    // Starts paused.
    expect(r.isMeshAnimationPaused('obj-1')).toBe(true);
    // First toggle → playing (returns false).
    expect(r.toggleMeshAnimation('obj-1')).toBe(false);
    expect(r.isMeshAnimationPaused('obj-1')).toBe(false);
    // Second toggle → paused again (returns true).
    expect(r.toggleMeshAnimation('obj-1')).toBe(true);
    expect(r.isMeshAnimationPaused('obj-1')).toBe(true);
    r.dispose();
  });

  it('toggleMeshAnimation returns null when the slot is absent', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    expect(r.toggleMeshAnimation('obj-1')).toBeNull();
    expect(r.isMeshAnimationPaused('obj-1')).toBeNull();
    r.dispose();
  });

  it('re-adding the same objectId re-pauses even when the prior slot was playing', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'first', { type: 'gltf', id: 'first', url: 'https://cdn/m1.glb' });
    r.toggleMeshAnimation('obj-1'); // → playing
    expect(r.isMeshAnimationPaused('obj-1')).toBe(false);
    // Replacing the mesh under the same objectId must return to the frozen
    // default so the user has to opt-in to animation on every new selection.
    await r.addMesh('obj-1', 'second', { type: 'gltf', id: 'second', url: 'https://cdn/m2.glb' });
    expect(r.isMeshAnimationPaused('obj-1')).toBe(true);
    r.dispose();
  });

  it('renderFrame does not throw while paused', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'render-paused', { type: 'gltf', id: 'render-paused', url: 'https://cdn/m.glb' });
    r.setTransition(1);
    expect(r.isMeshAnimationPaused('obj-1')).toBe(true);
    expect(() => r.renderFrame()).not.toThrow();
    // After resume renderFrame must also remain safe.
    r.toggleMeshAnimation('obj-1');
    expect(() => r.renderFrame()).not.toThrow();
    r.dispose();
  });
});

// ── meshRoot container separation + per-mesh CSS size (0.18.0) ───────────────
//
// Pins the contract introduced to fix the two media-art bugs:
//
//   1. Meshes were inheriting `charContainer.rotation` — the idle-wobble
//      `applyContainerRotationAndZoom` writes each frame — and drifted
//      around their stroke anchor. Fix: parent mesh slots under a
//      non-rotating `meshRoot` group parented directly to the scene.
//   2. Every mesh was normalised to world size 2.0 regardless of the
//      source stroke bbox, breaking the visual link to the drawing. Fix:
//      `setMeshSizeCss(objectId, w, h)` records a per-slot target CSS
//      size that `renderMeshFrame` maps into world units via the current
//      camera frustum.

describe('Hologram3DRenderer meshRoot container separation (0.18.0)', () => {
  it('meshRoot is a direct child of the scene after init', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    const internal = r as unknown as {
      scene: { children: unknown[] } | null;
      meshRoot: { name: string } | null;
    };
    expect(internal.scene).not.toBeNull();
    expect(internal.meshRoot).not.toBeNull();
    expect(internal.meshRoot!.name).toBe('meshRoot');
    expect(internal.scene!.children.includes(internal.meshRoot!)).toBe(true);
    r.dispose();
  });

  it('loaded mesh is parented under meshRoot, not under charContainer', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'mesh-parent', {
      type: 'gltf',
      id: 'mesh-parent',
      url: 'https://cdn.test/m.glb',
    });
    expect(handle).not.toBeNull();
    const internal = r as unknown as {
      charContainer: { children: unknown[] } | null;
      meshRoot: { children: unknown[] } | null;
    };
    const group = handle!.state.group as unknown;
    expect(internal.meshRoot!.children.includes(group)).toBe(true);
    expect(internal.charContainer!.children.includes(group)).toBe(false);
    r.dispose();
  });

  it('charContainer rotation does NOT propagate to the mesh group', async () => {
    // Regression guard for the idle-wobble drift bug: meshRoot must sit on
    // its own scene-graph branch so rotating charContainer leaves the
    // mesh's local rotation at identity.
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'no-drift', {
      type: 'gltf',
      id: 'no-drift',
      url: 'https://cdn.test/m.glb',
    });
    expect(handle).not.toBeNull();
    const internal = r as unknown as {
      charContainer: { rotation: { y: number } };
    };
    internal.charContainer.rotation.y = 1.0;
    // The mesh group's rotation writer is renderMeshFrame/source.update;
    // neither should pick up charContainer.rotation. The stub Group's
    // rotation is mutation-tracked per-instance, so asserting on the
    // mesh's own rotation is sufficient to prove no inheritance.
    const meshGroup = handle!.state.group as unknown as { rotation: { y: number } };
    expect(meshGroup.rotation.y).toBe(0);
    r.dispose();
  });

  it('removeMesh detaches the group from meshRoot', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'detach', {
      type: 'gltf',
      id: 'detach',
      url: 'https://cdn.test/m.glb',
    });
    const internal = r as unknown as { meshRoot: { children: unknown[] } };
    const group = handle!.state.group as unknown;
    expect(internal.meshRoot.children.includes(group)).toBe(true);
    await r.removeMesh('obj-1');
    expect(internal.meshRoot.children.includes(group)).toBe(false);
    r.dispose();
  });
});

describe('Hologram3DRenderer per-mesh CSS size (0.18.0)', () => {
  it('getMeshSizeCss returns null before setMeshSizeCss is called', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'size-default', {
      type: 'gltf',
      id: 'size-default',
      url: 'https://cdn.test/m.glb',
    });
    expect(r.getMeshSizeCss('obj-1')).toBeNull();
    r.dispose();
  });

  it('setMeshSizeCss / getMeshSizeCss round-trip stores a copy (not a live reference)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'size-rt', {
      type: 'gltf',
      id: 'size-rt',
      url: 'https://cdn.test/m.glb',
    });
    r.setMeshSizeCss('obj-1', 120, 80);
    const first = r.getMeshSizeCss('obj-1');
    expect(first).toEqual({ width: 120, height: 80 });
    // Mutating the returned object must NOT bleed into the internal slot.
    first!.width = 999;
    expect(r.getMeshSizeCss('obj-1')).toEqual({ width: 120, height: 80 });
    r.dispose();
  });

  it('setMeshSizeCss on an unknown objectId is a no-op', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.ready;
    r.setMeshSizeCss('missing', 100, 100);
    expect(r.getMeshSizeCss('missing')).toBeNull();
    r.dispose();
  });

  it('setMeshSizeCss ignores non-positive dims', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'size-guard', {
      type: 'gltf',
      id: 'size-guard',
      url: 'https://cdn.test/m.glb',
    });
    r.setMeshSizeCss('obj-1', 0, 10);
    expect(r.getMeshSizeCss('obj-1')).toBeNull();
    r.setMeshSizeCss('obj-1', 10, -1);
    expect(r.getMeshSizeCss('obj-1')).toBeNull();
    r.setMeshSizeCss('obj-1', 10, 10);
    expect(r.getMeshSizeCss('obj-1')).toEqual({ width: 10, height: 10 });
    r.dispose();
  });

  it('renderFrame with sizeCss applies a scale derived from the canvas CSS formula (not the fixed 2.0/maxDim)', async () => {
    // maxDim of the stub bbox is 2 (bbox min=(-1,-1,-1), max=(1,1,1)), so the
    // default normalize is 2.0/2 = 1.0 → group.scale = 1 * transition.
    // With sizeCss={100,100} and canvas 800×600 / camZ=6 / fov=35°:
    //   visibleHalfH = 6 * tan(17.5°) ≈ 1.8924
    //   aspect = 800/600 = 4/3  → visibleHalfW ≈ 2.5232
    //   targetWorld = (100 / 800) * 2 * 2.5232 ≈ 0.6308
    //   normalize = 0.6308 / 2 ≈ 0.3154
    //   baseScale = 0.3154 * 1 ≈ 0.3154
    // Assert the resulting group.scale is ~0.315 — well below the default 1.0
    // that the fixed-normalize fallback would produce.
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'size-apply', {
      type: 'gltf',
      id: 'size-apply',
      url: 'https://cdn.test/m.glb',
    });
    r.setTransition(1);
    r.setMeshSizeCss('obj-1', 100, 100);
    r.renderFrame();
    const meshGroup = handle!.state.group as unknown as { scale: { x: number } };
    expect(meshGroup.scale.x).toBeGreaterThan(0.2);
    expect(meshGroup.scale.x).toBeLessThan(0.5);
    r.dispose();
  });

  it('renderFrame without sizeCss falls back to the world-size-2 normalise (scale ≈ 1.0 for unit bbox)', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    const handle = await r.addMesh('obj-1', 'size-fallback', {
      type: 'gltf',
      id: 'size-fallback',
      url: 'https://cdn.test/m.glb',
    });
    r.setTransition(1);
    r.renderFrame();
    const meshGroup = handle!.state.group as unknown as { scale: { x: number } };
    // maxDim=2 for the stub bbox → normalize=2/2=1, baseScale=1*transition=1.
    expect(meshGroup.scale.x).toBeCloseTo(1.0, 5);
    r.dispose();
  });

  it('removeMesh clears sizeCss so a re-add under the same id starts fresh', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-1', 'first', { type: 'gltf', id: 'first', url: 'https://cdn/m.glb' });
    r.setMeshSizeCss('obj-1', 200, 200);
    await r.removeMesh('obj-1');
    expect(r.getMeshSizeCss('obj-1')).toBeNull();
    await r.addMesh('obj-1', 'second', { type: 'gltf', id: 'second', url: 'https://cdn/m.glb' });
    expect(r.getMeshSizeCss('obj-1')).toBeNull();
    r.dispose();
  });

  it('resetTransform clears sizeCss for every slot', async () => {
    const r = new Hologram3DRenderer({ canvas: createMockCanvas() });
    await r.addMesh('obj-a', 'reset-a', { type: 'gltf', id: 'reset-a', url: 'https://cdn/a.glb' });
    await r.addMesh('obj-b', 'reset-b', { type: 'gltf', id: 'reset-b', url: 'https://cdn/b.glb' });
    r.setMeshSizeCss('obj-a', 100, 100);
    r.setMeshSizeCss('obj-b', 200, 200);
    r.resetTransform();
    expect(r.getMeshSizeCss('obj-a')).toBeNull();
    expect(r.getMeshSizeCss('obj-b')).toBeNull();
    r.dispose();
  });
});
