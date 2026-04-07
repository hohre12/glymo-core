import type { EffectPresetName, GlymoEvent, Stroke, StrokePoint } from '../types.js';
import { EFFECT_PRESETS, GPU_EFFECT_NAMES } from '../types.js';
import { hexToRgb } from '../util/math.js';
import type { MorphAnimator } from '../animate/MorphAnimator.js';
import type { FontMorphAnimator } from '../text/FontMorphAnimator.js';
import type { EventBus } from '../state/EventBus.js';
import type { IRenderer, RendererType } from './IRenderer.js';
import type { OverlayText } from '../text/types.js';

// ── Constants ────────────────────────────────────────

const INIT_TIMEOUT_MS = 2000;
const BG_COLOR: GPUColor = { r: 0, g: 0, b: 0, a: 1 };
const ACTIVE_DOT_COLOR = '#10b981';
const ACTIVE_DOT_RADIUS = 3;

// ── Availability ────────────────────────────────────

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export async function requestGPUDevice(): Promise<{ device: GPUDevice } | null> {
  if (!isWebGPUAvailable()) return null;
  try {
    const result = await Promise.race([
      (async () => {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return null;
        const device = await adapter.requestDevice();
        return { device };
      })(),
      new Promise<null>((r) => setTimeout(() => r(null), INIT_TIMEOUT_MS)),
    ]);
    return result ?? null;
  } catch {
    // Intentionally silent: GPU initialisation is expected to fail on
    // browsers/devices that do not support WebGPU. Caller treats null as
    // "unavailable" and falls back to Canvas 2D.
    return null;
  }
}

// ── Base stroke shader (renders strokes as thick lines) ─

const BASE_STROKE_WGSL = /* wgsl */`
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  effect_id: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) color: vec4<f32>,
};
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) world_pos: vec2<f32>,
};

@vertex fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  var pos = input.position;

  // Liquid: sin/cos wave displacement
  if (u.effect_id > 0.5 && u.effect_id < 1.5) {
    let freq = 0.015;
    let amp = 6.0;
    pos.x = pos.x + sin(pos.y * freq + u.time * 2.0) * amp;
    pos.y = pos.y + cos(pos.x * freq + u.time * 1.5) * amp * 0.7;
  }

  let ndc = (pos / u.resolution) * 2.0 - 1.0;
  out.position = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
  out.color = input.color;
  out.world_pos = pos;
  return out;
}

@fragment fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  var col = input.color;

  // Hologram: RGB channel shift + scanlines
  if (u.effect_id > 1.5 && u.effect_id < 2.5) {
    let scanline = step(0.5, fract(input.world_pos.y / 4.0));
    col = col * (0.8 + 0.2 * scanline);
    let glitch = step(0.93, fract(u.time * 0.3)) * sin(input.world_pos.y * 50.0 + u.time * 80.0) * 0.15;
    col.r = col.r + glitch;
    col.b = col.b - glitch;
  }

  // Bloom: bright additive glow
  if (u.effect_id > 2.5 && u.effect_id < 3.5) {
    let brightness = dot(col.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    let bloom = smoothstep(0.3, 0.8, brightness) * 0.5;
    col = vec4<f32>(col.rgb + vec3<f32>(bloom), col.a);
  }

  // GPU Particles: pulsing size/alpha
  if (u.effect_id > 3.5 && u.effect_id < 4.5) {
    let pulse = 0.8 + 0.2 * sin(u.time * 3.0 + input.world_pos.x * 0.05);
    col = vec4<f32>(col.rgb * pulse, col.a * pulse);
  }

  // Dissolve: noise-based alpha cutoff
  if (u.effect_id > 4.5 && u.effect_id < 5.5) {
    let n = fract(sin(dot(input.world_pos * 0.01, vec2<f32>(12.9898, 78.233))) * 43758.5453);
    let progress = fract(u.time * 0.15);
    let cycle = abs(progress * 2.0 - 1.0);
    let edge = smoothstep(cycle - 0.08, cycle, n);
    let edge_glow = smoothstep(cycle - 0.08, cycle, n) - smoothstep(cycle, cycle + 0.04, n);
    col = vec4<f32>(col.rgb + vec3<f32>(1.0, 0.6, 0.2) * edge_glow * 2.0, col.a * edge);
  }

  return col;
}
`;

// ── Glow pass shader (soft additive glow) ──────────

const GLOW_WGSL = /* wgsl */`
struct Uniforms { resolution: vec2<f32>, time: f32, _pad: f32 };
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexInput { @location(0) position: vec2<f32>, @location(1) color: vec4<f32> };
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) color: vec4<f32> };

@vertex fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let ndc = (input.position / u.resolution) * 2.0 - 1.0;
  out.position = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
  out.color = input.color;
  return out;
}

@fragment fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(input.color.rgb, input.color.a * 0.35);
}
`;

