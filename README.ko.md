<p align="center">
  <h1 align="center">@glymo/core</h1>
  <p align="center"><strong>브라우저를 위한 핸드 크리에이티브 툴킷</strong></p>
  <p align="center">핸드 트래킹 + 아티스틱 이펙트 + 제스처 컨트롤 — 하나의 라이브러리로.</p>
</p>

<p align="center">
  <a href="https://github.com/hohre12/glymo/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@glymo/core"><img src="https://img.shields.io/npm/v/@glymo/core.svg" alt="npm" /></a>
  <a href="./README.md">English</a>
</p>

---

웹캠 하나로 크리에이티브 캔버스를 만드세요. `@glymo/core`는 MediaPipe 핸드 트래킹, 6단계 드로잉 파이프라인, 아티스틱 핸드 렌더링, 제스처 DSL을 하나의 TypeScript 라이브러리로 통합합니다.

```typescript
// 한 줄이면 시작
const glymo = await Glymo.create(canvas, {
  camera: true,
  effect: 'neon',
  handStyle: 'aurora',
});
```

## 다른 라이브러리와의 차이

대부분의 핸드 트래킹 라이브러리는 원시 랜드마크만 줍니다. 대부분의 드로잉 라이브러리는 스트로크만 줍니다. **@glymo/core는 둘 다 — 그리고 그 사이의 모든 것을 줍니다.**

| 기능 | Raw MediaPipe | Canvas 라이브러리 | @glymo/core |
|------|:---:|:---:|:---:|
| 핸드 랜드마크 트래킹 | O | — | O |
| 아티스틱 핸드 렌더링 (5종) | — | — | O |
| 제스처 인식 DSL | — | — | O |
| 스무딩 + 필압 파이프라인 | — | 일부 | O |
| 에어 라이팅 → 텍스트 인식 | — | — | O |
| 원라인 카메라 셋업 | — | — | O |

## 설치

```bash
npm install @glymo/core
```

## 핵심 기능

### 1. 제스처 DSL

직관적인 API로 핸드 제스처를 정의하세요. 원시 랜드마크 수학이 필요 없습니다.

```typescript
import { GestureEngine, HandStateImpl } from '@glymo/core';

const engine = new GestureEngine();

// 내장 제스처 (6종 포함)
// pinch, fist, point, open-palm, peace-sign, thumbs-up

// 커스텀 제스처 정의
engine.define('rock-on', (hand) =>
  hand.extended('index', 'pinky') &&
  hand.folded('middle', 'ring')
);

// 이벤트 리스닝
engine.on('gesture:rock-on', () => console.log('Rock on!'));
engine.on('gesture:rock-on:end', () => console.log('Stopped'));
```

**HandStateImpl**은 원시 랜드마크를 체이너블 API로 래핑합니다:

```typescript
const hand = new HandStateImpl(landmarks);

hand.extended('index')              // 검지가 펴져 있는지
hand.folded('middle', 'ring')       // 중지와 약지가 접혀 있는지
hand.pinchDistance()                // 엄지-검지 정규화 거리
hand.score('thumb')                 // 0-1 펴짐 점수
```

2프레임 디바운스로 오탐지를 방지합니다. 커스텀 제스처는 내장 제스처와 동일한 일급 시민입니다.

### 2. Hand as Art — 5가지 아티스틱 스타일

손 스켈레톤을 디버그 오버레이가 아닌 시각적 요소로 바꿉니다.

```typescript
import { Glymo } from '@glymo/core';

const glymo = await Glymo.create(canvas, {
  camera: true,
  handStyle: 'flame', // 'neon-skeleton' | 'crystal' | 'flame' | 'aurora' | 'particle-cloud'
});

// 런타임에 변경 가능
glymo.setHandStyle('aurora');
```

| 스타일 | 시각 효과 |
|--------|-----------|
| `neon-skeleton` | 글로우가 있는 클래식 네온 와이어프레임 |
| `crystal` | 반짝임과 포인트 라이트 플레어가 있는 얼음/유리 조각 |
| `flame` | 손끝에서 솟아오르는 CPU 파티클 불꽃 |
| `aurora` | HSL 시프트 리본 + screen 컴포지팅 |
| `particle-cloud` | 손을 따라다니는 브라운 운동 파티클 무리 |

각 스타일은 `HandStyleBase`를 구현합니다 — 확장해서 커스텀 스타일을 만들 수 있습니다.

### 3. 캐스케이딩 텍스트 인식

빠르게 시작하고 자가 보정하는 2레이어 인식 파이프라인입니다.

```typescript
import { CascadingRecognizer } from '@glymo/core';

const recognizer = new CascadingRecognizer({
  onChar(char) {
    // Net 1: 즉시 스트로크별 인식 (~200ms)
    // confidence: 0.6
    console.log(`인식됨: ${char.char} at (${char.x}, ${char.y})`);
  },
  onCorrection(correction) {
    // Net 2: 전체 컨텍스트 재인식, 매 Net 1 이후 실행
    // confidence: 0.95
    console.log(`보정됨: ${correction.oldChar} → ${correction.newChar}`);
  },
});

// 스트로크 완료 시 피드
glymo.on('stroke:complete', ({ stroke, bbox }) => {
  recognizer.feedStroke(stroke.raw, bbox, devicePixelRatio);
});
```

