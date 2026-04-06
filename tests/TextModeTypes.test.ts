import { DEFAULT_TEXT_MODE_CONFIG } from '../src/text/types.js';

// ── Default config values (design doc compliance) ────

describe('DEFAULT_TEXT_MODE_CONFIG', () => {
  it('should have text mode disabled by default', () => {
    expect(DEFAULT_TEXT_MODE_CONFIG.enabled).toBe(false);
  });

  it('should default to sans-serif font at 72px', () => {
    expect(DEFAULT_TEXT_MODE_CONFIG.font).toBe('72px sans-serif');
  });

  it('should support eng+kor language by default', () => {
    expect(DEFAULT_TEXT_MODE_CONFIG.language).toBe('eng+kor');
  });

  it('should set confidence threshold to 0.6', () => {
    expect(DEFAULT_TEXT_MODE_CONFIG.confidenceThreshold).toBe(0.6);
  });

  it('should limit to 20 characters by default', () => {
    expect(DEFAULT_TEXT_MODE_CONFIG.maxChars).toBe(20);
  });

  it('should target 300 points per glyph outline', () => {
    expect(DEFAULT_TEXT_MODE_CONFIG.glyphPointCount).toBe(300);
  });
});
