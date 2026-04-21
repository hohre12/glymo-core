// Category label arrays for each ONNX classifier model.
// These MUST match the exact output index order of the trained models.
// Source of truth: glymo-server/ml/models/manifest.json (produced by
// 06_export_onnx.py from the trained .pt checkpoints).
//
// If the trainer's class order changes, this file MUST be regenerated.
// Mismatching order produces confident but wrong predictions — the model
// returns index N, the client reads a different label at index N.
//
// PHASE 1.8 v003 — drawing_classifier expanded from 20 → 347 categories
// (QuickDraw 345 + heart + robot). Regenerated from
// glymo-server/ml/training/common/config.py::DRAWING_CATEGORIES by
// glymo-server/ml/scripts/generate_landing_categories.py.

export const TYPE_CATEGORIES = ['text', 'symbol', 'drawing'] as const;

export const DRAWING_CATEGORIES = [
  'aircraft carrier',  // 0
  'airplane',  // 1
  'alarm clock',  // 2
  'ambulance',  // 3
  'angel',  // 4
  'animal migration',  // 5
  'ant',  // 6
  'anvil',  // 7
  'apple',  // 8
  'arm',  // 9
  'asparagus',  // 10
  'axe',  // 11
  'backpack',  // 12
  'banana',  // 13
  'bandage',  // 14
  'barn',  // 15
  'baseball',  // 16
  'baseball bat',  // 17
  'basket',  // 18
  'basketball',  // 19
  'bat',  // 20
  'bathtub',  // 21
  'beach',  // 22
  'bear',  // 23
  'beard',  // 24
  'bed',  // 25
  'bee',  // 26
  'belt',  // 27
  'bench',  // 28
  'bicycle',  // 29
  'binoculars',  // 30
  'bird',  // 31
  'birthday cake',  // 32
  'blackberry',  // 33
  'blueberry',  // 34
  'book',  // 35
  'boomerang',  // 36
  'bottlecap',  // 37
  'bowtie',  // 38
  'bracelet',  // 39
  'brain',  // 40
  'bread',  // 41
  'bridge',  // 42
  'broccoli',  // 43
  'broom',  // 44
  'bucket',  // 45
  'bulldozer',  // 46
  'bus',  // 47
  'bush',  // 48
  'butterfly',  // 49
  'cactus',  // 50
  'cake',  // 51
  'calculator',  // 52
  'calendar',  // 53
  'camel',  // 54
  'camera',  // 55
  'camouflage',  // 56
  'campfire',  // 57
  'candle',  // 58
  'cannon',  // 59
  'canoe',  // 60
  'car',  // 61
  'carrot',  // 62
  'castle',  // 63
  'cat',  // 64
  'ceiling fan',  // 65
  'cello',  // 66
  'cell phone',  // 67
  'chair',  // 68
  'chandelier',  // 69
  'church',  // 70
  'circle',  // 71
  'clarinet',  // 72
  'clock',  // 73
  'cloud',  // 74
  'coffee cup',  // 75
  'compass',  // 76
  'computer',  // 77
  'cookie',  // 78
  'cooler',  // 79
  'couch',  // 80
  'cow',  // 81
  'crab',  // 82
  'crayon',  // 83
  'crocodile',  // 84
  'crown',  // 85
  'cruise ship',  // 86
  'cup',  // 87
  'diamond',  // 88
  'dishwasher',  // 89
  'diving board',  // 90
  'dog',  // 91
  'dolphin',  // 92
  'donut',  // 93
  'door',  // 94
  'dragon',  // 95
  'dresser',  // 96
  'drill',  // 97
  'drums',  // 98
  'duck',  // 99
  'dumbbell',  // 100
  'ear',  // 101
  'elbow',  // 102
  'elephant',  // 103
  'envelope',  // 104
  'eraser',  // 105
  'eye',  // 106
  'eyeglasses',  // 107
  'face',  // 108
  'fan',  // 109
  'feather',  // 110
  'fence',  // 111
  'finger',  // 112
  'fire hydrant',  // 113
  'fireplace',  // 114
  'firetruck',  // 115
  'fish',  // 116
  'flamingo',  // 117
  'flashlight',  // 118
  'flip flops',  // 119
  'floor lamp',  // 120
  'flower',  // 121
  'flying saucer',  // 122
  'foot',  // 123
  'fork',  // 124
  'frog',  // 125
  'frying pan',  // 126
  'garden',  // 127
  'garden hose',  // 128
  'giraffe',  // 129
  'goatee',  // 130
  'golf club',  // 131
  'grapes',  // 132
  'grass',  // 133
  'guitar',  // 134
  'hamburger',  // 135
  'hammer',  // 136
  'hand',  // 137
  'harp',  // 138
  'hat',  // 139
  'headphones',  // 140
  'hedgehog',  // 141
  'helicopter',  // 142
  'helmet',  // 143
  'hexagon',  // 144
  'hockey puck',  // 145
  'hockey stick',  // 146
  'horse',  // 147
  'hospital',  // 148
  'hot air balloon',  // 149
  'hot dog',  // 150
  'hot tub',  // 151
  'hourglass',  // 152
  'house',  // 153
  'house plant',  // 154
  'hurricane',  // 155
  'ice cream',  // 156
  'jacket',  // 157
  'jail',  // 158
  'kangaroo',  // 159
  'key',  // 160
  'keyboard',  // 161
  'knee',  // 162
  'knife',  // 163
  'ladder',  // 164
  'lantern',  // 165
  'laptop',  // 166
  'leaf',  // 167
  'leg',  // 168
  'light bulb',  // 169
  'lighter',  // 170
  'lighthouse',  // 171
  'lightning',  // 172
  'line',  // 173
  'lion',  // 174
  'lipstick',  // 175
  'lobster',  // 176
  'lollipop',  // 177
  'mailbox',  // 178
  'map',  // 179
  'marker',  // 180
  'matches',  // 181
  'megaphone',  // 182
  'mermaid',  // 183
  'microphone',  // 184
  'microwave',  // 185
  'monkey',  // 186
  'moon',  // 187
  'mosquito',  // 188
  'motorbike',  // 189
  'mountain',  // 190
  'mouse',  // 191
  'moustache',  // 192
  'mouth',  // 193
  'mug',  // 194
  'mushroom',  // 195
  'nail',  // 196
  'necklace',  // 197
  'nose',  // 198
  'ocean',  // 199
  'octagon',  // 200
  'octopus',  // 201
  'onion',  // 202
  'oven',  // 203
  'owl',  // 204
  'paintbrush',  // 205
  'paint can',  // 206
  'palm tree',  // 207
  'panda',  // 208
  'pants',  // 209
  'paper clip',  // 210
  'parachute',  // 211
  'parrot',  // 212
  'passport',  // 213
  'peanut',  // 214
  'pear',  // 215
  'peas',  // 216
  'pencil',  // 217
  'penguin',  // 218
  'piano',  // 219
  'pickup truck',  // 220
  'picture frame',  // 221
  'pig',  // 222
  'pillow',  // 223
  'pineapple',  // 224
  'pizza',  // 225
  'pliers',  // 226
  'police car',  // 227
  'pond',  // 228
  'pool',  // 229
  'popsicle',  // 230
  'postcard',  // 231
  'potato',  // 232
  'power outlet',  // 233
  'purse',  // 234
  'rabbit',  // 235
  'raccoon',  // 236
  'radio',  // 237
  'rain',  // 238
  'rainbow',  // 239
  'rake',  // 240
  'remote control',  // 241
  'rhinoceros',  // 242
  'rifle',  // 243
  'river',  // 244
  'roller coaster',  // 245
  'rollerskates',  // 246
  'sailboat',  // 247
  'sandwich',  // 248
  'saw',  // 249
  'saxophone',  // 250
  'school bus',  // 251
  'scissors',  // 252
  'scorpion',  // 253
  'screwdriver',  // 254
  'sea turtle',  // 255
  'see saw',  // 256
  'shark',  // 257
  'sheep',  // 258
  'shoe',  // 259
  'shorts',  // 260
  'shovel',  // 261
  'sink',  // 262
  'skateboard',  // 263
  'skull',  // 264
  'skyscraper',  // 265
  'sleeping bag',  // 266
  'smiley face',  // 267
  'snail',  // 268
  'snake',  // 269
  'snorkel',  // 270
  'snowflake',  // 271
  'snowman',  // 272
  'soccer ball',  // 273
  'sock',  // 274
  'speedboat',  // 275
  'spider',  // 276
  'spoon',  // 277
  'spreadsheet',  // 278
  'square',  // 279
  'squiggle',  // 280
  'squirrel',  // 281
  'stairs',  // 282
  'star',  // 283
  'steak',  // 284
  'stereo',  // 285
  'stethoscope',  // 286
  'stitches',  // 287
  'stop sign',  // 288
  'stove',  // 289
  'strawberry',  // 290
  'streetlight',  // 291
  'string bean',  // 292
  'submarine',  // 293
  'suitcase',  // 294
  'sun',  // 295
  'swan',  // 296
  'sweater',  // 297
  'swing set',  // 298
  'sword',  // 299
  'syringe',  // 300
  'table',  // 301
  'teapot',  // 302
  'teddy-bear',  // 303
  'telephone',  // 304
  'television',  // 305
  'tennis racquet',  // 306
  'tent',  // 307
  'The Eiffel Tower',  // 308
  'The Great Wall of China',  // 309
  'The Mona Lisa',  // 310
  'tiger',  // 311
  'toaster',  // 312
  'toe',  // 313
  'toilet',  // 314
  'tooth',  // 315
  'toothbrush',  // 316
  'toothpaste',  // 317
  'tornado',  // 318
  'tractor',  // 319
  'traffic light',  // 320
  'train',  // 321
  'tree',  // 322
  'triangle',  // 323
  'trombone',  // 324
  'truck',  // 325
  'trumpet',  // 326
  't-shirt',  // 327
  'umbrella',  // 328
  'underwear',  // 329
  'van',  // 330
  'vase',  // 331
  'violin',  // 332
  'washing machine',  // 333
  'watermelon',  // 334
  'waterslide',  // 335
  'whale',  // 336
  'wheel',  // 337
  'windmill',  // 338
  'wine bottle',  // 339
  'wine glass',  // 340
  'wristwatch',  // 341
  'yoga',  // 342
  'zebra',  // 343
  'zigzag',  // 344
  'heart',  // 345
  'robot',  // 346
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
