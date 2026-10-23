export type WritingLengthUnit = 'WORDS' | 'CHARACTERS';

export interface WritingLengthMetric {
  value: number;
  unit: WritingLengthUnit;
  policyVersion: 'TV3_LENGTH_V1';
}

export function countWritingLength(text: string | null | undefined, languageTag: string | null | undefined): WritingLengthMetric {
  const source = text ?? '';
  const language = languageTag?.trim().replace(/_/g, '-').split('-', 1)[0].toLowerCase();
  if (language === 'zh' || language === 'ja') {
    return {
      value: [...source].filter(character => /[\p{L}\p{N}]/u.test(character)).length,
      unit: 'CHARACTERS',
      policyVersion: 'TV3_LENGTH_V1',
    };
  }

  const trimmed = source.trim();
  const value = trimmed ? trimmed.split(/[\s\p{Z}]+/u).length : 0;
  return { value, unit: 'WORDS', policyVersion: 'TV3_LENGTH_V1' };
}