// ── Effect ID mapping ──────────────────────────────

const EFFECT_ID: Record<string, number> = {
  liquid: 1, hologram: 2, bloom: 3, 'gpu-particles': 4, dissolve: 5,
};

// ── WebGPURenderer ──────────────────────────────────

export class WebGPURenderer implements IRenderer {
  readonly type: RendererType = 'webgpu';

  private readonly canvas: HTMLCanvasElement;
  private readonly dpr: number;
  private device: GPUDevice | null = null;
  private gpuContext: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private strokePipeline: GPURenderPipeline | null = null;
  private glowPipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private uniformBindGroup: GPUBindGroup | null = null;

  private eventBus: EventBus | null = null;
  private animationId: number | null = null;
  private lastFrameTime = 0;
  private elapsedTime = 0;

  private completedStrokes: Stroke[] = [];
  private activePoints: ReadonlyArray<StrokePoint> = [];
  private activeEffect: EffectPresetName = 'liquid';
  private morphAnimator: MorphAnimator | null = null;
  private getActivePointsFn: (() => ReadonlyArray<StrokePoint>) | null = null;

  // 2D overlay for active dots
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;

  private initialized = false;

  constructor(canvas: HTMLCanvasElement, dpr: number = 1) {
    this.canvas = canvas;
    this.dpr = dpr;
  }

