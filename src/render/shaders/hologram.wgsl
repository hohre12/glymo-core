// Hologram — RGB channel separation + scanline overlay + glitch
// Post-processing fragment shader

struct Uniforms {
  time: f32,
  resolution: vec2<f32>,
  separation: f32,    // RGB channel offset in pixels
  scanline_gap: f32,  // Scanline spacing in pixels
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var src_texture: texture_2d<f32>;
@group(0) @binding(2) var src_sampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Fullscreen triangle vertex shader
@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> VertexOutput {
  var out: VertexOutput;
  // Fullscreen triangle covering NDC [-1,1]
  let x = f32(i32(idx & 1u)) * 4.0 - 1.0;
  let y = f32(i32(idx >> 1u)) * 4.0 - 1.0;
  out.position = vec4<f32>(x, y, 0.0, 1.0);
  out.uv = vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let offset = u.separation / u.resolution.x;

  // RGB channel separation (chromatic aberration)
  let r = textureSample(src_texture, src_sampler, uv + vec2<f32>(offset, 0.0)).r;
  let g = textureSample(src_texture, src_sampler, uv).g;
  let b = textureSample(src_texture, src_sampler, uv - vec2<f32>(offset, 0.0)).b;
  let a = textureSample(src_texture, src_sampler, uv).a;

  var color = vec4<f32>(r, g, b, a);

  // Scanline overlay
  let pixel_y = input.position.y;
  let scanline = step(0.5, fract(pixel_y / u.scanline_gap));
  color = color * (0.85 + 0.15 * scanline);

  // Subtle glitch — horizontal jitter every few seconds
  let glitch_phase = step(0.95, fract(u.time * 0.3));
  let jitter = sin(pixel_y * 50.0 + u.time * 100.0) * glitch_phase * 0.005;
  let glitch_uv = uv + vec2<f32>(jitter, 0.0);
  let glitch_sample = textureSample(src_texture, src_sampler, glitch_uv);
  color = mix(color, glitch_sample, glitch_phase * 0.3);

  return color;
}
