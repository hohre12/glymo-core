// Category label arrays for each ONNX classifier model.
// These MUST match the exact output index order of the trained models.
// Source of truth: glymo-server/ml/models/manifest.json (produced by
// 06_export_onnx.py from the trained .pt checkpoints).
//
// If the trainer's class order changes, this file MUST be regenerated.
// Mismatching order produces confident but wrong predictions — the model
// returns index N, the client reads a different label at index N.

export const TYPE_CATEGORIES = ['text', 'symbol', 'drawing'] as const;

export const DRAWING_CATEGORIES = [
  'butterfly',   // 0
  'cat',         // 1
  'dog',         // 2
  'fish',        // 3
  'bird',        // 4
  'flower',      // 5
  'tree',        // 6
  'sun',         // 7
  'moon',        // 8
  'star',        // 9
  'car',         // 10
  'house',       // 11
  'heart',       // 12
  'cloud',       // 13
  'rain',        // 14
  'mountain',    // 15
  'sailboat',    // 16
  'apple',       // 17
  'smiley face', // 18
  'robot',       // 19
] as const;

// Phase 1.5: expanded from 50 → 102 classes.
// Jamo split into 14 single consonants + 5 double consonants + 21 vowels (40 total).
// Latin split into 26 uppercase + 26 lowercase (52 total).
// Digits unchanged (10).
export const TEXT_CATEGORIES = [
  // Korean single consonants (0-13)
  '\u3131','\u3134','\u3137','\u3139','\u3141','\u3142','\u3145','\u3147','\u3148','\u314A','\u314B','\u314C','\u314D','\u314E',
  // Korean double consonants / 쌍자음 (14-18)
  '\u3132','\u3138','\u3143','\u3146','\u3149',
  // Korean vowels / 모음 (19-39), U+314F..U+3163 in Jungseong order
  '\u314F','\u3150','\u3151','\u3152','\u3153','\u3154','\u3155','\u3156',
  '\u3157','\u3158','\u3159','\u315A','\u315B','\u315C','\u315D','\u315E',
  '\u315F','\u3160','\u3161','\u3162','\u3163',
  // Latin uppercase A-Z (40-65)
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  // Latin lowercase a-z (66-91)
  'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
  // Digits 0-9 (92-101)
  '0','1','2','3','4','5','6','7','8','9',
] as const;

// Symbol trainer categories (14). NOTE: the symbol classifier ships with
// 20% accuracy in this beta and is NOT deployed (see landing/public/models/
// manifest.json — symbol-classifier is intentionally excluded). The worker
// falls back to the drawing classifier when TYPE predicts "symbol".
// These labels remain here so that when the retrained symbol model ships,
// the client is ready to display its outputs correctly.
export const SYMBOL_CATEGORIES = [
  '\u2605', // ★  0
  '\u2665', // ♥  1
  '\u2192', // →  2
  '\u2190', // ←  3
  '\u2191', // ↑  4
  '\u2193', // ↓  5
  '?',      //    6
  '!',      //    7
  '\u2713', // ✓  8
  '\u2717', // ✗  9
  '\u263A', // ☺  10
  '\u2600', // ☀  11
  '\u266A', // ♪  12
  '\u25B3', // △  13
] as const;

export type DrawingCategory = typeof DRAWING_CATEGORIES[number];
export type TextCategory = typeof TEXT_CATEGORIES[number];
export type SymbolCategory = typeof SYMBOL_CATEGORIES[number];
export type TypeCategory = typeof TYPE_CATEGORIES[number];