**동작 원리:**
- **Net 1 (즉시):** 각 스트로크를 독립적으로 인식 → 글자가 즉시 나타남
- **Net 2 (컨텍스트):** 모든 스트로크를 함께 재전송 → 컨텍스트가 정확도 향상 → 불일치 보정
- 삭제 후 보정 루프를 방지하는 안티사이클링 보호
- 일관된 폰트 사이징을 위한 롤링 높이 정규화

### 4. 원라인 카메라 캔버스

`Glymo.create()`가 MediaPipe 로딩, 카메라 권한, 핸드 트래킹, 드로잉 셋업을 모두 처리합니다.

```typescript
const glymo = await Glymo.create(canvas, {
  camera: true,
  effect: 'aurora',
  handStyle: 'crystal',
  twoHands: true,
  alwaysDraw: true,             // 핀치 없이 드로잉 (텍스트 모드)
  instantComplete: true,         // 모프 딜레이 없음
  transparentBg: true,           // 카메라 피드 투과
  onGesture: {
    fist: () => console.log('주먹 감지'),
    'peace-sign': () => glymo.setHandStyle('neon-skeleton'),
  },
  onReady: () => console.log('카메라 활성화'),
  onError: (err) => console.error(err),
});
```

## 6단계 파이프라인

모든 스트로크는 다음 단계를 거칩니다:

```
캡처 → 안정화 → 필압 → 분리 → 스무딩 → 이펙트
```

| 단계 | 하는 일 |
|------|---------|
| **캡처** | 웹캠 핸드 트래킹 (MediaPipe) 또는 마우스/터치 입력 |
| **안정화** | OneEuroFilter로 반응성을 유지하면서 떨림 제거 |
| **필압** | 속도 → 필압 변환 (느림 = 굵은 획, 빠름 = 얇은 획) |
| **분리** | 핀치/펜업 감지로 스트로크 분리 |
| **스무딩** | Chaikin 코너 커팅 (4회 반복) |
| **이펙트** | 글로우, 그라데이션, 파티클, 가변 폭 렌더링 |

## 이펙트 프리셋

| 프리셋 | 스타일 |
|--------|--------|
| `calligraphy` | 따뜻한 잉크, 가변 폭 |
| `neon` | 전기 글로우, 강렬한 블룸 |
| `gold` | 메탈릭 반짝임, 따뜻한 파티클 |
| `aurora` | 파스텔 그라데이션 흐름 |
| `fire` | 뜨거운 그라데이션, 솟아오르는 불꽃 |

## API 레퍼런스

### Glymo

```typescript
const glymo = new Glymo(canvas, { effect: 'neon', maxStrokes: 50 });

glymo.bindCamera()                    // 웹캠 핸드 트래킹 시작
glymo.bindMouse()                     // 마우스/터치 입력 시작
glymo.setHandStyle('flame')           // 핸드 시각화 변경
glymo.gesture('custom', detectorFn)   // 커스텀 제스처 등록
glymo.getGestureEngine()              // GestureEngine 직접 접근
glymo.on('stroke:complete', handler)  // 이벤트 리스닝
glymo.on('gesture:fist', handler)     // 제스처 이벤트 리스닝
glymo.exportPNG()                     // PNG blob으로 내보내기
glymo.clear()                         // 모든 스트로크 지우기
glymo.destroy()                       // 정리
```

### GestureEngine

```typescript
const engine = new GestureEngine();

engine.define(name, detectorFn)       // 제스처 등록
engine.update(landmarks, secondHand?) // 랜드마크 입력 (프레임마다 호출)
engine.on(event, callback)            // 제스처 이벤트 리스닝
```

### HandStateImpl

```typescript
const hand = new HandStateImpl(landmarks);

hand.extended(...fingers)     // 이 손가락들이 펴져 있는가?
hand.folded(...fingers)       // 이 손가락들이 접혀 있는가?
hand.score(finger)            // 0-1 펴짐 점수
hand.pinchDistance()          // 엄지-검지 정규화 거리
hand.landmarks                // 원시 랜드마크 배열 (readonly)
```

### CascadingRecognizer

```typescript
const rec = new CascadingRecognizer(options);

rec.feedStroke(raw, bbox, dpr)  // 완료된 스트로크 입력
rec.removeChar(id)              // 글자 제거 (Net 2 비활성화)
rec.undo()                      // 마지막 글자 제거
rec.clear()                     // 모든 상태 초기화
rec.destroy()                   // 정리
```

## 브라우저 지원

- Chrome 90+ (권장)
- Edge 90+
- Safari 16.4+
- Firefox 100+

WebGPU 기능은 Chrome 113+ 또는 Edge 113+가 필요합니다.

## 라이선스

[MIT](./LICENSE)
