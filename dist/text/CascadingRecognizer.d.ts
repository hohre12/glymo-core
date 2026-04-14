import { StrokePoint } from '../types.js';
import { Bbox } from '../grouping/SpatialGrouper.js';
export interface RecognizedChar {
    id: string;
    char: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    strokeIndex: number;
    strokePoints?: {
        x: number;
        y: number;
    }[];
}
export interface CharCorrection {
    id: string;
    oldChar: string;
    newChar: string;
}
export type CaseMode = 'upper' | 'lower' | 'auto';
export interface CascadingRecognizerOptions {
    onChar: (char: RecognizedChar) => void;
    onCorrection: (correction: CharCorrection) => void;
    onRecognizing?: (busy: boolean) => void;
    /** Called before font display — consumer should fade out specific strokes by ID */
    onDisplayFlush?: (strokeIds: string[]) => void;
    caseMode?: CaseMode;
    heightWindowSize?: number;
}
export declare class CascadingRecognizer {
    private readonly opts;
    private idCounter;
    private destroyed;
    private inflight;
    private readonly grouper;
    /** Recognition state per spatial group id */
    private groupState;
    private heightWindow;
    private chars;
    /** Tracks dpr per group so finalize callback can use it */
    private groupDpr;
    private language;
    constructor(options: CascadingRecognizerOptions);
    setCaseMode(mode: CaseMode): void;
    setLanguage(lang: string): void;
    notifyStrokeStart(): void;
    feedStroke(raw: StrokePoint[], bbox: Bbox, dpr?: number, strokeId?: string): void;
    /** Temporary dpr storage for the current feedStroke call */
    private _currentDpr;
    private handleGroupUpdated;
    private handleGroupFinalized;
    /** Trigger recognition for a group's strokes */
    private recognizeGroup;
    /** Finalize a group: display font character, fade handwritten strokes */
    private finalizeGroup;
    removeChar(id: string): void;
    undo(): string | undefined;
    clear(): void;
    get charCount(): number;
    destroy(): void;
}
