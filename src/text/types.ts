import type { Point, StrokePoint } from '../types.js';

/** Typography rendering mode: overlay renders text over strokes; morph morphs strokes into glyphs */
export type TypographyMode = 'overlay' | 'morph';

/** Configuration for text mode */
export interface TextModeConfig {
  enabled: boolean;
  font: string;              // CSS font string, e.g. '72px "Noto Sans KR"'
  language: string;          // Tesseract language code: 'eng+kor'
  confidenceThreshold: number; // 0.0-1.0, default 0.6
  maxChars: number;          // Max characters to process, default 20
  glyphPointCount: number;   // Target points per glyph outline, default 300
  typographyMode: TypographyMode;
}

/** Default text mode configuration */
export const DEFAULT_TEXT_MODE_CONFIG: TextModeConfig = {
  enabled: false,
  font: '72px sans-serif',
  language: 'eng+kor',
  confidenceThreshold: 0.6,
  maxChars: 20,
  glyphPointCount: 300,
  typographyMode: 'overlay' as TypographyMode,
};

/** Text overlay result emitted via 'text:overlay' event in overlay typography mode */
export interface OverlayText {
  text: string;
  font: string;
  x: number;
  y: number;
  width: number;
  height: number;
  effectColor: string;
  glowColor: string;
  glowSize: number;
  startTime: number;
  fadeDuration: number;
}

/** Result from Stage 7: TextRecognizer */
export interface RecognizedText {
  text: string;              // Full recognized string
  confidence: number;        // 0.0-1.0 overall confidence
  characters: RecognizedChar[];
  processingTimeMs: number;
}

/** Per-character OCR result */
export interface RecognizedChar {
  char: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

/** Result from Stage 8: GlyphExtractor — one per character */
export interface GlyphOutline {
  char: string;
  points: Point[];           // Border pixel point cloud (resampled)
  bbox: { x: number; y: number; width: number; height: number };
  fontUsed: string;          // Actual font rendered (may differ if fallback)
}

/** Combined output of Stages 7-8, input for Stage 9 */
export interface TextModeResult {
  recognized: RecognizedText;
  glyphs: GlyphOutline[];
  sourceStrokes: StrokePoint[][];
}

/** Per-character matched point pairs (Stage 9 output) */
export interface MatchedCharacter {
  char: string;
  charIndex: number;
  pairs: import('../types.js').MatchedPair[];
}

/** Options for the FontMorphAnimator (Stage 10) */
export interface FontMorphOptions {
  matchedCharacters: MatchedCharacter[];
  effectColor: string;             // Target effect color (hex)
  duration?: number;               // Override MORPH_DURATION_MS (for testing)
  cascadeDelay?: number;           // Override CASCADE_DELAY_MS (for testing)
}

/** Error codes specific to text mode */
export type TextErrorCode =
  | 'TESSERACT_LOAD_FAILED'
  | 'OCR_FAILED'
  | 'OCR_LOW_CONFIDENCE'
  | 'RECOGNITION_FAILED'
  | 'FONT_LOAD_TIMEOUT'
  | 'GLYPH_EXTRACTION_FAILED'
  | 'NO_STROKES';

// ── Layout Types (pretext integration) ─────────────

/** A single character positioned in space by a layout engine */
export interface PositionedChar {
  char: string;
  x: number;
  y: number;
  rotation: number;  // radians
  scale: number;
}

/** Layout arrangement mode for text placement */
export type LayoutMode = 'linear' | 'curve' | 'circle' | 'fill';

/** Options controlling how text is laid out */
export interface LayoutOptions {
  mode: LayoutMode;
  radius?: number;       // for circle mode
  startAngle?: number;   // for circle mode (radians, default 0)
  fontSize?: number;     // character spacing reference (default 16)
}

/** Default layout options */
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  mode: 'linear',
  fontSize: 16,
};
