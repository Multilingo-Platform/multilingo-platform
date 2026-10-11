import { describe, expect, it } from 'vitest';
import { attemptStatusLabel, formatResultAccuracy, formatResultDuration, formatResultScore, formatResultTimestamp,
  resultScopeLabel, writingStatusLabel } from '../utils/resultPresentation';

describe('result formatting without score conversion', () => {
  it.each([[0, '0'], [5.5, '5,5'], [200, '200'], [99999999.99, '99.999.999,99']])('raw %s → %s', (value, expected) => {
    expect(formatResultScore(value as number)).toBe(expected);
  });
  it.each([[0, '0,00%'], [33.33, '33,33%'], [100, '100,00%']])('accuracy %s → %s', (value, expected) => {
    expect(formatResultAccuracy(value as number)).toBe(expected);
  });
  it.each([[null, 'Chưa có dữ liệu'], [0, '0:00:00'], [59, '0:00:59'], [60, '0:01:00'], [3661, '1:01:01']])('duration %s → %s', (value, expected) => {
    expect(formatResultDuration(value as number | null)).toBe(expected);
  });
  it('formats timestamps in Vietnam timezone and keeps missing timestamps unavailable', () => {
    expect(formatResultTimestamp('2026-10-11T00:00:00Z')).toContain('07:00:00');
    expect(formatResultTimestamp('2026-10-11T00:00:00Z')).toContain('11/10/2026');
    expect(formatResultTimestamp(null)).toBe('Chưa có dữ liệu');
  });
  it('does not describe COMPLETED as Writing scored', () => {
    expect(attemptStatusLabel('COMPLETED')).toBe('Bài làm đã hoàn tất');
    expect(writingStatusLabel('UNAVAILABLE')).toBe('Chưa có kết quả chấm Writing');
    expect(resultScopeLabel('SINGLE_PART')).toBe('Một phần thi');
  });
});
