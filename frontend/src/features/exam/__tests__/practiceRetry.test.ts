import { describe, it, expect } from 'vitest';
import {
  selectRetryQuestionIds,
  filterRetryGroups,
} from '../utils/practiceRetry';
import type { Question, QuestionGroup } from '../types/exam.types';

const mockQuestions: Question[] = [
  {
    question_id: 'q1',
    question_number: 1,
    type: 'SINGLE_CHOICE',
    question_text: 'Question 1',
    options: null,
    media: null,
  },
  {
    question_id: 'q2',
    question_number: 2,
    type: 'SINGLE_CHOICE',
    question_text: 'Question 2',
    options: null,
    media: null,
  },
  {
    question_id: 'q3',
    question_number: 3,
    type: 'MULTIPLE_CHOICE',
    question_text: 'Question 3',
    options: null,
    media: null,
  },
  {
    question_id: 'q4',
    question_number: 4,
    type: 'FILL_IN_THE_BLANK',
    question_text: 'Question 4',
    options: null,
    media: null,
  },
];

const mockGroups: QuestionGroup[] = [
  {
    group_id: 'g1',
    instruction: 'Read passage 1',
    context_html: '<p>Context 1</p>',
    shared_audio: { url: 'audio1.mp3', duration_seconds: 60 },
    shared_media: { type: 'image', url: 'img1.png' },
    questions: [mockQuestions[0], mockQuestions[1]], // q1, q2
  },
  {
    group_id: 'g2',
    instruction: 'Read passage 2',
    context_html: '<p>Context 2</p>',
    shared_audio: { url: 'audio2.mp3', duration_seconds: 90 },
    shared_media: null,
    questions: [mockQuestions[2]], // q3
  },
  {
    group_id: 'g3',
    instruction: 'Read passage 3',
    context_html: '<p>Context 3</p>',
    shared_audio: null,
    shared_media: null,
    questions: [mockQuestions[3]], // q4
  },
];

describe('TV3-16-03 practiceRetry utils', () => {
  describe('selectRetryQuestionIds', () => {
    it('preserves natural Part question order even if wrong IDs are out of order', () => {
      // wrong IDs given as q3 then q1
      const result = selectRetryQuestionIds(mockQuestions, ['q3', 'q1']);
      // Must be ordered as q1 then q3 (matching mockQuestions order)
      expect(result).toEqual(['q1', 'q3']);
    });

    it('eliminates duplicate question IDs in wrongQuestionIds', () => {
      const result = selectRetryQuestionIds(mockQuestions, ['q2', 'q2', 'q2']);
      expect(result).toEqual(['q2']);
    });

    it('filters out question IDs not present in the current Part', () => {
      const result = selectRetryQuestionIds(mockQuestions, [
        'q2',
        'q_foreign_part',
        'q999',
      ]);
      expect(result).toEqual(['q2']);
    });

    it('returns empty array when wrongQuestionIds is empty or questions list is empty', () => {
      expect(selectRetryQuestionIds(mockQuestions, [])).toEqual([]);
      expect(selectRetryQuestionIds([], ['q1', 'q2'])).toEqual([]);
    });

    it('does not mutate source questions or wrongQuestionIds array', () => {
      const questionsClone = [...mockQuestions];
      const wrongIds = ['q3', 'q1'];
      const wrongIdsClone = [...wrongIds];

      selectRetryQuestionIds(mockQuestions, wrongIds);

      expect(mockQuestions).toEqual(questionsClone);
      expect(wrongIds).toEqual(wrongIdsClone);
    });
  });

  describe('filterRetryGroups', () => {
    it('filters questions within groups and preserves all group context/media', () => {
      const retrySet = new Set(['q1', 'q3']);
      const filtered = filterRetryGroups(mockGroups, retrySet);

      // g1 has q1, g2 has q3, g3 (q4) is dropped because it has no matching questions
      expect(filtered).toHaveLength(2);

      // Group 1
      expect(filtered[0].group_id).toBe('g1');
      expect(filtered[0].instruction).toBe('Read passage 1');
      expect(filtered[0].context_html).toBe('<p>Context 1</p>');
      expect(filtered[0].shared_audio).toEqual({
        url: 'audio1.mp3',
        duration_seconds: 60,
      });
      expect(filtered[0].shared_media).toEqual({
        type: 'image',
        url: 'img1.png',
      });
      expect(filtered[0].questions).toHaveLength(1);
      expect(filtered[0].questions[0].question_id).toBe('q1');

      // Group 2
      expect(filtered[1].group_id).toBe('g2');
      expect(filtered[1].instruction).toBe('Read passage 2');
      expect(filtered[1].context_html).toBe('<p>Context 2</p>');
      expect(filtered[1].shared_audio).toEqual({
        url: 'audio2.mp3',
        duration_seconds: 90,
      });
      expect(filtered[1].questions).toHaveLength(1);
      expect(filtered[1].questions[0].question_id).toBe('q3');
    });

    it('omits groups that have no matching questions after filtering', () => {
      const retrySet = new Set(['q4']); // only in g3
      const filtered = filterRetryGroups(mockGroups, retrySet);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].group_id).toBe('g3');
      expect(filtered[0].questions[0].question_id).toBe('q4');
    });

    it('returns empty array if questionIds set is empty or has no matches', () => {
      expect(filterRetryGroups(mockGroups, new Set())).toEqual([]);
      expect(filterRetryGroups(mockGroups, new Set(['non_existent']))).toEqual([]);
      expect(filterRetryGroups([], new Set(['q1']))).toEqual([]);
    });

    it('does not mutate original groups array or original questions array', () => {
      const retrySet = new Set(['q1']);
      const originalG1QuestionsCount = mockGroups[0].questions.length;

      const filtered = filterRetryGroups(mockGroups, retrySet);

      expect(filtered[0].questions).toHaveLength(1);
      // Original mockGroups[0] must still have 2 questions
      expect(mockGroups[0].questions).toHaveLength(originalG1QuestionsCount);
      expect(mockGroups).toHaveLength(3);
    });
  });
});
