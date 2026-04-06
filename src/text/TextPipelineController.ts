// ── Text Pipeline Controller ────────────────────────

import type { StrokePoint, EffectPresetName } from '../types.js';
import { EFFECT_PRESETS } from '../types.js';
import type { EventBus } from '../state/EventBus.js';
import type { SessionStateMachine } from '../state/SessionStateMachine.js';
import type { TextModeConfig, OverlayText, TypographyMode } from './types.js';
import type { TextRecognizer } from './TextRecognizer.js';
import type { GlyphExtractor } from './GlyphExtractor.js';
import type { PointMatcher } from './PointMatcher.js';
import type { FontMorphAnimator } from './FontMorphAnimator.js';
import { recognizeHandwriting } from './HandwritingRecognizer.js';

/** Maps Tesseract 3-letter language codes to BCP 47 codes used by Google Handwriting API */
const TESSERACT_TO_BCP47: Record<string, string> = {
  eng: 'en',
  kor: 'ko',
  jpn: 'ja',
  zho: 'zh',
  chi_sim: 'zh-Hans',
  chi_tra: 'zh-Hant',
  fra: 'fr',
  deu: 'de',
  spa: 'es',
  por: 'pt',
  rus: 'ru',
  ara: 'ar',
};

/**
 * Manages the text mode lifecycle: lazy module loading,
 * stroke accumulation, and OCR → glyph extraction → matching → morph pipeline.
 */
export class TextPipelineController {
  private textRecognizer: TextRecognizer | null = null;
  private glyphExtractor: GlyphExtractor | null = null;
  private pointMatcher: PointMatcher | null = null;
  private morphAnimator: FontMorphAnimator | null = null;
  private destroyed = false;
  private typographyMode: TypographyMode = 'overlay';
  private presetText: string | null = null;

  constructor(
    private config: TextModeConfig,
    private readonly eventBus: EventBus,
    private readonly stateMachine: SessionStateMachine,
    private effect: EffectPresetName = 'neon',
  ) {}

  setTypographyMode(mode: TypographyMode): void {
    this.typographyMode = mode;
  }

  getTypographyMode(): TypographyMode {
    return this.typographyMode;
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (enabled && !this.textRecognizer) {
      this.initModules();
    }
  }

  setFont(font: string): void {
    this.config.font = font;
    this.textRecognizer?.updateConfig({ font });
    this.glyphExtractor?.updateConfig({ font });
  }

  getFont(): string {
    return this.config.font;
  }

  setEffect(effect: EffectPresetName): void {
    this.effect = effect;
  }

  setPresetText(text: string): void {
    this.presetText = text || null;
  }

  getPresetText(): string | null {
    return this.presetText;
  }

  /** Get the active morph animator (if any) */
  getMorphAnimator(): FontMorphAnimator | null {
    return this.morphAnimator;
  }

  /** Run full text pipeline: recognize → extract → match → morph */
  async runPipeline(strokeArrays: StrokePoint[][]): Promise<void> {
    // Handwriting recognition doesn't require loaded modules for overlay mode
    const needsGlyphModules = this.typographyMode !== 'overlay';
    if (needsGlyphModules && (!this.glyphExtractor || !this.pointMatcher)) {
      return;
    }

    this.stateMachine.transition('recognize_start');

    try {
      // Determine text: preset text OR handwriting recognition
      let text: string;

      if (this.presetText) {
        text = this.presetText;
      } else {
        // Use Google Handwriting Recognition API (free, no API key)
        // Convert Tesseract language code (e.g. 'eng', 'kor') to BCP 47 (e.g. 'en', 'ko')
        const tesseractLang = this.config.language?.split('+')[0] ?? 'eng';
        const bcp47Lang = TESSERACT_TO_BCP47[tesseractLang] ?? tesseractLang.slice(0, 2);
        const result = await recognizeHandwriting(strokeArrays, bcp47Lang);
        if (!result) {
          this.eventBus.emit('text:error', {
            code: 'RECOGNITION_FAILED' as const,
            message: 'Handwriting recognition failed — try writing more clearly',
          });
          this.stateMachine.transition('recognize_fail');
          return;
        }
        text = result.text;
      }

      this.eventBus.emit('text:recognized', {
        text,
        confidence: 1.0,
        characters: [],
        processingTimeMs: 0,
      });

      if (this.typographyMode === 'overlay') {
        // Compute stroke bounding box
        const bbox = computeStrokeBounds(strokeArrays);
        const style = EFFECT_PRESETS[this.effect];

        const overlayData: OverlayText = {
          text: text.trim(),
          font: this.config.font,
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
          effectColor: style?.color ?? '#00ffaa',
          glowColor: style?.glowColor ?? 'rgba(0,255,170,0.7)',
          glowSize: style?.glowSize ?? 40,
          startTime: performance.now(),
          fadeDuration: 600,
        };

        this.eventBus.emit('text:overlay', overlayData);
        this.stateMachine.transition('recognize_complete');
        return;
      }

      // Stage 8: Glyph extraction
      if (!this.glyphExtractor || !this.pointMatcher) return;
      const glyphs = await this.glyphExtractor.extractAll(text);
      this.eventBus.emit('glyph:extracted', glyphs);

      this.stateMachine.transition('recognize_complete');

      // Stage 9: Point matching
      const matched = this.pointMatcher.matchAll(strokeArrays, glyphs);
      this.eventBus.emit('text:matched', matched);

      // Stage 10: Font morph animation
      await this.startMorph(matched);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'OCR_FAILED';
      this.eventBus.emit('text:error', {
        code,
        message: `Text recognition failed: ${code}`,
      });
      this.stateMachine.transition('recognize_fail');
    }
  }

  dispose(): void {
    this.destroyed = true;
    this.morphAnimator?.cancel();
    this.morphAnimator = null;
    this.textRecognizer?.dispose().catch(() => {});
    this.textRecognizer = null;
    this.glyphExtractor = null;
    this.pointMatcher = null;
  }

  /** Start the morph animation with matched character data */
  private async startMorph(
    matched: import('./types.js').MatchedCharacter[],
  ): Promise<void> {
    // Cancel any existing morph
    this.morphAnimator?.cancel();

    const effectColor = EFFECT_PRESETS[this.effect].color;

    const { FontMorphAnimator: FMA } = await import('./FontMorphAnimator.js');
    if (this.destroyed) return;

    this.morphAnimator = new FMA(
      { matchedCharacters: matched, effectColor },
      this.eventBus,
    );
    this.morphAnimator.start();
  }

  /** Lazily load text mode modules via dynamic import */
  private initModules(): void {
    Promise.all([
      import('./TextRecognizer.js'),
      import('./GlyphExtractor.js'),
      import('./PointMatcher.js'),
    ]).then(([trMod, geMod, pmMod]) => {
      if (this.destroyed) return;
      this.textRecognizer = new trMod.TextRecognizer(this.config);
      this.glyphExtractor = new geMod.GlyphExtractor(this.config);
      this.pointMatcher = new pmMod.PointMatcher();
    }).catch(() => {
      this.config.enabled = false;
      this.eventBus.emit('text:error', {
        code: 'TESSERACT_LOAD_FAILED' as const,
        message: 'Failed to load text mode modules',
      });
    });
  }
}

/** Compute bounding box from all stroke points */
function computeStrokeBounds(
  strokeArrays: StrokePoint[][],
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokeArrays) {
    for (const pt of stroke) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 100, height: 100 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
