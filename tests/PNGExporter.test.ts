import { exportPNG } from '../src/export/PNGExporter.js';

// ── Helpers ─────────────────────────────────────────

function createMockCanvas(
  width = 800,
  height = 600,
  blobResult: Blob | null = new Blob(['png-data'], { type: 'image/png' }),
): HTMLCanvasElement {
  return {
    width,
    height,
    toBlob: (cb: (blob: Blob | null) => void) => { cb(blobResult); },
  } as unknown as HTMLCanvasElement;
}

// ── Successful Export ───────────────────────────────

describe('PNGExporter successful export', () => {
  it('returns a Blob on success', async () => {
    const canvas = createMockCanvas();
    const blob = await exportPNG(canvas);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('returns a PNG-type Blob', async () => {
    const canvas = createMockCanvas();
    const blob = await exportPNG(canvas);
    expect(blob.type).toBe('image/png');
  });

  it('resolves with non-zero size', async () => {
    const canvas = createMockCanvas();
    const blob = await exportPNG(canvas);
    expect(blob.size).toBeGreaterThan(0);
  });
});

// ── Canvas Validation ───────────────────────────────

describe('PNGExporter canvas validation', () => {
  it('throws on zero-width canvas', () => {
    const canvas = createMockCanvas(0, 600);
    expect(() => exportPNG(canvas)).toThrow('Invalid canvas dimensions');
  });

  it('throws on zero-height canvas', () => {
    const canvas = createMockCanvas(800, 0);
    expect(() => exportPNG(canvas)).toThrow('Invalid canvas dimensions');
  });

  it('throws on negative dimensions', () => {
    const canvas = createMockCanvas(-1, -1);
    expect(() => exportPNG(canvas)).toThrow('Invalid canvas dimensions');
  });

  it('includes dimensions in error message', () => {
    const canvas = createMockCanvas(0, 0);
    expect(() => exportPNG(canvas)).toThrow('0x0');
  });
});

// ── Error Handling ──────────────────────────────────

describe('PNGExporter error handling', () => {
  it('rejects when toBlob returns null', async () => {
    const canvas = createMockCanvas(800, 600, null);
    await expect(exportPNG(canvas)).rejects.toThrow('toBlob returned null');
  });

  it('rejects when toBlob throws', async () => {
    const canvas = {
      width: 800,
      height: 600,
      toBlob: () => { throw new Error('SecurityError'); },
    } as unknown as HTMLCanvasElement;

    await expect(exportPNG(canvas)).rejects.toThrow('SecurityError');
  });

  it('wraps non-Error throws', async () => {
    const canvas = {
      width: 800,
      height: 600,
      toBlob: () => { throw 'string error'; },
    } as unknown as HTMLCanvasElement;

    await expect(exportPNG(canvas)).rejects.toThrow('string error');
  });
});
