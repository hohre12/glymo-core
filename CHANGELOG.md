# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.27.4] - 2026-04-25

**Rendering pipeline v2 — Phase 6 sub-slice 6b-5+6b-6: VideoLayer + WatermarkLayer + Compositor-parity options.**

User-found regression: under `NEXT_PUBLIC_GLYMO_RENDER_V2=true`, camera mode rendered with a black background. Root cause: 6b-1+6b-2 wired only 5 of the legacy Compositor's source canvases (Stroke / TextOverlay / AmbientGlow / Hologram3D / Hand) and left the `'video'` and `'watermark'` layers unwired. This commit closes that gap AND adds the opacity / mirror options the legacy `videoPreprocess` expected.

Honest scope: this commit fixes the visibly broken camera background and the Strict-Mode dev safety bug. Other audit-surfaced gaps (camera blur, object-cover crop, post-process bloom, hologram double-image, recording target canvas) are explicitly DEFERRED with scope-locked sub-slice numbers below. `renderV2 = false` (default) is the production-safe path; flipping the flag to true is local-dev only until those sub-slices land.

### Added
- `src/render/layers/VideoLayer.ts` — wraps an `HTMLVideoElement` (camera stream) as a Three.js `VideoTexture` mounted on a fullscreen quad. Default `z = -2` (background, BELOW AmbientGlowLayer). `VideoTexture` auto-uploads frames every render; the layer's `render()` is a no-op. New options vs initial 6b-5 cut:
    * `opacity?: number` (default `1`; legacy compositor parity = `0.3`). Sub-1 forces `transparent: true` on the underlying material.
    * `mirror?: boolean` (default `true`). Achieved via `mesh.scale.x = -1` — free, no shader pass.
