import { HandStyleName, HandStyleBase } from './types.js';
/**
 * Create a new hand style instance by name.
 * Each call returns a fresh instance with independent state.
 */
export declare function createHandStyle(name: HandStyleName): HandStyleBase;
export type { HandStyleName, HandStyleConfig } from './types.js';
export { HandStyleBase } from './types.js';
