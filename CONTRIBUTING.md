# Contributing to @glymo/core

Thank you for your interest in contributing to Glymo! We welcome contributions of all kinds -- bug reports, feature requests, documentation improvements, and code changes.

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/hohre12/glymo-core.git
   cd glymo-core
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development build (watch mode):
   ```bash
   npm run dev
   ```

4. Run tests:
   ```bash
   npm test
   ```

5. Type check:
   ```bash
   npm run typecheck
   ```

6. Run tests with coverage:
   ```bash
   npm run test:coverage
   ```

## Project Structure

The full module map lives in [docs/architecture.md](./docs/architecture.md#module-map) — single source of truth so a directory rename only updates one file. Skim that first if you're new to the codebase.

Per-area deep dives:

- [docs/classifier.md](./docs/classifier.md) — `@glymo/core/classifier` subpath (ONNX inference)
- [docs/hologram.md](./docs/hologram.md) — `Hologram3DRenderer` + Media Art polymorphic sources
- [docs/animation.md](./docs/animation.md) — `StrokeAnimator` vs `MorphAnimator`
- [docs/session-doc.md](./docs/session-doc.md) — `SessionDoc` wire format + persistence

Tests live in `tests/` (Vitest, jsdom env, currently 57 test suites). Add new tests next to whatever module you're touching — naming convention is `<ModuleName>.test.ts`.

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Write or update tests for your changes
3. Ensure all checks pass:
   ```bash
   npm test
   npm run typecheck
   ```
4. Write clear, descriptive commit messages
5. Open a PR with a description of **what** you changed and **why**

### PR Title Convention

Use conventional commit style for PR titles:

- `feat: add new gesture detector`
- `fix: correct pressure calculation on touch devices`
- `docs: update API reference for TextMode`
- `refactor: simplify pipeline stage interface`
- `test: add coverage for WebGPU fallback`

## Code Style

- **TypeScript strict mode** -- all code must pass `tsc --noEmit` with strict checks
- **No `any` types** -- use `unknown` with type guards instead
- **All documentation and comments in English**
- **No `console.log`** in library code (use `EventBus` to emit diagnostics)
- **Pure ESM internally** -- use `.js` extensions in relative imports (TypeScript resolves these)
- **Immutable where possible** -- prefer `readonly` properties and `ReadonlyArray`

## Architecture Guidelines

- The **pipeline** processes strokes through 6 ordered stages. New stages should implement the same stage interface and slot into the chain.
- **Renderers** implement `IRenderer`. If adding a new renderer backend, follow the Canvas2D/WebGPU pattern.
- **Effect presets** are defined in `src/types.ts` (`EFFECT_PRESETS`). Adding a new preset means adding the preset config there and implementing rendering logic in the appropriate renderer.
- **Gestures** use a DSL pattern. Custom gestures are functions of type `(hand: HandState) => boolean`. See `src/gesture/builtins.ts` for examples.
- **Hand styles** implement the `HandStyle` interface. Add new styles in `src/input/hand-styles/`.

## Reporting Issues

- Use [GitHub Issues](https://github.com/hohre12/glymo-core/issues)
- Include:
  - Browser version and OS
  - Steps to reproduce
  - Expected vs. actual behavior
  - Console errors (if any)
- Screenshots or screen recordings are very helpful, especially for visual bugs

## Feature Requests

We use GitHub Issues for feature requests too. Please:

- Search existing issues first to avoid duplicates
- Describe the use case, not just the solution
- Label your issue with `enhancement`

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
