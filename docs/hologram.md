# Hologram 3D — `Hologram3DRenderer` + Media Art

A self-contained Three.js WebGPU renderer for holographic 3D text and media-art meshes. Lives **alongside** the main `Glymo` facade rather than as a stage of the 6-stage pipeline — see [architecture.md](./architecture.md#rendering-modes).

The host (consumer app) creates and owns the `Hologram3DRenderer` against its own canvas, then wires it to `Glymo` through the two injection seams (`setMeshHitTestFn`, `setMeshTranslator`) so click-to-select and translate-to-move keep media-art meshes in sync with their underlying `GlymoObject`.

## Peer dependency

The hologram subsystem reaches Three.js through an **optional peer dependency**:

```bash
npm install @glymo/core three   # three >= 0.160
```

Three.js is dynamically imported (`three/webgpu`, `three/tsl`, `three/addons/tsl/display/BloomNode.js`, `three/examples/jsm/loaders/*`) so apps that don't use the hologram path don't pay the bundle cost.

## Quickstart

```typescript
import { Hologram3DRenderer } from '@glymo/core';

const renderer = new Hologram3DRenderer({ canvas: hologramCanvas });
const ok = await renderer.ready;          // false → WebGPU init / font load failed
if (!ok) console.warn('Hologram unavailable');

renderer.setSize(width, height);          // CSS dimensions; renderer owns canvas.width/height
renderer.setText(chars);                  // HologramChar[] for the text path

// Each animation frame:
renderer.renderFrame();
```

The renderer **owns the canvas backbuffer** — never set `width` / `height` props on the canvas element directly. Use a `ResizeObserver` in the host and forward CSS dimensions through `setSize(cssW, cssH)`. A WebGPU swap-chain race against React produces "resolve target size does not match" validation errors otherwise.

## `Hologram3DRenderer` API

### Lifecycle

| Member | Returns | Notes |
|--------|---------|-------|
| `new Hologram3DRenderer({ canvas })` | — | Starts async init. |
| `ready` | `Promise<boolean>` | Resolves `true` when WebGPU + font loaded; `false` on failure. |
| `isAvailable` | `boolean` | Synchronous post-init check. |
| `setSize(cssW, cssH)` | `void` | Resize backbuffer + camera frustum. Skipped while zero-sized. |
| `setEnabled(enabled)` | `void` | Pauses rendering when false. |
| `renderFrame()` | `void` | Host calls this from its rAF loop. |
| `dispose()` | `void` | Releases GPU + scene-graph resources. |

### Text mode (per-character holograms)

| Method | Notes |
|--------|-------|
| `setText(chars: HologramChar[])` | Replaces the displayed character set. |
| `grabChar(charId, x, y)` | Begin dragging a char to a CSS-coord position. |
| `releaseChar(charId)` | Stop dragging — char stays at its last position. |
| `hitTestChar(x, y, maxDist)` | `HitTestResult \| null` — nearest char within `maxDist` CSS px. |

### Global transform

These apply to BOTH text and meshes (shared rotation / zoom / spread / hand-control feel):

| Method | Range | Notes |
|--------|-------|-------|
| `setRotation(rotX, rotY, rotZ?)` | radians | Z is optional. |
| `setZoom(z)` | `>= 0.01` | No upper bound — two-hand stretch can drive arbitrarily large. |
| `setTransition(t)` | `[0, 1]` | Entry/exit easing — 0 hidden, 1 fully visible. |
| `setSpread(s)` | `[0, 6]` | 0 flat, 1 normal, 6 max explosion. |
| `setHandActive(active)` | bool | Visual affordance for active two-hand control. |
| `resetTransform()` | — | Clears rotation, zoom, spread, drag state, AND every mesh's per-slot offset + size. |

### Mesh mode (multi-mesh, canonical since 0.16.0)

```typescript
const handle = await renderer.addMesh(objectId, modelId, descriptor, ctx?);
```

| Method | Returns | Notes |
|--------|---------|-------|
| `addMesh(objectId, modelId, descriptor, ctx?)` | `Promise<MeshHandle \| null>` | Loads + registers under `objectId`. Replaces any existing slot for the same id. `null` when superseded by a newer call for the same id, or the renderer is disposed. |
| `removeMesh(objectId)` | `Promise<boolean>` | Tears down the slot. Idempotent. |
| `getMesh(objectId)` | `MeshHandle \| null` | Stable handle once load committed; identity-comparable with `addMesh` result. |
| `getAllMeshIds()` | `readonly string[]` | Includes still-loading slots. Filter via `getMesh(id) !== null` for loaded-only. |
| `hasAnyMesh()` | `boolean` | Cheap probe. |

### Mesh transform

| Method | Notes |
|--------|-------|
| `translateMeshTo(objectId, x, y)` | Absolute CSS-pixel position. Replaces prior `offsetCss`. |
| `translateMeshBy(objectId, dx, dy)` | Additive **canvas-pixel** delta (DPR-scaled), matches `Glymo.translateObject`'s public unit. Renderer converts to CSS internally. |
| `getMeshOffsetCss(objectId)` | `{ x, y } \| null` — current per-slot offset. |
| `setMeshSizeCss(objectId, w, h)` | Target CSS dimensions; mesh scales so its largest axis matches. Without this, meshes normalise to world size 2.0 (the pre-0.18.0 behaviour). |
| `getMeshSizeCss(objectId)` | `{ width, height } \| null` |
| `grabMesh(objectId)` | `boolean` — begin single-hand pinch-grab. Returns `false` if the slot isn't loaded. |
| `releaseMesh()` | No-arg — drag state is renderer-wide (single boolean). |
| `hitTestMeshForSelection(cssX, cssY)` | `objectId \| null` — top-most mesh under the point across all loaded slots. |

Per-mesh offset + size are slot-owned: applying media art to two different objects spawns the meshes at their respective bbox centres, not stacked at the same point. `resetTransform()` clears both.

### Mesh animation

| Method | Notes |
|--------|-------|
| `isMeshAnimationPaused(objectId)` | `boolean \| null` — `null` when slot doesn't exist or is still loading. |
| `toggleMeshAnimation(objectId)` | `boolean \| null` — returns the new paused state. |

**Freshly loaded meshes are always paused.** Consumers wake animation in response to an explicit user action (the air-magic pinch in Studio) — matches the 2026-04-21 Studio convention.

## Mesh source pack

Three concrete sources ship with `@glymo/core`, dispatched by descriptor `type`:

| `type` | Class | Use case | Visual treatment |
|--------|-------|----------|------------------|
| `'gltf'` | `GltfMeshSource` | Simple objects / food / vehicles — plain GLB shape | Cyan holographic shader + bundled neutral environment + 3-point light rig (Earth/Dog-grade quality without per-asset HDRI) |
| `'gltf-pbr'` | `GlbPbrMeshSource` | Hero objects / animals — GLB + custom HDR | Textured-luminance cyan tint with fresnel rim, IBL from per-asset HDRI |
| `'procedural-planet'` | `ProceduralPlanetMeshSource` | `space` category (Earth, future planets) | Three layered spheres (body / clouds / atmosphere) with NASA-PD textures + TSL Sobel coastline edge glow |

### Descriptor schema

```typescript
type MeshSourceDescriptor =
  | GltfMeshSourceDescriptor
  | GltfPbrMeshSourceDescriptor
  | ProceduralPlanetMeshSourceDescriptor;

interface GltfMeshSourceDescriptor {
  type: 'gltf';
  id: string;                       // Stable catalog id — used for cache key
  url: string;                      // Public GLB URL
  cache?: MeshSourceCache;
  environmentIntensity?: number;    // Default 0.6
  lightRigIntensity?: { key?: number; fill?: number; ambient?: number };
}

interface GltfPbrMeshSourceDescriptor {
  type: 'gltf-pbr';
  id: string;
  url: string;
  hdriUrl: string;                  // RGBE .hdr environment map
  cache?: MeshSourceCache;
  environmentIntensity?: number;    // Default 0.6
}

interface ProceduralPlanetMeshSourceDescriptor {
  type: 'procedural-planet';
  id: string;
  textures: { daymap: string; clouds: string; normal: string };  // Three URLs sharing dimensions
  textureSize: { width: number; height: number };
  cache?: MeshSourceCache;
  axialTiltDeg?: number;            // Default 23.4 (Earth)
  rotationRate?: { body?: number; clouds?: number };  // Default body 0.10, clouds 0.13 rad/s
  atmosphereColorHex?: number;      // Default 0x00ccff (cyan)
}
```

### Cache contract

```typescript
interface MeshSourceCache {
  get(key: string): Promise<ArrayBuffer | null>;
  set(key: string, value: ArrayBuffer): Promise<void>;
}
```

Implementations may persist to IndexedDB, in-memory, or skip caching entirely. Keys are based on `descriptor.id` (NOT URL) so reloading after a CDN move still hits cache. Multi-asset sources namespace internally — the public contract stays `{get,set}(key, value)`.

### `createMeshSource` factory

```typescript
import { createMeshSource } from '@glymo/core';

const source = createMeshSource(descriptor);  // dispatches on descriptor.type
const state  = await source.load({ THREE, tsl }, ctx?);
```

You normally never call this directly — `Hologram3DRenderer.addMesh` does it for you. Useful when extending the source pack or stubbing in tests.

The factory is the **single dispatch point** from descriptor → `MeshSource` implementation. Adding a new variant is a one-line case in the factory + a fresh file under `hologram/sources/` extending `BaseMeshSource`. The exhaustive `never` branch makes a missing case a build-time error.

### `BaseMeshSource` (extending the pack)

Subclasses inherit cache wiring, fetcher (`fetcher` option override for tests), `id` validation, and a `fetchBuffer({ url, errorCode, cacheKeySuffix?, onProgress?, onCacheHit? })` helper that handles cached / streaming fetches with progress reporting.

Subclass contract:

1. Pass the descriptor to `super()`.
2. Implement `load(deps, ctx?)` — fetch + parse + assemble `MediaArtMeshState`.
3. Use the protected helpers instead of forking your own.

THREE / tsl are NEVER imported in the abstract base — they're passed via `load(deps)` so the file stays out of the initial bundle.

## Compressed-asset loaders (KTX2 / Draco)

Lazy-init singletons so future curated assets can ship as Draco-encoded GLBs or embed `.ktx2` textures without code changes:

```typescript
import { getKtx2Loader, getDracoLoader, setLoaderDecoderPaths } from '@glymo/core';

// Default decoder paths; override BEFORE the first source.load() if your app
// serves from a non-root pathname (e.g. Next.js basePath).
setLoaderDecoderPaths({
  ktx2: '/three/basis/',     // default
  draco: '/three/draco/',    // default
});
```

The decoder binaries are NOT bundled — copy them from `three/examples/jsm/libs/{basis,draco}/*` into your public assets at build time, matching the path you set above.

## Shared rendering defaults

Constants exported from `@glymo/core` so consumers can read the same values the bundled sources use:

| Export | Value | Meaning |
|--------|-------|---------|
| `BUNDLED_NEUTRAL_ENVIRONMENT` | `{ kind: 'room-environment', cacheKey: '@core:neutral-env' }` | PMREM generated via `THREE.RoomEnvironment` — no HDR ships in `@glymo/core` |
| `DEFAULT_ENVIRONMENT_INTENSITY` | `0.6` | Shared between `gltf` + `gltf-pbr` |
| `DEFAULT_LIGHT_RIG_INTENSITY` | `{ key: 1.6, fill: 0.4, ambient: 0.2 }` | 3-point rig defaults |
| `DEFAULT_KEY_LIGHT_POSITION` | `{ x: 3, y: 5, z: 4 }` | |
| `DEFAULT_FILL_LIGHT_POSITION` | `{ x: -4, y: 2, z: -3 }` | |
| `DEFAULT_AXIAL_TILT_DEG` | `23.4` | Earth |
| `DEFAULT_ROTATION_BODY` | `0.10` rad/s | |
| `DEFAULT_ROTATION_CLOUDS` | `0.13` rad/s | |
| `DEFAULT_ATMOSPHERE_COLOR_HEX` | `0x00ccff` | Cyan — overrideable per planet |

`VARIANT_DEFAULTS` + `getVariantDefaults(variant)` group these per descriptor type (`gltf` / `gltf-pbr` / `procedural-planet`).

## `createNeutralLightRig` + `createNeutralEnvironmentTexture`

```typescript
import { createNeutralLightRig, createNeutralEnvironmentTexture } from '@glymo/core';

const rig = createNeutralLightRig(THREE, {
  intensity: { key: 1.6, fill: 0.4, ambient: 0.2 },  // partial override
  keyPosition: { x: 3, y: 5, z: 4 },
  fillPosition: { x: -4, y: 2, z: -3 },
});
scene.add(rig.group);
// ...
rig.dispose();   // detaches children
```

`createNeutralEnvironmentTexture(THREE)` produces a 128×64 3-tone vertical-gradient `DataTexture` (warm floor, bright horizon, cool ceiling) in equirectangular mapping — assign to `scene.environment` and Three.js generates the PMREM internally on first use. Used by `GltfMeshSource` so no binary HDR ships with `@glymo/core`. The `cacheKey` field on `BUNDLED_NEUTRAL_ENVIRONMENT` (`@core:neutral-env`) is an identifier consumers can key shared instances against — the helper itself returns a fresh texture per call.

## Media-art shader treatments

Lower-level TSL primitives if you're authoring a new mesh source or visual treatment:

| Export | Purpose |
|--------|---------|
| `createMediaArtShaderNodes(deps)` | Builds the shared TSL node graph (luminance, fresnel, holo tint, scanlines). |
| `applyMediaArtShaderTreatment(...)` | Apply the cyan holo treatment to a node/material. |
| `applyTexturedMediaArtShaderTreatment(...)` | Variant that lets the GLB's albedo bleed through. Used by `gltf-pbr`. |
| `MEDIA_ART_LUMINANCE_STOPS` | Luminance-to-tint stops, exported so consumers can match the gradient when authoring matching UI. |

## Wiring with `Glymo` (host responsibility)

`@glymo/core` keeps the renderer-agnostic seam clean — `Glymo` doesn't know Three.js exists. The two injection points:

```typescript
// In your host (e.g. <CanvasEngine> in glymo-app or glymo-landing):
glymo.setMeshHitTestFn((x, y) => hologramRenderer.hitTestMeshForSelection(x, y));
glymo.setMeshTranslator((objectId, dx, dy) =>
  hologramRenderer.translateMeshBy(objectId, dx, dy),
);
```

With these wired:

- A click on a media-art mesh routes through `Glymo.selectObjectAtPoint` → returns the underlying `GlymoObject.id`.
- Any `Glymo.translateObject(id, dx, dy)` (move-tool drag, gesture translate, undo / redo) propagates to the mesh in lock-step with the `GlymoObject`.

Forwarding the **canvas-pixel** delta verbatim is intentional — `translateMeshBy` does the DPR conversion to CSS pixels at the boundary, so every translateObject call site stays single-unit.

For session round-trip, `Glymo.loadSession` emits `media-art:restore` per restored object whose `metadata.mediaArt` carries a valid `modelId` — the host subscribes and calls `addMesh` for each. See [session-doc.md](./session-doc.md#media-art-restore).

## Adding a new variant

1. Add the descriptor variant to the union in `src/hologram/types.ts` (`type: 'my-variant'` + per-type fields).
2. Create `src/hologram/sources/MyVariantMeshSource.ts` extending `BaseMeshSource`, implement `load(deps, ctx?)`.
3. Add the case in `src/hologram/sources/createMeshSource.ts` (the `never` branch will fail to compile until you do).
4. Add the variant defaults to `src/hologram/sources/variantDefaults.ts` if it has overridable per-frame parameters.
5. Re-export from `src/hologram/sources/index.ts` if it's part of the public surface.

Add a Vitest covering the descriptor → source dispatch and a smoke test of `load()` against a fixture before shipping.

## See also

- [architecture.md](./architecture.md) — overall module map, including the `setMeshHitTestFn` / `setMeshTranslator` seam diagram
- [session-doc.md](./session-doc.md) — `media-art:restore` event + `metadata.mediaArt` round-trip
- `docs/plans/media-art-mvp.md` and `docs/plans/media-art-multi-mesh.md` (in the monorepo root) — design history
