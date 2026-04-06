// GPU Particles — Instanced rendering for 10K+ particles at 60fps
// Uses compute shader for particle physics + instanced vertex rendering

struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  life: f32,
  decay: f32,
  size: f32,
  _pad: f32,
  color: vec4<f32>,
};

struct SimUniforms {
  dt: f32,
  particle_count: u32,
  gravity: vec2<f32>,
};

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;

// Compute shader: update particle positions and lifetimes
@compute @workgroup_size(64)
fn cs_update(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= sim.particle_count) {
    return;
  }

  var p = particles[idx];

  // Skip dead particles
  if (p.life <= 0.0) {
    return;
  }

  // Apply gravity and velocity
  p.velocity = p.velocity + sim.gravity * sim.dt;
  p.position = p.position + p.velocity * sim.dt;
  p.life = p.life - p.decay * sim.dt;

  particles[idx] = p;
}

// ── Render pipeline (instanced quads) ───────────────

struct RenderUniforms {
  resolution: vec2<f32>,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> render: RenderUniforms;
@group(0) @binding(1) var<storage, read> render_particles: array<Particle>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) life: f32,
};

// Instanced quad: 6 vertices per particle (2 triangles)
@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  var out: VertexOutput;
  let p = render_particles[iid];

  // Skip dead particles (degenerate triangle)
  if (p.life <= 0.0) {
    out.position = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    out.color = vec4<f32>(0.0);
    out.life = 0.0;
    return out;
  }

  // Quad corners (triangle strip order: 0,1,2, 2,1,3)
  let corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
  );

  let size = p.size * p.life;
  let world_pos = p.position + corners[vid] * size;

  // Normalize to NDC
  let ndc = (world_pos / render.resolution) * 2.0 - 1.0;
  out.position = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
  out.color = p.color;
  out.life = p.life;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(input.color.rgb, input.color.a * input.life);
}
