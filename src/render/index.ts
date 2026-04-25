// `@glymo/core/render` subpath barrel — Phase 6 entry into the new
// Three.js-backed rendering surface. Imported by:
//   - `@glymo/ui` test code (Browser Mode SceneGraph smoke + future
//     scene-graph integration tests),
//   - eventually by the post-Phase-6 `<CanvasEngine>` wiring inside
//     `@glymo/ui` once the `GLYMO_RENDER_V2` flag flips.
//
// Per §1.5.4 R-A — every type re-exported here is a Glymo-owned plain
// TypeScript shape (HTMLCanvasElement / number / string / SceneGraphBackend
// enum). The `Layer` interface accepts Three.js types in its
// `LayerInitContext`, but that surface is `@internal` and only relevant to
// authors of new layer subclasses inside `@glymo/core`. External consumers
// never need to import `Layer` to use a `SceneGraph`.

export {
  SceneGraph,
  type SceneGraphInitOptions,
  type SceneGraphBackend,
} from './SceneGraph.js';

// `Layer` + `LayerInitContext` are kept @internal — re-exported here only
// so concrete layer modules under `@glymo/core/render/layers/*` (added in
// subsequent Phase 6 sub-slices) can import them via the subpath without
// reaching into `./Layer.js` directly. External consumers should treat
// these as not part of the supported public surface.
export type { Layer, LayerInitContext } from './Layer.js';

// ── Concrete layers (Phase 6 sub-slices 6a-2…6a-6) ────────────────────────
// Concrete `Layer` implementations live under `./layers/` and re-export
// from this barrel so consumers `import { StrokeLayer, … } from
// '@glymo/core/render'` without reaching into the sub-directory.
//
// Per §1.5.4 R-A — each concrete layer's PUBLIC surface (constructor
// options, public methods) deals only in Glymo / DOM types. Three.js
// types are confined to the implementation.

// Shared base for the CanvasTexture-quad layer family
// (StrokeLayer / TextOverlayLayer / AmbientGlowLayer / Hologram3DLayer /
// HandLayer all extend it). Exposed for `@internal` consumption by future
// layer authors and for direct construction in tests / consumers that
// want non-default name/z combinations without picking a specific
// subclass.
export {
  CanvasMirrorLayer,
  type CanvasMirrorLayerInit,
} from './layers/CanvasMirrorLayer.js';

export { StrokeLayer, type StrokeLayerOptions } from './layers/StrokeLayer.js';
export {
  TextOverlayLayer,
  type TextOverlayLayerOptions,
} from './layers/TextOverlayLayer.js';
export {
  AmbientGlowLayer,
  type AmbientGlowLayerOptions,
} from './layers/AmbientGlowLayer.js';
export {
  Hologram3DLayer,
  type Hologram3DLayerOptions,
} from './layers/Hologram3DLayer.js';
export {
  HandLayer,
  type HandLayerOptions,
} from './layers/HandLayer.js';
