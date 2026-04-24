// ── Public Type Exports ──────────────────────────────

export type {
  EffectPresetName,
  Fill,
  GlymoEvent,
  GlymoEventMap,
  GlymoOptions,
  GIFOptions,
  GlymoObject,
  StrokePoint,
  Point,
  Point3D,
  RGB,
  EffectStyle,
  Particle,
  MatchedPair,
  RenderedPoint,
  MorphFrame,
  RawInputPoint,
  InputCapture,
  PipelineStage,
  BatchPipelineStage,
  RenderLayer,
  Stroke,
  StrokeDoc,
  StrokeDocPoint,
  SessionDoc,
  ObjectDoc,
  FillDoc,
  CharacterDoc,
  AnimationDoc,
  BitmapUploader,
  BitmapLoader,
  CanvasSession,
  SessionState,
} from './types.js';

// `GlymoError` is a class (with a same-named interface via declaration merging),
// so it must be re-exported as a value — not a type.
export { GlymoError } from './types.js';

export { EFFECT_PRESETS } from './types.js';

// ── Runtime Effect Registry ────────────────────────
export {
  registerEffect,
  unregisterEffect,
  getEffect,
  resolveEffect,
  listEffects,
} from './effects/registry.js';
export type { EffectId, EffectDefinition } from './effects/registry.js';

export {
  type GIFExportOptions,
  type ReplayFn,
  GIF_FPS,
  GIF_DURATION_MS,
  GIF_MAX_FRAMES,
  GIF_SIZE_WARN_BYTES,
} from './export/index.js';

export {
  PerformanceMonitor,
  PERF_WINDOW_SIZE,
  PERF_DEGRADED_THRESHOLD_MS,
  PERF_DEGRADED_CONSECUTIVE,
} from './util/PerformanceMonitor.js';

// ── Text Mode Exports ───────────────────────────────

export type {
  TextModeConfig,
  TypographyMode,
  OverlayText,
  RecognizedText,
  RecognizedChar,
  GlyphOutline,
  TextModeResult,
  TextErrorCode,
  PositionedChar,
  LayoutMode,
  LayoutOptions,
} from './text/types.js';

export { DEFAULT_TEXT_MODE_CONFIG, DEFAULT_LAYOUT_OPTIONS } from './text/types.js';

export { TextRecognizer } from './text/TextRecognizer.js';
export { GlyphExtractor } from './text/GlyphExtractor.js';
export { recognizeHandwriting } from './text/HandwritingRecognizer.js';

// ── Spatial Grouping ────────────────────────────────
export { SpatialGrouper, combineBbox, bboxNear } from './grouping/SpatialGrouper.js';
export type { Bbox, GroupedStroke, SpatialGroup, SpatialGrouperOptions } from './grouping/SpatialGrouper.js';

// ── Cascading Recognition ────────────────────────────

export type {
  RecognizedChar as CascadingChar,
  CharCorrection,
  CascadingRecognizerOptions,
  CaseMode,
} from './text/CascadingRecognizer.js';
export { CascadingRecognizer } from './text/CascadingRecognizer.js';

// ── Layout + Kinetic Typography Exports ─────────────

export {
  layoutTextAlongCurve,
  layoutTextInCircle,
  layoutTextInShape,
} from './text/PretextLayout.js';

export { KineticEngine } from './text/KineticEngine.js';

// ── Input / Camera Exports ─────────────────────────

export { HandVisualizer, HAND_CONNECTIONS } from './input/HandVisualizer.js';
export type { Landmark, HandLandmarkerResult } from './input/CameraCapture.js';
export {
  PINCH_THRESHOLD,
  computePinchDistance,
  computeSpeed,
  zToPressure,
} from './input/CameraCapture.js';

// ── Hand Styles ────────────────────────────────────

export type { HandStyleName, HandStyleConfig } from './input/hand-styles/types.js';
export { HandStyleBase } from './input/hand-styles/types.js';
export { createHandStyle } from './input/hand-styles/index.js';

// ── Gesture DSL ────────────────────────────────────

export type {
  FingerName,
  BuiltInGesture,
  HandState,
  GestureDetectorFn,
  GestureEvent,
  GestureCallback,
} from './gesture/types.js';
export { HandStateImpl } from './gesture/HandStateImpl.js';
export { HandStatePool, DEFAULT_HAND_STATE_POOL_CAP } from './gesture/HandStatePool.js';
export type { HandStatePoolOptions } from './gesture/HandStatePool.js';
export { GestureEngine } from './gesture/GestureEngine.js';
export { BUILTIN_GESTURES } from './gesture/builtins.js';
export {
  LANDMARK_COUNT,
  FINGER_FOLD_THRESHOLD,
  FINGER_EXTEND_THRESHOLD,
  GESTURE_ACTIVATE_FRAMES,
  GESTURE_DEACTIVATE_FRAMES,
} from './gesture/constants.js';

