import { Glymo } from '../src/index.js';

// ── Helpers ──────────────────────────────────────────

function createMockCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  return {
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

function createMockCanvas(): HTMLCanvasElement {
  return {
    width: 800,
    height: 600,
    getContext: () => createMockCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    style: { transition: '', opacity: '' },
  } as unknown as HTMLCanvasElement;
}

// ── setTextMode / isTextMode ─────────────────────────

describe('Glymo text mode toggle', () => {
  let glymo: Glymo;

  beforeEach(() => {
    glymo = new Glymo(createMockCanvas());
  });

  afterEach(() => {
    glymo.destroy();
  });

  it('should default to text mode disabled', () => {
    expect(glymo.isTextMode()).toBe(false);
  });

  it('should enable text mode via setTextMode(true)', () => {
    glymo.setTextMode(true);
    expect(glymo.isTextMode()).toBe(true);
  });

  it('should disable text mode via setTextMode(false)', () => {
    glymo.setTextMode(true);
    glymo.setTextMode(false);
    expect(glymo.isTextMode()).toBe(false);
  });

  it('should toggle text mode multiple times', () => {
    glymo.setTextMode(true);
    expect(glymo.isTextMode()).toBe(true);

    glymo.setTextMode(false);
    expect(glymo.isTextMode()).toBe(false);

    glymo.setTextMode(true);
    expect(glymo.isTextMode()).toBe(true);
  });

  it('should throw when called on destroyed instance', () => {
    glymo.destroy();
    expect(() => glymo.setTextMode(true)).toThrow('destroyed');
  });
});

// ── Constructor text mode option ─────────────────────

describe('Glymo constructor textMode option', () => {
  it('should accept textMode: true in constructor options', () => {
    const glymo = new Glymo(createMockCanvas(), { textMode: true });
    expect(glymo.isTextMode()).toBe(true);
    glymo.destroy();
  });

  it('should accept textMode: false in constructor options', () => {
    const glymo = new Glymo(createMockCanvas(), { textMode: false });
    expect(glymo.isTextMode()).toBe(false);
    glymo.destroy();
  });

  it('should default textMode to false when not specified', () => {
    const glymo = new Glymo(createMockCanvas());
    expect(glymo.isTextMode()).toBe(false);
    glymo.destroy();
  });
});

// ── setFont / getFont ────────────────────────────────

describe('Glymo font management', () => {
  let glymo: Glymo;

  beforeEach(() => {
    glymo = new Glymo(createMockCanvas());
  });

  afterEach(() => {
    glymo.destroy();
  });

  it('should default to "72px sans-serif"', () => {
    expect(glymo.getFont()).toBe('72px sans-serif');
  });

  it('should update font via setFont', () => {
    glymo.setFont('48px "Noto Sans KR"');
    expect(glymo.getFont()).toBe('48px "Noto Sans KR"');
  });

  it('should allow changing font multiple times', () => {
    glymo.setFont('48px serif');
    expect(glymo.getFont()).toBe('48px serif');

    glymo.setFont('64px monospace');
    expect(glymo.getFont()).toBe('64px monospace');
  });

  it('should accept constructor font option', () => {
    const g = new Glymo(createMockCanvas(), { font: '36px Georgia' });
    expect(g.getFont()).toBe('36px Georgia');
    g.destroy();
  });
});

// ── Constructor language option ──────────────────────

describe('Glymo constructor language option', () => {
  it('should accept language option without error', () => {
    const glymo = new Glymo(createMockCanvas(), { language: 'kor' });
    expect(glymo).toBeInstanceOf(Glymo);
    glymo.destroy();
  });
});

// ── Event registration for text events ───────────────

describe('Glymo text mode events', () => {
  let glymo: Glymo;

  beforeEach(() => {
    glymo = new Glymo(createMockCanvas());
  });

  afterEach(() => {
    glymo.destroy();
  });

  it('should register text:error event listener without throwing', () => {
    const unsub = glymo.on('text:error', () => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('should register text:recognized event listener without throwing', () => {
    const unsub = glymo.on('text:recognized', () => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('should register glyph:extracted event listener without throwing', () => {
    const unsub = glymo.on('glyph:extracted', () => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });
});
