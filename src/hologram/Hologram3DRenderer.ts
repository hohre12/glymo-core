// ── Hologram 3D Renderer ──────────────────────────────────────────────────────
//
// Extracted from landing/hooks/useHologram3DMesh.ts.
// Self-contained Three.js WebGPU renderer for holographic 3D text.
// No React dependency — operates on a plain HTMLCanvasElement.

import type { HologramChar, Hologram3DRendererOptions, HitTestResult } from './types.js';

// ── Lazy Three.js WebGPU imports ──────────────────────────────────────────────
// Dynamically imported to keep initial bundle small and avoid SSR issues.

let THREE: typeof import('three/webgpu') | null = null;
let TextGeometry: typeof import('three/examples/jsm/geometries/TextGeometry.js').TextGeometry | null = null;
let FontClass: typeof import('three/examples/jsm/loaders/FontLoader.js').Font | null = null;
let tsl: typeof import('three/tsl') | null = null;
let bloomFn: typeof import('three/addons/tsl/display/BloomNode.js').bloom | null = null;

async function loadThreeDeps(): Promise<boolean> {
  if (THREE) return true;
  try {
    const [
      threeModule,
      textGeoModule,
      fontLoaderModule,
      tslModule,
      bloomModule,
    ] = await Promise.all([
      import('three/webgpu'),
      import('three/examples/jsm/geometries/TextGeometry.js'),
      import('three/examples/jsm/loaders/FontLoader.js'),
      import('three/tsl'),
      import('three/addons/tsl/display/BloomNode.js'),
    ]);
    THREE = threeModule;
    TextGeometry = textGeoModule.TextGeometry;
    FontClass = fontLoaderModule.Font;
    tsl = tslModule;
    bloomFn = bloomModule.bloom;
    return true;
  } catch (e) {
    console.error('[Hologram3DRenderer] Failed to load Three.js WebGPU:', e);
    return false;
  }
}

// ── Font loading URLs ─────────────────────────────────────────────────────────

const DEFAULT_FONT_URLS = [
  '/fonts/helvetiker_bold.typeface.json',
  'https://cdn.jsdelivr.net/npm/three@0.183.2/examples/fonts/helvetiker_bold.typeface.json',
];

// Korean font stack used for canvas texture fallback
const KOREAN_FONT_STACK = '"Apple SD Gothic Neo", "Nanum Gothic", "Malgun Gothic", "Noto Sans KR", sans-serif';

/** Check if a character requires CJK rendering (no glyph in helvetiker) */
function needsTextureFallback(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  // Hangul Syllables (AC00-D7AF), Jamo (1100-11FF, 3130-318F),
  // CJK Unified (4E00-9FFF), Hiragana/Katakana (3040-30FF)
  return (code >= 0xAC00 && code <= 0xD7AF)
      || (code >= 0x1100 && code <= 0x11FF)
      || (code >= 0x3130 && code <= 0x318F)
      || (code >= 0x4E00 && code <= 0x9FFF)
      || (code >= 0x3040 && code <= 0x30FF);
}

// ── Renderer Class ────────────────────────────────────────────────────────────

export class Hologram3DRenderer {
  private canvas: HTMLCanvasElement;
  private destroyed = false;

  // Three.js objects (initialized asynchronously)
  private renderer: InstanceType<typeof import('three/webgpu').WebGPURenderer> | null = null;
  private postProcessing: InstanceType<typeof import('three/webgpu').PostProcessing> | null = null;
  private scene: InstanceType<typeof import('three/webgpu').Scene> | null = null;
  private camera: InstanceType<typeof import('three/webgpu').PerspectiveCamera> | null = null;
  private charContainer: InstanceType<typeof import('three/webgpu').Group> | null = null;
  private pivotGroup: InstanceType<typeof import('three/webgpu').Group> | null = null;
  private loadedFont: InstanceType<typeof import('three/examples/jsm/loaders/FontLoader.js').Font> | null = null;

