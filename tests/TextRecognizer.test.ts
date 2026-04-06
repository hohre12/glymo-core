import { TextRecognizer } from '../src/text/TextRecognizer.js';
import { DEFAULT_TEXT_MODE_CONFIG } from '../src/text/types.js';
import type { StrokePoint } from '../src/types.js';

// ── Hoisted mock variables ───────────────────────────

const mockWorkerInstance = vi.hoisted(() => ({
  recognize: vi.fn(),
  terminate: vi.fn(),
}));

const mockCreateWorker = vi.hoisted(() => vi.fn());

// Single top-level mock — behavior controlled per test via mockCreateWorker
vi.mock('tesseract.js', () => ({
  createWorker: mockCreateWorker,
}));

// Mock OffscreenCanvas globally
const mockCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'round',
  lineJoin: 'round',
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
};

vi.stubGlobal('OffscreenCanvas', class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }
  getContext() {
    return mockCtx;
  }
});

// ── Helpers ──────────────────────────────────────────

function makeStrokes(count: number = 1): StrokePoint[][] {
  return Array.from({ length: count }, (_, i) => [
    { x: i * 10, y: 0, t: 0, pressure: 0.5 },
    { x: i * 10 + 50, y: 50, t: 16, pressure: 0.5 },
    { x: i * 10 + 100, y: 0, t: 32, pressure: 0.5 },
  ]);
}

function setupWorker(options?: {
  text?: string;
  confidence?: number;
  symbols?: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }> | null;
}) {
  const {
    text = 'Hello',
    confidence = 92,
    symbols = [
      { text: 'H', confidence: 95, bbox: { x0: 10, y0: 10, x1: 30, y1: 40 } },
      { text: 'e', confidence: 90, bbox: { x0: 35, y0: 10, x1: 50, y1: 40 } },
      { text: 'l', confidence: 88, bbox: { x0: 55, y0: 10, x1: 65, y1: 40 } },
      { text: 'l', confidence: 91, bbox: { x0: 70, y0: 10, x1: 80, y1: 40 } },
      { text: 'o', confidence: 93, bbox: { x0: 85, y0: 10, x1: 100, y1: 40 } },
    ],
  } = options ?? {};

  mockWorkerInstance.recognize.mockResolvedValue({
    data: { text, confidence, symbols },
  });
  mockWorkerInstance.terminate.mockResolvedValue(undefined);
  mockCreateWorker.mockResolvedValue(mockWorkerInstance);
}

function makeConfig() {
  return { ...DEFAULT_TEXT_MODE_CONFIG, enabled: true };
}

// ── Dynamic import & initialization ──────────────────

describe('TextRecognizer initialization', () => {
  beforeEach(() => {
    mockCreateWorker.mockReset();
    mockWorkerInstance.recognize.mockReset();
    mockWorkerInstance.terminate.mockReset();
  });

  it('should dynamically import tesseract.js on initialize', async () => {
    setupWorker();
    const recognizer = new TextRecognizer(makeConfig());

    await recognizer.initialize();

    expect(mockCreateWorker).toHaveBeenCalledTimes(1);
    await recognizer.dispose();
  });

  it('should reuse the same worker on second initialize call', async () => {
    setupWorker();
    const recognizer = new TextRecognizer(makeConfig());

    await recognizer.initialize();
    await recognizer.initialize();

    // createWorker should only be called once
    expect(mockCreateWorker).toHaveBeenCalledTimes(1);
    await recognizer.dispose();
  });

  it('should pass language config to createWorker', async () => {
    setupWorker();
    const recognizer = new TextRecognizer({ ...makeConfig(), language: 'kor' });

    await recognizer.initialize();

    expect(mockCreateWorker).toHaveBeenCalledWith('kor');
    await recognizer.dispose();
  });

  it('should throw TESSERACT_LOAD_FAILED when createWorker rejects', async () => {
    mockCreateWorker.mockRejectedValue(new Error('Network error'));

    const recognizer = new TextRecognizer(makeConfig());
    await expect(recognizer.initialize()).rejects.toThrow('TESSERACT_LOAD_FAILED');
  });

  it('should allow retrying after a failed initialization', async () => {
    // First attempt fails
    mockCreateWorker.mockRejectedValueOnce(new Error('Network error'));

    const recognizer = new TextRecognizer(makeConfig());
    await expect(recognizer.initialize()).rejects.toThrow('TESSERACT_LOAD_FAILED');

    // Second attempt succeeds
    setupWorker();
    await expect(recognizer.initialize()).resolves.toBeUndefined();
    await recognizer.dispose();
  });
});

// ── Recognition ──────────────────────────────────────

describe('TextRecognizer recognize', () => {
  beforeEach(() => {
    mockCreateWorker.mockReset();
    mockWorkerInstance.recognize.mockReset();
    mockWorkerInstance.terminate.mockReset();
    mockCtx.fillRect.mockClear();
    mockCtx.beginPath.mockClear();
    mockCtx.moveTo.mockClear();
    mockCtx.lineTo.mockClear();
    mockCtx.stroke.mockClear();
    setupWorker();
  });

  it('should return recognized text with normalized confidence', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    const result = await recognizer.recognize(makeStrokes());

    expect(result.text).toBe('Hello');
    // Confidence is normalized from 0-100 to 0-1
    expect(result.confidence).toBeCloseTo(0.92, 2);
    await recognizer.dispose();
  });

  it('should normalize per-character confidence from 0-100 to 0-1', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    const result = await recognizer.recognize(makeStrokes());

    expect(result.characters[0]!.confidence).toBeCloseTo(0.95, 2);
    expect(result.characters[1]!.confidence).toBeCloseTo(0.90, 2);
    await recognizer.dispose();
  });

  it('should convert Tesseract bbox format to {x, y, width, height}', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    const result = await recognizer.recognize(makeStrokes());

    const firstChar = result.characters[0]!;
    expect(firstChar.bbox).toEqual({
      x: 10,
      y: 10,
      width: 20, // x1 - x0 = 30 - 10
      height: 30, // y1 - y0 = 40 - 10
    });
    await recognizer.dispose();
  });

});

// ── Recognition edge cases ──────────────────────────

describe('TextRecognizer recognize edge cases', () => {
  beforeEach(() => {
    mockCreateWorker.mockReset();
    mockWorkerInstance.recognize.mockReset();
    mockWorkerInstance.terminate.mockReset();
    setupWorker();
  });

  it('should limit characters to maxChars config', async () => {
    const config = { ...makeConfig(), maxChars: 3 };
    const recognizer = new TextRecognizer(config);
    const result = await recognizer.recognize(makeStrokes());

    expect(result.characters.length).toBeLessThanOrEqual(3);
    await recognizer.dispose();
  });

  it('should include processingTimeMs in result', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    const result = await recognizer.recognize(makeStrokes());

    expect(typeof result.processingTimeMs).toBe('number');
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    await recognizer.dispose();
  });

  it('should trim text in result', async () => {
    setupWorker({ text: '  Hello  ' });
    const recognizer = new TextRecognizer(makeConfig());
    const result = await recognizer.recognize(makeStrokes());

    expect(result.text).toBe('Hello');
    await recognizer.dispose();
  });

  it('should handle null symbols array gracefully', async () => {
    setupWorker({ symbols: null });
    const recognizer = new TextRecognizer(makeConfig());
    const result = await recognizer.recognize(makeStrokes());

    expect(result.characters).toEqual([]);
    await recognizer.dispose();
  });
});

// ── Error handling ───────────────────────────────────

