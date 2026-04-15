import { HologramChar, Hologram3DRendererOptions, HitTestResult } from './types.js';
export declare class Hologram3DRenderer {
    private canvas;
    private destroyed;
    private renderer;
    private postProcessing;
    private scene;
    private camera;
    private charContainer;
    private pivotGroup;
    private loadedFont;
    private charMeshes;
    private chars;
    private rotX;
    private rotY;
    private rotZ;
    private zoom;
    private transition;
    private spread;
    private handActive;
    private enabled;
    /** Per-char position overrides (persists after release): charId -> {x, y} in CSS coords */
    private movedChars;
    /** Which char is currently being actively dragged (null = none) */
    private activeDragId;
    private startTime;
    /** Whether the renderer has been successfully initialized */
    private _isAvailable;
    get isAvailable(): boolean;
    /** Initialization promise — resolves to true if WebGPU + font loaded OK */
    readonly ready: Promise<boolean>;
    constructor(options: Hologram3DRendererOptions);
    /** Update the set of characters to display */
    setText(chars: HologramChar[]): void;
    /** Set X/Y/Z rotation in radians */
    setRotation(rotX: number, rotY: number, rotZ?: number): void;
    /** Set zoom level (clamped to 0.3 - 3.0) */
    setZoom(zoom: number): void;
    /** Set transition progress (0 = hidden, 1 = fully visible) */
    setTransition(t: number): void;
    /** Set spread multiplier: 0 = flat, 1 = normal, 6 = max spread */
    setSpread(spread: number): void;
    /** Set whether hands are actively controlling the hologram */
    setHandActive(active: boolean): void;
    /** Enable/disable the renderer */
    setEnabled(enabled: boolean): void;
    /** Start dragging a char to a CSS position */
    grabChar(charId: string, x: number, y: number): void;
    /** Stop dragging — char stays at last position */
    releaseChar(_charId: string): void;
    /** Reset all transforms to initial state */
    resetTransform(): void;
    /** Find the nearest char to a CSS point using 3D raycasting, returns {id, dist} or null */
    hitTestChar(x: number, y: number, maxDist: number): HitTestResult | null;
    /** Fallback 2D hit test using CSS coordinates (used when 3D raycasting is unavailable) */
    private hitTestCharFallback;
    /** Render one frame. Call this from your compositor or animation loop. */
    renderFrame(): void;
    /** Clean up all GPU/Three.js resources */
    dispose(): void;
    private init;
    /** Create a TSL hologram material */
    private createHologramMaterial;
    /** Create a 3D character mesh with hologram materials */
    private createCharMesh;
    /** Fallback: render CJK character to a canvas texture on a plane with TSL alpha */
    private createTextureCharMesh;
}
