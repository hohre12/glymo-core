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

```
src/
├── Glymo.ts              # Main class (Facade)
├── types.ts               # Core type definitions
├── index.ts               # Public API exports
├── pipeline/              # 6-stage processing pipeline
│   └── stages/            #   Capture, Stabilize, Pressure, Segment, Smooth
├── render/                # Canvas 2D & WebGPU renderers
│   ├── CanvasRenderer.ts  #   Canvas 2D with effect presets
│   ├── WebGPURenderer.ts  #   WebGPU compute shader renderer
│   ├── ParticleSystem.ts  #   GPU particle effects
│   └── StrokeRenderer.ts  #   Raw input visualization
├── input/                 # Input sources
│   ├── MouseCapture.ts    #   Mouse/touch via PointerEvent
│   ├── CameraCapture.ts   #   Hand tracking via MediaPipe
│   ├── HandVisualizer.ts  #   Artistic hand rendering
│   └── hand-styles/       #   5 hand rendering styles
├── gesture/               # Gesture recognition DSL
├── filter/                # OneEuroFilter (pointer stabilization)
├── state/                 # EventBus, SessionStateMachine
├── animate/               # MorphAnimator
├── text/                  # Text recognition & typography
│   ├── HandwritingRecognizer.ts   # Google Input Tools API
│   ├── CascadingRecognizer.ts     # Multi-strategy fallback
│   ├── GlyphExtractor.ts         # Glyph path extraction
│   ├── GlyphCache.ts             # Extracted glyph caching
│   ├── FontMorphAnimator.ts      # Stroke-to-font morphing
│   ├── KineticEngine.ts          # Kinetic typography
│   └── PretextLayout.ts          # Text layout integration
├── export/                # PNG, GIF exporters
└── util/                  # Math utilities, PerformanceMonitor

tests/                     # Vitest test files (32 test suites)
```

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
