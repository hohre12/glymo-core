// Locale-aware translations for classifier output labels.
//
// The ONNX classifiers emit English / symbolic labels (see ./categories.ts).
// UI surfaces (e.g. AIGuessDisplay) must display them in the user's locale.
// Keep this file as the single source of truth for label localization so that
// adding a new locale or a new category is a one-place change.
//
// Shape:
//   LABEL_TRANSLATIONS[englishLabel][locale] -> localized string
//
// All entries omit the default locale ('en'): translateLabel() returns the
// raw English label as the graceful fallback when:
//   - locale === 'en', OR
//   - the label is missing from the map, OR
//   - the locale is missing for that label.
//
// The NonDefaultLocale type below guarantees at compile time that every new
// Locale (except the default) appears in each entry — add a locale to the
// `ClassifierLocale` union and TypeScript will flag every row of this table.
//
// GENERATED FILE — do not edit by hand.
// Source: glymo-server/app/ml/drawing_metadata.py (drawing) + static text /
// symbol tables embedded in glymo-server/ml/scripts/generate_landing_translations.py.
// Regenerate with: python -m ml.scripts.generate_landing_translations --write
import {
  DRAWING_CATEGORIES,
  TEXT_CATEGORIES,
  SYMBOL_CATEGORIES,
} from './categories.js';

// Locales the classifier ships translations for. The default locale ('en')
// returns the raw English label as a graceful fallback. Add a new locale
// here and TypeScript will flag every entry of `LABEL_TRANSLATIONS` that is
// missing the new key.
//
// Defined locally inside the classifier subpath (rather than importing from
// the consumer app) so `@glymo/core/classifier` has zero dependency on a
// host-app i18n module. Consumer apps with a stricter Locale union (e.g.
// `'en' | 'ko'`) can pass any value assignable to `ClassifierLocale`
// without further type plumbing.
export type ClassifierLocale = 'en' | 'ko';

/** Default locale — returns the raw English label as fallback. */
export const DEFAULT_CLASSIFIER_LOCALE: ClassifierLocale = 'en';

// All locales that need an explicit translation (i.e. every locale except
// the default English locale, which uses the raw label).
export type NonDefaultLocale = Exclude<ClassifierLocale, typeof DEFAULT_CLASSIFIER_LOCALE>;

// Every English label the classifier can emit, unified into a single list
// so other consumers (tests, logging, debug panels) can iterate.
export const ALL_CLASSIFIER_LABELS = [
  ...DRAWING_CATEGORIES,
  ...TEXT_CATEGORIES,
  ...SYMBOL_CATEGORIES,
] as const;

export type ClassifierLabel = (typeof ALL_CLASSIFIER_LABELS)[number];

// Per-label, per-locale translations. Each label must provide a string for
// every non-default locale. Missing a locale on a known label is a type error.
type TranslationRow = Record<NonDefaultLocale, string>;

