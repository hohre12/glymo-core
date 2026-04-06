<p align="center">
  <h1 align="center">@glymo/core</h1>
  <p align="center"><strong>Hand-powered creative toolkit for the browser</strong></p>
  <p align="center">Hand tracking + artistic effects + gesture control — in one library.</p>
</p>

<p align="center">
  <a href="https://github.com/hohre12/glymo/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@glymo/core"><img src="https://img.shields.io/npm/v/@glymo/core.svg" alt="npm" /></a>
  <a href="./README.ko.md">한국어</a>
</p>

---

Turn any webcam into a creative canvas. `@glymo/core` combines MediaPipe hand tracking, a 6-stage drawing pipeline, artistic hand rendering, and a gesture DSL into a single TypeScript library.

```typescript
// One line to start
const glymo = await Glymo.create(canvas, {
  camera: true,
  effect: 'neon',
  handStyle: 'aurora',
});
```

## What makes this different

Most hand-tracking libraries give you raw landmarks. Most drawing libraries give you strokes. **@glymo/core gives you both — plus everything in between.**

| Feature | Raw MediaPipe | Canvas libs | @glymo/core |
|---------|:---:|:---:|:---:|
| Hand landmark tracking | Yes | — | Yes |
| Artistic hand rendering (5 styles) | — | — | Yes |
| Gesture detection DSL | — | — | Yes |
| Smoothing + pressure pipeline | — | Some | Yes |
| Air-writing → text recognition | — | — | Yes |
| One-line camera setup | — | — | Yes |

## Install

```bash
npm install @glymo/core
```

## Core Features

### 1. Gesture DSL

Define hand gestures with a fluent, readable API. No raw landmark math.

```typescript
import { GestureEngine, HandStateImpl } from '@glymo/core';

const engine = new GestureEngine();

// Built-in gestures (6 included)
// pinch, fist, point, open-palm, peace-sign, thumbs-up

// Define your own
engine.define('rock-on', (hand) =>
  hand.extended('index', 'pinky') &&
  hand.folded('middle', 'ring')
);

// Listen
engine.on('gesture:rock-on', () => console.log('Rock on!'));
engine.on('gesture:rock-on:end', () => console.log('Stopped'));
```

**HandStateImpl** wraps raw landmarks into a chainable API:

```typescript
const hand = new HandStateImpl(landmarks);

hand.extended('index')              // true if index finger is extended
hand.folded('middle', 'ring')       // true if both are folded
hand.pinchDistance()                 // normalized distance between thumb and index
hand.score('thumb')                 // 0-1 extension score
```

2-frame debounce prevents false triggers. Custom gestures are first-class citizens alongside built-ins.

### 2. Hand as Art — 5 Artistic Styles

Turn the hand skeleton into a visual element, not just a debug overlay.

```typescript
import { Glymo } from '@glymo/core';

const glymo = await Glymo.create(canvas, {
  camera: true,
  handStyle: 'flame', // 'neon-skeleton' | 'crystal' | 'flame' | 'aurora' | 'particle-cloud'
});

// Change at runtime
glymo.setHandStyle('aurora');
```

| Style | Visual |
|-------|--------|
| `neon-skeleton` | Classic neon wireframe with glow |
| `crystal` | Ice/glass shards with shimmer and point-light flares |
| `flame` | CPU particle fire rising from fingertips |
| `aurora` | HSL-shifting ribbons with screen compositing |
| `particle-cloud` | Brownian-motion particle swarm following the hand |

Each style implements `HandStyleBase` — extend it to create your own.

### 3. Cascading Text Recognition

Two-layer recognition pipeline that starts fast and self-corrects.

```typescript
import { CascadingRecognizer } from '@glymo/core';

const recognizer = new CascadingRecognizer({
  onChar(char) {
    // Net 1: instant per-stroke recognition (~200ms)
    // confidence: 0.6
    console.log(`Recognized: ${char.char} at (${char.x}, ${char.y})`);
  },
  onCorrection(correction) {
    // Net 2: full-context re-recognition, fires after each Net 1
    // confidence: 0.95
    console.log(`Corrected: ${correction.oldChar} → ${correction.newChar}`);
  },
});

// Feed strokes as they complete
glymo.on('stroke:complete', ({ stroke, bbox }) => {
  recognizer.feedStroke(stroke.raw, bbox, devicePixelRatio);
});
```

