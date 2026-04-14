/** Euclidean distance between thumb tip and index tip (normalized coords) */
export declare function computePinchDistance(thumb: {
    x: number;
    y: number;
}, index: {
    x: number;
    y: number;
}): number;
/** Compute movement speed in canvas-px per ms */
export declare function computeSpeed(prev: {
    x: number;
    y: number;
    t: number;
}, curr: {
    x: number;
    y: number;
}, now: number): number;
/** Map Z-depth to pressure (closer to camera = higher pressure) */
export declare function zToPressure(z: number): number;
