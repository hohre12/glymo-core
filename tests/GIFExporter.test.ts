/* eslint-disable @typescript-eslint/no-explicit-any */

// Cross-compatible mock function
const mockFn = typeof vi !== 'undefined' ? vi.fn : jest.fn;

// ── gifenc mock ─────────────────────────────────────
// Store on globalThis so mock factory can access after hoisting

(globalThis as any).__gifencWriteFrame = mockFn();
(globalThis as any).__gifencFinish = mockFn();
(globalThis as any).__gifencBytes = mockFn(() => new Uint8Array([71, 73, 70]));

const mockModule = typeof vi !== 'undefined' ? vi : jest;
mockModule.mock('gifenc', () => ({
  GIFEncoder: () => ({
    writeFrame: (globalThis as any).__gifencWriteFrame,
    finish: (globalThis as any).__gifencFinish,
    bytes: (globalThis as any).__gifencBytes,
  }),
  quantize: () => [[0, 0, 0], [255, 255, 255]],
  applyPalette: () => new Uint8Array(100),
}));

// ── Lazy module loading ─────────────────────────────

type GIFExporterModule = typeof import('../src/export/GIFExporter.js');
let mod: GIFExporterModule;

beforeAll(async () => {
  mod = await import('../src/export/GIFExporter.js');
});

const mockWriteFrame = (globalThis as any).__gifencWriteFrame;
const mockFinish = (globalThis as any).__gifencFinish;
const mockBytes = (globalThis as any).__gifencBytes;

// ── Helpers ─────────────────────────────────────────

function createMockImageData(): ImageData {
  return {
    data: new Uint8ClampedArray(800 * 600 * 4),
    width: 800,
    height: 600,
    colorSpace: 'srgb',
  } as ImageData;
}

function createMockCanvas(
  width = 800,
  height = 600,
  hasContext = true,
): HTMLCanvasElement {
  const ctx = hasContext
    ? { getImageData: () => createMockImageData() }
    : null;

  return {
    width,
    height,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

// ── Setup ───────────────────────────────────────────

beforeEach(() => {
  mockWriteFrame.mockClear();
  mockFinish.mockClear();
  mockBytes.mockClear();
});

// ── Constants ───────────────────────────────────────

describe('GIFExporter constants', () => {
  it('GIF_FPS is 20', () => {
    expect(mod.GIF_FPS).toBe(20);
  });

  it('GIF_DURATION_MS is 2000', () => {
    expect(mod.GIF_DURATION_MS).toBe(2000);
  });

  it('GIF_MAX_FRAMES is 40', () => {
    expect(mod.GIF_MAX_FRAMES).toBe(40);
  });

  it('GIF_SIZE_WARN_BYTES is 5MB', () => {
    expect(mod.GIF_SIZE_WARN_BYTES).toBe(5_000_000);
  });
});

// ── Frame Capture ───────────────────────────────────

describe('GIFExporter frame capture', () => {
  it('calls writeFrame for each frame', async () => {
    const canvas = createMockCanvas();
    await mod.exportGIF(canvas);

    const expectedFrames = Math.min(
      Math.floor((mod.GIF_DURATION_MS / 1000) * mod.GIF_FPS),
      mod.GIF_MAX_FRAMES,
    );
    expect(mockWriteFrame).toHaveBeenCalledTimes(expectedFrames);
  });

  it('calls finish after all frames', async () => {
    const canvas = createMockCanvas();
    await mod.exportGIF(canvas);
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it('returns a Blob', async () => {
    const canvas = createMockCanvas();
    const blob = await mod.exportGIF(canvas);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('returns a GIF-type Blob', async () => {
    const canvas = createMockCanvas();
    const blob = await mod.exportGIF(canvas);
    expect(blob.type).toBe('image/gif');
  });
});

// ── Progress Callback ───────────────────────────────

describe('GIFExporter progress callback', () => {
  it('calls onProgress during encoding', async () => {
    const onProgress = mockFn();
    const canvas = createMockCanvas();
    await mod.exportGIF(canvas, { onProgress });
    expect(onProgress).toHaveBeenCalled();
  });

  it('reports 100% at completion', async () => {
    const progressValues: number[] = [];
    const onProgress = (pct: number) => {
      progressValues.push(pct);
    };
    const canvas = createMockCanvas();
    await mod.exportGIF(canvas, { onProgress });

    expect(progressValues[progressValues.length - 1]).toBe(100);
  });

  it('reports increasing percentages', async () => {
    const progressValues: number[] = [];
    const onProgress = (pct: number) => {
      progressValues.push(pct);
    };
    const canvas = createMockCanvas();
    await mod.exportGIF(canvas, { onProgress });

    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(
        progressValues[i - 1],
      );
    }
  });
});

// ── Default Options ─────────────────────────────────

describe('GIFExporter default options', () => {
  it('uses 20fps by default (40 frames for 2s)', async () => {
    const canvas = createMockCanvas();
    await mod.exportGIF(canvas);
    expect(mockWriteFrame).toHaveBeenCalledTimes(40);
  });

  it('respects custom fps', async () => {
    const canvas = createMockCanvas();
    await mod.exportGIF(canvas, { fps: 10, durationMs: 1000 });
    expect(mockWriteFrame).toHaveBeenCalledTimes(10);
  });

  it('respects maxFrames limit', async () => {
    const canvas = createMockCanvas();
    await mod.exportGIF(canvas, {
      fps: 60,
      durationMs: 5000,
      maxFrames: 5,
    });
    expect(mockWriteFrame).toHaveBeenCalledTimes(5);
  });
});

// ── Canvas Validation ───────────────────────────────

describe('GIFExporter canvas validation', () => {
  it('rejects when no 2D context', async () => {
    const canvas = createMockCanvas(800, 600, false);
    await expect(mod.exportGIF(canvas)).rejects.toThrow(
      'Cannot get 2D context',
    );
  });

  it('throws on zero-width canvas', () => {
    const canvas = createMockCanvas(0, 600);
    expect(() => mod.exportGIF(canvas)).toThrow(
      'Invalid canvas dimensions',
    );
  });

  it('throws on zero-height canvas', () => {
    const canvas = createMockCanvas(800, 0);
    expect(() => mod.exportGIF(canvas)).toThrow(
      'Invalid canvas dimensions',
    );
  });
});

// ── Size Warning ────────────────────────────────────

describe('GIFExporter size warning', () => {
  it('warns when output exceeds 5MB', async () => {
    const largeData = new Uint8Array(6_000_000);
    mockBytes.mockReturnValueOnce(largeData);

    const warnSpy = mockFn();
    const originalWarn = console.warn;
    console.warn = warnSpy;

    const canvas = createMockCanvas();
    await mod.exportGIF(canvas);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('exceeds'),
    );
    console.warn = originalWarn;
  });

  it('does not warn when output is under 5MB', async () => {
    mockBytes.mockReturnValueOnce(new Uint8Array(3));

    const warnSpy = mockFn();
    const originalWarn = console.warn;
    console.warn = warnSpy;

    const canvas = createMockCanvas();
    await mod.exportGIF(canvas);

    expect(warnSpy).not.toHaveBeenCalled();
    console.warn = originalWarn;
  });
});
