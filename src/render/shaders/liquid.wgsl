// Liquid Distortion — sin/cos wave vertex shader displaces stroke points
// Uniforms: time, amplitude, frequency

struct Uniforms {
  time: f32,
  amplitude: f32,
  frequency: f32,
  resolution: vec2<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // Liquid wave displacement
  let wave_x = sin(input.position.y * u.frequency + u.time * 2.0) * u.amplitude;
  let wave_y = cos(input.position.x * u.frequency + u.time * 1.5) * u.amplitude * 0.7;

  let displaced = vec2<f32>(
    input.position.x + wave_x,
    input.position.y + wave_y,
  );

  // Normalize to clip space
  let ndc = (displaced / u.resolution) * 2.0 - 1.0;
  out.position = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
  out.color = input.color;
  out.uv = input.uv;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Subtle color shift based on displacement phase
  let phase = sin(input.uv.x * 6.28 + u.time) * 0.1;
  let col = input.color;
  return vec4<f32>(
    col.r + phase,
    col.g + phase * 0.5,
    col.b - phase * 0.3,
    col.a,
  );
}
