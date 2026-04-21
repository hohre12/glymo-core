import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Pick up legacy `tests/**` flat layout AND co-located classifier tests
    // under `src/classifier/__tests__/` (mirrors the layout shipped from
    // glymo-landing for easier history tracking — see
    // docs/plans/drawing-classifier-migration.md §7.1).
    include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    // The one-time golden generator must NEVER run as part of `npm test` —
    // it overwrites the committed pixel-exact goldens used by the parity
    // regression. Run it manually only when intentionally re-baselining.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/__generate-goldens__*',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
