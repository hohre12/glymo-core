import type { StrokePoint } from '../types.js';
import type { RecognizedText, RecognizedChar, TextModeConfig } from './types.js';

// Canvas dimensions for stroke rendering (black-on-white for OCR)
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 700;
const STROKE_LINE_WIDTH = 4;

/**
 * Stage 7: TextRecognizer
 *
 * Accepts finalized strokes from the core pipeline (stages 1-6),
 * renders them to an OffscreenCanvas, and runs Tesseract.js OCR
 * to recognize handwritten Latin and Korean characters.
 *
 * Tesseract.js is dynamically imported — never bundled with core.
 */
export class TextRecognizer {
  private tesseractWorker: unknown | null = null;
  private loading: Promise<void> | null = null;
  private config: TextModeConfig;

  constructor(config: TextModeConfig) {
    this.config = { ...config };
  }

  /** Dynamically import and initialize Tesseract.js worker */
  async initialize(): Promise<void> {
    if (this.tesseractWorker) return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        const Tesseract = await import('tesseract.js');
        this.tesseractWorker = await Tesseract.createWorker(this.config.language);
      } catch {
        this.loading = null;
        throw new Error('TESSERACT_LOAD_FAILED');
      }
    })();

    return this.loading;
  }

  /** Run OCR on finalized strokes */
  async recognize(strokes: StrokePoint[][]): Promise<RecognizedText> {
    if (strokes.length === 0 || strokes.every((s) => s.length === 0)) {
      throw new Error('NO_STROKES');
    }

    const startTime = performance.now();

    await this.initialize();

    const canvas = this.renderStrokesToCanvas(strokes);
    const worker = this.tesseractWorker as {
      recognize(image: OffscreenCanvas): Promise<{
        data: {
          text: string;
          confidence: number;
          symbols: Array<{
            text: string;
            confidence: number;
            bbox: { x0: number; y0: number; x1: number; y1: number };
          }>;
        };
      }>;
    };

    try {
      const { data } = await worker.recognize(canvas);
      const processingTimeMs = performance.now() - startTime;

      const characters = this.extractCharacters(data.symbols);

      return {
        text: data.text.trim(),
        confidence: data.confidence / 100, // Tesseract returns 0-100
        characters: characters.slice(0, this.config.maxChars),
        processingTimeMs,
      };
    } catch {
      throw new Error('OCR_FAILED');
    }
  }

  /** Render strokes to OffscreenCanvas for OCR input */
  private renderStrokesToCanvas(strokes: StrokePoint[][]): OffscreenCanvas {
    const canvas = new OffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d')!;

    // Black-on-white for maximum OCR accuracy
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = STROKE_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i]!.x, stroke[i]!.y);
      }
      ctx.stroke();
    }

    return canvas;
  }

  /** Extract per-character results from Tesseract symbols */
  private extractCharacters(
    symbols: Array<{
      text: string;
      confidence: number;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }>,
  ): RecognizedChar[] {
    if (!symbols) return [];

    return symbols.map((sym) => ({
      char: sym.text,
      confidence: sym.confidence / 100, // Tesseract returns 0-100
      bbox: {
        x: sym.bbox.x0,
        y: sym.bbox.y0,
        width: sym.bbox.x1 - sym.bbox.x0,
        height: sym.bbox.y1 - sym.bbox.y0,
      },
    }));
  }

  /** Update configuration (e.g., language, confidence threshold) */
  updateConfig(partial: Partial<TextModeConfig>): void {
    Object.assign(this.config, partial);
  }

  /** Release Tesseract worker resources */
  async dispose(): Promise<void> {
    if (this.tesseractWorker) {
      const worker = this.tesseractWorker as { terminate(): Promise<void> };
      await worker.terminate();
      this.tesseractWorker = null;
    }
    this.loading = null;
  }
}
