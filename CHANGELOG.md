# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-04-07

### Added
- 6-stage drawing pipeline (Capture → Stabilize → Pressure → Segment → Smooth → Effect)
- 5 Canvas 2D effect presets (`neon`, `aurora`, `gold`, `calligraphy`, `fire`)
- 5 WebGPU effect presets (`liquid`, `hologram`, `bloom`, `gpu-particles`, `dissolve`)
- Mouse and touch input via PointerEvent API (`MouseCapture`)
- Camera hand tracking via MediaPipe HandLandmarker (`CameraCapture`)
- Gesture recognition DSL with 6 built-in gestures (`pinch`, `fist`, `point`, `open-palm`, `peace-sign`, `thumbs-up`)
- 5 artistic hand rendering styles (`NeonSkeleton`, `Aurora`, `Crystal`, `Flame`, `ParticleCloud`)
- Two-hand simultaneous drawing support
- Always-draw mode (point to draw, fist to pause)
- Text recognition via Google Input Tools handwriting API (`HandwritingRecognizer`)
- Cascading text recognition with fallback strategies (`CascadingRecognizer`)
- Glyph extraction and caching (`GlyphExtractor`, `GlyphCache`)
- Font morphing animation with point matching (`FontMorphAnimator`, `PointMatcher`)
- Kinetic typography engine (`KineticEngine`)
- Text pipeline controller for end-to-end text mode
- Pretext-based text layout integration (`PretextLayout`)
- `MorphAnimator` with easeOutElastic easing
- PNG and GIF export (`PNGExporter`, `GIFExporter`)
- Canvas 2D renderer with automatic effect application
- WebGPU renderer with compute shader particle system
- Automatic renderer fallback (WebGPU → Canvas 2D)
- `ParticleSystem` for GPU-accelerated visual effects
- `StrokeRenderer` for raw input visualization
- `OneEuroFilter` for pointer stabilization
- `EventBus` with typed event payloads
- `SessionStateMachine` for lifecycle management (idle → ready → drawing → morphing → ...)
- `PerformanceMonitor` for frame timing and degradation detection
- Math utilities (Catmull-Rom interpolation, distance calculations)
- `Glymo` facade class with `create()` convenience factory
- TypeScript strict mode with full type coverage
- ESM and CJS dual output via Vite build
- Vitest test suite with 32 test files

### Fixed
- Use dynamic language parameter in Google Handwriting API URL

### Changed
- Added `package-lock.json` to `.gitignore`

## [0.1.0] - 2026-04-07

### Added
- Initial project scaffolding and repository setup

[0.2.0]: https://github.com/hohre12/glymo-core/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hohre12/glymo-core/releases/tag/v0.1.0
