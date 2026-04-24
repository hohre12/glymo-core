# Animation — `StrokeAnimator` vs `MorphAnimator`

`@glymo/core` ships two animation engines with disjoint responsibilities. Knowing which one to reach for is the entire point of this document.

| | `StrokeAnimator` | `MorphAnimator` |
|---|---|---|
| Module | `src/animation/` | `src/animate/` |
| Exported? | **Yes** (`@glymo/core`) | No — internal to `Glymo` facade |
| Drives | Per-stroke kinetic transforms after a stroke is finalised | The pen-up → smoothed transition for a single just-finalised stroke |
| Lifetime | Long-lived — persists across the session, can target any stroke | One per stroke, alive only during the morph window |
| Output | Composable `AnimationTransform` per stroke per frame | Interpolated `StrokePoint[]` per frame |
| Easing | Per-type (sin / linear / Brownian / keyframe) | `easeOutElastic` — IMMUTABLE per `CLAUDE.md` |
| Persisted? | Yes — serialised in `SessionDoc` as `AnimationDoc[]` | No — transient |

> If you're animating a stroke that's already on the canvas (a flower swaying in the wind, a glowing letter, a falling leaf), use `StrokeAnimator`.
>
> If you're customising how raw input transitions into the smoothed final stroke, that's `MorphAnimator`'s job — and you almost certainly shouldn't customise it (the elastic easing is locked).

## `StrokeAnimator` (public)

```typescript
import { StrokeAnimator } from '@glymo/core';

const animator = new StrokeAnimator();

const animId = animator.addAnimation([strokeId], {
  type: 'pulse',
  duration: 800,        // ms per cycle
  repeat: true,
  amplitude: 0.15,      // type-specific (here: ±15% scale)
});

// In your render loop:
const transform = animator.getTransform(strokeId, performance.now());
if (transform) {
  // { translateX, translateY, scale, rotation, opacity, glowIntensity }
  applyToStroke(strokeId, transform);
}
```

The renderer is the consumer — it composes the returned `AnimationTransform` onto the stroke at paint time. Identity transform (`{ translateX: 0, translateY: 0, scale: 1, rotation: 0, opacity: 1, glowIntensity: 1 }`) is returned for non-animated strokes (or `null`).

### Methods

| Method | Returns | Notes |
|--------|---------|-------|
| `addAnimation(strokeIds, params)` | `string` (animation id) | Targets one or more strokes. |
| `removeAnimation(animationId)` | `void` | |
| `removeByStrokeId(strokeId)` | `void` | Drops the stroke from every animation; deletes animations left empty. |
| `getTransform(strokeId, now)` | `AnimationTransform \| null` | Composed across multiple animations targeting the same stroke (additive translate/rotate, multiplicative scale/opacity/glow). Auto-purges completed non-repeating animations. |
| `getAnimationParams(strokeId)` | `AnimationParams \| null` | First active animation found for the stroke. |
| `getSparkleStrokeIds(now)` | `string[]` | Convenience for the renderer's particle path. |
| `hasAnimations()` | `boolean` | Cheap "anything active?" probe. |
| `clear()` | `void` | Drop all animations. |
| `serialize()` | `Array<{ strokeIds, params }>` | Wire-safe form (excludes `startTime` / `active`). |
| `restore(entries)` | `void` | Replays serialised entries with fresh `startTime`. |

### Composition rules

When multiple animations target the same stroke, `getTransform` composes them per-channel:

| Channel | Composition |
|---------|-------------|
| `translateX`, `translateY`, `rotation` | Additive |
| `scale`, `opacity`, `glowIntensity` | Multiplicative |

This lets you stack a `bloom` (scale arch) with a `shine` (glow + opacity breathing) without one cancelling the other.

## Animation types

23 built-in types fall into three groups:

### Legacy (text-mode, `shapeAnimations.ts` path)

| Type | Effect |
|------|--------|
| `pulse` | Scale + opacity sin breathing |
| `sparkle` | Subtle scale/opacity breathing — primary signal is `ParticleSystem` emission |
| `float` | Sin-wave Y bobbing |
| `bounce` | Absolute-sine upward bounce |
| `rotate` | Continuous rotation (`speed` in deg/sec, default 90) |
| `fly` | Linear translate in `direction` (`up` / `down` / `left` / `right`) + fade-out in last 30 % |
| `shake` | Diminishing X oscillation |
| `fadeOut` | Linear opacity 1 → 0 |
| `keyframe` | Lerps user-supplied `AnimationKeyframe[]` (each keyframe carries `t`, `x?`, `y?`, `scale?`, `rotation?`, `opacity?`, `glow?`) |

