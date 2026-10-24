import viExam from '../../../locales/vi/exam.json';
import enExam from '../../../locales/en/exam.json';
import { describe, expect, it } from 'vitest';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

describe('TV3 exam locale namespace', () => {
  it('keeps Vietnamese and English key parity', () => {
    expect(keys(viExam).sort()).toEqual(keys(enExam).sort());
  });

  it('keeps exam language and feedback language concepts separate', () => {
    expect(viExam.language.source).not.toEqual(viExam.language.explanation);
    expect(enExam.language.source).not.toEqual(enExam.language.explanation);
  });
});
