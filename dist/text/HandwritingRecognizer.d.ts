import { StrokePoint } from '../types.js';
/**
 * Recognize handwritten text from stroke data using Google's free Handwriting API.
 * Returns the best text candidate, or null if recognition fails.
 */
export declare function recognizeHandwriting(strokeArrays: StrokePoint[][], language?: string, canvasWidth?: number, canvasHeight?: number): Promise<{
    text: string;
    candidates: string[];
} | null>;
