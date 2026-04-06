declare module 'tesseract.js' {
  interface RecognizeResult {
    data: {
      text: string;
      confidence: number;
      symbols: Array<{
        text: string;
        confidence: number;
        bbox: { x0: number; y0: number; x1: number; y1: number };
      }>;
    };
  }

  interface Worker {
    recognize(image: OffscreenCanvas | HTMLCanvasElement | ImageData): Promise<RecognizeResult>;
    terminate(): Promise<void>;
  }

  export function createWorker(lang: string): Promise<Worker>;
}
