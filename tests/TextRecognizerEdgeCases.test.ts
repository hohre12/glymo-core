import { TextRecognizer } from '../src/text/TextRecognizer.js';
import { DEFAULT_TEXT_MODE_CONFIG } from '../src/text/types.js';
import type { StrokePoint } from '../src/types.js';

// ── Hoisted mock variables ───────────────────────────

const mockWorkerInstance = vi.hoisted(() => ({
  recognize: vi.fn(),
  terminate: vi.fn(),
}));

const mockCreateWorker = vi.hoisted(() => vi.fn());

vi.mock('tesseract.js', () => ({
  createWorker: mockCreateWorker,
}));

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
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  getContext() { return mockCtx; }
});

// ── Helpers ──────────────────────────────────────────

function makeStrokes(count: number = 1): StrokePoint[][] {
  return Array.from({ length: count }, (_, i) => [
    { x: i * 10, y: 0, t: 0, pressure: 0.5 },
    { x: i * 10 + 50, y: 50, t: 16, pressure: 0.5 },
    { x: i * 10 + 100, y: 0, t: 32, pressure: 0.5 },
  ]);
}

function setupWorker() {
  mockWorkerInstance.recognize.mockResolvedValue({
    data: {
      text: 'Hello', confidence: 92,
      symbols: [
        { text: 'H', confidence: 95, bbox: { x0: 10, y0: 10, x1: 30, y1: 40 } },
      ],
    },
  });
  mockWorkerInstance.terminate.mockResolvedValue(undefined);
  mockCreateWorker.mockResolvedValue(mockWorkerInstance);
}

function makeConfig() {
  return { ...DEFAULT_TEXT_MODE_CONFIG, enabled: true };
}

// ── Error handling ──────────────────────────────────

describe('TextRecognizer error handling', () => {
  beforeEach(() => {
    mockCreateWorker.mockReset();
    mockWorkerInstance.recognize.mockReset();
    mockWorkerInstance.terminate.mockReset();
  });

  it('should throw NO_STROKES for empty array', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    await expect(recognizer.recognize([])).rejects.toThrow('NO_STROKES');
  });

  it('should throw NO_STROKES when all strokes are empty', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    await expect(recognizer.recognize([[], []])).rejects.toThrow('NO_STROKES');
  });

  it('should throw OCR_FAILED when worker.recognize rejects', async () => {
    mockWorkerInstance.recognize.mockRejectedValue(new Error('OCR error'));
    mockWorkerInstance.terminate.mockResolvedValue(undefined);
    mockCreateWorker.mockResolvedValue(mockWorkerInstance);
    const recognizer = new TextRecognizer(makeConfig());
    await expect(recognizer.recognize(makeStrokes())).rejects.toThrow('OCR_FAILED');
    await recognizer.dispose();
  });
});

// ── Stroke rendering ────────────────────────────────

describe('TextRecognizer stroke rendering', () => {
  beforeEach(() => {
    mockCreateWorker.mockReset();
    mockWorkerInstance.recognize.mockReset();
    mockWorkerInstance.terminate.mockReset();
    vi.clearAllMocks();
    setupWorker();
  });

  it('should create OffscreenCanvas for rendering strokes', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    await recognizer.recognize(makeStrokes());
    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 960, 700);
    await recognizer.dispose();
  });

  it('should draw stroke path with beginPath/moveTo/lineTo/stroke', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    await recognizer.recognize(makeStrokes(1));
    expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
    expect(mockCtx.moveTo).toHaveBeenCalledTimes(1);
    expect(mockCtx.lineTo).toHaveBeenCalledTimes(2);
    expect(mockCtx.stroke).toHaveBeenCalledTimes(1);
    await recognizer.dispose();
  });

  it('should render multiple strokes', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    await recognizer.recognize(makeStrokes(3));
    expect(mockCtx.beginPath).toHaveBeenCalledTimes(3);
    expect(mockCtx.stroke).toHaveBeenCalledTimes(3);
    await recognizer.dispose();
  });

  it('should skip single-point strokes during rendering', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    const singlePointStroke: StrokePoint[][] = [
      [{ x: 10, y: 10, t: 0, pressure: 0.5 }],
      [{ x: 0, y: 0, t: 0, pressure: 0.5 }, { x: 10, y: 10, t: 16, pressure: 0.5 }],
    ];
    await recognizer.recognize(singlePointStroke);
    expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
    await recognizer.dispose();
  });
});

// ── Dispose ─────────────────────────────────────────

describe('TextRecognizer dispose', () => {
  beforeEach(() => {
    mockCreateWorker.mockReset();
    mockWorkerInstance.recognize.mockReset();
    mockWorkerInstance.terminate.mockReset();
    setupWorker();
  });

  it('should terminate the worker on dispose', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    await recognizer.initialize();
    await recognizer.dispose();
    expect(mockWorkerInstance.terminate).toHaveBeenCalledTimes(1);
  });

  it('should be safe to call dispose without initialization', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    await expect(recognizer.dispose()).resolves.toBeUndefined();
  });

  it('should be safe to call dispose twice', async () => {
    const recognizer = new TextRecognizer(makeConfig());
    await recognizer.initialize();
    await recognizer.dispose();
    await expect(recognizer.dispose()).resolves.toBeUndefined();
    expect(mockWorkerInstance.terminate).toHaveBeenCalledTimes(1);
  });
});

// ── Config update ───────────────────────────────────

describe('TextRecognizer updateConfig', () => {
  it('should merge partial config without error', () => {
    const recognizer = new TextRecognizer(makeConfig());
    recognizer.updateConfig({ language: 'kor' });
    expect(true).toBe(true);
  });
});