**How it works:**
- **Net 1 (instant):** Each stroke recognized independently → character appears immediately
- **Net 2 (context):** All strokes re-sent together → context improves accuracy → mismatches corrected
- Anti-cycling protection prevents correction loops after deletions
- Rolling height normalization for consistent font sizing

### 4. One-Line Camera Canvas

`Glymo.create()` handles MediaPipe loading, camera permissions, hand tracking, and drawing setup.

```typescript
const glymo = await Glymo.create(canvas, {
  camera: true,
  effect: 'aurora',
  handStyle: 'crystal',
  twoHands: true,
  alwaysDraw: true,             // draw without pinch (text mode)
  instantComplete: true,         // no morph delay
  transparentBg: true,           // camera feed shows through
  onGesture: {
    fist: () => console.log('Fist detected'),
    'peace-sign': () => glymo.setHandStyle('neon-skeleton'),
  },
  onReady: () => console.log('Camera active'),
  onError: (err) => console.error(err),
});
```

## 6-Stage Pipeline

Every stroke flows through:

```
Capture → Stabilize → Pressure → Segment → Smooth → Effect
```

| Stage | What It Does |
|-------|-------------|
| **Capture** | Webcam hand tracking (MediaPipe) or mouse/touch input |
| **Stabilize** | OneEuroFilter removes jitter while preserving responsiveness |
| **Pressure** | Velocity → pressure conversion (slow = thick, fast = thin) |
| **Segment** | Stroke separation via pinch/pen-up detection |
| **Smooth** | Chaikin's corner cutting (4 iterations) |
| **Effect** | Glow, gradient, particles, variable-width rendering |

## Effect Presets

| Preset | Style |
|--------|-------|
| `calligraphy` | Warm ink, variable width |
| `neon` | Electric glow, intense bloom |
| `gold` | Metallic shimmer, warm particles |
| `aurora` | Pastel gradient flow |
| `fire` | Hot gradient, rising sparks |

## API Reference

### Glymo

```typescript
const glymo = new Glymo(canvas, { effect: 'neon', maxStrokes: 50 });

glymo.bindCamera()                    // Start webcam hand tracking
glymo.bindMouse()                     // Start mouse/touch input
glymo.setHandStyle('flame')           // Change hand visualization
glymo.gesture('custom', detectorFn)   // Register custom gesture
glymo.getGestureEngine()              // Direct GestureEngine access
glymo.on('stroke:complete', handler)  // Listen to events
glymo.on('gesture:fist', handler)     // Listen to gesture events
glymo.exportPNG()                     // Export as PNG blob
glymo.clear()                         // Clear all strokes
glymo.destroy()                       // Cleanup
```

### GestureEngine

```typescript
const engine = new GestureEngine();

engine.define(name, detectorFn)       // Register gesture
engine.update(landmarks, secondHand?) // Feed landmarks (called per frame)
engine.on(event, callback)            // Listen to gesture events
```

### HandStateImpl

```typescript
const hand = new HandStateImpl(landmarks);

hand.extended(...fingers)     // Are these fingers extended?
hand.folded(...fingers)       // Are these fingers folded?
hand.score(finger)            // 0-1 extension score
hand.pinchDistance()          // Thumb-index normalized distance
hand.landmarks                // Raw landmark array (readonly)
```

### CascadingRecognizer

```typescript
const rec = new CascadingRecognizer(options);

rec.feedStroke(raw, bbox, dpr)  // Feed completed stroke
rec.removeChar(id)              // Remove character (disables Net 2)
rec.undo()                      // Remove last character
rec.clear()                     // Reset all state
rec.destroy()                   // Cleanup
```

## Browser Support

- Chrome 90+ (recommended)
- Edge 90+
- Safari 16.4+
- Firefox 100+

WebGPU features require Chrome 113+ or Edge 113+.

## License

[MIT](./LICENSE)
