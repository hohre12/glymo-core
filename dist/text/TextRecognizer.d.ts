import { StrokePoint } from '../types.js';
import { RecognizedText, TextModeConfig } from './types.js';
/**
 * Stage 7: TextRecognizer
 *
 * Accepts finalized strokes from the core pipeline (stages 1-6),
 * renders them to an OffscreenCanvas, and runs Tesseract.js OCR
 * to recognize handwritten Latin and Korean characters.
 *
 * Tesseract.js is dynamically imported — never bundled with core.
 */
export declare class TextRecognizer {
    private tesseractWorker;
    private loading;
    private config;
    constructor(config: TextModeConfig);
    /** Dynamically import and initialize Tesseract.js worker */
    initialize(): Promise<void>;
    /** Run OCR on finalized strokes */
    recognize(strokes: StrokePoint[][]): Promise<RecognizedText>;
    /** Render strokes to OffscreenCanvas for OCR input */
    private renderStrokesToCanvas;
    /** Extract per-character results from Tesseract symbols */
    private extractCharacters;
    /** Update configuration (e.g., language, confidence threshold) */
    updateConfig(partial: Partial<TextModeConfig>): void;
    /** Release Tesseract worker resources */
    dispose(): Promise<void>;
}
