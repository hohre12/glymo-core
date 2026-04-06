// ── Text Mode Public API ────────────────────────────

export type {
  TextModeConfig,
  RecognizedText,
  RecognizedChar,
  GlyphOutline,
  TextModeResult,
  TextErrorCode,
  MatchedCharacter,
  FontMorphOptions,
  PositionedChar,
  LayoutMode,
  LayoutOptions,
} from './types.js';

export { DEFAULT_TEXT_MODE_CONFIG, DEFAULT_LAYOUT_OPTIONS } from './types.js';

export { TextRecognizer } from './TextRecognizer.js';
export { GlyphExtractor } from './GlyphExtractor.js';
export { GlyphCache } from './GlyphCache.js';
export { PointMatcher } from './PointMatcher.js';
export {
  FontMorphAnimator,
  MORPH_DURATION_MS,
  CASCADE_DELAY_MS,
  MORPH_START_COLOR,
} from './FontMorphAnimator.js';

export {
  layoutTextAlongCurve,
  layoutTextInCircle,
  layoutTextInShape,
  measureText,
} from './PretextLayout.js';

export { KineticEngine } from './KineticEngine.js';