// ── Stroke Animation ────────────────────────────────

export type {
  AnimationType,
  AnimationParams,
  StrokeAnimation,
  AnimationTransform,
} from './animation/index.js';

export { StrokeAnimator } from './animation/index.js';

// ── CreateOptions (Glymo.create) ───────────────────

export type { CreateOptions } from './types.js';

// ── Object Store ──────────────────────────────────
export { ObjectStore } from './store/ObjectStore.js';

// ── Selection ──────────────────────────────────────
export { SelectionManager } from './selection/SelectionManager.js';

// ── Stroke Correction ──────────────────────────────
export { StrokeCorrector, snapEndpoints, trimOvershoot } from './correction/index.js';
export type { CorrectionOptions, CorrectionMetadata, SnapResult, TrimResult } from './types.js';

// ── Fill Tool ──────────────────────────────────────
export { executeFill } from './render/FloodFill.js';

// ── Hologram 3D ──────────────────────────────────────

export { Hologram3DRenderer } from './hologram/index.js';
export type {
  HologramChar,
  Hologram3DRendererOptions,
  HitTestResult,
  HologramGestureState,
  // ── Media Art (v0.8.0 polymorphic source pack) ──
  MeshSource,
  MeshSourceCache,
  MeshSourceDescriptor,
  MeshSourceLoadContext,
  BaseMeshSourceDescriptor,
  GltfMeshSourceDescriptor,
  GltfPbrMeshSourceDescriptor,
  ProceduralPlanetMeshSourceDescriptor,
  MediaArtMeshState,
  MeshHandle,
} from './hologram/index.js';
export {
  BaseMeshSource,
  GltfMeshSource,
  GlbPbrMeshSource,
  ProceduralPlanetMeshSource,
  createMeshSource,
  setLoaderDecoderPaths,
  getKtx2Loader,
  getDracoLoader,
  createMediaArtShaderNodes,
  applyMediaArtShaderTreatment,
  applyTexturedMediaArtShaderTreatment,
  MEDIA_ART_LUMINANCE_STOPS,
  // v0.13.0 — shared rendering defaults + neutral environment/rig helpers
  BUNDLED_NEUTRAL_ENVIRONMENT,
  DEFAULT_ATMOSPHERE_COLOR_HEX,
  DEFAULT_AXIAL_TILT_DEG,
  DEFAULT_ENVIRONMENT_INTENSITY,
  DEFAULT_FILL_LIGHT_POSITION,
  DEFAULT_KEY_LIGHT_POSITION,
  DEFAULT_LIGHT_RIG_INTENSITY,
  DEFAULT_ROTATION_BODY,
  DEFAULT_ROTATION_CLOUDS,
  VARIANT_DEFAULTS,
  getVariantDefaults,
  createNeutralEnvironmentTexture,
  createNeutralLightRig,
} from './hologram/index.js';
export type {
  BaseMeshSourceOptions,
  FetchLike,
  FetchProgressCallback,
  MediaArtShaderNodes,
  MediaArtTreatmentResult,
  // v0.13.0 types
  BundledNeutralEnvironment,
  LightPosition,
  LightRigIntensity,
  GltfVariantDefaults,
  GltfPbrVariantDefaults,
  ProceduralPlanetVariantDefaults,
  VariantDefaults,
  VariantKey,
  NeutralLightRig,
  NeutralLightRigConfig,
} from './hologram/index.js';

export { HologramGesture } from './gesture/HologramGesture.js';
export type { LandmarkPoint } from './gesture/HologramGesture.js';

// ── Diagnostics ──────────────────────────────────────

export { DiagBus } from './diag/DiagBus.js';
export type { DiagEvent, DiagStage, DiagListener } from './diag/DiagBus.js';

// ── Render-clock scheduler (Phase 1 of rendering-pipeline-v2) ──────────
//
// Single `requestAnimationFrame` consumer with a 6-phase lifecycle. All
// `@glymo/core` subsystems that used to own their own rAF subscribe here
// instead; `@glymo/ui` consumes via `Glymo.getScheduler()` in Phase 5.
// `PostTaskBridge` is a feature-detected alternative for background work
// that yields rather than competing with render frames.

export { RafScheduler, SCHEDULER_PHASE_ORDER } from './scheduler/RafScheduler.js';
export type {
  SchedulerPhase,
  SchedulerCallback,
  SchedulerUnsubscribe,
} from './scheduler/RafScheduler.js';
export { PostTaskBridge, isPostTaskSupported } from './scheduler/PostTaskBridge.js';
export type { PostTaskPriority, PostTaskOptions } from './scheduler/PostTaskBridge.js';

// ── Main Class ──────────────────────────────────────

export { Glymo } from './Glymo.js';
