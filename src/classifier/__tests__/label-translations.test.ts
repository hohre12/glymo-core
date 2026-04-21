import { describe, it, expect } from 'vitest';
import {
  translateLabel,
  LABEL_TRANSLATIONS,
  ALL_CLASSIFIER_LABELS,
} from '../label-translations.js';

describe('translateLabel', () => {
  it('returns the raw label for the default (en) locale', () => {
    expect(translateLabel('house', 'en')).toBe('house');
    expect(translateLabel('\u2605', 'en')).toBe('\u2605');
  });

  it('translates known drawing labels to Korean', () => {
    expect(translateLabel('house', 'ko')).toBe('집');
    expect(translateLabel('sun', 'ko')).toBe('해');
    expect(translateLabel('cloud', 'ko')).toBe('구름');
    expect(translateLabel('smiley face', 'ko')).toBe('웃는 얼굴');
  });

  it('translates symbols to descriptive Korean nouns', () => {
    expect(translateLabel('\u2713', 'ko')).toBe('체크표시'); // ✓
    expect(translateLabel('\u2605', 'ko')).toBe('별');     // ★
    expect(translateLabel('\u2192', 'ko')).toBe('오른쪽 화살표'); // →
  });

  it('falls back to the raw label when no translation exists', () => {
    expect(translateLabel('unknown-future-class', 'ko')).toBe('unknown-future-class');
    expect(translateLabel('', 'ko')).toBe('');
  });

  it('has a Korean translation for every known classifier label', () => {
    for (const label of ALL_CLASSIFIER_LABELS) {
      expect(LABEL_TRANSLATIONS[label]?.ko, `missing ko translation for "${label}"`).toBeTruthy();
    }
  });
});
