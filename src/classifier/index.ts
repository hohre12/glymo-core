// Barrel exports for the @glymo/core/classifier subpath.
//
// Consumers import from '@glymo/core/classifier' to get:
//   - The ONNX `ClassifierClient` (main-thread proxy for the Worker).
//   - The category arrays + DrawingCategory / TextCategory / SymbolCategory
//     unions (Phase 1.8 v003-B3.5 — 347 drawing classes).
//   - The deterministic stroke → 64×64 grayscale rasteriser
//     (`strokesToImage`).
//   - Locale-aware label translation for UI surfaces.
//   - The IndexedDB model cache helpers.
//   - The TYPE-router hysteresis stabiliser.
//
// `personality.ts` is intentionally NOT moved into core: it is a UX-layer
// concern (selects an i18n key for the Personality bubble) and depends on
// each consumer app's `useStrings()` keyspace. It remains in
// `glymo-landing/lib/classifier/personality.ts`.

export { ClassifierClient } from './ClassifierClient.js';
export type {
  Prediction,
  ClassifierStatus,
  ClassifyResponse,
  ClassifierClientOptions,
} from './ClassifierClient.js';

export {
  DRAWING_CATEGORIES,
  TEXT_CATEGORIES,
  SYMBOL_CATEGORIES,
  TYPE_CATEGORIES,
} from './categories.js';
export type {
  DrawingCategory,
  TextCategory,
  SymbolCategory,
  TypeCategory,
} from './categories.js';

export { strokesToImage } from './strokes-to-image.js';

export type { StrokePoint, StrokeData } from './types.js';

export { loadModel, fetchManifest, openModelDB } from './model-cache.js';
export type { ModelManifest } from './model-cache.js';

export {
  translateLabel,
  LABEL_TRANSLATIONS,
  ALL_CLASSIFIER_LABELS,
  DEFAULT_CLASSIFIER_LOCALE,
} from './label-translations.js';
export type {
  ClassifierLocale,
  NonDefaultLocale,
  ClassifierLabel,
} from './label-translations.js';

export { TypeStabilizer } from './type-stabilizer.js';
export type {
  StableType,
  StabilizerObservation,
  TypeStabilizerOptions,
} from './type-stabilizer.js';
