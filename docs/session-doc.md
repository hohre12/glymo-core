# Session persistence — `SessionDoc` round-trip

`@glymo/core` round-trips the entire Studio canvas through a single `Glymo#exportSession()` / `Glymo#loadSession(doc)` pair. This document describes the v2 wire format, the runtime stores, and the host-injection seams (`BitmapUploader`, `BitmapLoader`).

## Round-trip in one snippet

```typescript
import { Glymo } from '@glymo/core';

const glymo = new Glymo(canvas, {
  bitmapUploader,   // your S3 / Supabase / Storage uploader
  bitmapLoader,     // your bitmap fetcher
});

// Save
const doc = await glymo.exportSession();
await fetch('/api/projects', { method: 'POST', body: JSON.stringify(doc) });

// Restore
const reloaded = await fetch('/api/projects/123').then(r => r.json());
await glymo.loadSession(reloaded);
```

`SessionDoc` is a JSON-serialisable contract. Fill bitmaps are uploaded out-of-band and referenced by URL — the JSON payload stays small enough to fit in a Supabase Free JSONB row.

## `SessionDoc` (v2) — top-level shape

```typescript
interface SessionDoc {
  version: 2;
  canvas: { w: number; h: number };          // CSS pixels (NOT device pixels)
  effect: { name: string; params?: Record<string, unknown> };
  strokes: StrokeDoc[];
  objects: ObjectDoc[];                      // MAY be empty
  fills: FillDoc[];                          // MAY be empty
  characters?: CharacterDoc[];               // OMITTED for drawing-mode / legacy
  backgroundMode?: 'dark' | 'white';         // OMITTED when 'dark' (default)
}
```

`canvas.w` / `canvas.h` are CSS dimensions — DPR scaling happens at runtime via `options.pixelRatio`.