### Locomotion primitives (drawing-mode, task #112)

| Type | Effect |
|------|--------|
| `drift` | Slow directional sin sway (`direction` = `'horizontal'` / `'vertical'`) |
| `traverse` | One-shot end-to-end travel with fade in/out |
| `oscillate` | Symmetric pendulum sin sway |
| `orbit` | Circular path of radius = `amplitude` |
| `swim` | Forward drift + lateral undulation (fish motion) |
| `flutter` | Two coprime-frequency sines (insect flight) |
| `fall` | Gravity-aligned descent with slight horizontal sway |
| `rise` | Anti-gravity ascent with sway (balloon / smoke / bubble) |
| `random` | Brownian-feeling Lissajous walk — deterministic per `startTime` (no real RNG) |

### Modulation primitives (drawing-mode, task #112)

| Type | Effect |
|------|--------|
| `shine` | Luminance pulse — `glowIntensity` is primary, plus subtle scale + opacity breathing |
| `bend` | Lateral flex (translateX oscillation) |
| `bloom` | Single-arch radial expansion (scale up then back) |
| `drip` | Subtle Y nudge + glow spike at peak (renderer can read the spike as a particle-emission signal) |
| `glow` | Edge-emissive breathing — glow swing + scale + opacity for visible breathing on minimal-glow effect presets |

`pulse`, `sparkle`, `rotate`, `shake` are documented under the legacy heading but are reused by the locomotion / modulation primitive system as well — the union literal is defined exactly once.

### Defaults

`amplitude` defaults vary per type — see `DEFAULT_AMPLITUDE` in `src/animation/StrokeAnimator.ts`. Example: `pulse` = 0.15 (scale fraction), `float` = 20 (px), `drift` = 0.02 (NDC fraction/sec), `random` = 15 (px).

## Adding a new animation type

1. Add the literal to the `AnimationType` union in `src/animation/types.ts`.
2. Add the `case 'my-type':` in `StrokeAnimator.computeAnimationTransform`. Compute the per-channel transform from `t` (eased progress) and `elapsed` (ms since start, for time-aware effects).
3. Optionally add a `DEFAULT_AMPLITUDE['my-type']` so callers don't need to pass `amplitude`.
4. If the type is persistable, no further work is needed — `serialize` / `restore` round-trips the params verbatim.

## `MorphAnimator` (internal — included for context)

Not exported — `Glymo` constructs one per stroke during the pen-up → smoothed transition (Stage 5 of the pipeline) and tears it down on `morph:complete`.

The morph path:

```
penUp() → resampleStroke(raw, smoothed.length)        // match counts
        → lerpStrokes(resampled, smoothed, easeOutElastic(t))
        → emit on render loop until t === 1
        → emit 'morph:complete'
```

Locked behaviours per `CLAUDE.md` "Technical Prohibitions":

- **`easeOutElastic` is immutable.** The curve is `Math.pow(2, -10·t) · sin((t·10 − 0.75) · (2π/3)) + 1`. Do not change.
- Default duration is `MORPH_DURATION_MS = 1200` (1.2 s) from `state/SessionStateMachine.ts`.

The unrelated **nearest-neighbor point matching** prohibition in `CLAUDE.md` applies to the stroke → font glyph matcher in `src/text/PointMatcher.ts` (kinetic typography), not to this stage-5 transition — `MorphAnimator` interpolates between two parameterisations of the SAME stroke (raw resampled to the smoothed length), so index pairing is correct.

If you're touching `MorphAnimator`, you're modifying core stroke-finalisation behaviour — the change should land with a regression test that pins the easing output and timing.

## Persistence

`StrokeAnimator.serialize()` / `restore()` round-trip via `SessionDoc.strokes[].animation` (`AnimationDoc`). The wire format renames two fields explicitly to lock units:

| Wire (`AnimationDoc`) | Runtime (`AnimationParams`) |
|-----------------------|-----------------------------|
| `durationMs` | `duration` |
| `loop` | `repeat` |

Live state (`startTime`, `active`) is intentionally NOT persisted — animations restart at `t = 0` on load, matching the UX of a page refresh today. See [session-doc.md](./session-doc.md#animationdoc).

## See also

- [architecture.md](./architecture.md#extension-points) — animation type as an extension seam
- [session-doc.md](./session-doc.md) — persistence wire shape and the `duration` ↔ `durationMs` rename
