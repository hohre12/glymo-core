import { StrokePoint, EffectPresetName } from '../types.js';
import { EventBus } from '../state/EventBus.js';
import { SessionStateMachine } from '../state/SessionStateMachine.js';
import { TextModeConfig, TypographyMode } from './types.js';
import { FontMorphAnimator } from './FontMorphAnimator.js';
/**
 * Manages the text mode lifecycle: lazy module loading,
 * stroke accumulation, and OCR → glyph extraction → matching → morph pipeline.
 */
export declare class TextPipelineController {
    private config;
    private readonly eventBus;
    private readonly stateMachine;
    private effect;
    private textRecognizer;
    private glyphExtractor;
    private pointMatcher;
    private morphAnimator;
    private destroyed;
    private typographyMode;
    private presetText;
    constructor(config: TextModeConfig, eventBus: EventBus, stateMachine: SessionStateMachine, effect?: EffectPresetName);
    setTypographyMode(mode: TypographyMode): void;
    getTypographyMode(): TypographyMode;
    get enabled(): boolean;
    setEnabled(enabled: boolean): void;
    setFont(font: string): void;
    getFont(): string;
    setEffect(effect: EffectPresetName): void;
    setPresetText(text: string): void;
    getPresetText(): string | null;
    /** Get the active morph animator (if any) */
    getMorphAnimator(): FontMorphAnimator | null;
    /** Run full text pipeline: recognize → extract → match → morph */
    runPipeline(strokeArrays: StrokePoint[][]): Promise<void>;
    dispose(): void;
    /** Start the morph animation with matched character data */
    private startMorph;
    /** Lazily load text mode modules via dynamic import */
    private initModules;
}