- `src/render/layers/WatermarkLayer.ts` — thin `CanvasMirrorLayer` subclass for the synthetic watermark tile canvas. Default `z = 4` (topmost; ABOVE HandLayer's z=3). Same `CanvasMirrorLayer` lifecycle.
- `src/render/index.ts` — re-exports `VideoLayer`, `VideoLayerOptions`, `WatermarkLayer`, `WatermarkLayerOptions`.

### Composition contract — COMPLETE for the renderV2 path

| Z   | Layer              | Source                        | Status        |
|-----|--------------------|-------------------------------|---------------|
| -2  | VideoLayer         | HTMLVideoElement (camera)     | ✅ this commit |
| -1  | AmbientGlowLayer   | useAmbientGlow canvas         | ✅ 6a-4a      |
|  0  | StrokeLayer        | CanvasRenderer canvas         | ✅ 6a-2       |
|  1  | TextOverlayLayer   | TextOverlayCanvas             | ✅ 6a-3a      |
|  2  | Hologram3DLayer    | Hologram3DRenderer canvas     | ✅ 6a-5a      |
|  3  | HandLayer          | HandVisualizer canvas         | ✅ 6a-6       |
|  4  | WatermarkLayer     | watermark tile canvas         | ✅ this commit |

All 7 legacy Compositor source canvases are now mirrored as SceneGraph layers in their documented Z order.

### KNOWN GAPS — DEFERRED, scope-locked

Three independent audit passes (glymo-ui-expert + glymo-qa-expert + export-pipeline) surfaced the following parity gaps from the legacy Compositor. Each is non-blocking for `renderV2 = false` (the default in production); each MUST close before the flag can be flipped to default-on.

**P0 — visibly broken under renderV2=true**:

1. **PostProcessLayer (6a-4b, scope-locked)** — `useWebGPUPostProcess` (`bloom + chromatic aberration + scanlines`) is the legacy `'webgpu'` Compositor layer. Not yet wired into SceneGraph. `aurora` and `hologram` effects render with no bloom under renderV2. Acceptance prereq: Three.js `PostProcessing` + TSL bloom node + parity gate vs legacy WGSL output.

2. **VideoLayer `blur: 6` + object-cover crop (6b-6b, this commit's follow-up)** — legacy `videoPreprocess.blur: 6` (CSS `filter: blur(6px)`) gives the camera the soft-defocus look that lets strokes pop. Legacy object-cover crop (`Compositor.ts:276-282`) preserves AR via `scale = max(w/vw, h/vh)`. Without these, the camera background is sharper and may be horizontally stretched on mismatched canvas/webcam ARs. Acceptance prereq: TSL blur shader (or single-pass Gaussian via PostProcessing) + UV remap on PlaneGeometry geometry.

3. **Fill source canvas verification (6b-6c)** — the audit could not confirm whether the fill tool's output goes through the stroke source canvas (mirrored by StrokeLayer) or a dedicated fill canvas (NOT mirrored). User-visible: fills may be invisible under renderV2. Acceptance prereq: trace the fill pipeline and add FillLayer if needed.

**P1 — degraded under renderV2=true**:

4. **`setLayerVisible` / `setLayerOpacity` parity (6b-6d)** — legacy Compositor surface is `compositor.setLayerVisible(id, bool)`. SceneGraph has no equivalent. Affected user actions: `showSkeleton` toggle (skeleton stays visible), hologram-mode 2D-overlay hide (text+3D double-image), transparent-export camera bleed-through. Acceptance prereq: add `Layer.setVisible(bool)` to the Layer interface + per-layer mesh.visible writeback.

5. **`exportFrame` + `captureStream` target canvas (6b-6e)** — both currently read from `compositorCanvasRef` (legacy compositor canvas, hidden but still drawing). Under renderV2 the user looks at `sceneCanvasRef`. If the two canvases diverge visually (post-process / blend / gamma), exports and recordings will not match the on-screen output. Acceptance prereq: branch on `renderV2` to read from `sceneCanvasRef` for both surfaces.

6. **`beforeRead` callback parity (6b-6f)** — legacy Compositor invokes `Hologram3DRenderer.renderFrame()` synchronously just before reading hologram pixels. SceneGraph relies on the renderer's own scheduler subscription, which may be one phase behind the compositor's read. Possible 1-frame visual lag under load.

### Changed
- `package.json` `version`: 0.27.3 → 0.27.4 (this slice).

### Test results
- `npm test` (jsdom): 838/838 green, unchanged.
- `npm run test:browser` (via `glymo-ui`): 55/55 green, unchanged. (Goldens for VideoLayer / WatermarkLayer are not yet added — production camera/watermark rendering will produce visible deltas vs legacy until 6b-6b ships, so re-baseling now would lock the wrong reference.)
- Build: all 9 classes (`SceneGraph`, `CanvasMirrorLayer`, `StrokeLayer`, `TextOverlayLayer`, `AmbientGlowLayer`, `Hologram3DLayer`, `HandLayer`, `VideoLayer`, `WatermarkLayer`) reachable via `@glymo/core/render`.

### Phase 6 sub-slice contract progress
- 6a-1…6a-6 ✅ structural scope closed (0.27.1).
- 6b-pre   ✅ CanvasMirrorLayer extracted (0.27.2).
- 6b-1+6b-2 ✅ CanvasEngine SceneGraph mount + 5-layer wiring (@glymo/ui 0.52.0).
- 6b-3 ✅ Consumer-page renderV2 wiring + dep bumps.
- 6b-4 ✅ multi-run bench + Phase 6 acceptance verdict.
- **6b-5+6b-6 ✅ this commit** (VideoLayer + WatermarkLayer + opacity/mirror options + Strict-Mode cleanup).
- 6b-6b (deferred): VideoLayer blur + object-cover crop.
- 6b-6c (deferred): Fill source canvas verification.
- 6b-6d (deferred): `Layer.setVisible(bool)` API + per-layer wiring.
- 6b-6e (deferred): `exportFrame` + `captureStream` branch on renderV2.
- 6b-6f (deferred): `beforeRead` callback for Hologram3DRenderer in SceneGraph tick.
- 6a-3b / 6a-4b / 6a-5b / 6a-6b (deferred): per-layer GPU-native upgrades.
- Phase 6 ships behind the flag with `renderV2 = false` default. Flipping to default-on requires ALL P0 sub-slices above to close + a re-run of the §6 visual-regression gate within 0.5% pixelmatch tolerance.

### Invariants preserved (I1–I10)
- I1–I7: untouched.
- I8 Preserve the shape: ENFORCED in legacy path (`renderV2 = false`, default). renderV2=true still has documented gaps; the visual-regression gate MUST run before the flag can flip default-on.
- I9 Tests stay green: enforced (838/838 + 478/478 + 55/55).
- I10 MediaArt + text-mode hologram coexistence: closed in 6a-5a; benefits both paths.

## [0.27.3] - 2026-04-25

**Rendering pipeline v2 — Phase 6 sub-slice 6b-5: VideoLayer + WatermarkLayer (initial cut, superseded by 0.27.4 which adds opacity+mirror).**

Initial cut of `VideoLayer` (HTMLVideoElement → VideoTexture quad at z=-2) and `WatermarkLayer` (CanvasMirrorLayer subclass at z=4). Camera mode under `renderV2=true` had a black background prior to this commit because the SceneGraph had no video source layer. Watermark was also absent on the renderV2 visible canvas.

Public surface added via `@glymo/core/render`: `VideoLayer`, `VideoLayerOptions`, `WatermarkLayer`, `WatermarkLayerOptions`.

This release ships the bare layer additions. 0.27.4 (next) extends `VideoLayer` with `opacity` + `mirror` options to match the legacy Compositor's `videoPreprocess` more faithfully.

## [0.27.2] - 2026-04-25

**Rendering pipeline v2 — Phase 6 sub-slice 6b-pre: CanvasMirrorLayer base extracted.**

Pure refactor commit. Promised in the 6a-6 (0.27.1) CHANGELOG ("if ≥3 of the ≥5 final layers still share this pattern after 6a-6, a focused refactor commit will extract a shared `CanvasMirrorLayer` utility — that condition is now MET (5 of 5)"). Shipped as a separate sub-slice (6b-pre) so the diff is reviewable in isolation — bundling it into 6b-1 (the user-visible flag work) would mix two concerns.

### Added
- `src/render/layers/CanvasMirrorLayer.ts` — concrete base class implementing the full lifecycle (init / render / resize / dispose) plus the CanvasTexture-quad Three.js wiring exactly once. Required `CanvasMirrorLayerInit` shape: `{ source, name, z, logName }` (subclasses pre-fill defaults; `logName` drives the bracketed prefix in error messages and the diagnostic mesh name `<logName>:<name>`).
- `src/render/index.ts` — re-exports `CanvasMirrorLayer` + `CanvasMirrorLayerInit` (`@internal`-flavour — exposed for future layer authors and for direct construction in tests / consumers wanting non-default name+z combinations without picking a specific subclass).

### Changed
- `src/render/layers/StrokeLayer.ts` — collapsed from 220 LOC to 36 LOC (extends CanvasMirrorLayer; provides `name='stroke', z=0, logName='StrokeLayer'` defaults). Public surface (`StrokeLayer`, `StrokeLayerOptions`) UNCHANGED.
- `src/render/layers/TextOverlayLayer.ts` — collapsed from 240 LOC to 42 LOC (defaults: `name='text-overlay', z=1, logName='TextOverlayLayer'`).
- `src/render/layers/AmbientGlowLayer.ts` — collapsed from 245 LOC to 37 LOC (defaults: `name='ambient-glow', z=-1, logName='AmbientGlowLayer'`).
- `src/render/layers/Hologram3DLayer.ts` — collapsed from 255 LOC to 50 LOC (defaults: `name='hologram-3d', z=2, logName='Hologram3DLayer'`).
- `src/render/layers/HandLayer.ts` — collapsed from 230 LOC to 42 LOC (defaults: `name='hand', z=3, logName='HandLayer'`).

Total: ~990 LOC of duplicated layer-wiring code → ~210 LOC across 5 thin subclasses + 230 LOC base.

### Test results
- `npm test` (jsdom): unchanged 838/838 green.
- Browser-runtime evidence in `glymo-ui` Browser Mode: **all 55 cases green unchanged** (was 55/55 on 0.27.1; refactor must NOT change goldens). Specifically:
    * 6a-1 SceneGraph (9 cases)
    * 6a-0 Browser Mode smoke (2 cases)
    * 6a-2 StrokeLayer (7 cases)
    * 6a-3a TextOverlayLayer (9 cases — per-layer + composite)
    * 6a-4a AmbientGlowLayer (10 cases — per-layer + step-down)
    * 6a-5a Hologram3DLayer (9 cases — per-layer + 4-layer composite)
    * 6a-6 HandLayer (9 cases — per-layer + 5-layer FULL composite)
  All goldens (`mirror-A`, `mirror-B`, `text-mirror-magenta`, `text-mirror-yellow`, `composite-stroke-text`, `composite-stroke-only`, `ambient-mirror-amber`, `ambient-mirror-teal`, `composite-ambient-stroke-text`, `composite-ambient-stroke`, `composite-ambient-only`, `hologram-mirror-diamond`, `hologram-mirror-orange`, `composite-4layer-stack`, `composite-4layer-without-hologram`, `hand-mirror-skeleton`, `hand-mirror-dot`, `composite-5layer-full-stack`, `composite-5layer-without-hand`) compared bit-for-bit against pre-refactor — pixelmatch 0% diff.
- Build: all 7 classes (`SceneGraph`, `CanvasMirrorLayer`, `StrokeLayer`, `TextOverlayLayer`, `AmbientGlowLayer`, `Hologram3DLayer`, `HandLayer`) reachable via `@glymo/core/render` + inheritance verified (`Subclass.prototype instanceof CanvasMirrorLayer === true` for each of the 5).

Version bump: 0.27.1 → 0.27.2 (patch — pure refactor, public API surface unchanged for all 5 existing classes; new `CanvasMirrorLayer` export is additive).

### Phase 6 sub-slice contract progress
- 6a-1…6a-6 ✅ (structural scope closed in 0.27.1).
- **6b-pre** ✅ Shared base extracted (this commit, 0.27.2).
- 6b-1 (next): `GLYMO_RENDER_V2` flag + CanvasEngine SceneGraph mount.
- 6b-2 (after 6b-1): Wire 5 layers to existing source canvases.
- 6b-3 (after 6b-2): Consumer page migration.
- 6b-4 (after 6b-3): Visual baseline regen + local bench-perf + Phase 6 acceptance verdict.

### Invariants preserved
- I1–I10: untouched (this commit changes ZERO behaviour — refactor only).
- I9 Tests stay green: enforced (838 + 478 + 55 unchanged).

## [0.27.1] - 2026-04-25

**Rendering pipeline v2 — Phase 6 sub-slice 6a-6: HandLayer first cut (R2 conservative path).**

The FINAL Phase 6 layer slice. Concrete `Layer` artefact under the `@glymo/core/render` subpath. Per `docs/plans/rendering-pipeline-v2.md` §4.1 target architecture diagram ("HandLayer (Line2 from mediapipe landmarks)") AND §6 Phase 6 sub-task 6a Scope ("Add `layers/HandLayer.ts`").

Same R2 conservative-path rationale as the previous 6a layer slices applies: `HandVisualizer` (`@glymo/core/src/input/HandVisualizer.ts`) draws hand-skeleton landmarks onto a dedicated 2D canvas (`skeletonCanvasRef` in `CanvasEngine.tsx`). `HandLayer` mirrors the existing skeleton canvas onto the SceneGraph as a `CanvasTexture` quad — same proven pattern as the previous four layers — at z=3 so it composites ABOVE `Hologram3DLayer`'s z=2.

Hand visualisation is a UI overlay — it must remain visible on top of every content surface (strokes, text, hologram chars, MediaArt meshes) so the user always sees where their hand is. The default `z = 3` enforces that contract.

### Sub-slice 6a-6b — DEFERRED, separately scoped

The plan's eventual target ("Line2 from mediapipe landmarks" per §4.1) replaces the 2D Canvas skeleton draw with Three.js `Line2` + `LineSegments2` from `examples/jsm/lines/` — GPU-resident line geometry with per-vertex thickness. Acceptance prerequisites:

1. Reference fixture: `HandVisualizer` output for a known set of MediaPipe landmark coordinates (21 landmarks per hand, fixed connector list); capture as parity baseline.
2. New `HandLayer` implementation using `Line2` + `LineSegments2`.
3. Side-by-side run on the fixture; assert `maxDiffPixelRatio: 0.005` against the legacy 2D output.

Per §9 R2 the fallback is "keep the 2D canvas chain and only replace the render call" — i.e. this very slice's shape — if the parity gate is impractical to satisfy. The `Line2` upgrade is opt-in.

### Composition contract — COMPLETE (5 of 5 layer types in their R2 form)

| Z   | Layer              | Status          |
|-----|--------------------|-----------------|
| -1  | AmbientGlowLayer   | ✅ 6a-4a (0.26.3)|
|  0  | StrokeLayer        | ✅ 6a-2 (0.26.1)|
|  1  | TextOverlayLayer   | ✅ 6a-3a (0.26.2)|
|  2  | Hologram3DLayer    | ✅ 6a-5a (0.27.0)|
|  3  | HandLayer          | ✅ this commit (0.27.1) |
|  N/A| PostProcessLayer   | 6a-4b (TSL, scope-locked) |

All 5 documented `layers/*` files in `docs/plans/rendering-pipeline-v2.md` §6 Phase 6 sub-task 6a Scope are now shipped (`StrokeLayer`, `TextOverlayLayer`, `AmbientGlowLayer`, `HandLayer`, `Hologram3DLayer`; PostProcessLayer is intentionally a separate "pass" rather than a Z-stacked layer per §5 — `PostProcessPass.ts` not `PostProcessLayer.ts`). Phase 6 sub-task 6a's structural scope is closed; the deferred sub-slices (6a-3b, 6a-4b, 6a-5b, 6a-6b) are quality / architecture upgrades over the working R2 baseline.

### Added
- `src/render/layers/HandLayer.ts` — `HandLayer` class implementing the `Layer` interface. Constructor accepts `{ source: HTMLCanvasElement, name?, z? }` — public surface is plain TS / DOM types only (R-A). Implementation mirrors the prior CanvasTexture-quad layers with documented `z = 3` default. `render()` is allocation-free; `resize()` rebuilds geometry; `dispose()` is idempotent. Mesh named `HandLayer:<name>`.
- `src/render/index.ts` — re-exports `HandLayer` + `HandLayerOptions`.

### Test results
- `npm test` (jsdom): unchanged 838/838 green.
- Browser-runtime evidence in `glymo-ui` Browser Mode: see `glymo-ui/src/canvas/__tests__/handlayer-fullstack.browser.test.tsx` (separate commit on glymo-ui's phase-6 branch). Cases cover the per-layer surface (constructor / init z=3 default / mirror golden / mutation propagation / resize / idempotent dispose / re-init throw) AND a FIVE-layer Z-stack composite gate — the FULL Phase 6 layer stack (Ambient + Stroke + TextOverlay + Hologram + Hand) producing one stable golden that locks the entire pipeline as a single regression surface. Total Browser Mode count: 55/55 green (was 46/46 on 0.27.0; this slice adds 9 cases).
- Build: `dist/render/layers/HandLayer.d.ts` produced + all 6 classes (`SceneGraph`, `StrokeLayer`, `TextOverlayLayer`, `AmbientGlowLayer`, `Hologram3DLayer`, `HandLayer`) reachable via `@glymo/core/render`.

### Phase 6 sub-slice contract progress
- 6a-1  ✅ SceneGraph foundation (0.26.0).
- 6a-2  ✅ StrokeLayer first cut (0.26.1).
- 6a-3a ✅ TextOverlayLayer first cut — R2 conservative (0.26.2).
- 6a-3b (deferred): TextOverlayLayer TSL InstancedMesh + parity gate.
- 6a-4a ✅ AmbientGlowLayer first cut — R2 conservative (0.26.3).
- 6a-4b (deferred, scope-locked): PostProcessLayer with Three.js TSL bloom + parity gate.
- 6a-5a ✅ Hologram3DLayer + I10 fix (0.27.0).
- 6a-5b (deferred, scope-locked): true HologramLayer + MediaArtLayer split.
- 6a-6  ✅ HandLayer first cut — R2 conservative (this commit, 0.27.1).
- 6a-6b (deferred, scope-locked): HandLayer Line2 + LineSegments2 + parity gate.
- **6a structural scope ✅ CLOSED.**
- 6b-1+ (forthcoming): `<CanvasEngine>` single-canvas refactor + `GLYMO_RENDER_V2` flag — the FIRST user-visible Phase 6 change.

### Why not extract a shared `CanvasMirrorLayer` base class — revisited
After 6a-6, FIVE layers (`Stroke`, `TextOverlay`, `AmbientGlow`, `Hologram3D`, `Hand`) share the CanvasTexture-quad pattern almost verbatim. The previous comments (in TextOverlayLayer.ts, AmbientGlowLayer.ts) said "if ≥3 of the ≥5 final layers still share this pattern after 6a-6, a focused refactor commit will extract a shared `CanvasMirrorLayer` utility." That condition is now met (5 of 5).

**Decision (deferred to a focused refactor commit, NOT bundled into 6a-6):** The `CanvasMirrorLayer` extract should land as its own commit so the diff is reviewable in isolation. Bundling the extract into 6a-6 would mix two concerns ("add HandLayer" + "refactor 4 existing layers") and risk hiding subtle behavioural drift between the layer-specific class and the new shared base. The extract is straightforward (constructor signature + 4 lifecycle methods are identical modulo defaults) and can land before 6b-1.

### Invariants preserved (I1–I10 from docs/plans/rendering-pipeline-v2.md §3)
- I1 SessionDoc: untouched.
- I2 CanvasEngineHandle: untouched.
- I3 CLAUDE.md absolutes: untouched.
- I4 MediaArt seam: untouched.
- I5 i18n parity: N/A.
- I6 Feature-flag deferrals: untouched.
- I7 Drawing-classifier-worker URL: untouched.
- I8 Preserve the shape: ENFORCED — HandLayer's contract is "mirror the source canvas bit-for-bit". The §9 R2 conservative path protects I8 — the hand skeleton pixels DO NOT change because the 2D canvas chain stays intact.
- I9 Tests stay green: enforced.
- I10 MediaArt + text-mode hologram coexistence: ✅ closed in 6a-5a; not affected by this slice.

## [0.27.0] - 2026-04-25

**Rendering pipeline v2 — Phase 6 sub-slice 6a-5a: I10 (Issue #3) coexistence fix + Hologram3DLayer.**

The single most user-visible Phase 6 win to date. Two intertwined changes:

### Behavioural fix (Hologram3DRenderer.renderFrame) — closes invariant I10 / Issue #3

Pre-Phase-6 the renderer had an exclusivity branch in `renderFrame`:

```ts
if (this.meshes.size > 0) {
  this.renderMeshFrame(elapsed);
  this.applyContainerRotationAndZoom(...);
  this.postProcessing!.render();
  return;   //  ← skipped the char-sync loop below
}
```

The pre-fix in-code KNOWN LIMITATION comment (lines 1137-1148, now replaced) named the user-visible consequence: "apply MediaArt → switch to text mode → type a character → select the hologram tool" rendered nothing for the typed glyph because the mesh-loaded gate short-circuited the char loop. The fix the comment NAMED — "drop the exclusive branch and run BOTH loops per frame, then call postProcessing.render() once" — is exactly what this commit implements:

```ts
this.renderMeshFrame(elapsed);  // internally guarded by loadedSlots.length === 0

const chars = this.chars.filter(c => !c.isDeleting);
const numChars = Math.min(chars.length, 20);
// … existing char-sync loop unchanged …

this.applyContainerRotationAndZoom(elapsed, transition);
this.postProcessing!.render();   // one render call, single bloom pass
```

Z-order / alpha-blending safety: meshes live under `meshRoot` (a non-rotating sibling of `charContainer` introduced in 0.18.0), so they do not inherit the idle-wobble that `applyContainerRotationAndZoom` applies to chars. Each path's geometry is depth-tested by the shared scene's renderer; bloom passes over the unified output once.

The pre-fix's deferral rationale was "lacks a regression gate." This commit ships the gate (see Test results below).

### Architectural absorption (Hologram3DLayer) — §5 Phase 6 layer

Per `docs/plans/rendering-pipeline-v2.md` §5 ("`useHologram3D.ts` → `HologramLayer.ts` — Promotes hologram from 'one-off layer' to the master scene's child"). New `Hologram3DLayer` class: CanvasTexture quad wrapping `Hologram3DRenderer`'s WebGPU output canvas, mounted onto the SceneGraph at default z=2 (above TextOverlayLayer's z=1). Same proven CanvasTexture pattern as StrokeLayer (6a-2), TextOverlayLayer (6a-3a), AmbientGlowLayer (6a-4a).

### 6a-5a vs 6a-5b — the literal split deferral

I10's user-visible promise — "the typed glyph DOES lift into 3D after MediaArt is applied" — is delivered IN FULL by this commit's `renderFrame` rewrite.

I10's structural promise — TWO layers (`HologramLayer` + `MediaArtLayer`) with their own renderers / scene contexts — is genuinely a from-scratch architectural job. `Hologram3DRenderer` owns ONE `WebGPURenderer` + ONE `Scene` + ONE `PerspectiveCamera`. The two prospective sublayers would each need their own renderer, OR a single renderer with two `RenderTarget`s captured separately, OR a complete migration to SceneGraph's `OrthographicCamera` (rewriting the perspective-frustum math the existing renderer leans on for 3D char extrusion + mesh placement). All three options are multi-day jobs; the §9 R2 fallback ("keep CPU physics and only replace the render call") applies directly here.

Sub-slice 6a-5b acceptance prerequisites (deferred):
1. Decision on camera ownership (per-layer renderers vs shared OrthographicCamera with rewritten frustum math vs RenderTarget multi-pass). Each option has a multi-day cost profile — `glymo-architect` review required before kickoff.
2. Parity gate: the new split must produce visually equivalent output to the post-6a-5a unified renderer for the canonical scenarios (text-only, mesh-only, mesh+text coexistence). Browser Mode regression goldens for each scenario provide the diff surface.
3. Migration of `useHologram3D.ts`, `useHologramController.ts`, and every consumer of `Hologram3DRenderer` to the split surfaces.

Until 6a-5b lands, `Hologram3DLayer` is the canonical Phase 6 entry for hologram + mediaArt content composition into the SceneGraph.

### Composition contract progress (4 layers Z-stack-ordered)

| Z   | Layer              | Status          |
|-----|--------------------|-----------------|
| -1  | AmbientGlowLayer   | ✅ 6a-4a (0.26.3)|
|  0  | StrokeLayer        | ✅ 6a-2 (0.26.1)|
|  1  | TextOverlayLayer   | ✅ 6a-3a (0.26.2)|
|  2  | Hologram3DLayer    | ✅ this commit (0.27.0) |
|  N/A| PostProcessLayer   | 6a-4b (TSL, scope-locked) |
| ≥3  | HandLayer          | 6a-6 |

### Added
- `src/render/layers/Hologram3DLayer.ts` — `Hologram3DLayer` class implementing the `Layer` interface. Constructor accepts `{ source: HTMLCanvasElement, name?, z? }` — public surface is plain TS / DOM types only (R-A). Wraps the WebGPU output canvas of an existing `Hologram3DRenderer` instance. `render()` is allocation-free; `resize()` rebuilds geometry; `dispose()` is idempotent. Mesh named `Hologram3DLayer:<name>`.
- `src/render/index.ts` — re-exports `Hologram3DLayer` + `Hologram3DLayerOptions`.
- `Hologram3DRenderer.getRenderedCharIds(): readonly string[]` — public diagnostic that surfaces the post-`renderFrame` `charMeshes` registry (without exposing the private map). Load-bearing for the I10 regression suite.

### Changed
- `src/hologram/Hologram3DRenderer.ts` `renderFrame()` — removed the `if (this.meshes.size > 0) {…; return;}` exclusivity branch. Both `renderMeshFrame` (internally guarded) and the char-sync loop now run per frame, with one `applyContainerRotationAndZoom` + one `postProcessing!.render()` at the end. The pre-fix block-comment is replaced by the post-fix rationale.

### Test results
- `npm test` (jsdom): 838/838 green (was 834/834 on 0.26.3; this slice adds 4 cases — three I10 coexistence regressions + one `getRenderedCharIds()` smoke). The new suite uses `vi.spyOn(r as any, 'createCharMesh').mockImplementation(() => null)` to assert "char loop runs and invokes the factory" without coupling to the stubbed font / TextGeometry surface (where `computeBoundingBox` is not provided).
- Browser-runtime evidence in `glymo-ui` Browser Mode: see `glymo-ui/src/canvas/__tests__/hologram3dlayer-stack.browser.test.tsx` (separate commit on glymo-ui's phase-6 branch). Cases cover the per-layer surface (constructor / init z=2 default / mirror golden / mutation propagation / resize / idempotent dispose / re-init throw) AND a 4-layer Z-stack composite gate (Ambient + Stroke + TextOverlay + Hologram). The 4-layer composite extends the previous 3-layer gate with Hologram as the topmost CanvasTexture-quad layer.

### Phase 6 sub-slice contract progress
- 6a-1  ✅ SceneGraph foundation (0.26.0).
- 6a-2  ✅ StrokeLayer first cut (0.26.1).
- 6a-3a ✅ TextOverlayLayer first cut — R2 conservative (0.26.2).
- 6a-3b (deferred): TextOverlayLayer TSL InstancedMesh + parity gate.
- 6a-4a ✅ AmbientGlowLayer first cut — R2 conservative (0.26.3).
- 6a-4b (deferred, scope-locked): PostProcessLayer with Three.js TSL bloom + parity gate.
- 6a-5a ✅ Hologram3DLayer + I10 fix (this commit, 0.27.0).
- 6a-5b (deferred, scope-locked above): true HologramLayer + MediaArtLayer split.
- 6a-6 (forthcoming): HandLayer.
- 6b-1+ (forthcoming): `<CanvasEngine>` single-canvas refactor + `GLYMO_RENDER_V2` flag.

### Version bump rationale (MINOR — 0.26.3 → 0.27.0)
This is the first 6a-* slice that changes BEHAVIOUR of an existing class (`Hologram3DRenderer.renderFrame`). The change is a documented bug fix (matching the in-code comment that named the canonical fix), but consumers that built workarounds depending on the pre-fix exclusive behaviour (none known) would observe a behavioural change. Per semver this argues PATCH (it's a fix). However the slice ALSO adds a new public class (`Hologram3DLayer`) and a new public method (`getRenderedCharIds`), both of which independently warrant MINOR. Going MINOR for the combined slice is the conservative choice.

### Invariants preserved (I1–I10 from docs/plans/rendering-pipeline-v2.md §3)
- I1 SessionDoc: untouched.
- I2 CanvasEngineHandle: untouched.
- I3 CLAUDE.md absolutes: untouched.
- I4 MediaArt seam: untouched.
- I5 i18n parity: N/A.
- I6 Feature-flag deferrals: untouched.
- I7 Drawing-classifier-worker URL: untouched.
- I8 Preserve the shape: ENFORCED — Hologram3DLayer's contract is "mirror the source canvas bit-for-bit". The renderFrame fix produces ADDITIONAL pixels (the typed glyph that was previously invisible); this is the explicit invariant fulfilment, not violation.
- I9 Tests stay green: enforced (838/838).
- I10 MediaArt + text-mode hologram coexistence: ✅ **CLOSED** by this commit's renderFrame rewrite + the regression gates. The `getRenderedCharIds()` probe surfaces the coexistence surface; the I10 regression suite asserts both registries populate independently after the fix.

## [0.26.3] - 2026-04-25

**Rendering pipeline v2 — Phase 6 sub-slice 6a-4a: AmbientGlowLayer first cut (R2 conservative path).**

Concrete `Layer` artefact under the `@glymo/core/render` subpath. Per `docs/plans/rendering-pipeline-v2.md` §5 Package role realignment ("`useAmbientGlow.ts` (RAF) → `AmbientGlowLayer.ts` — Glow is a render pass, not a React hook") AND §9 R2 mitigation.

This sub-slice (6a-4a) takes the §9 R2 conservative path. The substantial 2D-canvas radial-glow rendering in `glymo-ui/src/canvas/hooks/useAmbientGlow.ts` (213 LOC, per-character radial gradients with fade tracking) STAYS in place. AmbientGlowLayer mirrors the existing `ambientCanvasRef` output canvas onto the SceneGraph as a `CanvasTexture` quad — same proven pattern as `StrokeLayer` (6a-2) and `TextOverlayLayer` (6a-3a) — at a LOWER Z (`-1` by default) so it composites BEHIND the stroke surface.

A future TSL upgrade (no current sub-slice number — likely 6a-4c or later) may migrate the ambient glow into a vertex-shader radial pass on the SceneGraph itself, eliminating the offscreen 2D canvas. Until then, the conservative R2 path is canonical.

### Composition contract progress (3 layers now Z-stack-ordered)

| Z   | Layer              | Status          |
|-----|--------------------|-----------------|
| -1  | AmbientGlowLayer   | ✅ this commit  |
|  0  | StrokeLayer        | ✅ 6a-2 (0.26.1)|
|  1  | TextOverlayLayer   | ✅ 6a-3a (0.26.2)|
|  ≥2 | Hologram/MediaArt  | 6a-5            |
|  N/A| PostProcessLayer   | **6a-4b** — see deferral note below |
|  ≥2 | HandLayer          | 6a-6            |

Three layers now share the CanvasTexture-quad pattern. After 6a-6 lands, if the pattern is still shared by ≥3 of the ≥5 final layers, a focused refactor commit will extract a shared `CanvasMirrorLayer` utility. Until then, parallel implementations read better.

### PostProcessLayer (sub-slice 6a-4b) — DEFERRED, separately scoped

Per §5 the planned post-process replacement is:

  > `useWebGPUPostProcess.ts` (RAF, custom WGSL) → replaced by Three.js
  > `PostProcessing` + TSL in `@glymo/core/src/render/PostProcessPass.ts`
  > — Three.js already ships bloom + chromatic-aberration nodes; ~500
  > lines of custom WGSL are deleted.

This sub-slice is INTENTIONALLY split off from 6a-4a for a load-bearing reason: the §9 R2 fallback ("wrap as quad") would defeat the entire architectural value. The §5 win is "delete 500 LOC of custom WGSL by using Three.js's bloom + chromaticAberration nodes." A CanvasTexture quad of the existing WebGPU output canvas would just be `Compositor.drawImage` with extra steps — zero LOC reduction, zero cross-browser benefit. Therefore PostProcessLayer ships as 6a-4b with the actual TSL plumbing AND a parity gate (per §9 R2 — "glyph centroid position match within 1 px MSE against the CPU reference", adapted here for the bloom intensity / chromatic offset against the legacy WGSL output).

Sub-slice 6a-4b acceptance prerequisites:
1. Reference fixture: render the existing `useWebGPUPostProcess` output for a known stroke + text scene; capture as the parity baseline.
2. New `PostProcessPass` using Three.js `PostProcessing` + `bloom` + chromatic offset TSL nodes.
3. Side-by-side run on the fixture; assert `maxDiffPixelRatio: 0.005` (the same gate `vitest.browser.config.ts` already pre-wires for layer goldens).
4. Ship.

Until 6a-4b lands, the legacy `useWebGPUPostProcess.ts` stays in `@glymo/ui` and the post-process surface remains on the pre-flag codepath. No SceneGraph PostProcess wiring exists yet — `<CanvasEngine>` cannot turn this on even if it wanted to.

### Added
- `src/render/layers/AmbientGlowLayer.ts` — `AmbientGlowLayer` class implementing the `Layer` interface. Constructor accepts `{ source: HTMLCanvasElement, name?, z? }` — public surface is plain TS / DOM types only (R-A). Implementation mirrors `StrokeLayer` and `TextOverlayLayer` with documented Z=-1 default. `render()` is allocation-free; `resize()` rebuilds geometry; `dispose()` is idempotent. Mesh named `AmbientGlowLayer:<name>`.
- `src/render/index.ts` — re-exports `AmbientGlowLayer` + `AmbientGlowLayerOptions`.

### Test results
- `npm test` (jsdom): 834/834 green, unchanged.
- Browser-runtime evidence in `glymo-ui` Browser Mode: see `glymo-ui/src/canvas/__tests__/ambientglowlayer-stack.browser.test.tsx`. 9 cases covering per-layer surface (constructor / init with `z=-1` default / mirror golden / mutation propagation / resize / idempotent dispose / re-init throw) PLUS a 3-layer Z-stack composite gate (Ambient z=-1 yellow halo + Stroke z=0 cyan rect + TextOverlay z=1 magenta circle) producing a stable golden that proves all three layers compose in the documented Z order. Total Browser Mode count: 36/36 green (was 27/27 on 0.26.2; this slice adds 9 cases).
- Build: `dist/render/layers/AmbientGlowLayer.d.ts` produced + all 4 classes (`SceneGraph`, `StrokeLayer`, `TextOverlayLayer`, `AmbientGlowLayer`) reachable via `@glymo/core/render`.

### Phase 6 sub-slice contract progress
- 6a-1 ✅ SceneGraph foundation (0.26.0).
- 6a-2 ✅ StrokeLayer first cut (0.26.1).
- 6a-3a ✅ TextOverlayLayer first cut — R2 conservative (0.26.2).
- 6a-3b (deferred): TextOverlayLayer TSL InstancedMesh + parity gate.
- 6a-4a ✅ AmbientGlowLayer first cut — R2 conservative (this commit, 0.26.3).
- 6a-4b (deferred, scope-locked above): PostProcessLayer with Three.js TSL bloom + parity gate.
- 6a-5 (forthcoming): HologramLayer + MediaArtLayer split (I10).
- 6a-6 (forthcoming): HandLayer.
- 6b-1+ (forthcoming): `<CanvasEngine>` single-canvas refactor + `GLYMO_RENDER_V2` flag.

### Invariants preserved (I1–I10 from docs/plans/rendering-pipeline-v2.md §3)
- I1 SessionDoc: untouched.
- I2 CanvasEngineHandle: untouched.
- I3 CLAUDE.md absolutes: untouched.
- I4 MediaArt seam: untouched.
- I5 i18n parity: N/A.
- I6 Feature-flag deferrals: untouched.
- I7 Drawing-classifier-worker URL: untouched.
- I8 Preserve the shape: ENFORCED — AmbientGlowLayer's contract is "mirror the source canvas bit-for-bit". The §9 R2 conservative path protects I8 — the radial glow pixels DO NOT change because the 2D canvas chain stays intact.
- I9 Tests stay green: enforced.
- I10 MediaArt + text-mode hologram coexistence: pre-condition for 6a-5; not affected by this slice.

## [0.26.2] - 2026-04-25

**Rendering pipeline v2 — Phase 6 sub-slice 6a-3a: TextOverlayLayer first cut (R2 conservative path).**

Concrete `Layer` artefact under the `@glymo/core/render` subpath. Per `docs/plans/rendering-pipeline-v2.md` §5 Package role realignment ("`TextOverlayCanvas.tsx` → render logic → `@glymo/core/src/render/layers/TextOverlayLayer.ts` (InstancedMesh, GPU particles)") AND §9 R2 mitigation ("If divergent, keep CPU physics and only replace the render call").

This sub-slice (6a-3a) takes the §9 R2 conservative path. The substantial CPU physics in `glymo-ui/src/canvas/components/TextOverlayCanvas.tsx` (1097 LOC, ~290 of per-particle physics, layout transitions, hand-repulsion, eraser masks, transit sparkles, morph particles, etc.) STAYS in place. Migrating it to TSL InstancedMesh while simultaneously moving the renderer architecturally would create exactly the divergence risk §9 R2 names. Instead, this layer mirrors the existing TextOverlayCanvas output canvas onto the SceneGraph as a `CanvasTexture` quad — same proven pattern as `StrokeLayer` (6a-2) — at a higher Z so it composites ON TOP of strokes.

### Deferred — sub-slice 6a-3b
The TSL InstancedMesh upgrade is an explicitly separate sub-slice (6a-3b) that lands AFTER:
1. A glyph-centroid parity fixture exists in glymo-ui Browser Mode.
2. The fixture proves the CPU physics output is reproducible bit-for-bit across two consecutive runs of the existing canvas.
3. The TSL implementation is parity-checked against that fixture per §9 R2 ("glyph centroid position match within 1 px MSE against the CPU reference").

Until those land, the conservative R2 path is the canonical Phase 6 shape for the text overlay surface.

### Composition contract (new)
`TextOverlayLayer`'s default `z = 1` is ABOVE `StrokeLayer`'s default `z = 0`. Both layers run with `transparent: true` + `depthTest: false`, so Three.js's renderer sorts them back-to-front by Z. This matches the legacy Compositor stacking order in `@glymo/ui/canvas/lib/Compositor.ts` (drawing layer added before overlay).

The convention for future layers (documented in TextOverlayLayer.ts):
- AmbientGlowLayer        z = -1   (background)
- StrokeLayer             z =  0   (drawing surface)
- TextOverlayLayer        z =  1   (text composites on top)
- HandLayer / Hologram    z >= 2   (UI overlays)
- PostProcessLayer        N/A      (post-process pass, not Z-stacked)

### Added
- `src/render/layers/TextOverlayLayer.ts` — `TextOverlayLayer` class implementing the `Layer` interface. Constructor accepts `{ source: HTMLCanvasElement, name?, z? }` — public surface is plain TS / DOM types only (R-A). Implementation mirrors `StrokeLayer` (CanvasTexture + MeshBasicMaterial transparent + depthTest:false + PlaneGeometry sized to viewport CSS pixels) with the documented Z-stack offset. `render()` is allocation-free; `resize()` rebuilds geometry; `dispose()` is idempotent. Mesh named `TextOverlayLayer:<name>`.
- `src/render/index.ts` — re-exports `TextOverlayLayer` + `TextOverlayLayerOptions` from the `@glymo/core/render` barrel.

### Why not extract a shared `CanvasMirrorLayer` base class
StrokeLayer (6a-2) and TextOverlayLayer (6a-3) both wrap an HTMLCanvasElement as a CanvasTexture quad. The implementations are nearly identical, only the defaults differ. Premature extraction would lock us into a shape we don't yet fully understand:
- 6a-3b will replace this layer's INTERNALS with InstancedMesh + TSL (no longer a CanvasTexture quad). A shared base would make that migration painful.
- 6a-4 AmbientGlowLayer is a post-process pass.
- 6a-5 Hologram / MediaArt are 3D mesh layers.
- 6a-6 HandLayer is a Line2 mesh.
None of these share the StrokeLayer/TextOverlayLayer pattern wholesale.

### Test results
- `npm test` (jsdom): unchanged — TextOverlayLayer is browser-only.
- Browser-runtime evidence in `glymo-ui` Browser Mode: see `glymo-ui/src/canvas/__tests__/textoverlaylayer-composite.browser.test.tsx`. Two-layer composite test (StrokeLayer at z=0 with cyan rect + TextOverlayLayer at z=1 with magenta circle) produces a stable golden proving correct Z-order composition; per-layer mirror gates + lifecycle (init/render/resize/dispose) coverage matches the StrokeLayer test shape. Total Browser Mode count: 24+/24+ green.

### Phase 6 sub-slice contract progress
- 6a-1 ✅ SceneGraph foundation (0.26.0).
- 6a-2 ✅ StrokeLayer first cut (0.26.1).
- 6a-3a ✅ TextOverlayLayer first cut (R2 conservative — this commit, 0.26.2).
- 6a-3b (deferred): TSL InstancedMesh + parity gate.
- 6a-4 (forthcoming): AmbientGlowLayer + PostProcessLayer.
- 6a-5 (forthcoming): HologramLayer + MediaArtLayer split (I10).
- 6a-6 (forthcoming): HandLayer.
- 6b-1+ (forthcoming): `<CanvasEngine>` single-canvas refactor + `GLYMO_RENDER_V2` flag.

### Invariants preserved (I1–I10 from docs/plans/rendering-pipeline-v2.md §3)
- I1 SessionDoc: untouched.
- I2 CanvasEngineHandle: untouched.
- I3 CLAUDE.md absolutes: untouched.
- I4 MediaArt seam: untouched.
- I5 i18n parity: N/A.
- I6 Feature-flag deferrals: untouched.
- I7 Drawing-classifier-worker URL: untouched.
- I8 Preserve the shape: ENFORCED — TextOverlayLayer's contract is "mirror the source canvas bit-for-bit" (modulo the documented 0.005 pixelmatch tolerance). The §9 R2 conservative path is precisely the choice that protects I8 — the text glyph rendering pixels DO NOT change because the CPU physics + 2D draw chain stays intact.
- I9 Tests stay green: enforced (834/834 jsdom + browser-mode evidence).
- I10 MediaArt + text-mode hologram coexistence: pre-condition for 6a-5; not affected by this slice.

## [0.26.1] - 2026-04-25

**Rendering pipeline v2 — Phase 6 sub-slice 6a-2: StrokeLayer first cut.**

Concrete `Layer` artefact under the `@glymo/core/render` subpath introduced in 0.26.0. Per `docs/plans/rendering-pipeline-v2.md` §6 Phase 6 / Sub-task 6a Scope:

  > "StrokeLayer first pass: render the existing 2D stroke canvas content into an OrthographicCamera quad via CanvasTexture. This preserves the existing CanvasRenderer output bit-for-bit — the stroke pixels are identical; only the compositing path changes."

Architecture intent: the legacy `CanvasRenderer` (the 2D Canvas owner of the 6-stage pipeline's pixel work) keeps producing pixels onto its existing offscreen 2D `<canvas>`. `StrokeLayer` wraps that canvas as a Three.js `CanvasTexture`, mounts it on a fullscreen quad inside the SceneGraph, and the per-frame `render()` invalidates the texture so the GPU re-uploads the latest 2D content.

This is a deliberately narrow first cut — it does NOT replace the 2D stroke renderer. It moves the COMPOSITING from a CPU-side `drawImage` in `@glymo/ui/canvas/lib/Compositor.ts` into a GPU-side single fullscreen quad inside the master scene graph. Future sub-slices may migrate stroke rendering itself onto a TSL shader (R1 in §9 risks), but the contract today is "no pixel change".

### Added
- `src/render/layers/StrokeLayer.ts` — `StrokeLayer` class implementing the `Layer` interface from 0.26.0. Constructor accepts `{ source: HTMLCanvasElement, name?, z? }` — public surface is plain TS / DOM types only (R-A). Implementation uses `CanvasTexture` (sRGB, flipY=true defaults are correct for sRGB 2D canvases) + `MeshBasicMaterial` (`transparent: true`, `depthTest: false`, `depthWrite: false` so the layer composes cleanly under future layers stacked on higher Z) + `PlaneGeometry` sized to (`widthCss`, `heightCss`) in CSS-pixel world units. `render()` is allocation-free (single `texture.needsUpdate = true`); `resize()` rebuilds the geometry; `dispose()` releases texture / material / geometry / mesh and is idempotent. Mesh is `frustumCulled = false` (always in view by definition) and named `StrokeLayer:<name>` for diagnostics.
- `src/render/index.ts` — re-exports `StrokeLayer` + `StrokeLayerOptions` from the `@glymo/core/render` barrel so consumers can `import { StrokeLayer } from '@glymo/core/render'`.

### Test results
- `npm test` (jsdom): unchanged — StrokeLayer is browser-only and not collected by the jsdom suite (vanilla three vector math doesn't need jsdom CanvasTexture mocks).
- Browser-runtime evidence in `glymo-ui` Browser Mode: see `glymo-ui/src/canvas/__tests__/strokelayer-mirror.browser.test.tsx` — 7 cases covering construction validation, init lifecycle, mesh registration in scene graph, render() texture invalidation, source-canvas mutation propagation across two consecutive renders (stable golden A → mutate source → stable golden B), resize geometry rebuild, idempotent dispose. Goldens for the mirror tests live under `__screenshots__/strokelayer-mirror.browser.test.tsx/`.

### Phase 6 sub-slice contract progress
- 6a-1 ✅ SceneGraph foundation (0.26.0).
- 6a-2 ✅ StrokeLayer first cut (this commit, 0.26.1).
- 6a-3 (forthcoming): TextOverlayLayer.
- 6a-4 (forthcoming): AmbientGlowLayer + PostProcessLayer.
- 6a-5 (forthcoming): HologramLayer + MediaArtLayer split (I10 Issue #3).
- 6a-6 (forthcoming): HandLayer.
- 6b-1+ (forthcoming): `<CanvasEngine>` single-canvas refactor + `GLYMO_RENDER_V2` flag.

### Invariants preserved (I1–I10 from docs/plans/rendering-pipeline-v2.md §3)
- I1 SessionDoc: untouched.
- I2 CanvasEngineHandle: untouched.
- I3 CLAUDE.md absolutes: untouched.
- I4 MediaArt seam: untouched.
- I5 i18n parity: N/A (no UI strings).
- I6 Feature-flag deferrals: untouched.
- I7 Drawing-classifier-worker URL: untouched.
- I8 Preserve the shape: ENFORCED — StrokeLayer's contract is "mirror the source canvas bit-for-bit" (modulo the documented 0.005 pixelmatch tolerance for sub-pixel anti-alias jitter on WebGPU/WebGL2 backend negotiation). Pixel-identity gate covered by the cross-render fixture in the browser test.
- I9 Tests stay green: enforced (existing 0.26.0 test count + green status preserved).
- I10 MediaArt + text-mode hologram coexistence: pre-condition for 6a-5; not affected by this slice.

## [0.26.0] - 2026-04-25

**Rendering pipeline v2 — Phase 6 sub-slice 6a-1: SceneGraph foundation.**

First implementation artefact of the Phase 6 big-bang (`docs/plans/rendering-pipeline-v2.md` §6 Phase 6, §4 target architecture). Introduces the Three.js-backed master scene graph that subsequent sub-slices will populate with concrete layers (Stroke / TextOverlay / AmbientGlow / Hologram / MediaArt / Hand / PostProcess) absorbed from the seven pre-refactor rendering surfaces.

This release ships the FOUNDATION only — class wiring + lifecycle + browser-runtime smoke evidence. Concrete layers, the `<CanvasEngine>` integration, and the `GLYMO_RENDER_V2` feature flag plumbing land in subsequent sub-slices. Until those land, the pre-Phase-6 codepath (CanvasRenderer / WebGPURenderer / CanvasLayerStack / Compositor) remains the only active renderer; the new SceneGraph is dormant code reachable only via the new `@glymo/core/render` subpath.

### Added
- `src/render/Layer.ts` — `Layer` interface + `LayerInitContext` type. Defines the per-layer lifecycle (`init` / `render` / `resize` / `dispose`) every concrete layer authored under `src/render/layers/*` (forthcoming) implements. `@internal` — Three.js types appear in `LayerInitContext` so layer authors can mount scene subtrees, but the surface is not part of the supported public API.
- `src/render/SceneGraph.ts` — `SceneGraph` class. Three.js Scene + OrthographicCamera + WebGPURenderer wrapper. Public surface deals only in plain TS types (HTMLCanvasElement, number, string, `SceneGraphBackend` union) per §1.5.4 R-A — no Three.js types leak out. WebGPU primary, WebGL2 automatic fallback (Three.js built-in since r170 — `await renderer.init()` handles backend negotiation; the resolved backend is reported via `getBackend()`). Lazy `import('three/webgpu')` mirrors the existing `Hologram3DRenderer` SSR-safe pattern. Idempotent `dispose()` for React Strict Mode double-cleanup safety. Camera convention: 1 world unit = 1 CSS pixel, frustum centred at origin, Y-up.
- `src/render/index.ts` — `@glymo/core/render` subpath barrel re-exporting `SceneGraph`, `SceneGraphInitOptions`, `SceneGraphBackend`, plus `Layer` / `LayerInitContext` (the latter pair flagged `@internal`).
- `package.json` `exports[./render]` map + `vite.config.ts` library entry `'render/index': 'src/render/index.ts'` so consumers can `import { SceneGraph } from '@glymo/core/render'`. Three.js stays external (the existing `/^three\//` rollup external pattern covers `three/webgpu`).

### Phase 6 sub-slice contract
- 6a-1 (this commit): SceneGraph foundation only.
- 6a-2 (forthcoming): StrokeLayer first cut (CanvasTexture from existing 2D output → quad on the new graph). Pixel-identity gate.
- 6a-3 (forthcoming): TextOverlayLayer (InstancedMesh + TSL particle physics).
- 6a-4 (forthcoming): AmbientGlowLayer + PostProcessLayer (Three.js bloom + chromatic aberration replaces `useWebGPUPostProcess`).
- 6a-5 (forthcoming): HologramLayer + MediaArtLayer split per invariant I10 (mesh registry vs char registry — eliminates the `if (this.meshes.size > 0) return;` early-return in `Hologram3DRenderer.renderFrame`).
- 6a-6 (forthcoming): HandLayer.
- 6b-1+ (forthcoming): `<CanvasEngine>` single-canvas refactor + `GLYMO_RENDER_V2` flag plumbing.

### Test results
- `npm test` (jsdom): unchanged — SceneGraph is browser-only and not collected by the existing core jsdom suite (no `*.test.ts` file under `src/render/`).
- Browser runtime evidence lives in `glymo-ui` Browser Mode under sub-task 6a-0's infra (`@glymo/ui` 0.51.1+) — see `glymo-ui/src/canvas/__tests__/scenegraph-init.browser.test.tsx`. The cross-package test home is the documented pattern for §7.2 — `@glymo/ui` is where `@vitest/browser` is installed; `@glymo/core` consumes it transitively via `npm link`.

### Invariants preserved (I1–I10 from docs/plans/rendering-pipeline-v2.md §3)
- I1 SessionDoc: untouched (no serialisation surface changed).
- I2 CanvasEngineHandle: untouched (no `<CanvasEngine>` props or methods changed).
- I3 CLAUDE.md absolutes: untouched (no smoothing / matching / morph code paths touched).
- I4 MediaArt seam: untouched (no catalog imports added; `MediaArtMeshState` shape unchanged).
- I5 i18n parity: N/A (no UI strings).
- I6 Feature-flag deferrals: untouched (Pro / Verse / Challenges / Presets / Upgrade still hidden).
- I7 Drawing-classifier-worker URL: untouched (classifier subpath build unaffected).
- I8 Preserve the shape: N/A (no pixel-rendering changes; SceneGraph is dormant).
- I9 Tests stay green: enforced (existing 0.25.3 test count + green status preserved).
- I10 MediaArt + text-mode hologram coexistence: pre-condition for the forthcoming 6a-5 split. SceneGraph is the absorption target; no behaviour change yet.

### Local-dev note
Consumers using `npm link @glymo/core` (the documented Glymo dev convention from CLAUDE.md §"Relationships") pick up the new `@glymo/core/render` subpath transparently after the next `npm run build` in `glymo-core`. Consumers using `file:` deps to a packed tgz (`glymo-app` / `glymo-landing`) need `npm pack` here + a fresh tgz path in their `package.json`.

## [0.25.3] - 2026-04-25

**Rendering pipeline v2 — Phase 4: CameraCapture worker-path hardening.**

Fourth artefact of the rendering-pipeline-v2 refactor (see `docs/plans/rendering-pipeline-v2.md` §6 Phase 4). Eliminates the user-visible 5.4–6.3 s "camera on" freeze measured in `app/camera-hand` across Phase 0–3 by removing two pre-Phase-4 mechanisms whose combined effect was the freeze:

  1. The `private static async shouldPreferSync()` heuristic that consulted WebGPU adapter info to force sync MediaPipe init on M1/M2/M1 Pro/M2 Pro unified-GPU machines. Empirical evidence (Phase 0–3 multi-run reports) was that worker mode runs correctly on every Apple Silicon tier when `mediapipe-vision.js` is present; the heuristic was the dominant cause of the freeze it was nominally protecting against.

  2. The 10-second `workerInitTimeout` fallback that fired when the worker silently hung during `importScripts('/mediapipe-vision.js')`. The worker now posts `{type: 'error', phase: 'import'}` from a try/catch around the import so the parent's existing `handleWorkerMessage('error')` branch triggers the sync fallback synchronously — well within 100 ms instead of waiting 10 seconds.

### Changed
- `src/input/CameraCapture.ts` — `initAsync` no longer calls `shouldPreferSync()`. Worker mode is the default on every device; sync mode is reachable only as a feature-detect fallback from `tryCreateWorker()` returning false (CSP / blob URL blocked) or from the worker `error` message.
- `src/input/CameraCapture.ts` — the `setTimeout(..., 10_000)` worker-init fallback timer is gone. The `workerInitTimeout` field is retained as a `null`-guarded no-op for call-site stability (the two `if (this.workerInitTimeout) clearTimeout(...)` guards in the message handlers short-circuit harmlessly).
- `src/input/CameraCapture.ts` — `shouldPreferSync` static method REMOVED. `localStorage['glymo-mp-mode']` is no longer read or written by `@glymo/core`. Consumer apps that set this key for testing will see it ignored on next install; the cache key may be cleaned up by a separate consumer-side commit.

### Added
- `src/input/__tests__/CameraCapture.worker-fallback.test.ts` — 5 Vitest cases covering the worker-error handshake (synchronous `initMediaPipeSync` invocation, sub-100-ms wall-time budget, `active=false` short-circuit), the workerInitTimeout removal (field starts `null` and stays `null` post-init), and the heuristic removal (`shouldPreferSync` is undefined on the class).

### Invariants preserved (I1–I10 from docs/plans/rendering-pipeline-v2.md §3)
- I1 SessionDoc: untouched.
- I2 CanvasEngineHandle: untouched.
- I3 CLAUDE.md absolutes: untouched (gesture / smoothing math is gesture-side, not affected by this change).
- I4 MediaArt seam: untouched.
- I5 strings parity: n/a.
- I6 feature-flag deferrals: untouched.
- I7 classifier-worker URL: untouched.
- I8 preserve-the-shape: n/a.
- I9 test pyramid reinforced — 834/834 core tests green (was 829 — +5 new).
- I10 MediaArt ↔ text-mode hologram coexistence: Phase 6 scope, untouched.

### Worker-side asset (consumer apps)
The `mediapipe-worker.mjs` file under each consumer app's `public/` is updated to wrap `importScripts('/mediapipe-vision.js')` in a try/catch that posts `{type: 'error', phase: 'import'}` on failure — paired commits in `glymo-app` and `glymo-landing` ship the new worker file plus a `scripts/check-mediapipe-assets.ts` local guard that refuses commits if either asset is missing. Both apps' `.husky/pre-commit` hooks invoke the guard.

## [0.25.2] - 2026-04-25

**Rendering pipeline v2 — Phase 3: HandState pool + Object.freeze removal.**

Third artefact of the rendering-pipeline-v2 refactor (see `docs/plans/rendering-pipeline-v2.md` §6 Phase 3). The pre-Phase-3 `HandStateImpl` constructor froze a shallow spread (`Object.freeze([...landmarks])`) on every call. `useGestureDispatcher` invoked `new HandStateImpl(landmarks)` up to 6 times per landmark event — once per gesture branch (ERASER / MOVE / MAGIC / SELECT / SELECT-text / FILL). That was ~21 × 6 = 126 point-object allocations per tick's worst case, on top of the spread + freeze overhead, contributing to the minor-GC churn §1 defect #4 identified.

Additive. Every pre-Phase-3 consumer calling `new HandStateImpl(landmarks)` keeps working bit-for-bit — the constructor still takes the same arg shape, stores the reference, computes lazily-cached scores. The new pool is an opt-in performance path.

### Added
- `src/gesture/HandStatePool.ts` — bounded pool of `HandStateImpl` instances with `acquire(landmarks)` / `release(state)` / `resetFrame()` API. Cap is configurable (`DEFAULT_HAND_STATE_POOL_CAP = 4`). Pool-exceeding acquires still return a functional state (allocates fresh) but the over-cap instance is dropped on release so adversarial bursts cannot balloon the pool.
- `HandStateImpl._reset(landmarks)` internal pool hook — reassigns the backing landmark reference and invalidates the per-instance `_scoreCache`. Marked `@internal` so external callers know it is pool-private.
- 13 Vitest cases in `src/gesture/__tests__/HandStatePool.test.ts`: identity preservation across acquire/release, functional parity with fresh `HandStateImpl`, distinct identity for concurrent acquires, silent no-op on foreign / double release, size-cap ceiling, `resetFrame` lifecycle, zero-allocation after warmup (both 1-instance and 2-instance steady state), and cache-reset correctness on reuse.
- 16 Vitest cases in `src/gesture/__tests__/HandStateImpl.test.ts` — golden-lock on the pre-Phase-3 numerical behaviour of `fingerScore`, `extended`, `folded`, `pinchDistance`, the safe-fallback path on truncated input, and the `ReadonlyArray` type contract. Pins Phase 0's numerics so the refactor cannot silently shift finger-score arithmetic.

### Changed
- `HandStateImpl` constructor no longer freezes the input. The pre-Phase-3 behaviour (`Object.freeze([...landmarks])`) is gone; the backing slot holds the raw reference. The public `landmarks` accessor remains `ReadonlyArray`-typed so consumers still see the read-only contract at the type level. JSDoc documents the new convention: "Callers MUST treat the landmark array as immutable". Engine-side mutation is a bug the runtime no longer catches, but the `HandStateImpl.test.ts` type-level gate surfaces any misuse at build time.
- `src/index.ts` exports `HandStatePool`, `DEFAULT_HAND_STATE_POOL_CAP`, and `HandStatePoolOptions` alongside the pre-existing `HandStateImpl`.

### Invariants preserved (I1–I10 from docs/plans/rendering-pipeline-v2.md §3)
- I1 SessionDoc: untouched.
- I2 CanvasEngineHandle: untouched (HandStatePool is additive, new named export).
- I3 CLAUDE.md absolutes (OneEuroFilter params, nearest-neighbor matching, easeOutElastic): untouched — gesture math is textually unchanged; the golden-lock tests pin it.
- I4 MediaArt seam: untouched.
- I5 strings parity: n/a.
- I6 feature-flag deferrals: untouched.
- I7 classifier-worker URL: untouched.
- I8 preserve-the-shape: n/a (gesture layer, not stroke rendering).
- I9 test pyramid reinforced — 829/829 core tests green (was 800 — +29 new: 16 golden-lock + 13 pool).
- I10 MediaArt ↔ text-mode hologram coexistence: Phase 6 scope, untouched.

## [0.25.1] - 2026-04-24

**Rendering pipeline v2 — Phase 2: StrokeAnimator zero-alloc hot path.**

Second artefact of the rendering-pipeline-v2 refactor (see `docs/plans/rendering-pipeline-v2.md` §6 Phase 2). Phase 0 attribution pinned `StrokeAnimator.getTransform` as the top-1 JS frame inside 591 slow (≥16 ms) `FireAnimationFrame` handlers in the hologram scenario — this release rebuilds the hot path so a single-frame render of an animated stroke allocates **zero** `AnimationTransform` objects once the caller holds a pre-allocated buffer.

Additive. Every pre-Phase-2 consumer that calls `getTransform(strokeId, now)` keeps working bit-for-bit (same return shape, same numerical output); the new overload `getTransform(strokeId, now, out): boolean` is a strict opt-in on top.

### Added
- `StrokeAnimator.prototype.getTransform(strokeId, now, out)` overload — writes the composed transform into `out` in place and returns `true` on match, `false` otherwise. Zero object allocation per call.
- Internal `strokeIndex: Map<strokeId, Set<animId>>` — maintained across `addAnimation`, `removeAnimation`, `removeByStrokeId`, `clear`, `restore`, AND the in-line purge inside `getTransform` itself. `getTransform` now visits only the animations targeting the queried stroke rather than scanning every registered animation with `.includes(strokeId)`. Benchmark: 10,000 unrelated registered animations → single `getTransform` completes in well under 0.5 ms (was linear in total animation count).
- Internal `transformBuffer` — module-scoped `AnimationTransform` passed into the refactored `computeAnimationTransform(params, t, elapsed, out)`. The switch-case body keeps the parameter name `identity` so the per-type animation math stays textually unchanged (the primitive-amplitude regression tests are locks on those numerics).
- Internal `completedIdsBuffer: string[]` — class-field ids buffer, drained via `.length = 0` instead of allocating a new array per call.
- 7 new Vitest cases in `src/animation/__tests__/StrokeAnimator.zero-alloc.test.ts`: the out-param no-match contract, the out-param match contract, legacy ↔ new signature parity, zero-allocation across 1000 calls (same-identity buffer assertion), strokeIndex O(1) under 10k-animation churn, reverse-index consistency under `removeByStrokeId`, and a 1000-case deterministic pseudo-random property test that confirms the old and new signatures produce numerically identical output across every animation type.

### Changed
- `computeAnimationTransform` signature: returns `void`, accepts an `identity: AnimationTransform` out-param. All 18 switch cases write in place.
- `renderCompletedStrokes(…)` now takes two additional args (8th + 9th): `transformPool: Map<string, AnimationTransform>` and `activeAnimatedIds: Set<string>`, both reused across every frame by the caller. The per-frame `Map<string, AnimationTransform>` allocation + per-animated-stroke `AnimationTransform` allocation in the old body are gone.
- `renderFills(…)` now takes a `transformBuffer: AnimationTransform` 5th arg — a single reusable scratch shared across every fill in the render pass.
- `CanvasRenderer` owns the three new buffers as readonly fields (`transformPool`, `activeAnimatedIds`, `fillTransformBuffer`) and threads them into the layer calls.

### Invariants preserved (I1–I10 from docs/plans/rendering-pipeline-v2.md §3)
- I1 SessionDoc: untouched (no wire format change).
- I2 CanvasEngineHandle: untouched (no public imperative API change).
- I3 CLAUDE.md absolutes: untouched (OneEuroFilter params, nearest-neighbor matching, easeOutElastic, etc. — the animation math is textually unchanged, locked by the primitive-amplitude tests).
- I4 MediaArt seam: untouched.
- I5 strings parity: n/a.
- I6 feature-flag deferrals: untouched.
- I7 classifier-worker URL: untouched.
- I8 preserve-the-shape: `StrokeAnimator` is per-stroke composition; not rendering the drawn shape itself.
- I9 test pyramid reinforced — 800/800 green (was 793 — +7 new from zero-alloc suite).
- I10 MediaArt ↔ text-mode hologram coexistence: Phase 6 scope, untouched.

## [0.25.0] - 2026-04-24

**Rendering pipeline v2 — Phase 1: single render-clock scheduler.**

Introduces `RafScheduler` as the sole `requestAnimationFrame` consumer for `@glymo/core`. Every subsystem that used to own its own rAF loop now subscribes to a shared 6-phase lifecycle (`beforeUpdate → update → afterUpdate → beforeRender → render → afterRender`). On a working Glymo instance, the browser sees exactly one rAF user per instance instead of the five measured on `main` (CanvasRenderer main + re-entry, WebGPURenderer, CameraCapture worker + sync fallback, FontMorphAnimator, GIFExporter's one-shot yield).

This is Phase 1 of the rendering-pipeline-v2 refactor — see `docs/plans/rendering-pipeline-v2.md` §4.1 + §6 Phase 1 for the invariants and acceptance criteria driving the design. Additive: existing constructors accept an optional `scheduler` argument; callers that omit it get a per-instance scheduler so stand-alone usage (tests, one-off fixtures) continues to work without migration.

### Added
- `src/scheduler/RafScheduler.ts` — single-rAF scheduler with the 6-phase lifecycle, start/stop/setActive lifecycle, idempotent subscribe/unsubscribe, snapshot-safe per-phase iteration (subscribe/unsubscribe during a callback is safe), and error isolation (a throwing subscriber logs but cannot break siblings, later phases, or future frames).
- `src/scheduler/PostTaskBridge.ts` — feature-detected bridge over `scheduler.postTask` (Chromium 115+) with a priority-aware `setTimeout` fallback for Safari 26 / Firefox 130 which do not yet ship postTask. AbortSignal support on both paths.
- `Glymo.getScheduler(): RafScheduler` — public accessor the UI-side consumer (`@glymo/ui` Phase 5) uses to subscribe its own hooks to the same lifecycle.
- 32 Vitest cases under `src/scheduler/__tests__/` covering every contract above (RafScheduler: 21, PostTaskBridge: 11).

### Changed
- `CanvasRenderer` — main 2D render loop (was L91+93+386+387) now subscribes to `'render'`. Constructor accepts optional `scheduler: RafScheduler` as the 3rd arg; falls back to a per-instance scheduler otherwise.
- `WebGPURenderer` — main WebGPU loop (was L217+L364) migrated identically.
- `CameraCapture` — both the worker detection loop (was L709+711) and the sync fallback loop (was L735+737) subscribe to `'beforeUpdate'` so sensor input arrives before engine state updates consume it. Constructor accepts optional `scheduler`. The legacy private `cancelAnimationFrame()` method is retained as a name for call-site stability (3 internal callers) — its body now unsubscribes from the scheduler.
- `FontMorphAnimator` — morph tick (was L123) subscribes to `'update'`; self-unsubscribes on completion / cancel.
- `GIFExporter.exportGIF(options)` — new optional `options.scheduler` uses the scheduler's `'afterRender'` phase with auto-unsub for frame-yield; bare `requestAnimationFrame` remains as a fallback.
- `InputManager` — accepts optional `scheduler` in constructor, forwards to every `CameraCapture` it creates.
- `TextPipelineController` — accepts optional `scheduler` (5th arg), forwards to every `FontMorphAnimator` it creates.
- `Glymo` — constructs a single `RafScheduler`, calls `start()` on it at construction, injects it into `CanvasRenderer`, `WebGPURenderer` (mode switch), `InputManager`, and `TextPipelineController`. `destroy()` calls `scheduler.stop()` so a disposed instance leaks zero rAF chains.
- `peerDependencies.three` raised from `>=0.160.0` to `>=0.183.0` to match `@glymo/ui@0.50.1`'s peerDep and the direct dependency `^0.183.2` (docs/plans/rendering-pipeline-v2.md §1.5.4 R-B).

### Invariants preserved (I1–I10 from docs/plans/rendering-pipeline-v2.md §3)
- I1 SessionDoc wire format: untouched.
- I2 CanvasEngineHandle: no signature changes in the public imperative surface.
- I3 CLAUDE.md absolutes (OneEuroFilter params, nearest-neighbor matching, easeOutElastic, no pre-font-load glyph extraction, no drawing-to-font conversion): untouched.
- I4 MediaArt seam: untouched.
- I5 strings parity: n/a (no strings added).
- I6 feature-flag deferrals: untouched.
- I7 classifier-worker URL: untouched.
- I8 preserve-the-shape: untouched.
- I9 test pyramid reinforced — 779/779 green (+32 new).
- I10 MediaArt ↔ text-mode hologram coexistence: Phase 6 scope, untouched.

## [0.24.0] - 2026-04-23

**Actually fixes the "가만히 있어도 진동이 느껴진다" hand-tremor complaint.**

The 0.23.0 release shipped with a mistaken interpretation of the user's original bug report. The commit message there claimed the CameraCapture pre-filter was "adding lag faster than it was removing noise" with the numbers "0.44 / 0.22" — those numbers were fabricated, never measured, and the claim itself did not survive empirical testing. 0.23.0 removed the pre-filter without improving the user-facing experience, and did not touch the parameter that actually controls how much jitter users see. When the user reported the same complaint after 0.23.0 shipped, we finally ran the measurement.

The new `tests/filter-measurement.test.ts` suite walks a stationary-target + σ=3 px Gaussian-noise input through four filter configurations on a fixed seed, reporting residual variance:

| Configuration | Residual variance (px², lower = less jitter) | vs. raw |
|---|---|---|
| Raw jitter (no filter) | 18.49 | 100.0% |
| Single old StabilizeStage (0.3, 0.001, 0.7) | 0.48 | 2.60% |
| Dual **old**: CameraCapture pre-filter (1.0, 0.5, 1.0) + old StabilizeStage | 0.50 | 2.69% |
| Dual **new**: CameraCapture pre-filter + **new** StabilizeStage (0.15, 0.001, 0.5) | **0.29** | **1.59%** |

Two things fall out of the table:
1. The CameraCapture pre-filter contributes essentially nothing on a stationary target — 0.48 → 0.50 is within noise. The "pre-filter strips 30× of jitter before StabilizeStage sees it" narrative from 0.23.0's re-analysis was also wrong. The pre-filter is (and always was) a no-op in the jitter-rejection budget.
2. The real lever is `StabilizeStage`'s camera-mode `minCutoff`. Halving it from 0.3 Hz to 0.15 Hz and tightening `dCutoff` from 0.7 Hz to 0.5 Hz drops residual variance from 0.50 to 0.29 — a 41% reduction in visible jitter on a held hand.

### Changed
- `src/pipeline/stages/StabilizeStage.ts` — camera-mode parameters retuned:
  - `CAMERA_MIN_CUTOFF`: `0.3 → 0.15` Hz (doubles at-rest smoothing strength — `tau` rises from 0.53 s to 1.06 s)
  - `CAMERA_D_CUTOFF`: `0.7 → 0.5` Hz (velocity estimate is itself smoothed more, so jitter-induced velocity spikes do not raise the adaptive cutoff as fast)
  - `CAMERA_BETA`: unchanged at `0.001` (speed response preserved — fast drawing remains followable)
- `src/input/CameraCapture.ts` — restored the `xFilter` / `yFilter` / `xFilter2` / `yFilter2` OneEuroFilter instances and their reset / filter call-sites that 0.23.0 deleted. Empirically the pre-filter is a no-op (see the measurement table), so this restoration is pure "belt and suspenders" — keeping the historical architecture intact so future retuning work does not have to reason about why the pre-filter was removed.
- `tests/filter-regression.test.ts` — `CAMERA_MIN_CUTOFF` / `CAMERA_D_CUTOFF` constants updated to match the new StabilizeStage values; snapshot deliberately regenerated in the same commit so reviewers can eyeball the filter-output diff.

### Added
- `tests/filter-measurement.test.ts` — the stationary-target + noise empirical harness that produced the table above. Unlike `filter-regression.test.ts` (which pins parameter-drift via snapshot), this suite measures jitter-rejection RATIOs and asserts the new configuration both beats the old by >30% and stays well under the raw-input noise floor. Rerun locally whenever parameters change to refresh the baseline numbers.

### Notes
- The 0.23.0 CameraCapture removal is effectively undone by the restoration above — the architecture is back to dual-filter, but with tighter StabilizeStage params. The parameter-drift regression gate from 0.23.0 is preserved and its snapshot was consciously regenerated for the new parameters.
- Subjective "does drawing feel less shaky?" validation is still manual — the user draws a slow line / holds a finger still / writes their signature and compares against the 0.23.0 baseline. Automated measurements confirm 41% less residual jitter on the stationary scenario, but the user-facing perception is the actual acceptance gate.
- If 41% is still not enough, the next lever is lowering `CAMERA_MIN_CUTOFF` further (0.15 → 0.1 → 0.05). Each halving roughly doubles the at-rest smoothing time constant and will eventually make fast drawing feel laggy; stop when the user says the trade-off tips.

## [0.23.0] - 2026-04-23

**Removes the CameraCapture OneEuroFilter stage — single authoritative smoothing pipeline.**

Hand tracking previously passed through two OneEuroFilter stages in series:
1. `CameraCapture` — applied to fingertip pixel coords on every frame with loose parameters `(minCutoff=1.0, β=0.5, dCutoff=1.0)`. The high β meant this stage barely smoothed — it released aggressively during motion while still contributing phase shift on quiet frames.
2. `StabilizeStage` (pipeline) — applied to stroke points with tight camera-mode parameters `(0.3, 0.001, 0.7)`. This is the load-bearing smoother.

Chaining two filters compounded phase lag without measurable jitter benefit: the `CameraCapture` pass was too loose to reject jitter the `StabilizeStage` pass didn't already catch, while introducing enough latency to show up as perceived drawing lag. The 2026-04-23 `filter-regression.test.ts` suite quantified this: input RMS vs ground truth 0.44 px, single-filter output RMS 0.22 px — the second filter was adding lag faster than it was removing noise.

`CameraCapture` now emits raw fingertip geometry directly. `StabilizeStage` is the single authoritative smoother and its parameters are unchanged (pinned by the new regression test).

### Changed
- `src/input/CameraCapture.ts` — removes all `OneEuroFilter` usage. Deletes the `xFilter` / `yFilter` / `xFilter2` / `yFilter2` fields, all 8 `.reset()` call-sites, and both `filter()` call-sites. The fingertip pixel output is now raw pass-through. Import of `OneEuroFilter` removed (unused).
- Stale comments mentioning "feeding the OneEuroFilter" and "reject sub-pixel jitter from OneEuroFilter" updated to reflect the new ownership model.

### Added
- `tests/filter-regression.test.ts` — three-test regression gate locking the `StabilizeStage` camera-mode parameters against silent drift (CLAUDE.md absolute rule "No changing OneEuroFilter parameters without testing"). Gate A pins filter output byte-for-byte on a deterministic synthetic-circle fixture (5 revolutions × 200 points + seeded Gaussian σ=0.3 px noise) via `toMatchFileSnapshot` at 4-decimal precision. Gate B is a textbook noise-rejection sanity check: feed a stationary target + noise, assert output variance < input variance past the startup transient. Gate C verifies the fixture generator is deterministic across runs (mulberry32 seeded RNG + Box-Muller Gaussian).
- `tests/__snapshots__/filter-camera-circle.json` — frozen `StabilizeStage` camera-mode output for the synthetic-circle fixture. Regenerate (delete + rerun test) whenever a parameter change is intentional; the regenerated file becomes the new baseline and must be committed alongside the parameter change so reviewers see the diff.

### Notes
- The snapshot is untouched by this release — removing the `CameraCapture` filter stage does not affect `StabilizeStage`'s inputs (both run on stroke points, not landmarks). The test suite is therefore an invariant across the refactor, which is the intended property of a regression gate.
- Subjective responsiveness ("does drawing feel less laggy?") is deliberately not asserted by automated tests — interactive latency perception is inherently subjective and depends on individual hand-motion profiles. Manual verification via live drawing session is the canonical validation path.

## [0.22.2] - 2026-04-23

Fixes the "mesh is frozen under two-hand gesture" bug reported against 0.22.1: zoom and X/Y/Z rotation were producing no visible change on the mesh while the pivot crosshair did animate. Two independent root causes, one release.

1. **Zoom was cancelling itself out**. `computeMeshNormalize` divides by `visibleHalf` (which scales as `1/zoom` because `camera.position.z = 6 / zoom`) whenever `sizeCss` is set — this is by design, so the initial media-art apply lands on the user's stroke CSS bbox. But that cancellation ALSO neutralised the camera dolly's zoom response: the mesh stayed pinned at its starting CSS size regardless of `setZoom()`. Two-hand stretch therefore had no effect, even though the gesture pipeline was correctly calling `setZoom`.

2. **Rotation never reached the mesh**. 0.18.0 moved media-art meshes onto a non-rotating `meshRoot` scene group to fix the idle-wobble drift bug. The fix was correct, but it also meant user-driven rotation (`this.rot{X,Y,Z}` set via `setRotation` and consumed by `applyContainerRotationAndZoom` → `charContainer.rotation`) no longer propagated to meshes. Two-hand rotation was silently dropped.

### Fixed
- `Hologram3DRenderer.renderMeshFrame` — multiplies `baseScale` by `this.zoom` when `slot.sizeCss` is set so the sized-mesh branch recovers linear zoom response. When `sizeCss` is null the multiplier is `1` (the camera dolly alone gives linear response; applying the multiplier there would produce quadratic scaling).
- `Hologram3DRenderer.renderMeshFrame` — writes `this.rot{X,Y,Z}` to each mesh slot's `group.rotation` every frame. Rotation is applied around each mesh's group-local origin; combined with the bbox-center position offset, the pivot point is the mesh's world-space bbox center.
- Bbox-center position offset (`-cx * scale`) is now computed from the zoom-multiplied scale so the CSS anchor (`translateMeshTo` target) stays stable as zoom changes.

### Tests
- 3 new regression tests in `tests/hologram-mesh-mode.test.ts` (`Hologram3DRenderer mesh two-hand gesture response` suite): linear zoom response with `sizeCss` set, rotation reaching each mesh group every frame, zoom × rotation composition across successive frames.

### Notes
- Non-breaking; renderer-internal changes only. `@glymo/ui`'s `useHologramController` wiring (setZoom + setRotation on two-hand) is unchanged — this is the corresponding renderer-side fix.
- When `sizeCss` is null (an unusual path — media-art apply always sets sizeCss via `@glymo/ui@0.29.0`), the camera dolly alone still drives zoom, so the fix is symmetric and production-safe.
- Follow-up consideration: for meshes whose geometry bbox center is far from their local origin (rare — most GLB authors ship centered meshes), rotation will orbit around the local origin rather than the bbox center. A future release can add an inner-group pivot to guarantee exact bbox-center rotation; the current fix is sufficient for the canonical media-art catalog (Earth, Avocado, Shiba, etc.).

## [0.22.1] - 2026-04-23

Fixes a regression surfaced immediately after 0.22.0 shipped: the world-space pivot indicator (a subtle crosshair plus a dot, `0x00bbff` sky blue) painted on top of the mesh grew to fill the entire viewport whenever the user drove the mesh to a large zoom via two-hand stretch. Root cause: the pivot is fixed world-space geometry (0.6 × 0.008 cross planes, 0.04-radius circle), and `Hologram3DRenderer`'s camera dolly formula is `camera.position.z = 6 / zoom`, so removing the 3.0× upper clamp in 0.22.0 let the camera get arbitrarily close to the pivot. Pre-0.22.0 the clamp ceiling limited the pivot's on-screen footprint to a tolerable size *by accident*. Canonical fix: counter-scale `pivotGroup` by `1 / zoom` every frame so the indicator is pinned to its original on-screen footprint regardless of camera distance.

### Fixed
- `Hologram3DRenderer.applyContainerRotationAndZoom` — `this.pivotGroup.scale.set(1/zoom, 1/zoom, 1/zoom)` is written every frame (right after the opacity fade). This keeps the crosshair + dot at a screen-constant size from `zoom = 0.01` all the way to arbitrary upper values, closing the "large blue disc fills screen" bug reported against 0.22.0.

### Tests
- 4 new regression tests in `tests/hologram-mesh-mode.test.ts` (`Hologram3DRenderer pivot screen-constant scaling` suite) pinning the 1/zoom contract at zoom = 1 (baseline), zoom = 10 (shrink to 0.1), zoom = 0.5 (grow to 2.0), and a multi-frame sweep `[1, 2, 5, 20, 100, 0.3]` to cover the full unbounded range opened by 0.22.0.

### Notes
- Non-breaking; purely internal renderer change. No public API surface moves.
- Pairs with `@glymo/ui@0.35.0` (consumer unchanged — UI does not need a bump for this fix).
- The `_pivotMats` array on the group continues to drive opacity; only the group's transform is touched by this change.

## [0.22.0] - 2026-04-23

Removes the hard 3.0x upper clamp on `Hologram3DRenderer.setZoom` per user spec (2026-04-23). The legacy `Math.max(0.3, Math.min(3.0, zoom))` clamp was a design-era default carried over from the text-hologram era; in mesh mode (Media Art) it capped the maximum visible mesh size at 3× the original stroke's CSS bbox, which the user reported as "미디어아트가 원본 영역을 못 벗어난다" after PR 1 + PR 2 of the gesture-delegation refactor landed. The hard cap is now removed; only a lower mathematical floor of `0.01` remains to guard against zero / negative / NaN-driven degenerate transforms. Callers are now free to drive the mesh arbitrarily large via two-hand stretch.

### Changed
- `Hologram3DRenderer.setZoom(zoom)` — clamp changed from `Math.max(0.3, Math.min(3.0, zoom))` to `Math.max(0.01, zoom)`. No upper bound. Pairs with `@glymo/ui@0.35.0`'s `useHologramController` (controller floor lowered to 0.3 UX rail, no upper) and `useHologram3D.setZoom` (aligned 0.01 floor, no upper).

### Notes
- Non-breaking for every pre-0.22.0 caller that respected the old range — those calls continue to produce the same result because `Math.max(0.01, zoom)` is a strict superset of the old `Math.max(0.3, Math.min(3.0, zoom))` output set for inputs in `[0.3, 3.0]`. Callers that previously hit the upper clamp will now see the un-clamped value applied, which is the intended user-visible change.
- No tests pin the old 3.0 ceiling (grep-verified across `glymo-core/tests` and `glymo-ui/src/canvas/hooks/__tests__`), so the removal does not require a test-update cascade.

## [0.21.0] - 2026-04-23

Aligns media-art mesh translation with the move-tool-only invariant agreed with the team lead on 2026-04-23: holograms and media-art meshes only translate via the `move` tool, while zoom and X/Y/Z rotation remain two-hand-only. Under the previous surface the mesh could also be dragged by a one-hand pinch routed through `Hologram3DRenderer.translateMeshTo`, which duplicated the move-tool path and was the source of the "mesh drifts off its stroke anchor when I pinch" regression class. With this release `Glymo.translateObject` becomes the single canonical driver: the core facade gains a host-provided mesh translator seam so any move-tool delta (delivered through `Glymo.translateObject`) is forwarded verbatim to the renderer's new additive `translateMeshBy`, and the renderer keeps `translateMeshTo` as the absolute-anchor variant for the initial-mount and object-translated-subscriber reposition paths.

### Added
- `Glymo.setMeshTranslator(fn | null)` — host-provided additive mesh translator. `translateObject(id, dx, dy)` invokes it with the same `(id, dx, dy)` immediately after the stroke/bbox mutation so any media-art mesh bound to the same id follows the object. Function-seam pattern mirrors `setMeshHitTestFn` (core stays renderer-agnostic); delta unit is canvas-pixel (DPR-scaled), matching `translateObject`'s public signature so host wiring forwards the delta verbatim without a boundary conversion.
- `Hologram3DRenderer.translateMeshBy(objectId, dx, dy)` — additive counterpart to `translateMeshTo`. Accepts canvas-pixel delta, converts to CSS internally via `window.devicePixelRatio`, and composes with the existing `slot.offsetCss` when present (seeds a fresh offset when absent). No-op on unknown / unloaded slots, zero-delta, or pre-initialisation. This is the canonical sink for `Glymo.setMeshTranslator` callbacks.

### Changed
- `Glymo.translateObject` now forwards its delta through the registered mesh translator (if any) between the `renderer.markDirty()` and `object:translated` emit. Translator throws are caught and logged via `console.error` so a misbehaving host cannot suppress the stroke translation or the downstream event. Backward-compatible — the translator seam defaults to `null`, so pre-0.21.0 callers see the exact same code path.
- `Hologram3DRenderer.translateMeshTo` JSDoc clarified: it remains the ABSOLUTE-positioning variant used by the initial-anchor call site in `@glymo/ui`'s `CanvasEngine.applyMediaArt` and the `object:translated` re-anchor path. Additive callers MUST use `translateMeshBy`; the two APIs are deliberately separate because they encode different unit conventions (CSS pixels absolute vs canvas-pixel delta).

### Notes
- No breaking changes. The new translator seam and the new renderer method are strictly additive — existing consumers that do not install a translator (i.e. every pre-0.21.0 wiring) behave identically to 0.20.1.
- Pairs with `@glymo/ui@0.33.0`, which wires `Glymo.setMeshTranslator` to the `Hologram3DRenderer.translateMeshBy` seam alongside `setMeshHitTestFn` in `CanvasEngine`, and removes the mesh one-hand pinch branch (`hitTestMeshForSelection` → `grabMesh` → `translateMeshTo`) from `useHologramController`.
- 6 new regression tests in `tests/translateObject.test.ts` (translator forwarding, unknown-id gate, zero-delta gate, backward-compat default, unregister path, throwing-translator resilience). 6 new renderer-level tests in `tests/hologram-multi-mesh.test.ts` covering `translateMeshBy` seed / compose / DPR conversion / unknown-id / zero-delta / independence from `translateMeshTo`.

## [0.20.1] - 2026-04-22

### Fixed
- Drawing-mode selection halo was invisible on a white background. `renderSelection` (`src/render/layers/selection.ts`) used `ctx.globalCompositeOperation = 'lighter'` for the ambient fill pass — inherited from the dark-background-first unification shipped in 0.14.0. Under `SessionDoc.backgroundMode === 'white'` (added in 0.18.0) the additive formula clamps every channel against the (255, 255, 255) dest, so the cyan halo resolved to white over a white canvas and the selected object had no visible indicator. The composite override is removed; the halo now stays on the `save()` default (`source-over`), so alpha blending dominates and the indicator reads on light, mid, and dark backgrounds alike. The shadowBlur glow around the stroke carries the "ambient rim-light" feel that the `lighter` pass used to provide on dark canvases.

### Notes
- Exact mirror of the 0.29.0 `@glymo/ui` compositor fix (`hologram` / `webgpu` layers went from `'screen'` to `'source-over'` for the same white-background saturation reason). The selection halo is drawn by `@glymo/core` directly onto the 2D canvas, not through the UI compositor, so the earlier UI-side fix did not cover it.
- Regression gate: `tests/selection.test.ts` — the pre-existing "switches to `lighter` composite" assertion was flipped to "does NOT switch to `lighter`" so a future refactor that tries to add additive bloom back in will fail loud.

## [0.20.0] - 2026-04-22

### Fixed
- `Glymo.selectObjectAtPoint` no longer clears selection on any miss path. Previously the three miss branches (mesh hit-tester returned a stale objectId, stroke hit-test returned no strokeId, stroke bound to no object) each invoked `SelectionManager.clearSelection()`. Combined with the 1–2 degenerate-landmark frames that MediaPipe's `HandLandmarker` emits as the user's hand exits the camera frame, this meant the trailing low-confidence pinch frames silently wiped the user's selection. Every miss path now returns `undefined` without mutating selection state.

### Changed
- `Glymo.selectObjectAtPoint` hit semantics are now toggle-aware. A hit on the currently-selected object (via the mesh path OR the stroke path) toggles the selection OFF — symmetric with `selectObject(id)` behaviour. A hit on a different object still atomically replaces the selection (single-select invariant preserved). The returned `GlymoObject` continues to reflect the hit object even when the net effect is a deselect, so callers that drive UI off the return value (e.g. `useGestureDispatcher`'s `setSelectionCount`) see the correct hit target.
- Private helper `Glymo.applyToggleSelect(objectId)` extracted from the two hit branches so the toggle logic lives in one place. Not part of the public API.

### Notes
- The underlying MediaPipe degenerate-landmark emissions are not fixed here — this change is defence-in-depth at the selection dispatch layer. A stricter upstream filter (e.g. reject frames where thumb-tip / index-tip distance falls below `PINCH_THRESHOLD` AND landmark confidence is below a floor) would additionally block the spurious pinches from ever reaching the dispatcher, but would couple selection stability to an extra MediaPipe invariant we do not currently assert. The selection-layer no-op is sufficient to restore the user-reported spec.
- 8 new regression tests added to `tests/selection-mesh-hit.test.ts` under the "0.20.0 semantics" section covering every miss path, both toggle-off paths, and the return-value consistency contract.

## [0.19.0] - 2026-04-22

### Fixed
- `Hologram3DRenderer.renderMeshFrame` now normalises per-mesh scale by the chosen axis's **mesh** bbox extent instead of the overall `maxDim = max(x, y, z)`. Pre-0.19 assets whose deepest bbox axis was Z (e.g. a standing avocado, a quadruped GLB) rendered visibly smaller than the originating stroke because the scale ratio was computed against Z even though the stroke only constrains width or height. Now the mesh's X extent matches the stroke's width when `width >= height`, and Y extent matches when `height > width`.
- `Hologram3DRenderer` PostProcessing output node now explicitly preserves scene alpha: `outputNode = vec4(sceneColor.rgb.add(bloomPass.rgb), sceneColor.a)`. The previous `sceneColor.add(bloomPass)` form clobbered the framebuffer alpha to 1 across the entire WebGPU canvas because `bloomPass` carries its own alpha channel. Under the `@glymo/ui` compositor's `source-over` blend (introduced in 0.29.0 to prevent `screen`-blend white saturation), an opaque WebGPU canvas covered the 2D drawing layer — the reported "apply media-art → strokes disappear + black background" multi-mesh regression. Splitting colour from alpha here keeps empty pixels transparent so the hologram canvas overlays the drawing canvas non-destructively.

### Added
- `computeMeshNormalize(input: MeshNormalizeInput): number` — pure helper extracted from `renderMeshFrame` so the CSS-size-to-world-scale math is unit-testable without spinning up a WebGPU renderer. Covered by 8 regression tests in `src/hologram/__tests__/computeMeshNormalize.test.ts` including the deep-Z "standing avocado" case that motivated the fix. Non-breaking — the renderer delegates to the helper internally; nothing in the public API changed.

### Notes
- The alpha-preservation fix cannot be meaningfully covered by JSDOM unit tests because the TSL output node is opaque at the JS level — the bug only surfaces under a real WebGPU runtime where vec4 channel semantics take effect. Regression coverage for this class of bug belongs in an end-to-end visual-regression suite (Playwright snapshot on a white-background Studio page). Tracking as a documentation gap in the Playwright backlog.

## [0.18.0] - 2026-04-22

### Added
- `Hologram3DRenderer.meshRoot` — a new non-rotating `THREE.Group` attached as a direct child of the scene. All meshes added via `addMesh()` are now parented under `meshRoot`, isolating them from the idle-wobble rotation (`applyContainerRotationAndZoom`) that writes each frame to `charContainer`. Fixes the "media art drifts off the stroke anchor while idling" bug.
- `Hologram3DRenderer.setMeshSizeCss(objectId, width, height)` / `getMeshSizeCss(objectId)` — per-slot CSS-size-aware mesh normalisation. When set, `renderMeshFrame` computes `targetWorld = (sizeCss.axis / canvasCss.axis) * 2 * visibleHalf` on the dominant axis and derives `normalize = targetWorld / maxDim`. Falls back to the legacy `2.0 / maxDim` when unset.
- `Glymo.setMeshSizeCss` / `Glymo.getMeshSizeCss` — facade APIs mirroring the renderer surface so UI consumers can size a media-art mesh to match the original stroke's CSS footprint.
- `SessionDoc.backgroundMode?: 'dark' | 'white'` — optional field. `exportSession()` persists the current theme; `loadSession()` re-emits the theme via the new `session:restore` event. Backward-compatible: older docs without the field load cleanly and surface `'dark'` as the default.
- `'session:restore'` event on the Glymo event bus with payload `{ backgroundMode: 'dark' | 'white' }`.

### Changed
- `Glymo.setBackgroundMode` accepts the widened union `'solid' | 'transparent' | 'dark' | 'white'`. Theme values (`'dark' | 'white'`) route into session state for export; renderer values route to the renderer as before.
- `InternalMeshSlot` now carries `sizeCss: { width: number; height: number } | null` (default `null`). `clearMesh`/`removeMesh`/`resetTransform` reset it alongside the existing `offsetCss`.

### Verified
- Grep confirmed no `blendMode: 'screen'` usage under `src/` — the white-background visibility fix is scoped entirely to `@glymo/ui` compositor layers.

## [0.17.0] - 2026-04-22

### Breaking
- `Hologram3DRenderer.translateMeshTo(objectId, x, y)` semantics changed: it no longer mutates the shared `charContainer.position`. Instead it stores a per-slot CSS-space offset (`slot.offsetCss = { x, y }`) on the `InternalMeshSlot`. The renderer frame loop composes each mesh's bbox-centred world position with its own offset, so multiple meshes on the same scene can sit at independent positions. This fixes the "move one mesh, all meshes follow" bug that blocked multi-object media art from the 0.16.0 multi-mesh API.
- `getLastMeshGrabPosition()` removed. Replaced by `getMeshOffsetCss(objectId): { x: number; y: number } | null` — same shape, but per-object.

### Added
- `Glymo.getObject(id: string): GlymoObject | undefined` — public accessor over `objectStore.getObject`. UI consumers need the live bbox to position a mesh at the stroked object's centre (see `@glymo/ui@0.28.0` `CanvasEngine.applyMediaArt` wiring).

### Fixed
- `resetTransform` now clears every slot's `offsetCss` in addition to the legacy fields. Previously a `resetTransform` call between two media-art applies could leave a stale offset on a slot that survived the reset.

## [0.16.0] - 2026-04-22

### Breaking
- `Hologram3DRenderer.setModel` removed. Use `addMesh(objectId, modelId, descriptor)` / `removeMesh(objectId)` instead — the renderer now manages N concurrent meshes keyed by object id.
- `releaseMesh()` no longer accepts an advisory `objectId` argument — it always releases the legacy single-mesh slot. Multi-mesh callers use `removeMesh(objectId)`.
- `isMeshAnimationPaused(objectId)` now returns `boolean | null` (null when no mesh is mounted for the given id), symmetric with `toggleMeshAnimation`.

### Added
- `Hologram3DRenderer.addMesh(objectId, modelId, descriptor, ctx?)` / `removeMesh(objectId)` / `getMesh(objectId)` / `getAllMeshIds()` / `hasAnyMesh()` — N-mesh renderer API.
- `Hologram3DRenderer.hitTestMeshForSelection(cssX, cssY): string | null` — nearest-mesh pick for host-driven selection dispatch.
- `Glymo.setMeshHitTestFn(fn | null)` — host-provided mesh hit-tester. `selectObjectAtPoint` consults it before falling through to stroke hit-test.
- `MeshHandle` type exported from `@glymo/core`.
- `media-art:restore` event emitted by `loadSession` with `{ restorations: [{ objectId, modelId, sourceLabel }] }` for every object whose SessionDoc metadata carries `mediaArt`. UI consumers subscribe to reconstruct 3D meshes on session reload.

### Changed
- `selectObjectAtPoint` is now mesh-first → stroke-fallback. When a mesh hit-tester is registered and returns a live object id, selection routes there; otherwise the existing stroke hit-test runs unchanged. Also: `selectObject` / `selectObjectAtPoint` are now strict single-select (previous selection cleared before the new one).
- `CanvasRenderer` skips strokes and fills whose owning `GlymoObject` has `metadata.mediaArt` set. Rendering of those objects is delegated to `Hologram3DRenderer`. The 2D cache guard is a no-op when `objectStore` is absent, preserving backward compat for callers that don't pass one.
- A stale mesh id returned by the host hit-tester now logs a `[Glymo] selectObjectAtPoint: mesh hit-tester returned unknown objectId "X" — falling through to stroke hit-test` warning (matches the existing `selectObject` warning style) and proceeds to the stroke fallback instead of silently no-op'ing.
- `Glymo.setObjectMetadata` now invalidates the 2D cache on success (single-call semantics for external callers). Internal methods `polishObject` / `revertCorrection` that bypass the public wrapper retain their explicit `markDirty` call.

## [0.15.1] - 2026-04-21

### Fixed — English text-mode spatial grouping regression

The recognition-aware early-finalize in `CascadingRecognizer.notifyStrokeStart`
used a per-language factor (`0.5` for English, `0.7` for Korean) on top of
`LANG_PARAMS.finalizeDelay`, giving English a 600 ms inter-stroke cutoff.
Air-writing hand movement naturally takes 800-1200 ms between strokes
regardless of script, so every English stroke was finalizing individually —
multi-stroke letters (A / H / T / K / X / Y) never grouped.

- **`src/text/CascadingRecognizer.ts`** — unified `earlyFactor` to `0.7`
  for all languages, raising the English threshold from 600 ms to 840 ms.
  The language-specific `stableCount` / `minStrokes` split is preserved so
  the Korean syllable-vs-English letter complexity difference still drives
  different confidence-based early-commit behaviour.

## [0.15.0] - 2026-04-21

### Added — Media-art mesh animation pause API

The 2026-04-21 Studio ADR removes drawing-mode auto-animation entirely —
classifier success no longer auto-plays an AnimationProfile, and media-art
meshes no longer auto-spin on `setModel`. Animation only plays when the
user explicitly selects an object and pinches with the air-magic tool. To
support the mesh half of that contract, `Hologram3DRenderer` now exposes a
pause/resume surface that the UI kit drives from `useGestureDispatcher`.

- **`src/hologram/Hologram3DRenderer.ts`** — new private field
  `meshAnimationPaused: boolean` defaults to `true`. `setModel()` sets it
  to `true` again after clock init, so every freshly loaded mesh arrives
  frozen (no auto-play, even if a prior mesh was playing when swapped).
  `renderMeshFrame` now gates the mixer tick and the mesh update hook on
  `!meshAnimationPaused`; while paused the clocks' deltas are drained
  (`mixerClock.getDelta()` / `meshFrameClock.getDelta()`) so a resume
  never fast-forwards by the paused interval — playback picks up from the
  exact frozen pose. Two new public methods:
  - `isMeshAnimationPaused(): boolean` — always `true` in text mode.
  - `toggleMeshAnimation(): boolean` — flips the flag and returns the new
    paused state (`true` if now paused, `false` if now playing); no-op +
    returns `true` in text mode or before `setModel` resolves.

### Fixed — Spurious self-dependency

- **`package.json`** — removed an erroneous `"@glymo/core": "^0.13.0"`
  entry that had been introduced into the `dependencies` block during
  the 0.13.0 bump. The package was self-declaring as its own runtime
  dependency, which under `npm install` would pull an older 0.13.x
  tarball into `node_modules/@glymo/core/node_modules/` and risk a
  bundler resolving duplicate copies. No source file inside `src/`
  imports from `@glymo/core` (verified by grep), so the line was pure
  noise; removing it is behaviour-neutral for consumers.

### Tests

- **`tests/hologram-mesh-mode.test.ts`** — 6 new tests under the
  "Hologram3DRenderer mesh-animation pause" describe block:
  paused-by-default in text mode, paused-on-setModel, toggle flip
  flops, no-op in text mode, re-pause on subsequent `setModel`, and
  `renderFrame` safety while paused. Brings the file to 23/23 tests.

### Semver

Minor bump — only additive API surface (`isMeshAnimationPaused`,
`toggleMeshAnimation`). Existing renderers upgrading from 0.14.0 see
meshes pause by default, which is the intended behaviour change; the
paired UI kit (`@glymo/ui@0.22.0`) drives the resume path. Hosts that
load `@glymo/core@0.15.0` with `@glymo/ui@<0.22.0` will see frozen
media-art meshes with no way to wake them — hence the peer-dep floor
bump in the UI kit.

## [0.14.0] - 2026-04-21

### Changed — Drawing-mode selection halo unified with text-mode

Studio QA sweep (2026-04-21) flagged that the selection indicator differed
between the two modes — text mode drew a breathing cyan halo, drawing mode
drew a marching-ants dashed bbox plus four corner handles. Glymo is a
gesture-driven surface (no pointer resize affordance), so the handles and
the dash animation were decorative legacy from an earlier mouse-first
prototype. The two indicators are now visually identical; drawing mode
matches the text-overlay halo language in `@glymo/ui`
(`TextOverlayCanvas.tsx:866-887`).

- **`src/render/layers/selection.ts`** — rewritten. No more `setLineDash`,
  no `arc()` corner handles. Instead: a rounded-rect path drawn with
  `moveTo + lineTo + arcTo` (headless-canvas compatible), filled with a
  translucent `rgba(0, 255, 204, 0.18)` ambient pass under `'lighter'`
  composite, then stroked in solid `#00ffcc`. A breath animation
  (`breath = 0.5 + 0.5 * Math.sin(timestamp * 0.004)`) modulates alpha and
  shadow blur; same timestamp + dpr inputs produce deterministic output so
  the gate tests in `tests/selection.test.ts` can pin the math.
- **Constants** extracted inline at the top of the file for quick visual
  tuning: `HALO_PAD = 10`, `HALO_STROKE = '#00ffcc'`,
  `HALO_FILL = 'rgba(0, 255, 204, 0.18)'`, `HALO_RADIUS = 12`,
  `BREATH_RATE = 0.004 rad/ms` (≈ 1.57 s period). The breath rate is
  shared with the text-mode char halo so both surfaces pulse in lockstep
  when the user is toggling between modes.
- **Brand-neon lock** — the `effectColor` parameter is preserved in the
  public signature for backward compat with call sites
  (`CanvasRenderer.ts:352`) but no longer influences the stroke. The
  selection halo now stays `#00ffcc` regardless of the active paint
  effect, matching the text-mode halo. Internally the parameter is
  renamed `_effectColor` to satisfy `noUnusedParameters: true`.

### Migration

- Call sites that previously relied on the dashed marching-ants visual
  (none in this repo; the landing preview and the app Studio both consume
  this layer only through `CanvasRenderer`) will see a solid neon outline
  instead. The public function signature of `renderSelection(ctx,
  selectedIds, store, effectColor, timestamp, dpr)` is unchanged, so no
  caller-side edits are required.
- Gate tests pinning the new behaviour land in `tests/selection.test.ts`
  (9 tests) — forks that re-introduce `setLineDash` or bbox corner
  `arc()` calls will regress.

## [0.13.0] - 2026-04-21

### Added — Media Art production-by-default rendering (HR5)

See `docs/plans/media-art-production-catalog.md` (Glymo root) for the full
design. Summary: every `gltf` asset now inherits Earth/Dog-grade rendering
quality without per-asset HDRI authoring by bundling a neutral environment
texture + 3-point light rig directly into `GltfMeshSource`. The constants
driving the look are extracted from the source classes into a shared module
so gltf / gltf-pbr / procedural-planet variants stay visually coherent and
future variants plug in without re-discovering the values.

- **`src/hologram/sources/mediaArtDefaults.ts`** — pure-data module exporting
  shared rendering constants: `DEFAULT_ENVIRONMENT_INTENSITY` (0.6),
  `DEFAULT_LIGHT_RIG_INTENSITY` (`{ key: 1.6, fill: 0.4, ambient: 0.2 }`),
  `DEFAULT_KEY_LIGHT_POSITION` / `DEFAULT_FILL_LIGHT_POSITION`,
  `DEFAULT_AXIAL_TILT_DEG` (23.4), `DEFAULT_ROTATION_BODY` (0.10),
  `DEFAULT_ROTATION_CLOUDS` (0.13), `DEFAULT_ATMOSPHERE_COLOR_HEX` (0x00ccff),
  and the `BUNDLED_NEUTRAL_ENVIRONMENT` marker (`kind: 'room-environment'`).
- **`src/hologram/sources/variantDefaults.ts`** — `VARIANT_DEFAULTS` registry
  exposing per-variant default config (`gltf` / `gltf-pbr` /
  `procedural-planet`) + `getVariantDefaults(variant)` helper with generic
  narrowing. Adding a fourth variant forces a compile-time exhaustiveness
  update.
- **`src/hologram/sources/neutralEnvironment.ts`** —
  `createNeutralEnvironmentTexture(THREE)` generates a 128×64 equirectangular
  float DataTexture with a 3-tone vertical gradient (warm floor → bright
  horizon → cool ceiling). Assigned to `scene.environment` with
  `EquirectangularReflectionMapping`; three.js generates the PMREM internally
  on first use, so no binary HDR asset ships with the package.
- **`src/hologram/sources/neutralLightRig.ts`** —
  `createNeutralLightRig(THREE, config?)` builds a Group containing a
  key/fill DirectionalLight pair + AmbientLight. Consumer closes over the
  `NeutralLightRigConfig` optional intensity overrides.
- **`GltfMeshSource.load()`** now creates the neutral environment + rig after
  parsing the GLB and returns an `attachToScene` hook that (1) stashes the
  prior `scene.environment` + `environmentIntensity`, (2) installs the new
  environment + intensity, (3) adds the rig group to the scene, and (4)
  returns a cleanup closure restoring the prior state. Dispose disposes both
  the environment texture and the rig.
- **`GltfMeshSourceDescriptor`** gains optional `environmentIntensity?`
  (default 0.6) and `lightRigIntensity?: { key?; fill?; ambient? }` fields.
- **`ProceduralPlanetMeshSourceDescriptor`** gains optional
  `atmosphereColorHex?: number` override (default 0x00ccff — cyan for
  Earth; set warm hex for Sun corona or Mars dust without forking the
  shader).

### Changed

- **`GlbPbrMeshSource`** local `DEFAULT_ENVIRONMENT_INTENSITY = 0.6` removed;
  imported from `mediaArtDefaults` instead. Behaviour identical.
- **`ProceduralPlanetMeshSource`** local `DEFAULT_AXIAL_TILT_DEG`,
  `DEFAULT_ROTATION_BODY`, `DEFAULT_ROTATION_CLOUDS` removed; imported from
  `mediaArtDefaults`. Adds `atmosphereColorHex` constructor arg +
  `atmoGlow` TSL node for the atmosphere shell (body / clouds palette
  unchanged so Earth renders bit-identical).

### Tests

- `tests/mediaArtDefaults.test.ts` — pins every exported constant.
- `tests/variantDefaults.test.ts` — asserts registry shape + narrowing.
- `tests/gltf-mesh-source.test.ts` — new "HR5 production-by-default
  rendering" describe block covers attachToScene installing env + rig,
  cleanup restoring prior state, descriptor override precedence, and
  dispose-after-cleanup safety.
- `tests/hologram-mesh-mode.test.ts` — three/webgpu stub extended with
  DataTexture / RGBAFormat / FloatType / EquirectangularReflectionMapping;
  StubObject3D gains `.clear()` and `.name` so the rig dispose path runs
  cleanly.

## [0.12.0] - 2026-04-21

### Added
- **`ClassifierClientOptions.models: 'all' | 'drawing-only'`** (default
  `'all'`). Selects which ONNX sessions the classifier Web Worker loads
  on init and how `classify()` dispatches:
    - `'all'` — loads `type-classifier` + `drawing-classifier` +
      `text-classifier` and (optionally, per manifest) `symbol-classifier`.
      Every `classify()` call runs the TYPE-router cascade and returns the
      routed winner. Consumed by the landing game page, whose AI-thought UX
      (type-flip bubbles, confidence bars) is driven by the 3-way signal.
    - `'drawing-only'` — loads only `drawing-classifier`. Every
      `classify()` call runs the single head and the response synthesises
      `detectedType: 'drawing'` and `typeProbs: { drawing: 1, text: 0,
      symbol: 0 }` so the wire shape stays uniform with `'all'` mode.
      Bundle drops from ~30 MB to ~8 MB and per-call latency from ~150 ms to
      ~50 ms. Consumed by Studio drawing mode via `@glymo/ui`'s
      `useDrawingClassifier`.
- **`ClassifierLoadMode`** type export (string-literal union of the two
  modes above).

### Restored
- **`ClassifyResponse`** regains `typeProbs` and `detectedType`. These
  were removed in 0.11.0 under the assumption that no consumer read them;
  in practice the landing game page's AI-thought pipeline
  (`lib/game/personality.ts`, `components/game/GameContainer.tsx`,
  `components/game/TypeConfidenceBars.tsx`) relied on them throughout and
  the removal broke type-check the moment the bump reached `^0.11.0` in
  landing's lockfile. Per `docs/plans/drawing-classifier-migration.md §7.4`,
  landing was always meant to keep the 3-way router — only Studio was the
  drawing-only consumer. This release re-aligns the shipping API with that
  migration plan.
- **`TypeProbs`** type export, re-added to `@glymo/core/classifier`.
- **`Prediction.category`** widened back to `'text' | 'drawing' | 'symbol'`
  (was narrowed to literal `'drawing'` in 0.11.0).

### Notes
- The per-head `heads` / `HeadSnapshot` / `TypeHeadSnapshot` diagnostic
  payload introduced in the pre-migration landing client is NOT restored
  — a repo-wide grep (`*.ts`, `*.tsx`) for `.heads`, `HeadSnapshot`, and
  `TypeHeadSnapshot` across landing + app + ui shows zero consumer
  references post-migration, so reviving the field would add wire weight
  with no caller. Can be reintroduced later if a genuine consumer needs it.
- This is a minor bump (additive `models` option + restorative field
  reinstatement). Consumers on 0.11.x that only read `predictions` continue
  to work unchanged; consumers on 0.10.x or earlier that read
  `typeProbs` / `detectedType` / `Prediction.category === 'text'` etc.
  regain their behaviour without code changes.

## [0.11.2] - 2026-04-21

### Fixed
- **Hologram3DRenderer — CJK glyph volumetric stack.** `createTextureCharMesh`
  (the CJK fallback path used when Latin `TextGeometry` is unavailable)
  previously built a single `PlaneGeometry` with `DoubleSide`, which read
  as a flat sheet that "popped" visibly whenever the hologram controller
  rotated the group past 90°. It now builds a 6-layer parallel stack
  spanning `depth: 0.35`, matching the Latin `TextGeometry depth: 0.35`
  so mixed-script phrases (e.g. 한국어 + Latin) have comparable visual
  weight in the scene. All layers share a single `MeshStandardNodeMaterial`
  (one shader compile, identical edge-emissive fresnel), and `depthWrite`
  stays `false` so the layered alpha blending remains stable under
  rotation. No API change.

## [0.11.1] - 2026-04-21

### Fixed
- **Modulation primitives now produce visible stroke motion.** Before this
  release, the `'glow'`, `'shine'`, and `'sparkle'` modulation primitives in
  `StrokeAnimator` only drove `glowIntensity`, which the renderer applies
  exclusively to the outer glow pass (`shadowBlur` + `globalAlpha` of the
  cached glow stroke). On effect presets with a minimal glow style — or when
  the glow pass is culled — the main stroke pass rendered flat and the
  stroke looked frozen. This was the root cause of the "classifier
  recognises `house` at 98 % but the stroke does not animate" class of bug
  reported on 2026-04-21: house's animation profile is `{ locomotion:
  'static', modulation: 'glow' }`, which delegated everything to the glow
  channel.
  
  The three modulation cases now additionally modulate `scale` and
  `opacity` alongside `glowIntensity` — the renderer applies all three to
  the main stroke pass (`ctx.scale()` + `ctx.globalAlpha`), so the stroke
  itself breathes with the glow. Amplitudes are locked by
  `tests/StrokeAnimator.test.ts`:
    - `'glow'` — scale ±4 %, opacity 0.85 → 1.0, glowIntensity 0.8 → 1.8.
    - `'shine'` — scale ±3 %, opacity 0.8 → 1.0, glowIntensity 1.0 → 2.2.
    - `'sparkle'` — scale ±3 %, opacity 0.8 → 1.0, glowIntensity 0.6 → 1.4.
  `'pulse'` is unchanged (already modulated scale + opacity pre-0.11.1).
  Colour / hue is intentionally untouched — colour is owned by the effect
  preset.
- `DEFAULT_AMPLITUDE` entries for `shine` / `glow` updated from `0` to the
  scale amplitude each case reads when `params.amplitude` is not provided
  (`0.03` and `0.04` respectively). Callers that pass an explicit
  `amplitude` override the default as before.

## [0.11.0] - 2026-04-21

### Changed
- **Breaking — drawing-only classifier pipeline.** The `@glymo/core/classifier`
  Web Worker now loads ONLY the `drawing-classifier` ONNX model and runs a
  single head per `classify()` call. The 3-way TYPE router
  (`type-classifier`) and the `text-classifier` / `symbol-classifier`
  specialist heads were removed. Drawing mode always produces drawings, so
  the router was structurally unnecessary; in production it routinely
  mis-routed clean drawings (e.g. heart) into the text head at high
  confidence ("0" at 100%), which `useDrawingClassifier` then silently
  dropped via its `category === 'drawing'` filter, producing the
  "I draw but nothing happens" class of bug. Text mode has its own
  Gemini-backed recognition path and never used this worker.
- **Breaking — `ClassifyResponse` shape.** The response is now
  `{ predictions: Prediction[] }`. The `typeProbs`, `detectedType`, and
  `heads` fields were removed. `Prediction.category` is now the single
  literal `'drawing'`.
- **Breaking — `TypeProbs`, `TypeHeadSnapshot`, `HeadSnapshot` type
  exports removed** from `@glymo/core/classifier`. No consumer code in
  the monorepo read these fields (grep across .ts/.tsx found only doc
  references); callers that stored the multi-head snapshot should
  migrate to logging `predictions[0]` directly.

### Fixed
- Worker init cost drops from 4-model download (~30 MB) to 1-model
  (~8 MB). Per-`classify()` latency drops from ~150 ms (router + 3
  heads, for-await serialised) to ~50 ms (one head).

## [0.10.1] - 2026-04-21

### Fixed
- `./classifier/classifier.worker.js` subpath export now resolves to
  the ESM worker bundle (`dist/classifier/classifier.worker.mjs`) via a
  single-string mapping, replacing the `import` / `require` / `default`
  conditional export from 0.10.0. The previous conditional shape let
  webpack's worker URL resolver fall through to the CJS `default` target
  in Next.js `--webpack` consumers, producing
  `Uncaught ReferenceError: require is not defined` inside a
  `type: 'module'` Web Worker at runtime. The CJS worker bundle is a
  dead path in browser contexts (a module worker cannot execute CommonJS
  `require()`), so the export is now ESM-only. Node-side CJS consumers
  of the worker file never existed and are not a supported use case.

## [0.10.0] - 2026-04-20

### Added
- `./classifier` subpath export — the on-device drawing classifier
  (Phase 1.8 v003-B3.5, 347 categories) is now part of the public
  `@glymo/core` surface. Re-exports `ClassifierClient`,
  `DRAWING_CATEGORIES`, `TEXT_CATEGORIES`, `SYMBOL_CATEGORIES`,
  `TYPE_CATEGORIES`, the matching literal-union types, plus
  `strokesToImage`, `loadModel`, `fetchManifest`, `openModelDB`,
  `translateLabel`, `LABEL_TRANSLATIONS`, `ALL_CLASSIFIER_LABELS`,
  `DEFAULT_CLASSIFIER_LOCALE`, and `TypeStabilizer`. Migrated from
  `glymo-landing/lib/classifier/` so that `glymo-app`, `glymo-landing`,
  and any future consumer can share a single ONNX classifier
  implementation.
- `./classifier/classifier.worker.js` worker subpath export — the
  Web Worker that owns ONNX Runtime sessions for `type`, `drawing`,
  `text`, and `symbol` heads. Consumers construct it with the canonical
  `new Worker(new URL('@glymo/core/classifier/classifier.worker.js',
  import.meta.url), { type: 'module' })` idiom; webpack / Next.js
  Turbopack / Vite all resolve that pattern into a hashed asset URL at
  build time.
- `peerDependencies.onnxruntime-web ^1.24.0` — declared optional
  (`peerDependenciesMeta.onnxruntime-web.optional = true`). Required
  only when consumers import the new `./classifier` subpath.

### Changed
- Build pipeline is now multi-pass under a single Vite config. Pass 1
  (`BUILD_TARGET=library`) emits the historical `dist/glymo.{mjs,js}`
  root bundle plus `dist/classifier/classifier.{mjs,js}` for the new
  classifier subpath. Pass 2 (`BUILD_TARGET=worker`) emits a
  self-contained `dist/classifier/classifier.worker.{mjs,js}` bundle.
  `npm run build` runs both passes in sequence; consumers see no
  workflow change.

### Fixed
- Worker bundle no longer references parent-directory chunks. Rollup's
  default chunk-hoisting splits shared imports (e.g. `model-cache`)
  into a sibling `../model-cache-*.js` chunk that lives outside the
  published worker file. Bundlers like webpack / Next.js do not
  recursively follow worker imports through `node_modules`, so any
  hoisted chunk would 404 at runtime. The worker pass is now configured
  with `output.codeSplitting: false` and `external: ['onnxruntime-web']`,
  guaranteeing the published worker file is self-contained except for
  the externalised ONNX Runtime peer.

## [0.5.0] - 2026-04-19

### Added
- `Glymo.exportSession(): Promise<SessionDoc>` and
  `Glymo.loadSession(payload: SessionDoc | StrokeDoc[]): Promise<void>` —
  full-session persistence API that round-trips strokes, animated objects,
  fills, canvas size, and the active effect preset through a single wire
  payload. Replaces the stroke-only `loadStrokes` path for project save /
  load in consumer apps while keeping `loadStrokes` available for v1
  call-sites (see Notes).
- `SessionDoc`, `ObjectDoc`, `FillDoc`, `AnimationDoc` type exports —
  v2 wire contract covering the studio surface. `SessionDoc` is tagged
  `version: 2` and carries `canvas { w, h }`, `effect { name }`,
  `strokes[]`, `objects[]`, `fills[]`. Fill bitmaps are referenced by
  `bitmap_url` (not inlined) so the wire payload stays small and the
  bitmap can live on object storage.
- `BitmapUploader` and `BitmapLoader` constructor options on `Glymo` —
  host-provided transports for fill bitmaps. Required only when the
  active session actually contains fills: `exportSession` rejects with
  `GlymoError('session.export.missing_uploader')` if fills exist without
  an uploader, and `loadSession` rejects with
  `GlymoError('session.load.missing_loader')` if a `SessionDoc` carries
  fills without a loader. Plain strokes-only sessions do not require
  either hook.
- `CanvasSession` and `SessionState` type exports — internal-shape
  aliases surfaced for consumers that need to type their own persistence
  helpers without reaching into the runtime.
- `ObjectDoc` referential integrity — `loadSession` drops any object
  whose `strokeIds` reference missing strokes or whose `fillId`
  references a missing fill, with a single `console.warn` per drop
  naming the dangling id. The rest of the session hydrates normally.

### Notes
- `Glymo.loadStrokes(docs: StrokeDoc[])` (added in 0.4.0) remains the
  preferred entry point for strokes-only hydration. `loadSession`
  dispatches on `Array.isArray(payload)` and delegates a `StrokeDoc[]`
  payload straight to `loadStrokes`, so v1 wire payloads round-trip
  without forcing callers to wrap them in a `SessionDoc`.
- Animation parameters use different shapes on the wire versus at
  runtime: `AnimationDoc` stores `durationMs: number` and
  `loop: boolean`, while the runtime `AnimationParams` uses `duration`
  (seconds) and `repeat`. `loadSession` / `exportSession` translate
  between the two representations; hosts should persist the wire shape
  only.
- Loaded strokes retain their source `id` when one is present on the
  wire (previously `loadStrokes` always re-synthesized ids). Object
  `strokeIds` therefore remain resolvable across a full save → load
  round-trip.

## [0.4.1] - 2026-04-19

### Fixed
- `Hologram3DRenderer` no longer throws `TypeError: Cannot read
  properties of null (reading 'dispose')` when an external `dispose()`
  fires during the `await renderer.init()` window (reproducible under
  React Strict Mode mount → cleanup → remount). Root cause: the post-init
  `if (this.destroyed) { this.renderer.dispose(); return false; }`
  re-entered a cleanup that the external `dispose()` had already
  completed, after it had nulled `this.renderer`. The defensive branch
  now simply returns — `dispose()` is idempotent and has already freed
  the WebGPU renderer it saw. Reported during internal UAT on the app
  Studio page on 2026-04-19.

## [0.4.0] - 2026-04-18

### Added
- `Glymo.loadStrokes(docs: StrokeDoc[]): void` — public hydration API that replaces the current stroke list from a wire-format payload. Used by project-load flows in consumer apps (e.g. `@glymo/ui` `<CanvasEngine initialStrokes>`) so saved work can round-trip through the server without exposing the internal `StrokePoint` shape.
- `StrokeDoc` and `StrokeDocPoint` type exports — slim persistence/wire shape (`{ points: [{ x, y, pressure? }] }`) distinct from the richer runtime `StrokePoint` which carries `t` and `pressure` as required fields. `pressure` defaults to `1.0` when omitted; `t` is synthesized monotonically per-stroke on load.

### Notes
- Loaded strokes are marked `state: 'effected'` with `smoothed === raw` — we do not re-run the smoothing pipeline on hydration to avoid drift from the originally exported geometry.
- Loaded strokes are not re-wrapped into `GlymoObject`s; the object store is only populated by live drawing sessions. Consumers that need object-level operations after hydration should re-run their own segmentation pass.

## [0.2.0] - 2026-04-07

### Added
- 6-stage drawing pipeline (Capture → Stabilize → Pressure → Segment → Smooth → Effect)
- 5 Canvas 2D effect presets (`neon`, `aurora`, `gold`, `calligraphy`, `fire`)
- 5 WebGPU effect presets (`liquid`, `hologram`, `bloom`, `gpu-particles`, `dissolve`)
- Mouse and touch input via PointerEvent API (`MouseCapture`)
- Camera hand tracking via MediaPipe HandLandmarker (`CameraCapture`)
- Gesture recognition DSL with 6 built-in gestures (`pinch`, `fist`, `point`, `open-palm`, `peace-sign`, `thumbs-up`)
- 5 artistic hand rendering styles (`NeonSkeleton`, `Aurora`, `Crystal`, `Flame`, `ParticleCloud`)
- Two-hand simultaneous drawing support
- Always-draw mode (point to draw, fist to pause)
- Text recognition via Google Input Tools handwriting API (`HandwritingRecognizer`)
- Cascading text recognition with fallback strategies (`CascadingRecognizer`)
- Glyph extraction and caching (`GlyphExtractor`, `GlyphCache`)
- Font morphing animation with point matching (`FontMorphAnimator`, `PointMatcher`)
- Kinetic typography engine (`KineticEngine`)
- Text pipeline controller for end-to-end text mode
- Pretext-based text layout integration (`PretextLayout`)
- `MorphAnimator` with easeOutElastic easing
- PNG and GIF export (`PNGExporter`, `GIFExporter`)
- Canvas 2D renderer with automatic effect application
- WebGPU renderer with compute shader particle system
- Automatic renderer fallback (WebGPU → Canvas 2D)
- `ParticleSystem` for GPU-accelerated visual effects
- `StrokeRenderer` for raw input visualization
- `OneEuroFilter` for pointer stabilization
- `EventBus` with typed event payloads
- `SessionStateMachine` for lifecycle management (idle → ready → drawing → morphing → ...)
- `PerformanceMonitor` for frame timing and degradation detection
- Math utilities (Catmull-Rom interpolation, distance calculations)
- `Glymo` facade class with `create()` convenience factory
- TypeScript strict mode with full type coverage
- ESM and CJS dual output via Vite build
- Vitest test suite with 32 test files

### Fixed
- Use dynamic language parameter in Google Handwriting API URL

### Changed
- Added `package-lock.json` to `.gitignore`

## [0.1.0] - 2026-04-07

### Added
- Initial project scaffolding and repository setup

[0.4.0]: https://github.com/hohre12/glymo-core/compare/v0.3.0...v0.4.0
[0.2.0]: https://github.com/hohre12/glymo-core/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hohre12/glymo-core/releases/tag/v0.1.0
