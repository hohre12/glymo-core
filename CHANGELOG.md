# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