  // Per-char mesh tracking
  private charMeshes = new Map<string, {
    group: InstanceType<typeof import('three/webgpu').Group>;
    frontMat: InstanceType<typeof import('three/webgpu').MeshStandardNodeMaterial>;
    sideMat: InstanceType<typeof import('three/webgpu').MeshStandardNodeMaterial>;
    uTime: ReturnType<typeof import('three/tsl').uniform>;
    uTransition: ReturnType<typeof import('three/tsl').uniform>;
    sideUTime: ReturnType<typeof import('three/tsl').uniform>;
    sideUTransition: ReturnType<typeof import('three/tsl').uniform>;
  }>();

  // Mutable state
  private chars: HologramChar[] = [];
  private rotX = 0;
  private rotY = 0;
  private rotZ = 0;
  private zoom = 1;
  private transition = 0;
  private spread = 1;
  private handActive = false;
  private enabled = true;
  // Note: color and font were removed — the renderer uses hardcoded hologram
  // color (0x00bbff) and loads its own 3D font file. If per-instance color/font
  // customization is needed later, add setter methods instead of constructor args.

  /** Per-char position overrides (persists after release): charId -> {x, y} in CSS coords */
  private movedChars = new Map<string, { x: number; y: number }>();
  /** Which char is currently being actively dragged (null = none) */
  private activeDragId: string | null = null;

  private startTime = performance.now();

  /** Whether the renderer has been successfully initialized */
  private _isAvailable = false;
  get isAvailable(): boolean { return this._isAvailable; }

  /** Initialization promise — resolves to true if WebGPU + font loaded OK */
  readonly ready: Promise<boolean>;

  constructor(options: Hologram3DRendererOptions) {
    this.canvas = options.canvas;
    this.ready = this.init();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Update the set of characters to display */
  setText(chars: HologramChar[]): void {
    this.chars = chars;
  }

  /** Set X/Y/Z rotation in radians */
  setRotation(rotX: number, rotY: number, rotZ?: number): void {
    this.rotX = rotX;
    this.rotY = rotY;
    if (rotZ !== undefined) this.rotZ = rotZ;
  }

  /** Set zoom level (clamped to 0.3 - 3.0) */
  setZoom(zoom: number): void {
    this.zoom = Math.max(0.3, Math.min(3.0, zoom));
  }

  /** Set transition progress (0 = hidden, 1 = fully visible) */
  setTransition(t: number): void {
    this.transition = Math.max(0, Math.min(1, t));
  }

  /** Set spread multiplier: 0 = flat, 1 = normal, 6 = max spread */
  setSpread(spread: number): void {
    this.spread = Math.max(0, Math.min(6.0, spread));
  }

  /** Set whether hands are actively controlling the hologram */
  setHandActive(active: boolean): void {
    this.handActive = active;
  }

  /** Enable/disable the renderer */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Start dragging a char to a CSS position */
  grabChar(charId: string, x: number, y: number): void {
    this.movedChars.set(charId, { x, y });
    this.activeDragId = charId;
  }

  /** Stop dragging — char stays at last position */
  releaseChar(_charId: string): void {
    this.activeDragId = null;
  }

  /** Reset all transforms to initial state */
  resetTransform(): void {
    this.rotX = 0;
    this.rotY = 0;
    this.rotZ = 0;
    this.zoom = 1;
    this.spread = 1;
    this.movedChars.clear();
    this.activeDragId = null;
  }

  /** Find the nearest char to a CSS point using 3D raycasting, returns {id, dist} or null */
  hitTestChar(x: number, y: number, maxDist: number): HitTestResult | null {
    if (!THREE || !this.camera || !this.canvas) {
      return this.hitTestCharFallback(x, y, maxDist);
    }

    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    // Convert CSS coords to NDC (-1 to +1)
    const ndcX = (x / w) * 2 - 1;
    const ndcY = -(y / h) * 2 + 1;

    // Use Three.js Raycaster for proper 3D hit testing
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

    // Collect all char meshes and their IDs
    const entries: { id: string; group: InstanceType<typeof import('three/webgpu').Group> }[] = [];
    const chars = this.chars.filter(c => !c.isDeleting);
    for (const ch of chars) {
      const entry = this.charMeshes.get(ch.id);
      if (entry) entries.push({ id: ch.id, group: entry.group });
    }

    const objects = entries.map(e => e.group);
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      const hit = intersects[0]!;
      // Find which char group contains the hit object
      for (const { id, group } of entries) {
        let found = false;
        group.traverse((child: any) => {
          if (child === hit.object) found = true;
        });
        if (found) {
          return { id, dist: hit.distance };
        }
      }
    }

    // Fall back to 2D distance check if raycasting missed but CSS coords are close
    return this.hitTestCharFallback(x, y, maxDist);
  }