  async init(): Promise<boolean> {
    if (this.initialized) return true;
    const resources = await requestGPUDevice();
    if (!resources) return false;

    this.device = resources.device;
    const ctx = this.canvas.getContext('webgpu');
    if (!ctx) { this.device.destroy(); this.device = null; return false; }

    this.gpuContext = ctx;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });

    this.setupOverlay();
    this.createPipelines();
    this.initialized = true;
    return true;
  }

  // ── IRenderer ─────────────────────────────────────

  setEventBus(bus: EventBus): void { this.eventBus = bus; }

  start(): void {
    if (this.animationId !== null) return;
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame((t) => this.renderLoop(t));
  }

  stop(): void {
    if (this.animationId !== null) { cancelAnimationFrame(this.animationId); this.animationId = null; }
  }

  setActivePointsSource(fn: () => ReadonlyArray<StrokePoint>): void { this.getActivePointsFn = fn; }
  setMorphAnimator(a: MorphAnimator | null): void { this.morphAnimator = a; }
  /** No-op — text morph rendering is not supported in WebGPU mode */
  setFontMorphAnimator(_animator: FontMorphAnimator | null): void { /* not implemented in WebGPU mode */ }
  /** No-op — overlay text rendering is not supported in WebGPU mode */
  setOverlayText(_overlay: OverlayText | null): void {}
  /** No-op — overlay text rendering is not supported in WebGPU mode */
  clearOverlayText(): void {}
  addCompletedStroke(s: Stroke): void { this.completedStrokes.push(s); }
  removeLastStroke(): Stroke | undefined { return this.completedStrokes.pop(); }
  fadeOutLastStroke(_durationMs: number): Stroke | undefined { return this.completedStrokes.pop(); }
  clearAll(): void { this.completedStrokes = []; }
  setEffect(name: EffectPresetName): void { this.activeEffect = name; }
  getEffect(): EffectPresetName { return this.activeEffect; }
  getStrokeCount(): number { return this.completedStrokes.length; }
  /** No-op for WebGPU renderer — background is always cleared by the GPU load op */
  setBackgroundMode(_mode: 'solid' | 'transparent'): void { /* GPU load op handles clear */ }

  destroy(): void {
    this.stop();
    this.completedStrokes = [];
    this.uniformBuffer?.destroy();
    this.device?.destroy();
    this.device = null;
    this.gpuContext = null;
    this.initialized = false;
    this.removeOverlay();
  }

  isGPUEffect(name: EffectPresetName): boolean {
    return GPU_EFFECT_NAMES.includes(name);
  }

  // ── Pipeline creation ─────────────────────────────

  private createPipelines(): void {
    const dev = this.device!;

    const vertexLayout: GPUVertexBufferLayout = {
      arrayStride: 6 * 4, // 2 float pos + 4 float color
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x2' as GPUVertexFormat },
        { shaderLocation: 1, offset: 2 * 4, format: 'float32x4' as GPUVertexFormat },
      ],
    };

    // Uniform buffer: resolution(2f) + time(1f) + effect_id(1f) = 16 bytes
    this.uniformBuffer = dev.createBuffer({
      size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = dev.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' as GPUBufferBindingType } }],
    });

    this.uniformBindGroup = dev.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    const pipelineLayout = dev.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    // Main stroke pipeline with blending
    const strokeModule = dev.createShaderModule({ code: BASE_STROKE_WGSL });
    this.strokePipeline = dev.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: strokeModule, entryPoint: 'vs_main', buffers: [vertexLayout] },
      fragment: {
        module: strokeModule, entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha' as GPUBlendFactor, dstFactor: 'one-minus-src-alpha' as GPUBlendFactor, operation: 'add' as GPUBlendOperation },
            alpha: { srcFactor: 'one' as GPUBlendFactor, dstFactor: 'one-minus-src-alpha' as GPUBlendFactor, operation: 'add' as GPUBlendOperation },
          },
        }],
      },
      primitive: { topology: 'triangle-list' as GPUPrimitiveTopology },
    });

    // Glow pipeline (additive blend)
    const glowModule = dev.createShaderModule({ code: GLOW_WGSL });
    this.glowPipeline = dev.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: glowModule, entryPoint: 'vs_main', buffers: [vertexLayout] },
      fragment: {
        module: glowModule, entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha' as GPUBlendFactor, dstFactor: 'one' as GPUBlendFactor, operation: 'add' as GPUBlendOperation },
            alpha: { srcFactor: 'one' as GPUBlendFactor, dstFactor: 'one' as GPUBlendFactor, operation: 'add' as GPUBlendOperation },
          },
        }],
      },
      primitive: { topology: 'triangle-list' as GPUPrimitiveTopology },
    });
  }

  // ── Render loop ───────────────────────────────────

  private renderLoop(timestamp: number): void {
    const dt = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    this.elapsedTime += dt * 0.001; // seconds
    this.activePoints = this.getActivePointsFn?.() ?? [];

    if (this.device && this.gpuContext) this.renderFrame(dt);
    this.renderOverlay();

    this.animationId = requestAnimationFrame((t) => this.renderLoop(t));
  }

  private renderFrame(_dt: number): void {
    const dev = this.device!;
    const ctx = this.gpuContext!;

    let texture: GPUTexture;
    try { texture = ctx.getCurrentTexture(); } catch { return; }

    const w = this.canvas.width || this.canvas.clientWidth * this.dpr;
    const h = this.canvas.height || this.canvas.clientHeight * this.dpr;
    const effectId = EFFECT_ID[this.activeEffect] ?? 0;

    // Update uniforms
    dev.queue.writeBuffer(this.uniformBuffer!, 0, new Float32Array([w, h, this.elapsedTime, effectId]));

    const encoder = dev.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: texture.createView(),
        clearValue: BG_COLOR,
        loadOp: 'clear' as GPULoadOp,
        storeOp: 'store' as GPUStoreOp,
      }],
    });

    // Render all completed strokes
    for (const stroke of this.completedStrokes) {
      if (stroke.smoothed.length < 2) continue;
      const style = EFFECT_PRESETS[stroke.effect];
      this.drawStroke(pass, dev, stroke.smoothed, style, true);
      this.drawStroke(pass, dev, stroke.smoothed, style, false);
    }

    // Render morphing stroke
    const animator = this.morphAnimator;
    if (animator?.isActive()) {
      const effect = animator.effect;
      const points = animator.update(_dt);
      if (points && points.length >= 2) {
        const style = EFFECT_PRESETS[effect];
        this.drawStroke(pass, dev, points, style, true);
        this.drawStroke(pass, dev, points, style, false);
      }
    }

    pass.end();
    dev.queue.submit([encoder.finish()]);
  }

  /** Build quad geometry for a stroke and draw it */
  private drawStroke(
    pass: GPURenderPassEncoder,
    dev: GPUDevice,
    points: StrokePoint[],
    style: { color: string; minWidth: number; maxWidth: number; glowColor: string; gradient: string[] | null },
    isGlow: boolean,
  ): void {
    const verts = this.buildStrokeGeometry(points, style, isGlow);
    if (verts.length === 0) return;

    const vertexBuffer = dev.createBuffer({
      size: verts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    dev.queue.writeBuffer(vertexBuffer, 0, verts);

    const pipeline = isGlow ? this.glowPipeline! : this.strokePipeline!;
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, this.uniformBindGroup!);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(verts.length / 6); // 6 floats per vertex

    // Schedule buffer cleanup after GPU submission
    vertexBuffer.destroy();
  }

  /** Convert stroke points into triangle strip quads with color */
  private buildStrokeGeometry(
    points: StrokePoint[],
    style: { color: string; minWidth: number; maxWidth: number; glowColor: string; gradient: string[] | null },
    isGlow: boolean,
  ): Float32Array {
    const segments = points.length - 1;
    if (segments <= 0) return new Float32Array(0);

    // 2 triangles per segment = 6 vertices, 6 floats per vertex
    const data = new Float32Array(segments * 6 * 6);
    let offset = 0;

    for (let i = 0; i < segments; i++) {
      const p0 = points[i]!;
      const p1 = points[i + 1]!;

      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const w0 = (style.minWidth + p0.pressure * (style.maxWidth - style.minWidth)) * (isGlow ? 3 : 1);
      const w1 = (style.minWidth + p1.pressure * (style.maxWidth - style.minWidth)) * (isGlow ? 3 : 1);

      // Color
      const t = segments > 1 ? i / segments : 0;
      let r: number, g: number, b: number, a: number;
      if (isGlow) {
        const gc = parseColor(style.glowColor);
        r = gc.r; g = gc.g; b = gc.b; a = gc.a;
      } else if (style.gradient && style.gradient.length >= 2) {
        const rgb = lerpHexColors(style.gradient, t);
        r = rgb.r; g = rgb.g; b = rgb.b; a = 1;
      } else {
        const rgb = hexToRgb(style.color);
        r = rgb.r / 255; g = rgb.g / 255; b = rgb.b / 255; a = 1;
      }

      // 4 corners of the quad
      const x0a = p0.x + nx * w0 * 0.5, y0a = p0.y + ny * w0 * 0.5;
      const x0b = p0.x - nx * w0 * 0.5, y0b = p0.y - ny * w0 * 0.5;
      const x1a = p1.x + nx * w1 * 0.5, y1a = p1.y + ny * w1 * 0.5;
      const x1b = p1.x - nx * w1 * 0.5, y1b = p1.y - ny * w1 * 0.5;

      // Triangle 1: 0a, 0b, 1a
      data[offset++] = x0a; data[offset++] = y0a; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = a;
      data[offset++] = x0b; data[offset++] = y0b; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = a;
      data[offset++] = x1a; data[offset++] = y1a; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = a;
      // Triangle 2: 1a, 0b, 1b
      data[offset++] = x1a; data[offset++] = y1a; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = a;
      data[offset++] = x0b; data[offset++] = y0b; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = a;
      data[offset++] = x1b; data[offset++] = y1b; data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = a;
    }

    return data;
  }

  // ── 2D overlay for active dots ────────────────────

  private setupOverlay(): void {
    this.overlayCanvas = document.createElement('canvas');
    const w = this.canvas.clientWidth * this.dpr;
    const h = this.canvas.clientHeight * this.dpr;
    this.overlayCanvas.width = w;
    this.overlayCanvas.height = h;
    this.overlayCanvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    this.canvas.parentElement?.appendChild(this.overlayCanvas);
    this.overlayCtx = this.overlayCanvas.getContext('2d');
  }

  private removeOverlay(): void {
    this.overlayCanvas?.remove();
    this.overlayCanvas = null;
    this.overlayCtx = null;
  }

  private renderOverlay(): void {
    const ctx = this.overlayCtx;
    if (!ctx || !this.overlayCanvas) return;

    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (this.activePoints.length === 0) return;

    ctx.save();
    ctx.fillStyle = ACTIVE_DOT_COLOR;
    ctx.shadowColor = ACTIVE_DOT_COLOR;
    ctx.shadowBlur = 8;
    for (const p of this.activePoints) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, ACTIVE_DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private emitEvent(event: GlymoEvent, ...args: unknown[]): void {
    this.eventBus?.emit(event, ...args);
  }
}

// ── Color helpers ───────────────────────────────────

function parseColor(css: string): { r: number; g: number; b: number; a: number } {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) return { r: +m[1]! / 255, g: +m[2]! / 255, b: +m[3]! / 255, a: m[4] !== undefined ? +m[4]! : 1 };
  const rgb = hexToRgb(css);
  return { r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255, a: 1 };
}

function lerpHexColors(gradient: string[], t: number): { r: number; g: number; b: number } {
  const n = gradient.length - 1;
  const seg = Math.min(Math.floor(t * n), n - 1);
  const local = t * n - seg;
  const a = hexToRgb(gradient[seg]!);
  const b = hexToRgb(gradient[seg + 1]!);
  return {
    r: (a.r + (b.r - a.r) * local) / 255,
    g: (a.g + (b.g - a.g) * local) / 255,
    b: (a.b + (b.b - a.b) * local) / 255,
  };
}