`effect.name` is intentionally a `string` (not `EffectPresetName`) so the consumer app can carry extended presets through the wire; resolution happens in the renderer via the runtime effect registry. See [architecture.md](./architecture.md#extension-points).

The `characters` and `backgroundMode` fields are **omitted on the wire when empty / default**, keeping the diff minimal for the common case.

## v1 backward compatibility

`loadSession` accepts a bare `StrokeDoc[]` (the v1 shape) and falls back to a strokes-only load. v2 docs missing optional fields (`characters`, `backgroundMode`) are also accepted — `version: 2` is the only required marker.

`Glymo#loadStrokes(docs: StrokeDoc[])` is the v1-only public method — kept for callers that have no need for the full session machinery.

## `StrokeDoc`

```typescript
interface StrokeDoc {
  id?: string;                       // synthesised via crypto.randomUUID() if absent
  points: StrokeDocPoint[];          // smoothed (post-stage-5) points
  effect?: string;                   // per-stroke effect override
  customColor?: string;
  customWidth?: number;
  animation?: AnimationDoc;
}

interface StrokeDocPoint {
  x: number;
  y: number;
  pressure?: number;                 // omitted when === 1 to shrink the wire
}
```

Wire `points` always carry the **smoothed** geometry (the output of stage 5 / Chaikin). The capture-time `t` (timestamp) is intentionally omitted — it is not part of the storage contract, only a runtime invariant inside the pipeline. The runtime `StrokePoint`'s `t` field is reconstructed at load time using `performance.now()`.

`id` is optional on the type but **required at v2 semantics** — the loader synthesises a UUID if missing so v1 payloads keep working. Once synthesised the id is preserved across the round-trip so object references resolve.

## `ObjectDoc`

```typescript
interface ObjectDoc {
  id: string;
  strokeIds: string[];
  fillIds: string[];
  bbox: { x: number; y: number; width: number; height: number };
  metadata?: Record<string, unknown>;
}
```

**Referential integrity** is enforced at load: `strokeIds` and `fillIds` MUST resolve within the same `SessionDoc`. Dangling references cause the offending object to be dropped with a `console.warn` — the canvas does not throw on a corrupt session.

Object ids are preserved verbatim across the round-trip via `ObjectStore#restoreObject`. Duplicate ids in the wire are skipped with a warn.

## `FillDoc`

```typescript
interface FillDoc {
  id: string;
  color: string;
  bitmap_url: string;                // public URL produced by BitmapUploader
}
```

The bitmap itself is persisted to your S3-compatible bucket out-of-band; `bitmap_url` carries the public URL at rest. **Size limit: 500 KB per fill PNG**, enforced client-side before upload (the renderer rejects oversized fills with a `GlymoError`).

## `AnimationDoc`

```typescript
interface AnimationDoc {
  type: AnimationType;               // see docs/animation.md for the 20 types
  durationMs?: number;               // wire — runtime field is `duration` (rename below)
  loop?: boolean;                    // wire — runtime field is `repeat`
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amplitude?: number;
  speed?: number;
  particleCount?: number;
  keyframes?: AnimationKeyframe[];
}
```

Two **deliberate field renames** between the wire and runtime shapes:

| Wire (`AnimationDoc`) | Runtime (`AnimationParams`) | Why |
|-----------------------|-----------------------------|-----|
| `durationMs` | `duration` | The wire name is unit-explicit so the persisted contract can't be misread as seconds. |
| `loop` | `repeat` | The wire name matches the SQL/JSON convention adopted by the server-side pydantic schema. |

The runtime field names predate the wire format and are too entrenched to rename without churning every animation site. Translation happens in `Glymo.exportSession` / `Glymo.loadSession` private helpers (`animationParamsToDoc` / `animationDocToParams`).

**Live state is not persisted.** `startTime` and `active` are reset on load — animations restart at `t = 0`, matching the UX of a page refresh today. Missing `durationMs` on the wire defaults to 2000 ms at load.

## `CharacterDoc` (text mode)

```typescript
interface CharacterDoc {
  id: string;                        // crypto.randomUUID() — see warning below
  char: string;                      // the recognised glyph (e.g. "안")
  x: number;                         // centre-x, CSS pixels
  y: number;                         // centre-y, CSS pixels
  width: number;
  height: number;                    // rolling-averaged at recognition time
  fontId?: string;
  effect?: string;
  confidence?: number;               // diagnostic only — not a load-time gate
}
```

Used by text-mode typography to round-trip recognised characters. The original handwritten strokes are **not** persisted — they're already removed from `Glymo.strokes` via `fadeOutStrokeById` once recognition finalises.

`strokePoints` (per-character geometry used by hologram / morph effects) is intentionally omitted — it's deterministically derivable from `char + fontId + (x, y, width, height)` on load, and keeping it out of the wire keeps the payload inside the soft size cap.

> **Critical:** `id` MUST be `crypto.randomUUID()` at recognition time. The pre-Revision-2 counter-based `char-N` scheme caused silent overwrites on save → re-enter → add (e.g. "안녕 → 반 → 녕반"). Counter ids would collide a freshly-typed character with a loaded one. The renderer treats id as authoritative — never reissue ids on load.

## Host-injection seams

`@glymo/core` is HTTP-agnostic — the consumer injects fill bitmap transport at construction:

```typescript
interface BitmapUploader {
  upload(bitmap: ImageBitmap): Promise<string>;   // returns public URL at rest
}

interface BitmapLoader {
  load(url: string): Promise<ImageBitmap>;        // fetch + decode
}
```

Wired via `GlymoOptions.bitmapUploader` / `GlymoOptions.bitmapLoader`. They're required when the corresponding operation involves fills:

| Operation | Throws when |
|-----------|-------------|
| `exportSession()` | `fills.length > 0 && !bitmapUploader` → `GlymoError('bitmap-uploader-missing')` |
| `loadSession(doc)` | `doc.fills.length > 0 && !bitmapLoader` → `GlymoError('bitmap-loader-missing')` |

Sessions without fills can save / load without either injected.

`exportSession` uploads fills **sequentially** — a mid-batch failure aborts the export before returning a partial doc. `loadSession` loads fills **in parallel** — any rejection propagates.

## Runtime stores

The persisted shape is sourced from / restored into three stores. They are part of `Glymo`'s internal composition; `ObjectStore` and `SelectionManager` are also exported for advanced consumer access.

### `ObjectStore` (exported)

Pure data layer for `GlymoObject` instances — groups of strokes + fills treated as a single unit for animation, undo, and interaction.

| Method | Returns | Notes |
|--------|---------|-------|
| `createObject(strokeIds, bbox)` | `GlymoObject` | Mints a UUID. Steals strokes from any prior owner. |
| `restoreObject(id, strokeIds, fillIds, bbox, metadata?)` | `GlymoObject \| undefined` | Preserves the supplied id. Skips with warn on duplicates. Used by `loadSession`. |
| `addFillToObject(objectId, fillId)` | `boolean` | |
| `addStrokeToObject(objectId, strokeId)` | `boolean` | Used by undo to restore a removed stroke. |
| `removeStrokeFromObject(strokeId)` | `void` | Used by `fadeOutStrokeById`. |
| `getObject(id)` | `GlymoObject \| undefined` | |
| `getObjectByStrokeId(strokeId)` | `GlymoObject \| undefined` | Reverse-lookup. |
| `getObjectByFillId(fillId)` | `GlymoObject \| undefined` | |
| `getLastObject()` | `GlymoObject \| undefined` | Most recently created. |
| `getAllObjects()` | `GlymoObject[]` | In creation order. |
| `removeObject(id)` | `GlymoObject \| undefined` | |
| `removeLastObject()` | `GlymoObject \| undefined` | |
| `setAnimationId(objectId, animationId)` | `void` | |
| `updateMetadata(objectId, key, value)` | `boolean` | Per-key write into `metadata`. |
| `clear()` | `void` | |
| `size` | `number` | |

### `SelectionManager` (exported)

Tracks a set of selected `GlymoObject` IDs. Constructor takes an `EventBus` so selection changes fan out as typed events.

| Method | Notes |
|--------|-------|
| `select(objectId)` / `deselect(objectId)` / `toggle(objectId)` | Idempotent. |
| `clearSelection()` | |
| `isSelected(objectId)` / `count` / `getSelectedIds()` | Read accessors. `getSelectedIds()` returns the live `ReadonlySet`. |
| `removeIfSelected(objectId)` | Used during object deletion to drop stale selection. |

Events emitted: `object:selected`, `object:deselected`, `selection:changed` (full ID list per change).

### `CharacterStore` (internal)

Authoritative store for recognised text-mode characters. Owned by `Glymo` so `exportSession` can serialise without a React round-trip and the renderer can read char geometry directly.

Methods: `addCharacter(doc)`, `updateCharacter(id, patch)`, `removeCharacter(id)`, `getCharacter(id)`, `getAllCharacters()`, `loadCharacters(docs)`, `clear()`. Mutations fan out as `character:change` events carrying the full authoritative list.

## Glymo facade — selection + persistence methods

| Method | Notes |
|--------|-------|
| `getStrokes()` | `readonly Stroke[]` — runtime view (all stages applied). |
| `getFills()` | `readonly Fill[]` |
| `loadStrokes(docs: StrokeDoc[])` | v1 strokes-only loader. |
| `exportSession()` | `Promise<SessionDoc>` |
| `loadSession(payload: SessionDoc \| StrokeDoc[])` | `Promise<void>` — auto-detects v1 array vs v2 doc. |
| `selectObjectAtPoint(x, y)` | `GlymoObject \| undefined` — walks `setMeshHitTestFn` first (if registered), then falls back to stroke hit-test. |
| `selectObject(objectId)` | Selects a known id. |
| `clearSelection()` | |
| `setObjectMetadata(objectId, key, value)` | `boolean` — invalidates the 2D cache on success so renderer picks up the change. |

## Persistence events

| Event | When | Payload |
|-------|------|---------|
| `session:restore` | End of every successful `loadSession` | `{ backgroundMode: 'dark' \| 'white' }` (defaults to `'dark'` when the wire doc omits the field) |
| `media-art:restore` | End of `loadSession`, only when ≥ 1 object's `metadata.mediaArt` carries a valid `modelId` | `{ restorations: readonly { objectId, modelId, sourceLabel, offsetCss, sizeCss }[] }` |
| `character:change` | Every mutation of `CharacterStore` (add / update / remove / bulk load) | `{ characters: CharacterDoc[] }` (full authoritative list) |

The host UI subscribes to these to re-mount 3D meshes, re-apply background theme, and re-render text overlays after a load.

### `media-art:restore` payload

```typescript
restorations: readonly {
  objectId: string;
  modelId: string;
  sourceLabel: string | null;        // human-readable label from the catalog
  offsetCss: { x: number; y: number } | null;          // 0.22.0+
  sizeCss: { width: number; height: number } | null;   // 0.22.0+
}[];
```

Driven by `ObjectDoc.metadata.mediaArt` — the canonical shape:

```typescript
metadata: {
  mediaArt: {
    modelId: string;                                   // catalog id
    sourceLabel?: string | null;
    offsetCss?: { x: number; y: number } | null;       // canvas-local CSS coords
    sizeCss?: { width: number; height: number } | null;
  };
}
```

Legacy sessions (pre-0.22.0) that omit `offsetCss` / `sizeCss` pass the guard but receive `null` in the restoration payload — subscribers should fall back to the object's bbox-derived anchor, preserving pre-0.22 behaviour.

The host wires `media-art:restore` to `Hologram3DRenderer.addMesh` per restoration. See [hologram.md](./hologram.md#wiring-with-glymo-host-responsibility).

## Schema-level invariants summary

- `version: 2` — literal type, single supported version.
- `canvas` is CSS dimensions, not device pixels.
- `effect.name` is `string` to allow consumer-extended presets.
- Strokes carry **smoothed** geometry only; raw points are not persisted.
- `StrokeDoc.pressure` omitted when `=== 1`.
- Object → stroke / fill references resolve within the same doc; dangling refs are dropped with warn.
- Character ids MUST be `crypto.randomUUID()` (no counters).
- Animation `duration` ↔ `durationMs`, `repeat` ↔ `loop` — explicit unit-locking renames.
- Animation live state (`startTime`, `active`) is not persisted.
- `characters` and `backgroundMode` are omitted from the wire when default to keep the diff minimal.

## See also

- [architecture.md](./architecture.md#persistence) — high-level overview
- [animation.md](./animation.md#persistence) — animation wire details
- [hologram.md](./hologram.md#wiring-with-glymo-host-responsibility) — `media-art:restore` integration
