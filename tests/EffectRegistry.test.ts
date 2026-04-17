import {
  registerEffect,
  unregisterEffect,
  getEffect,
  listEffects,
  resolveEffect,
  type EffectDefinition,
} from '../src/effects/registry.js';
import { EFFECT_PRESETS } from '../src/types.js';
import { ParticleSystem } from '../src/render/ParticleSystem.js';
import type { Stroke } from '../src/types.js';

const sampleDefinition: EffectDefinition = {
  color: '#123456',
  minWidth: 2,
  maxWidth: 8,
  glowColor: 'rgba(18,52,86,0.5)',
  glowSize: 30,
  particleColor: 'rgba(18,52,86,0.4)',
  gradient: ['#123456', '#abcdef'],
};

// ── Initial seed ──────────────────────────────────────

describe('EffectRegistry — initial seed', () => {
  it('exposes every EFFECT_PRESETS entry after module load', () => {
    const seeded = listEffects();
    for (const id of Object.keys(EFFECT_PRESETS)) {
      expect(seeded).toContain(id);
    }
  });

  it('returns the same definition object as EFFECT_PRESETS for seeded ids', () => {
    expect(getEffect('neon')).toBe(EFFECT_PRESETS.neon);
    expect(getEffect('calligraphy')).toBe(EFFECT_PRESETS.calligraphy);
  });

  it('returns undefined for unknown ids', () => {
    expect(getEffect('does-not-exist')).toBeUndefined();
  });
});

// ── Register / get ────────────────────────────────────

describe('EffectRegistry — registerEffect', () => {
  const id = 'test:register-then-get';

  afterEach(() => {
    unregisterEffect(id);
  });

  it('inserts a new definition that getEffect can retrieve', () => {
    registerEffect(id, sampleDefinition);
    expect(getEffect(id)).toBe(sampleDefinition);
    expect(listEffects()).toContain(id);
  });

  it('logs a warning and does not overwrite on duplicate id', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const first: EffectDefinition = { ...sampleDefinition, color: '#111111' };
    const second: EffectDefinition = { ...sampleDefinition, color: '#222222' };

    registerEffect(id, first);
    registerEffect(id, second);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(id);
    // First wins — duplicate registration does NOT clobber.
    expect(getEffect(id)?.color).toBe('#111111');

    warnSpy.mockRestore();
  });

  it('throws when definition does not match the EffectDefinition shape', () => {
    const malformed = { color: '#fff' } as unknown as EffectDefinition;
    expect(() => registerEffect('test:malformed', malformed)).toThrow(TypeError);
    expect(getEffect('test:malformed')).toBeUndefined();
  });
});

// ── resolveEffect ─────────────────────────────────────

describe('EffectRegistry — resolveEffect', () => {
  const id = 'test:resolve-registered';

  afterEach(() => {
    unregisterEffect(id);
  });

  it('returns the registered definition when the id exists', () => {
    registerEffect(id, sampleDefinition);
    expect(resolveEffect(id)).toBe(sampleDefinition);
  });

  it('falls back to neon when the id is unknown', () => {
    expect(resolveEffect('test:unknown-resolve')).toBe(EFFECT_PRESETS.neon);
  });

  it('seeded presets resolve to their EFFECT_PRESETS entry', () => {
    expect(resolveEffect('liquid')).toBe(EFFECT_PRESETS.liquid);
  });
});

// ── Renderer integration ──────────────────────────────

describe('EffectRegistry — renderer integration', () => {
  const id = 'test:renderer-integration';

  afterEach(() => {
    unregisterEffect(id);
  });

  it('ParticleSystem consumes a runtime-registered effect via resolveEffect', () => {
    const sentinelColor = '#feedfa';
    registerEffect(id, { ...sampleDefinition, particleColor: sentinelColor });

    const system = new ParticleSystem();
    const stroke: Pick<Stroke, 'raw' | 'smoothed' | 'effect'> = {
      raw: [{ x: 10, y: 10, pressure: 1, timestamp: 0, speed: 0 }],
      smoothed: [{ x: 10, y: 10, pressure: 1, timestamp: 0, speed: 0 }],
      effect: id as Stroke['effect'],
    };

    system.spawnBurstForMorph(stroke);

    const particles = (system as unknown as { particles: Array<{ color: string }> }).particles;
    expect(particles.length).toBeGreaterThan(0);
    expect(particles[0]!.color).toBe(sentinelColor);
  });
});

// ── Unregister ────────────────────────────────────────

describe('EffectRegistry — unregisterEffect', () => {
  it('returns true when removing an existing id, then getEffect is undefined', () => {
    const id = 'test:unregister-lifecycle';
    registerEffect(id, sampleDefinition);
    expect(getEffect(id)).toBeDefined();

    expect(unregisterEffect(id)).toBe(true);
    expect(getEffect(id)).toBeUndefined();
    expect(listEffects()).not.toContain(id);
  });

  it('returns false when removing an unknown id', () => {
    expect(unregisterEffect('test:never-registered')).toBe(false);
  });
});