  /** Fallback 2D hit test using CSS coordinates (used when 3D raycasting is unavailable) */
  private hitTestCharFallback(x: number, y: number, maxDist: number): HitTestResult | null {
    const chars = this.chars.filter(c => !c.isDeleting);
    let nearest: HitTestResult | null = null;
    for (const ch of chars) {
      const moved = this.movedChars.get(ch.id);
      const cx = moved?.x ?? ch.x;
      const cy = moved?.y ?? ch.y;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < maxDist && (!nearest || dist < nearest.dist)) {
        nearest = { id: ch.id, dist };
      }
    }
    return nearest;
  }

  /** Render one frame. Call this from your compositor or animation loop. */
  renderFrame(): void {
    if (this.destroyed) return;
    if (!this.canvas || !this.renderer || !this.postProcessing || !this.scene || !this.camera || !this.charContainer) return;

    const canvas = this.canvas;
    const renderer = this.renderer;
    const camera = this.camera;
    const charContainer = this.charContainer;

    // Sync canvas size
    const dpr = renderer.getPixelRatio();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    if (!this.enabled || this.transition < 0.001) {
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      return;
    }

    const now = performance.now();
    const elapsed = (now - this.startTime) * 0.001;
    const transition = this.transition;
    const chars = this.chars.filter(c => !c.isDeleting);
    const numChars = Math.min(chars.length, 20);
    const spread = this.spread;

    // ── Sync char meshes with state ──────────────────
    const activeIds = new Set<string>();

    for (let i = 0; i < numChars; i++) {
      const ch = chars[i]!;
      activeIds.add(ch.id);

      let entry = this.charMeshes.get(ch.id);
      if (!entry) {
        const created = this.createCharMesh(ch.char, elapsed, transition);
        if (!created) continue;
        entry = {
          group: created.group,
          frontMat: created.frontMat,
          sideMat: created.sideMat,
          uTime: created.uTime,
          uTransition: created.uTransition,
          sideUTime: created.sideUTime,
          sideUTransition: created.sideUTransition,
        };
        this.charMeshes.set(ch.id, entry);
        charContainer.add(entry.group);
      }

      // Update uniforms for both front and side materials
      (entry.uTime as any).value = elapsed;
      (entry.uTransition as any).value = transition;
      (entry.sideUTime as any).value = elapsed;
      (entry.sideUTransition as any).value = transition;

      // Position: convert CSS coords to 3D world coords
      const camZ = 6 / this.zoom;
      const fovRad = (35 * Math.PI / 180);
      const visibleHalfH = camZ * Math.tan(fovRad / 2);
      const visibleHalfW = visibleHalfH * camera.aspect;
      const cssW = w;
      const cssH = h;

      // Position override: use moved position if char was repositioned
      const moved = this.movedChars.get(ch.id);
      const isActivelyDragged = this.activeDragId === ch.id;
      const charX = moved?.x ?? ch.x;
      const charY = moved?.y ?? ch.y;
      const ndcX = (charX / cssW) * 2.0 - 1.0;
      const ndcY = -((charY / cssH) * 2.0 - 1.0);

      // Scale
      const charWorldH = (ch.height / cssH) * visibleHalfH * 2;
      const baseScale = Math.max(charWorldH, 0.5);
      const age = now - ch.entryTime;
      const entryT = Math.min(age / 600, 1.0);
      // Elastic entrance animation (600ms)
      const elastic = entryT < 1.0
        ? 1.0 + (1.0 - entryT) * 0.35 * Math.sin(entryT * Math.PI * 2.5)
        : 1.0;
      const entryScale = entryT * elastic;

      if (isActivelyDragged) {
        // ── ACTIVELY DRAGGED: screen-aligned, face camera ──
        const targetX = ndcX * visibleHalfW;
        const targetY = ndcY * visibleHalfH;

        // Counteract container rotation so char appears at pinch point
        const crx = charContainer.rotation.x;
        const cry = charContainer.rotation.y;
        const cosY = Math.cos(-cry);
        const sinY = Math.sin(-cry);
        const ix = targetX * cosY;
        const iz = -targetX * sinY;
        const cosX = Math.cos(-crx);
        const sinX = Math.sin(-crx);
        const iy = targetY * cosX - iz * sinX;
        const iz2 = targetY * sinX + iz * cosX;

        entry.group.position.set(ix, iy, iz2);
        entry.group.rotation.set(-crx, -cry, -charContainer.rotation.z);
        entry.group.scale.setScalar(baseScale * 1.2 * transition);
        (entry.uTransition as any).value = transition;
        (entry.sideUTransition as any).value = transition;
      } else {
        // ── NORMAL or REPOSITIONED CHAR: spread + depth ──
        // Compute centroid of all chars
        let cxSum = 0, cySum = 0;
        for (let j = 0; j < numChars; j++) {
          const mj = this.movedChars.get(chars[j]!.id);
          cxSum += ((mj?.x ?? chars[j]!.x) / cssW) * 2.0 - 1.0;
          cySum += -(((mj?.y ?? chars[j]!.y) / cssH) * 2.0 - 1.0);
        }
        const centerX = cxSum / numChars;
        const centerY = cySum / numChars;

        // Scale distance from centroid by spread factor (preserves relative layout)
        const worldX = (centerX + (ndcX - centerX) * spread) * visibleHalfW;
        const worldY = (centerY + (ndcY - centerY) * spread) * visibleHalfH;
        const centerIdx = (numChars - 1) / 2;
        const worldZ = -(i - centerIdx) * 0.6 * spread;

        entry.group.position.set(worldX, worldY, worldZ);
        entry.group.rotation.set(0, 0, 0);
        entry.group.scale.setScalar(baseScale * entryScale * transition);

        const opacity = Math.min(age / 400, 1.0);
        (entry.uTransition as any).value = transition * opacity;
        (entry.sideUTransition as any).value = transition * opacity;
      }
    }

    // Remove meshes for deleted chars
    for (const [id, entry] of this.charMeshes) {
      if (!activeIds.has(id)) {
        charContainer.remove(entry.group);
        entry.group.traverse(obj => {
          if ((obj as any).geometry) (obj as any).geometry.dispose();
          if ((obj as any).material) {
            const mat = (obj as any).material;
            if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
            else mat.dispose();
          }
        });
        this.charMeshes.delete(id);
      }
    }

    // ── Camera/container rotation ──────────────────────
    // When hands are active: user-controlled rotation only.
    // When no hands: add gentle idle wobble on top.
    const isLocked = !this.enabled && transition > 0;
    const idleRotY = (this.handActive || isLocked) ? 0 : Math.sin(elapsed * 0.5) * 0.3;
    const idleRotX = (this.handActive || isLocked) ? 0 : Math.sin(elapsed * 0.3) * 0.12;

    charContainer.rotation.x = this.rotX + idleRotX;
    charContainer.rotation.y = this.rotY + idleRotY;
    charContainer.rotation.z = this.rotZ;

    // ── Pivot indicator: fade in/out based on hand activity ──
    if (this.pivotGroup) {
      const pivotMats = (this.pivotGroup as any)._pivotMats as InstanceType<typeof import('three/webgpu').MeshBasicMaterial>[];
      const targetPivotOpacity = this.handActive ? 0.25 : 0;
      for (const mat of pivotMats) {
        mat.opacity += (targetPivotOpacity - mat.opacity) * 0.1;
      }
      this.pivotGroup.visible = pivotMats[0]!.opacity > 0.01;
    }

    // Zoom
    camera.position.z = 6 / this.zoom;

    // ── Render with bloom ──────────────────────────────
    this.postProcessing!.render();
  }

  /** Clean up all GPU/Three.js resources */
  dispose(): void {
    this.destroyed = true;
    for (const [, entry] of this.charMeshes) {
      entry.group.traverse(obj => {
        if ((obj as any).geometry) (obj as any).geometry.dispose();
        if ((obj as any).material) {
          const mat = (obj as any).material;
          if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
          else mat.dispose();
        }
      });
    }
    this.charMeshes.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }

  // ── Private initialization ──────────────────────────────────────────────────

  private async init(): Promise<boolean> {
    try {
      const ok = await loadThreeDeps();
      if (!ok || this.destroyed || !THREE || !tsl || !bloomFn) return false;

      // ── Scene setup ──────────────────────────────────
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      this.camera.position.set(0, 0, 6);

      // WebGPU Renderer — transparent background so camera feed shows through
      this.renderer = new THREE.WebGPURenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.sortObjects = true;

      // Must await WebGPU initialization
      await this.renderer.init();
      if (this.destroyed) { this.renderer.dispose(); return false; }

      // ── Post-processing: bloom via TSL ───────────────
      const { pass } = tsl;
      const scenePass = pass(this.scene, this.camera);
      const sceneColor = scenePass.getTextureNode('output');
      const bloomPass = bloomFn(sceneColor);
      (bloomPass as any).threshold.value = 0.1;
      (bloomPass as any).strength.value = 2.8;
      (bloomPass as any).radius.value = 0.6;

      this.postProcessing = new THREE.PostProcessing(this.renderer);
      this.postProcessing.outputNode = sceneColor.add(bloomPass);

      // ── Load font ────────────────────────────────────
      for (const url of DEFAULT_FONT_URLS) {
        try {
          const resp = await fetch(url);
          if (!resp.ok) continue;
          const data = await resp.json();
          this.loadedFont = new FontClass!(data);
          break;
        } catch { /* try next */ }
      }

      if (this.destroyed || !this.loadedFont) return false;

      // ── Container group for all chars ────────────────
      this.charContainer = new THREE.Group();
      this.scene.add(this.charContainer);

      // ── Pivot indicator: subtle crosshair at rotation center ──
      this.pivotGroup = new THREE.Group();
      this.scene.add(this.pivotGroup);
      {
        const pivotMat = new THREE.MeshBasicMaterial({
          color: 0x00bbff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const hGeo = new THREE.PlaneGeometry(0.6, 0.008);
        this.pivotGroup.add(new THREE.Mesh(hGeo, pivotMat));
        const vGeo = new THREE.PlaneGeometry(0.008, 0.6);
        this.pivotGroup.add(new THREE.Mesh(vGeo, pivotMat));
        const dotGeo = new THREE.CircleGeometry(0.04, 16);
        const dotMat = new THREE.MeshBasicMaterial({
          color: 0x00bbff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        this.pivotGroup.add(new THREE.Mesh(dotGeo, dotMat));
        (this.pivotGroup as any)._pivotMats = [pivotMat, dotMat];
      }

      this.startTime = performance.now();
      this._isAvailable = true;
      return true;
    } catch (err) {
      console.error('[Hologram3DRenderer] init failed:', err);
      return false;
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Create a TSL hologram material */
  private createHologramMaterial(isFront: boolean) {
    if (!THREE || !tsl) return null;

    const { Fn, float, vec3, uniform: tslUniform, color: tslColor,
            positionWorld, normalWorld, cameraPosition, sin, smoothstep, abs, dot, pow, clamp: tslClamp } = tsl;

    const uTime = tslUniform(0.0);
    const uTransition = tslUniform(0.0);
    const holoColor = new THREE.Color(0x00bbff);

    // Fresnel edge glow — strong edge highlight
    const fresnel = Fn(() => {
      const viewDir = cameraPosition.sub(positionWorld).normalize();
      const nDotV = abs(dot(normalWorld, viewDir));
      return pow(float(1.0).sub(nDotV), float(3.0));
    });

    // Scanlines — horizontal, scrolling upward
    const scanline = Fn(() => {
      const raw = sin(positionWorld.y.mul(60.0).sub(uTime.mul(4.0))).mul(0.5).add(0.5);
      return smoothstep(float(0.2), float(0.8), raw).mul(0.25);
    });

    // Flicker — brightness pulse
    const flicker = Fn(() => {
      return sin(uTime.mul(6.0)).mul(0.06).add(sin(uTime.mul(11.3)).mul(0.04));
    });

    const material = new THREE.MeshStandardNodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.side = THREE.FrontSide;

    if (isFront) {
      material.colorNode = tslColor(holoColor).add(fresnel().mul(0.8)).add(vec3(float(0.1), float(0.2), float(0.3)));
      material.opacityNode = tslClamp(
        float(0.92).add(fresnel().mul(0.08)).sub(scanline()).add(flicker()).mul(uTransition),
        float(0.0),
        float(1.0),
      );
    } else {
      const wallColor = tslColor(holoColor).mul(0.45).add(vec3(float(0.03), float(0.08), float(0.15)));
      material.colorNode = wallColor.add(fresnel().mul(0.5));
      material.opacityNode = tslClamp(
        float(0.7).add(fresnel().mul(0.2)).sub(scanline().mul(0.4)).add(flicker()).mul(uTransition),
        float(0.0),
        float(1.0),
      );
    }

    material.emissiveNode = tslColor(holoColor).mul(fresnel().mul(0.7).add(0.35));

    return { material, uTime, uTransition };
  }

  /** Create a 3D character mesh with hologram materials */
  private createCharMesh(char: string, _elapsed: number, _transition: number) {
    if (!THREE || !this.loadedFont) return null;

    const front = this.createHologramMaterial(true);
    const side = this.createHologramMaterial(false);
    if (!front || !side) return null;

    // Korean / CJK characters: use canvas texture on extruded plane
    // (helvetiker font has no CJK glyphs)
    if (needsTextureFallback(char)) {
      return this.createTextureCharMesh(char, front, side);
    }

    const geometry = new TextGeometry!(char, {
      font: this.loadedFont,
      size: 1.0,
      depth: 0.35,
      curveSegments: 6,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 3,
    });

    // Center the geometry
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const cx = (bb.max.x + bb.min.x) / 2;
    const cy = (bb.max.y + bb.min.y) / 2;
    const cz = (bb.max.z + bb.min.z) / 2;
    geometry.translate(-cx, -cy, -cz);

    const mesh = new THREE.Mesh(geometry, [front.material, side.material]);
    const group = new THREE.Group();
    group.add(mesh);

    return {
      group,
      frontMat: front.material,
      sideMat: side.material,
      uTime: front.uTime,
      uTransition: front.uTransition,
      sideUTime: side.uTime,
      sideUTransition: side.uTransition,
    };
  }

  /** Fallback: render CJK character to a canvas texture and apply to extruded shape */
  private createTextureCharMesh(
    char: string,
    front: { material: any; uTime: any; uTransition: any },
    side: { material: any; uTime: any; uTransition: any },
  ) {
    if (!THREE) return null;

    // Render character to a 2D canvas
    const texSize = 128;
    const offscreen = document.createElement('canvas');
    offscreen.width = texSize;
    offscreen.height = texSize;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, texSize, texSize);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${texSize * 0.7}px ${KOREAN_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, texSize / 2, texSize / 2);

    // Create Three.js texture from canvas
    const texture = new THREE.CanvasTexture(offscreen);
    texture.needsUpdate = true;

    // Create a front-face material that combines the hologram effect with the texture alpha
    const frontMat = front.material.clone();
    frontMat.transparent = true;
    frontMat.alphaMap = texture;
    frontMat.alphaTest = 0.1;

    // Use a box geometry with slight depth for 3D feel
    const geometry = new THREE.BoxGeometry(1.2, 1.2, 0.35);
    const mesh = new THREE.Mesh(geometry, [
      side.material,   // +x
      side.material,   // -x
      side.material,   // +y
      side.material,   // -y
      frontMat,        // +z (front face with text)
      front.material,  // -z (back)
    ]);

    const group = new THREE.Group();
    group.add(mesh);

    return {
      group,
      frontMat: front.material,
      sideMat: side.material,
      uTime: front.uTime,
      uTransition: front.uTransition,
      sideUTime: side.uTime,
      sideUTransition: side.uTransition,
    };
  }
}
