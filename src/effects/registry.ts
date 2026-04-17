// ── Runtime Effect Registry ─────────────────────────
//
// Allows themed effect packs (e.g. `@glymo/effects-media-art`) to register
// new effects at import time, without requiring a core release + consumer bump.
//
// Seeded on module load with `EFFECT_PRESETS` from `types.ts` so every
// existing effect keeps working exactly as before.
//
// ── Design trade-off (Option A vs B) ──────────────────
//
// We keep `EFFECT_PRESETS` in `types.ts` as a frozen snapshot of the initial
// seed (Option A). Runtime registrations are NOT visible via `EFFECT_PRESETS`
// — callers must use `getEffect(id)` / `listEffects()` to see them.
//
// Rationale: `EFFECT_PRESETS` is typed as `Record<EffectPresetName, EffectStyle>`
// with `as const`, giving existing consumers literal-key narrowing at 14+ call
// sites (e.g. `EFFECT_PRESETS[stroke.effect].color` with full type safety).
// A Proxy-based replacement (Option B) would surface runtime registrations but
// would erase the literal narrowing, and could break tree-shaking because a
// Proxy is a side-effecting object. Option A has zero breakage risk; consumers
// that want dynamic lookups migrate explicitly to `getEffect()`.

import type { EffectPresetName, EffectStyle } from '../types.js';
import { EFFECT_PRESETS } from '../types.js';

/**
 * Public alias: the registry treats effect IDs as a string-keyed namespace.
 * Core presets stay strongly typed via `EffectPresetName`; third-party packs
 * extend this at runtime with arbitrary ids (e.g. `'mediaart:drip'`).
 */
export type EffectId = EffectPresetName | (string & {});

/**
 * Public alias: what a registered effect must provide. Currently equivalent
 * to `EffectStyle`. Named `EffectDefinition` so we can evolve it later
 * (e.g. attach a renderer hook) without a breaking rename.
 */
export type EffectDefinition = EffectStyle;

// ── Internal store ────────────────────────────────────

const registry = new Map<string, EffectDefinition>();

/**
 * Structural compatibility check — every field of `EffectStyle` must exist
 * and have the right primitive shape. We do NOT deep-validate gradient
 * entries because `EffectStyle.gradient` is `string[] | null`.
 */
function isEffectDefinition(value: unknown): value is EffectDefinition {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.color !== 'string') return false;
  if (typeof v.minWidth !== 'number') return false;
  if (typeof v.maxWidth !== 'number') return false;
  if (typeof v.glowColor !== 'string') return false;
  if (typeof v.glowSize !== 'number') return false;
  if (typeof v.particleColor !== 'string') return false;
  if (v.gradient !== null && !Array.isArray(v.gradient)) return false;
  if (Array.isArray(v.gradient) && !v.gradient.every((c) => typeof c === 'string')) return false;
  return true;
}

// ── Seed from EFFECT_PRESETS ──────────────────────────

for (const [id, def] of Object.entries(EFFECT_PRESETS)) {
  registry.set(id, def as EffectDefinition);
}

// ── Public API ────────────────────────────────────────

/**
 * Register a new effect at runtime.
 *
 * Idempotent behaviour:
 * - If `id` is unknown: inserts the definition.
 * - If `id` already exists: logs a warning and **does not** overwrite the
 *   previous value. (Prevents accidental clobbering when two packs claim
 *   the same id.)
 * - If `definition` does not match the `EffectDefinition` shape: throws,
 *   because a malformed effect will crash the renderer at a later, harder
 *   to debug point.
 */
export function registerEffect(id: EffectId, definition: EffectDefinition): void {
  if (!isEffectDefinition(definition)) {
    throw new TypeError(
      `[@glymo/core] registerEffect("${id}"): definition does not match EffectDefinition shape.`,
    );
  }
  if (registry.has(id)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[@glymo/core] registerEffect("${id}"): id already registered — keeping the existing definition.`,
    );
    return;
  }
  registry.set(id, definition);
}

/**
 * Remove a previously registered effect. Intended for tests / hot-reload.
 * Returns `true` if the id existed and was removed, `false` otherwise.
 */
export function unregisterEffect(id: EffectId): boolean {
  return registry.delete(id);
}

/** Look up a registered effect by id. Returns `undefined` if unknown. */
export function getEffect(id: EffectId): EffectDefinition | undefined {
  return registry.get(id);
}

/**
 * Fallback effect id used by `resolveEffect` when the requested id is not
 * registered. Must always be present in `EFFECT_PRESETS` so the fallback is
 * guaranteed to exist at module load.
 */
const FALLBACK_EFFECT_ID: EffectPresetName = 'neon';

/**
 * Resolve an effect id to a definition, guaranteed non-undefined.
 *
 * Internal renderers call this on the render hot path — returning a fallback
 * instead of `undefined` lets the call sites stay terse without scattering
 * `?? EFFECT_PRESETS.neon` across the codebase. If you need the strict
 * "was it registered?" semantics, call `getEffect()` instead.
 *
 * Fallback policy:
 *  1. Registered definition for `id`, if any.
 *  2. Registered definition for `'neon'` (the seeded preset — always present
 *     because the seed loop inserts every `EFFECT_PRESETS` entry).
 *  3. Raw `EFFECT_PRESETS.neon` (defensive — only reachable if someone
 *     unregistered the seed, which is a test-only concern).
 */
export function resolveEffect(id: EffectId): EffectDefinition {
  const hit = registry.get(id);
  if (hit) return hit;
  const seeded = registry.get(FALLBACK_EFFECT_ID);
  if (seeded) return seeded;
  return EFFECT_PRESETS[FALLBACK_EFFECT_ID];
}

/** List all currently registered effect ids (seed + runtime additions). */
export function listEffects(): EffectId[] {
  return Array.from(registry.keys()) as EffectId[];
}
