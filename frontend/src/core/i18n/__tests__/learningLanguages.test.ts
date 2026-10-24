import { describe, expect, it } from 'vitest';
import {
  canonicalizeLearningLanguage,
  SUPPORTED_LEARNING_LANGUAGES,
} from '../learningLanguages';

describe('learning language catalog', () => {
  it('supports the eight approved base languages and backend ISO3 aliases', () => {
    expect(SUPPORTED_LEARNING_LANGUAGES.map(({ code }) => code)).toEqual([
      'en', 'vi', 'ko', 'zh', 'ja', 'fr', 'de', 'es',
    ]);
    expect(['eng', 'vie', 'kor', 'zho', 'jpn', 'fra', 'deu', 'spa']
      .map(canonicalizeLearningLanguage)).toEqual(['en', 'vi', 'ko', 'zh', 'ja', 'fr', 'de', 'es']);
  });

  it('preserves valid script and region subtags while rejecting aliases outside the backend catalog', () => {
    expect(canonicalizeLearningLanguage('zh-hans-cn')).toBe('zh-Hans-CN');
    expect(canonicalizeLearningLanguage('fr-ca')).toBe('fr-CA');
    expect(['english', 'chi', 'fre', 'ger', 'en_US', 'ru', 'en-u-ca-gregory']
      .map(canonicalizeLearningLanguage)).toEqual([null, null, null, null, null, null, null]);
  });
});
