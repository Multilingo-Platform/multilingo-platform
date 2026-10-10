import { describe, expect, it } from 'vitest';
import { serializeAnswers } from '../utils/answerSnapshot';

describe('serializeAnswers', () => {
  it('preserves clear values and untrimmed Unicode essays', () => {
    expect(serializeAnswers({ 10: { q1: null, q2: '', q3: [], q4: {}, q5: '  Bài viết 😀 <script>x</script>  ' } }))
      .toEqual([{ part_id: 10, answers: [
        { question_id: 'q1', answer: null }, { question_id: 'q2', answer: '' },
        { question_id: 'q3', answer: [] }, { question_id: 'q4', answer: {} },
        { question_id: 'q5', answer: '  Bài viết 😀 <script>x</script>  ' },
      ] }]);
  });
  it('copies nested arrays and maps so later changes cannot alter the snapshot', () => {
    const answers = { 10: { q1: ['A'], q2: { blank: 'B' } } };
    const result = serializeAnswers(answers);
    answers[10].q1.push('C'); answers[10].q2.blank = 'D';
    expect(result).toEqual([{ part_id: 10, answers: [
      { question_id: 'q1', answer: ['A'] }, { question_id: 'q2', answer: { blank: 'B' } },
    ] }]);
  });
  it.each([0, -1, 1.5, 2147483648])('rejects invalid part ID %s', id => {
    expect(() => serializeAnswers({ [id]: { q: 'A' } })).toThrow();
  });
  it.each([undefined, 1, true, ['A', 2], { blank: 2 }])('rejects invalid values rather than dropping them: %j', value => {
    expect(() => serializeAnswers({ 1: { q: value } } as never)).toThrow();
  });
});
