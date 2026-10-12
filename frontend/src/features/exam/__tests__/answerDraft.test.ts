import { afterEach, describe, expect, it, vi } from 'vitest';
import { persistAnswerDraft, removeAnswerDraft } from '../utils/answerDraft';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
describe('answerDraft', () => {
  it('keeps the existing raw record JSON and attempt-specific key', () => {
    expect(persistAnswerDraft(99, { 10: { q: '  Bài viết  ' } })).toBe(true);
    expect(JSON.parse(localStorage.getItem('exam_draft_99')!)).toEqual({ 10: { q: '  Bài viết  ' } });
    expect(removeAnswerDraft(99)).toBe(true);
    expect(localStorage.getItem('exam_draft_99')).toBeNull();
  });
  it('reports storage write failure without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(persistAnswerDraft(99, { 10: { q: 'A' } })).toBe(false);
  });
  it('reports storage cleanup failure without throwing', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(removeAnswerDraft(99)).toBe(false);
  });
});
