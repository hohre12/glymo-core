import { Point, StrokePoint } from '../types.js';
/** Typography rendering mode: overlay renders text over strokes; morph morphs strokes into glyphs */
export type TypographyMode = 'overlay' | 'morph';
/** Configuration for text mode */
export interface TextModeConfig {
    enabled: boolean;
    font: string;
    language: string;
    confidenceThreshold: number;
    maxChars: number;
    glyphPointCount: number;
    typographyMode: TypographyMode;
}
/** Default text mode configuration */
export declare const DEFAULT_TEXT_MODE_CONFIG: TextModeConfig;
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
    text: string;
    confidence: number;
    characters: RecognizedChar[];
    processingTimeMs: number;
}
/** Per-character OCR result */
export interface RecognizedChar {
    char: string;
    confidence: number;
    bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
/** Result from Stage 8: GlyphExtractor — one per character */
export interface GlyphOutline {
    char: string;
    points: Point[];
    bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    fontUsed: string;
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
    effectColor: string;
    duration?: number;
    cascadeDelay?: number;
}
/** Error codes specific to text mode */
export type TextErrorCode = 'TESSERACT_LOAD_FAILED' | 'OCR_FAILED' | 'OCR_LOW_CONFIDENCE' | 'RECOGNITION_FAILED' | 'FONT_LOAD_TIMEOUT' | 'GLYPH_EXTRACTION_FAILED' | 'NO_STROKES';
/** A single character positioned in space by a layout engine */
export interface PositionedChar {
    char: string;
    x: number;
    y: number;
    rotation: number;
    scale: number;
}
/** Layout arrangement mode for text placement */
export type LayoutMode = 'linear' | 'curve' | 'circle' | 'fill';
/** Options controlling how text is laid out */
export interface LayoutOptions {
    mode: LayoutMode;
    radius?: number;
    startAngle?: number;
    fontSize?: number;
}
/** Default layout options */
export declare const DEFAULT_LAYOUT_OPTIONS: LayoutOptions;
