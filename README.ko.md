<p align="center">
  <h1 align="center">@glymo/core</h1>
  <p align="center"><strong>브라우저를 위한 핸드 크리에이티브 툴킷</strong></p>
  <p align="center">핸드 트래킹, 드로잉 파이프라인, 제스처 DSL, ONNX 인식, WebGPU 홀로그램 — 하나의 TypeScript 라이브러리로.</p>
</p>

<p align="center">
  <a href="https://github.com/hohre12/glymo/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@glymo/core"><img src="https://img.shields.io/npm/v/@glymo/core.svg" alt="npm" /></a>
  <a href="./README.md">English</a>
</p>

---

```typescript
import { Glymo } from '@glymo/core';

const glymo = await Glymo.create(canvas, {
  camera: true,
  effect: 'neon',
  handStyle: 'aurora',
});
```

이게 hello-world입니다. 그 외에 들어 있는 내용은 아래에서 이어서.

## 설치

```bash
npm install @glymo/core
```

선택적 peer dependencies — 실제로 쓰는 모듈만 설치하세요:

| 모듈 | Peer dependency | 사용처 |
|------|-----------------|--------|
| 카메라 + 핸드 트래킹 | `@mediapipe/tasks-vision >= 0.10` | `Glymo.create({ camera: true })`, `HandVisualizer` |
| 홀로그램 3D | `three >= 0.160` | `Hologram3DRenderer` |
| ONNX 분류기 | `onnxruntime-web ^1.24` | `@glymo/core/classifier` 서브패스 |
| Tesseract OCR 폴백 | `tesseract.js ^5.0` | 텍스트 모드 폴백 인식기 |

## 무엇이 들어 있나

| 영역 | 핵심 내용 | 상세 문서 |
|------|----------|-----------|
| **6단계 드로잉 파이프라인** | Capture → Stabilize → Pressure → Segment → Smooth → Effect. OneEuroFilter 안정화, 속도 기반 필압 taper, Chaikin 스무딩. | [docs/architecture.md](./docs/architecture.md) |
| **렌더러** | Canvas 2D + WebGPU 자동 폴백, 런타임 확장 가능한 effect registry, fill 도구, 레이어 컴포지터. | [docs/architecture.md](./docs/architecture.md#rendering-modes) |
| **핸드 입력** | MediaPipe 기반 `CameraCapture`, `MouseCapture`, 5가지 아티스틱 핸드 스타일(`neon-skeleton` / `crystal` / `flame` / `aurora` / `particle-cloud`). | [docs/architecture.md](./docs/architecture.md#extension-points) |
| **제스처 DSL** | `GestureEngine` + 6개의 내장 제스처(pinch / fist / point / open-palm / peace-sign / thumbs-up). `(hand) => boolean` 디텍터로 커스텀 가능. | [docs/architecture.md](./docs/architecture.md#extension-points) |
| **텍스트 모드** | `CascadingRecognizer` — 즉시 스트로크별 인식 + 컨텍스트 재인식, anti-cycling 보호. Glyph 추출 + 키네틱 타이포그래피(`KineticEngine`). | [docs/architecture.md](./docs/architecture.md#public-api-surface) |
| **ONNX 분류기** | 별도 `@glymo/core/classifier` 서브패스. 347-class 드로잉 인식기 + TYPE 라우터(text / drawing / symbol). IndexedDB 모델 캐시, 히스테리시스 안정화. | [docs/classifier.md](./docs/classifier.md) |
| **홀로그램 3D + Media Art** | `Hologram3DRenderer`(Three.js + WebGPU) — bloom 효과의 멀티-메시 씬, polymorphic mesh sources(`gltf` / `gltf-pbr` / `procedural-planet`). | [docs/hologram.md](./docs/hologram.md) |
| **스트로크 애니메이션** | `StrokeAnimator` — 23가지 내장 타입(locomotion + modulation + legacy), 채널별 합성 가능. | [docs/animation.md](./docs/animation.md) |
| **세션 round-trip** | `exportSession()` / `loadSession()` — 스트로크, 오브젝트, fill, 애니메이션, 캐릭터, media-art mesh 메타데이터까지 모두. | [docs/session-doc.md](./docs/session-doc.md) |
| **진단** | 옵트인 `DiagBus` — 단계별 시간/드롭 카운트(텍스트 모드 디버깅용). | [docs/architecture.md](./docs/architecture.md#diagnostics) |

## 6단계 파이프라인 한눈에 보기

```
input ──► Capture ──► Stabilize ──► Pressure ──► Segment ──► Smooth ──► Effect ──► canvas
            (포인트별 — 실시간)                  (누적기)    (penUp 시 batch)  (paint 타임)
```

- **Capture**: raw input 포인트를 타입드 `StrokePoint`로 래핑.
- **Stabilize**: OneEuroFilter — 반응성을 유지하면서 떨림 제거. 마우스/카메라 source-aware preset.
- **Pressure**: 속도 → 필압 (느리면 굵게, 빠르면 얇게) + per-stroke taper.
- **Segment**: `penUp()`까지 포인트를 누적. 너무 짧은 스트로크는 드롭.
- **Smooth**: Chaikin's corner cutting (4회 반복).
- **Effect**: glow, gradient, particle, 가변 폭 — 렌더러가 paint 타임에 적용.

## 서브패키지

| 서브패스 | 용도 |
|----------|------|
| `@glymo/core` | 메인 라이브러리 — 위 표의 모든 항목(분류기 제외). |
| `@glymo/core/classifier` | ONNX 인식 (drawing / text / symbol). lazy-load 가능 — ML이 필요 없으면 번들 비용 0. |
| `@glymo/core/classifier/classifier.worker.js` | 클라이언트가 런타임에 spawn하는 worker entry. |

## 내장 effect preset

| Preset | 스타일 |
|--------|--------|
| `calligraphy` | 따뜻한 잉크, 가변 폭 |
| `neon` | 전기 글로우, 강한 bloom |
| `gold` | 메탈릭 반짝임, 따뜻한 파티클 |
| `aurora` | 파스텔 그라데이션 흐름 |
| `fire` | 뜨거운 그라데이션, 솟아오르는 불꽃 |
| `liquid` / `hologram` / `bloom` / `dissolve` / `gpu-particles` | WebGPU 전용 — WebGPU 미지원 시 Canvas 2D로 자동 폴백, `renderer:fallback` 이벤트 emit |

`registerEffect(id, definition)`으로 자체 effect 등록 가능 — [docs/architecture.md#extension-points](./docs/architecture.md#extension-points).

## 브라우저 지원

- Chrome 90+ (권장)
- Edge 90+
- Safari 16.4+
- Firefox 100+

WebGPU 기능(`gpu-particles` preset, `Hologram3DRenderer`)은 Chrome 113+ 또는 Edge 113+ 필요. 미지원 브라우저에서는 `Hologram3DRenderer.ready`가 `false`로 resolve되며 `renderer:fallback` 이벤트를 emit합니다.

## 예제

[`examples/`](./examples) 디렉토리에 동작하는 HTML 데모가 있습니다. 빌드 단계 없이 브라우저에서 바로 열 수 있는 단일 파일입니다.

## 라이선스

[MIT](./LICENSE) © Glymo contributors

## 기여

개발 셋업은 [CONTRIBUTING.md](./CONTRIBUTING.md), 버전 히스토리는 [CHANGELOG.md](./CHANGELOG.md)를 참고하세요.
