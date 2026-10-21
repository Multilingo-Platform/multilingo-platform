import { describe, expect, it } from 'vitest';
import { countWritingLength } from '../utils/writingLength';

describe('multilingual writing length', () => {
  it('counts CJK letters/numbers as characters while ignoring whitespace and punctuation', () => {
    expect(countWritingLength('日本語、猫 42!', 'ja-JP')).toEqual({ value: 6, unit: 'CHARACTERS', policyVersion: 'TV3_LENGTH_V1' });
    expect(countWritingLength('漢①Ⅷ', 'ja')).toEqual({ value: 3, unit: 'CHARACTERS', policyVersion: 'TV3_LENGTH_V1' });
    expect(countWritingLength('中文测试', 'zh-Hans-CN').value).toBe(4);
  });

  it('uses Unicode whitespace-delimited words for other languages', () => {
    expect(countWritingLength('  Über\u00a0die Straße\nlernen  ', 'de-DE')).toEqual({
      value: 4, unit: 'WORDS', policyVersion: 'TV3_LENGTH_V1',
    });
    expect(countWritingLength('한국어 123', 'ko').value).toBe(2);
    expect(countWritingLength('', 'en').value).toBe(0);
  });
});