// Build the map. Keys are the raw English / symbolic labels emitted by the
// ONNX models — they must match categories.ts byte-for-byte.
export const LABEL_TRANSLATIONS: Record<ClassifierLabel, TranslationRow> = {
  // ── Drawing classifier (347 classes) — generated from drawing_metadata.py
  'aircraft carrier': { ko: '항공모함' },
  airplane: { ko: '비행기' },
  'alarm clock': { ko: '자명종' },
  ambulance: { ko: '구급차' },
  angel: { ko: '천사' },
  'animal migration': { ko: '동물 이동' },
  ant: { ko: '개미' },
  anvil: { ko: '모루' },
  apple: { ko: '사과' },
  arm: { ko: '팔' },
  asparagus: { ko: '아스파라거스' },
  axe: { ko: '도끼' },
  backpack: { ko: '배낭' },
  banana: { ko: '바나나' },
  bandage: { ko: '반창고' },
  barn: { ko: '헛간' },
  baseball: { ko: '야구공' },
  'baseball bat': { ko: '야구방망이' },
  basket: { ko: '바구니' },
  basketball: { ko: '농구공' },
  bat: { ko: '박쥐' },
  bathtub: { ko: '욕조' },
  beach: { ko: '해변' },
  bear: { ko: '곰' },
  beard: { ko: '수염' },
  bed: { ko: '침대' },
  bee: { ko: '벌' },
  belt: { ko: '벨트' },
  bench: { ko: '벤치' },
  bicycle: { ko: '자전거' },
  binoculars: { ko: '쌍안경' },
  bird: { ko: '새' },
  'birthday cake': { ko: '생일 케이크' },
  blackberry: { ko: '블랙베리' },
  blueberry: { ko: '블루베리' },
  book: { ko: '책' },
  boomerang: { ko: '부메랑' },
  bottlecap: { ko: '병뚜껑' },
  bowtie: { ko: '나비넥타이' },
  bracelet: { ko: '팔찌' },
  brain: { ko: '뇌' },
  bread: { ko: '빵' },
  bridge: { ko: '다리' },
  broccoli: { ko: '브로콜리' },
  broom: { ko: '빗자루' },
  bucket: { ko: '양동이' },
  bulldozer: { ko: '불도저' },
  bus: { ko: '버스' },
  bush: { ko: '덤불' },
  butterfly: { ko: '나비' },
  cactus: { ko: '선인장' },
  cake: { ko: '케이크' },
  calculator: { ko: '계산기' },
  calendar: { ko: '달력' },
  camel: { ko: '낙타' },
  camera: { ko: '카메라' },
  camouflage: { ko: '위장무늬' },
  campfire: { ko: '캠프파이어' },
  candle: { ko: '양초' },
  cannon: { ko: '대포' },
  canoe: { ko: '카누' },
  car: { ko: '자동차' },
  carrot: { ko: '당근' },
  castle: { ko: '성' },
  cat: { ko: '고양이' },
  'ceiling fan': { ko: '천장 선풍기' },
  cello: { ko: '첼로' },
  'cell phone': { ko: '휴대폰' },
  chair: { ko: '의자' },
  chandelier: { ko: '샹들리에' },
  church: { ko: '교회' },
  circle: { ko: '동그라미' },
  clarinet: { ko: '클라리넷' },
  clock: { ko: '시계' },
  cloud: { ko: '구름' },
  'coffee cup': { ko: '커피잔' },
  compass: { ko: '나침반' },
  computer: { ko: '컴퓨터' },
  cookie: { ko: '쿠키' },
  cooler: { ko: '아이스박스' },
  couch: { ko: '소파' },
  cow: { ko: '소' },
  crab: { ko: '게' },
  crayon: { ko: '크레용' },
  crocodile: { ko: '악어' },
  crown: { ko: '왕관' },
  'cruise ship': { ko: '크루즈선' },
  cup: { ko: '컵' },
  diamond: { ko: '다이아몬드' },
  dishwasher: { ko: '식기세척기' },
  'diving board': { ko: '다이빙보드' },
  dog: { ko: '강아지' },
  dolphin: { ko: '돌고래' },
  donut: { ko: '도넛' },
  door: { ko: '문' },
  dragon: { ko: '용' },
  dresser: { ko: '서랍장' },
  drill: { ko: '드릴' },
  drums: { ko: '드럼' },
  duck: { ko: '오리' },
  dumbbell: { ko: '아령' },
  ear: { ko: '귀' },
  elbow: { ko: '팔꿈치' },
  elephant: { ko: '코끼리' },
  envelope: { ko: '편지봉투' },
  eraser: { ko: '지우개' },
  eye: { ko: '눈' },
  eyeglasses: { ko: '안경' },
  face: { ko: '얼굴' },
  fan: { ko: '선풍기' },
  feather: { ko: '깃털' },
  fence: { ko: '울타리' },
  finger: { ko: '손가락' },
  'fire hydrant': { ko: '소화전' },
  fireplace: { ko: '벽난로' },
  firetruck: { ko: '소방차' },
  fish: { ko: '물고기' },
  flamingo: { ko: '홍학' },
  flashlight: { ko: '손전등' },
  'flip flops': { ko: '슬리퍼' },
  'floor lamp': { ko: '스탠드 조명' },
  flower: { ko: '꽃' },
  'flying saucer': { ko: '비행접시' },
  foot: { ko: '발' },
  fork: { ko: '포크' },
  frog: { ko: '개구리' },
  'frying pan': { ko: '프라이팬' },
  garden: { ko: '정원' },
  'garden hose': { ko: '정원 호스' },
  giraffe: { ko: '기린' },
  goatee: { ko: '염소수염' },
  'golf club': { ko: '골프채' },
  grapes: { ko: '포도' },
  grass: { ko: '풀' },
  guitar: { ko: '기타' },
  hamburger: { ko: '햄버거' },
  hammer: { ko: '망치' },
  hand: { ko: '손' },
  harp: { ko: '하프' },
  hat: { ko: '모자' },
  headphones: { ko: '헤드폰' },
  hedgehog: { ko: '고슴도치' },
  helicopter: { ko: '헬리콥터' },
  helmet: { ko: '헬멧' },
  hexagon: { ko: '육각형' },
  'hockey puck': { ko: '하키 퍽' },
  'hockey stick': { ko: '하키 스틱' },
  horse: { ko: '말' },
  hospital: { ko: '병원' },
  'hot air balloon': { ko: '열기구' },
  'hot dog': { ko: '핫도그' },
  'hot tub': { ko: '온수 욕조' },
  hourglass: { ko: '모래시계' },
  house: { ko: '집' },
  'house plant': { ko: '화분' },
  hurricane: { ko: '허리케인' },
  'ice cream': { ko: '아이스크림' },
  jacket: { ko: '재킷' },
  jail: { ko: '감옥' },
  kangaroo: { ko: '캥거루' },
  key: { ko: '열쇠' },
  keyboard: { ko: '키보드' },
  knee: { ko: '무릎' },
  knife: { ko: '칼' },
  ladder: { ko: '사다리' },
  lantern: { ko: '등불' },
  laptop: { ko: '노트북' },
  leaf: { ko: '나뭇잎' },
  leg: { ko: '다리' },
  'light bulb': { ko: '전구' },
  lighter: { ko: '라이터' },
  lighthouse: { ko: '등대' },
  lightning: { ko: '번개' },
  line: { ko: '선' },
  lion: { ko: '사자' },
  lipstick: { ko: '립스틱' },
  lobster: { ko: '바닷가재' },
  lollipop: { ko: '막대사탕' },
  mailbox: { ko: '우편함' },
  map: { ko: '지도' },
  marker: { ko: '마커펜' },
  matches: { ko: '성냥' },
  megaphone: { ko: '확성기' },
  mermaid: { ko: '인어' },
  microphone: { ko: '마이크' },
  microwave: { ko: '전자레인지' },
  monkey: { ko: '원숭이' },
  moon: { ko: '달' },
  mosquito: { ko: '모기' },
  motorbike: { ko: '오토바이' },
  mountain: { ko: '산' },
  mouse: { ko: '쥐' },
  moustache: { ko: '콧수염' },
  mouth: { ko: '입' },
  mug: { ko: '머그컵' },
  mushroom: { ko: '버섯' },
  nail: { ko: '못' },
  necklace: { ko: '목걸이' },
  nose: { ko: '코' },
  ocean: { ko: '바다' },
  octagon: { ko: '팔각형' },
  octopus: { ko: '문어' },
  onion: { ko: '양파' },
  oven: { ko: '오븐' },
  owl: { ko: '올빼미' },
  paintbrush: { ko: '붓' },
  'paint can': { ko: '페인트통' },
  'palm tree': { ko: '야자수' },
  panda: { ko: '판다' },
  pants: { ko: '바지' },
  'paper clip': { ko: '종이 클립' },
  parachute: { ko: '낙하산' },
  parrot: { ko: '앵무새' },
  passport: { ko: '여권' },
  peanut: { ko: '땅콩' },
  pear: { ko: '배' },
  peas: { ko: '완두콩' },
  pencil: { ko: '연필' },
  penguin: { ko: '펭귄' },
  piano: { ko: '피아노' },
  'pickup truck': { ko: '픽업트럭' },
  'picture frame': { ko: '액자' },
  pig: { ko: '돼지' },
  pillow: { ko: '베개' },
  pineapple: { ko: '파인애플' },
  pizza: { ko: '피자' },
  pliers: { ko: '펜치' },
  'police car': { ko: '경찰차' },
  pond: { ko: '연못' },
  pool: { ko: '수영장' },
  popsicle: { ko: '아이스바' },
  postcard: { ko: '엽서' },
  potato: { ko: '감자' },
  'power outlet': { ko: '콘센트' },
  purse: { ko: '지갑' },
  rabbit: { ko: '토끼' },
  raccoon: { ko: '너구리' },
  radio: { ko: '라디오' },
  rain: { ko: '비' },
  rainbow: { ko: '무지개' },
  rake: { ko: '갈퀴' },
  'remote control': { ko: '리모컨' },
  rhinoceros: { ko: '코뿔소' },
  rifle: { ko: '소총' },
  river: { ko: '강' },
  'roller coaster': { ko: '롤러코스터' },
  rollerskates: { ko: '롤러스케이트' },
  sailboat: { ko: '돛단배' },
  sandwich: { ko: '샌드위치' },
  saw: { ko: '톱' },
  saxophone: { ko: '색소폰' },
  'school bus': { ko: '통학버스' },
  scissors: { ko: '가위' },
  scorpion: { ko: '전갈' },
  screwdriver: { ko: '드라이버' },
  'sea turtle': { ko: '바다거북' },
  'see saw': { ko: '시소' },
  shark: { ko: '상어' },
  sheep: { ko: '양' },
  shoe: { ko: '신발' },
  shorts: { ko: '반바지' },
  shovel: { ko: '삽' },
  sink: { ko: '싱크대' },
  skateboard: { ko: '스케이트보드' },
  skull: { ko: '해골' },
  skyscraper: { ko: '고층빌딩' },
  'sleeping bag': { ko: '침낭' },
  'smiley face': { ko: '웃는 얼굴' },
  snail: { ko: '달팽이' },
  snake: { ko: '뱀' },
  snorkel: { ko: '스노클' },
  snowflake: { ko: '눈송이' },
  snowman: { ko: '눈사람' },
  'soccer ball': { ko: '축구공' },
  sock: { ko: '양말' },
  speedboat: { ko: '고속정' },
  spider: { ko: '거미' },
  spoon: { ko: '숟가락' },
  spreadsheet: { ko: '스프레드시트' },
  square: { ko: '정사각형' },
  squiggle: { ko: '구불구불한 선' },
  squirrel: { ko: '다람쥐' },
  stairs: { ko: '계단' },
  star: { ko: '별' },
  steak: { ko: '스테이크' },
  stereo: { ko: '오디오' },
  stethoscope: { ko: '청진기' },
  stitches: { ko: '꿰맨 자국' },
  'stop sign': { ko: '정지 표지판' },
  stove: { ko: '가스레인지' },
  strawberry: { ko: '딸기' },
  streetlight: { ko: '가로등' },
  'string bean': { ko: '껍질콩' },
  submarine: { ko: '잠수함' },
  suitcase: { ko: '여행가방' },
  sun: { ko: '해' },
  swan: { ko: '백조' },
  sweater: { ko: '스웨터' },
  'swing set': { ko: '그네' },
  sword: { ko: '검' },
  syringe: { ko: '주사기' },
  table: { ko: '탁자' },
  teapot: { ko: '찻주전자' },
  'teddy-bear': { ko: '테디베어' },
  telephone: { ko: '전화기' },
  television: { ko: '텔레비전' },
  'tennis racquet': { ko: '테니스 라켓' },
  tent: { ko: '텐트' },
  'The Eiffel Tower': { ko: '에펠탑' },
  'The Great Wall of China': { ko: '만리장성' },
  'The Mona Lisa': { ko: '모나리자' },
  tiger: { ko: '호랑이' },
  toaster: { ko: '토스터' },
  toe: { ko: '발가락' },
  toilet: { ko: '변기' },
  tooth: { ko: '이빨' },
  toothbrush: { ko: '칫솔' },
  toothpaste: { ko: '치약' },
  tornado: { ko: '토네이도' },
  tractor: { ko: '트랙터' },
  'traffic light': { ko: '신호등' },
  train: { ko: '기차' },
  tree: { ko: '나무' },
  triangle: { ko: '삼각형' },
  trombone: { ko: '트롬본' },
  truck: { ko: '트럭' },
  trumpet: { ko: '트럼펫' },
  't-shirt': { ko: '티셔츠' },
  umbrella: { ko: '우산' },
  underwear: { ko: '속옷' },
  van: { ko: '밴' },
  vase: { ko: '꽃병' },
  violin: { ko: '바이올린' },
  'washing machine': { ko: '세탁기' },
  watermelon: { ko: '수박' },
  waterslide: { ko: '워터슬라이드' },
  whale: { ko: '고래' },
  wheel: { ko: '바퀴' },
  windmill: { ko: '풍차' },
  'wine bottle': { ko: '와인병' },
  'wine glass': { ko: '와인잔' },
  wristwatch: { ko: '손목시계' },
  yoga: { ko: '요가' },
  zebra: { ko: '얼룩말' },
  zigzag: { ko: '지그재그' },
  heart: { ko: '하트' },
  robot: { ko: '로봇' },

  // ── Text classifier: Korean single consonants (14) ────────────────────
  // Translation is the character itself — already native Korean.
  '\u3131': { ko: 'ㄱ' },
  '\u3134': { ko: 'ㄴ' },
  '\u3137': { ko: 'ㄷ' },
  '\u3139': { ko: 'ㄹ' },
  '\u3141': { ko: 'ㅁ' },
  '\u3142': { ko: 'ㅂ' },
  '\u3145': { ko: 'ㅅ' },
  '\u3147': { ko: 'ㅇ' },
  '\u3148': { ko: 'ㅈ' },
  '\u314A': { ko: 'ㅊ' },
  '\u314B': { ko: 'ㅋ' },
  '\u314C': { ko: 'ㅌ' },
  '\u314D': { ko: 'ㅍ' },
  '\u314E': { ko: 'ㅎ' },

  // ── Text classifier: Korean double consonants / 쌍자음 (5) — Phase 1.5 ──
  '\u3132': { ko: 'ㄲ' },  // 쌍기역
  '\u3138': { ko: 'ㄸ' },  // 쌍디귿
  '\u3143': { ko: 'ㅃ' },  // 쌍비읍
  '\u3146': { ko: 'ㅆ' },  // 쌍시옷
  '\u3149': { ko: 'ㅉ' },  // 쌍지읒

  // ── Text classifier: Korean vowels / 모음 (21) — Phase 1.5 ────────────
  '\u314F': { ko: 'ㅏ' },
  '\u3150': { ko: 'ㅐ' },
  '\u3151': { ko: 'ㅑ' },
  '\u3152': { ko: 'ㅒ' },
  '\u3153': { ko: 'ㅓ' },
  '\u3154': { ko: 'ㅔ' },
  '\u3155': { ko: 'ㅕ' },
  '\u3156': { ko: 'ㅖ' },
  '\u3157': { ko: 'ㅗ' },
  '\u3158': { ko: 'ㅘ' },
  '\u3159': { ko: 'ㅙ' },
  '\u315A': { ko: 'ㅚ' },
  '\u315B': { ko: 'ㅛ' },
  '\u315C': { ko: 'ㅜ' },
  '\u315D': { ko: 'ㅝ' },
  '\u315E': { ko: 'ㅞ' },
  '\u315F': { ko: 'ㅟ' },
  '\u3160': { ko: 'ㅠ' },
  '\u3161': { ko: 'ㅡ' },
  '\u3162': { ko: 'ㅢ' },
  '\u3163': { ko: 'ㅣ' },

  // ── Text classifier: Latin uppercase A-Z (26) ─────────────────────────
  // Latin letters read naturally in a drawing game; keep as-is.
  A: { ko: 'A' }, B: { ko: 'B' }, C: { ko: 'C' }, D: { ko: 'D' },
  E: { ko: 'E' }, F: { ko: 'F' }, G: { ko: 'G' }, H: { ko: 'H' },
  I: { ko: 'I' }, J: { ko: 'J' }, K: { ko: 'K' }, L: { ko: 'L' },
  M: { ko: 'M' }, N: { ko: 'N' }, O: { ko: 'O' }, P: { ko: 'P' },
  Q: { ko: 'Q' }, R: { ko: 'R' }, S: { ko: 'S' }, T: { ko: 'T' },
  U: { ko: 'U' }, V: { ko: 'V' }, W: { ko: 'W' }, X: { ko: 'X' },
  Y: { ko: 'Y' }, Z: { ko: 'Z' },

  // ── Text classifier: Latin lowercase a-z (26) — Phase 1.5 ─────────────
  a: { ko: 'a' }, b: { ko: 'b' }, c: { ko: 'c' }, d: { ko: 'd' },
  e: { ko: 'e' }, f: { ko: 'f' }, g: { ko: 'g' }, h: { ko: 'h' },
  i: { ko: 'i' }, j: { ko: 'j' }, k: { ko: 'k' }, l: { ko: 'l' },
  m: { ko: 'm' }, n: { ko: 'n' }, o: { ko: 'o' }, p: { ko: 'p' },
  q: { ko: 'q' }, r: { ko: 'r' }, s: { ko: 's' }, t: { ko: 't' },
  u: { ko: 'u' }, v: { ko: 'v' }, w: { ko: 'w' }, x: { ko: 'x' },
  y: { ko: 'y' }, z: { ko: 'z' },

  // ── Text classifier: 0-9 ──────────────────────────────────────────────
  '0': { ko: '0' }, '1': { ko: '1' }, '2': { ko: '2' }, '3': { ko: '3' },
  '4': { ko: '4' }, '5': { ko: '5' }, '6': { ko: '6' }, '7': { ko: '7' },
  '8': { ko: '8' }, '9': { ko: '9' },

  // ── Symbol classifier (14 classes) ────────────────────────────────────
  '\u2605': { ko: '별' },        // ★
  '\u2665': { ko: '하트' },      // ♥
  '\u2192': { ko: '오른쪽 화살표' }, // →
  '\u2190': { ko: '왼쪽 화살표' },   // ←
  '\u2191': { ko: '위쪽 화살표' },   // ↑
  '\u2193': { ko: '아래쪽 화살표' }, // ↓
  '?': { ko: '물음표' },
  '!': { ko: '느낌표' },
  '\u2713': { ko: '체크표시' },  // ✓
  '\u2717': { ko: '가위표' },    // ✗
  '\u263A': { ko: '웃는 얼굴' }, // ☺
  '\u2600': { ko: '해' },        // ☀
  '\u266A': { ko: '음표' },      // ♪
  '\u25B3': { ko: '삼각형' },    // △
};

/**
 * Translate a classifier output label into the given locale.
 *
 * Falls back to the raw label when:
 *   - locale is the default locale ('en'), or
 *   - the label is not in LABEL_TRANSLATIONS (e.g. a future class, a mock
 *     guess string, or the "unknown" sentinel).
 *
 * Never throws. Always returns a non-empty string as long as `label` is.
 */
export function translateLabel(label: string, locale: ClassifierLocale): string {
  if (locale === DEFAULT_CLASSIFIER_LOCALE) return label;
  const row = (LABEL_TRANSLATIONS as Record<string, TranslationRow | undefined>)[label];
  if (!row) return label;
  return row[locale as NonDefaultLocale] ?? label;
}
