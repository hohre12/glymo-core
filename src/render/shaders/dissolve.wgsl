// Dissolve/Reconstruct — Noise texture threshold animation
// Characters decompose into sand/dust then reconstruct

struct Uniforms {
  time: f32,
  progress: f32,     // 0.0 = fully visible, 1.0 = fully dissolved
  noise_scale: f32,  // Noise texture sampling scale
  resolution: vec2<f32>,
  edge_width: f32,   // Width of the dissolve edge glow
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var src_texture: texture_2d<f32>;
@group(0) @binding(2) var src_sampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Fullscreen triangle
@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> VertexOutput {
  var out: VertexOutput;
  let x = f32(i32(idx & 1u)) * 4.0 - 1.0;
  let y = f32(i32(idx >> 1u)) * 4.0 - 1.0;
  out.position = vec4<f32>(x, y, 0.0, 1.0);
  out.uv = vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5);
  return out;
}

// Simple hash-based noise (no texture dependency)
fn hash(p: vec2<f32>) -> f32 {
  let k = vec2<f32>(0.3183099, 0.3678794);
  let q = p * k + k.yx;
  return fract(16.0 * k.x * fract(q.x * q.y * (q.x + q.y)));
}

// Value noise with smooth interpolation
fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u_smooth = f * f * (3.0 - 2.0 * f);

  let a = hash(i + vec2<f32>(0.0, 0.0));
  let b = hash(i + vec2<f32>(1.0, 0.0));
  let c = hash(i + vec2<f32>(0.0, 1.0));
  let d = hash(i + vec2<f32>(1.0, 1.0));

  return mix(mix(a, b, u_smooth.x), mix(c, d, u_smooth.x), u_smooth.y);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let color = textureSample(src_texture, src_sampler, input.uv);

  // Generate noise value at this pixel
  let noise_uv = input.uv * u.noise_scale;
  let n = noise(noise_uv + vec2<f32>(u.time * 0.1, u.time * 0.05));

  // Dissolve threshold comparison
  let dissolve_edge = smoothstep(
    u.progress - u.edge_width,
    u.progress,
    n,
  );

  // Edge glow — bright orange/white at the dissolve frontier
  let edge_factor = smoothstep(u.progress - u.edge_width, u.progress, n)
                  - smoothstep(u.progress, u.progress + u.edge_width * 0.5, n);
  let edge_color = vec4<f32>(1.0, 0.6, 0.2, 1.0) * edge_factor * 3.0;

  // Combine: dissolve + edge glow
  let final_alpha = color.a * dissolve_edge;
  let final_color = color.rgb + edge_color.rgb;

  return vec4<f32>(final_color, final_alpha);
}
