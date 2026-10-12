import { describe, it, expect } from 'vitest';
import {
  formatUserAnswer,
  formatCorrectAnswer,
  formatScore,
  getVerdictBadgeInfo,
  filterReviewQuestions,
  getWritingEvaluationStatus,
} from '../utils/reviewPresentation';
import type { ReviewQuestionDto, ReviewVerdict } from '../types/api.types';

describe('reviewPresentation utility', () => {
  describe('formatUserAnswer', () => {
    it('returns "Chưa trả lời" for null, undefined, empty string or whitespace', () => {
      expect(formatUserAnswer(null)).toBe('Chưa trả lời');
      expect(formatUserAnswer(undefined)).toBe('Chưa trả lời');
      expect(formatUserAnswer('')).toBe('Chưa trả lời');
      expect(formatUserAnswer('   ')).toBe('Chưa trả lời');
    });

    it('formats plain string answer preserving Unicode and multiline', () => {
      expect(formatUserAnswer('Hà Nội')).toBe('Hà Nội');
      const multiline = 'Line 1\nLine 2\nLine 3';
      expect(formatUserAnswer(multiline)).toBe(multiline);
    });

    it('formats array answer by joining elements with comma and space', () => {
      expect(formatUserAnswer(['A', 'B', 'C'])).toBe('A, B, C');
      expect(formatUserAnswer(['Tùy chọn 1', 'Tùy chọn 2'])).toBe('Tùy chọn 1, Tùy chọn 2');
      expect(formatUserAnswer([])).toBe('Chưa trả lời');
    });

    it('formats object/record answer into structured string without crashing', () => {
      const objAnswer = { q1: 'A', q2: 'B' };
      expect(formatUserAnswer(objAnswer)).toContain('q1: A');
      expect(formatUserAnswer(objAnswer)).toContain('q2: B');
      expect(formatUserAnswer({})).toBe('Chưa trả lời');
    });

    it('formats boolean and numeric answers', () => {
      expect(formatUserAnswer(true)).toBe('Đúng');
      expect(formatUserAnswer(false)).toBe('Sai');
      expect(formatUserAnswer(42)).toBe('42');
    });
  });

  describe('formatCorrectAnswer', () => {
    it('returns "Chưa có dữ liệu" for null, undefined, empty string (never invents answers)', () => {
      expect(formatCorrectAnswer(null)).toBe('Chưa có dữ liệu');
      expect(formatCorrectAnswer(undefined)).toBe('Chưa có dữ liệu');
      expect(formatCorrectAnswer('')).toBe('Chưa có dữ liệu');
      expect(formatCorrectAnswer('   ')).toBe('Chưa có dữ liệu');
    });

    it('formats string correct answer preserving Unicode and multiline', () => {
      expect(formatCorrectAnswer('Tiếng Việt')).toBe('Tiếng Việt');
      expect(formatCorrectAnswer('A\nB')).toBe('A\nB');
    });

    it('formats array of correct answers', () => {
      expect(formatCorrectAnswer(['A', 'C'])).toBe('A, C');
      expect(formatCorrectAnswer([])).toBe('Chưa có dữ liệu');
    });

    it('formats object of correct answers', () => {
      expect(formatCorrectAnswer({ 1: 'True', 2: 'False' })).toContain('1: True');
    });
  });

  describe('formatScore', () => {
    it('returns "--" for null or undefined (never transforms null to 0)', () => {
      expect(formatScore(null)).toBe('--');
      expect(formatScore(undefined)).toBe('--');
    });

    it('formats numeric scores correctly including zero and floating point', () => {
      expect(formatScore(0)).toBe('0');
      expect(formatScore(1)).toBe('1');
      expect(formatScore(1.5)).toBe('1.5');
      expect(formatScore(2.25)).toBe('2.25');
    });
  });

  describe('getVerdictBadgeInfo', () => {
    it('returns green badge for CORRECT', () => {
      const info = getVerdictBadgeInfo('CORRECT');
      expect(info.label).toBe('Chính xác');
      expect(info.bgClass).toContain('green');
      expect(info.textClass).toContain('green');
    });

    it('returns red badge for WRONG', () => {
      const info = getVerdictBadgeInfo('WRONG');
      expect(info.label).toBe('Chưa chính xác');
      expect(info.bgClass).toContain('red');
      expect(info.textClass).toContain('red');
    });

    it('returns gray badge for BLANK', () => {
      const info = getVerdictBadgeInfo('BLANK');
      expect(info.label).toBe('Chưa làm');
      expect(info.bgClass).toContain('slate');
    });

    it('returns amber badge for PENDING', () => {
      const info = getVerdictBadgeInfo('PENDING');
      expect(info.label).toBe('Đang chấm');
      expect(info.bgClass).toContain('amber');
    });

    it('returns neutral fallback for unknown verdict', () => {
      const info = getVerdictBadgeInfo('UNKNOWN' as ReviewVerdict);
      expect(info.label).toBe('Chưa xác định');
    });
  });

  describe('filterReviewQuestions', () => {
    const questions: ReviewQuestionDto[] = [
      { questionId: 'q1', verdict: 'CORRECT' },
      { questionId: 'q2', verdict: 'WRONG' },
      { questionId: 'q3', verdict: 'BLANK' },
      { questionId: 'q4', verdict: 'CORRECT' },
      { questionId: 'q5', verdict: 'PENDING' },
    ];

    it('returns all questions when filter is ALL', () => {
      expect(filterReviewQuestions(questions, 'ALL')).toHaveLength(5);
    });

    it('filters only CORRECT questions', () => {
      const filtered = filterReviewQuestions(questions, 'CORRECT');
      expect(filtered).toHaveLength(2);
      expect(filtered.map(q => q.questionId)).toEqual(['q1', 'q4']);
    });

    it('filters only WRONG questions', () => {
      const filtered = filterReviewQuestions(questions, 'WRONG');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].questionId).toBe('q2');
    });

    it('filters only BLANK questions', () => {
      const filtered = filterReviewQuestions(questions, 'BLANK');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].questionId).toBe('q3');
    });

    it('filters only PENDING questions', () => {
      const filtered = filterReviewQuestions(questions, 'PENDING');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].questionId).toBe('q5');
    });
  });

  describe('getWritingEvaluationStatus', () => {
    const summary = {
      objective: {
        rawScore: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        total: 0,
        accuracy: 0,
        scoreUnit: 'RAW_OBJECTIVE',
        bySkill: [],
        byPart: [],
      },
      writing: {
        status: 'PENDING',
        tasks: [
          {
            partId: 10,
            questionId: 'w1',
            label: 'Task 1: Email',
            status: 'FAILED',
            wordCount: 120,
            score: null,
            maxScore: null,
          },
          {
            partId: 20,
            questionId: 'w1',
            label: 'Task 2: Essay',
            status: 'PENDING',
            wordCount: 250,
            score: null,
            maxScore: null,
          },
          {
            partId: 30,
            questionId: 'w2',
            label: 'Task 3: Report',
            status: 'QUEUED',
            wordCount: 180,
            score: null,
            maxScore: null,
          },
          {
            partId: 40,
            questionId: 'w3',
            label: 'Task 4: Summary',
            status: 'UNAVAILABLE',
            wordCount: 0,
            score: null,
            maxScore: null,
          },
        ],
      },
    } as any;

    it('looks up exact (partId, questionId) tuple and distinguishes same questionId across parts', () => {
      // Part 10 has question w1 with FAILED status
      const resPart10 = getWritingEvaluationStatus(10, 'w1', summary);
      expect(resPart10.status).toBe('FAILED');
      expect(resPart10.label).toBe('Chấm điểm không thành công');
      expect(resPart10.score).toBeNull();
      expect(resPart10.wordCount).toBe(120);

      // Part 20 has question w1 with PENDING status
      const resPart20 = getWritingEvaluationStatus(20, 'w1', summary);
      expect(resPart20.status).toBe('PENDING');
      expect(resPart20.label).toBe('Đang chấm');
      expect(resPart20.score).toBeNull();
      expect(resPart20.wordCount).toBe(250);
    });

    it('returns QUEUED label and null score for QUEUED task', () => {
      const res = getWritingEvaluationStatus(30, 'w2', summary);
      expect(res.status).toBe('QUEUED');
      expect(res.label).toBe('Đang chờ chấm');
      expect(res.score).toBeNull();
    });

    it('returns UNAVAILABLE for task with UNAVAILABLE status or missing tuple', () => {
      const resExplicit = getWritingEvaluationStatus(40, 'w3', summary);
      expect(resExplicit.status).toBe('UNAVAILABLE');
      expect(resExplicit.label).toBe('Chưa có thông tin chấm bài');
      expect(resExplicit.score).toBeNull();

      const resNotFound = getWritingEvaluationStatus(99, 'nonexistent', summary);
      expect(resNotFound.status).toBe('UNAVAILABLE');
      expect(resNotFound.label).toBe('Chưa có thông tin chấm bài');
      expect(resNotFound.score).toBeNull();
    });

    it('returns UNAVAILABLE when summary or writing is null or undefined', () => {
      const resNull = getWritingEvaluationStatus(10, 'w1', null);
      expect(resNull.status).toBe('UNAVAILABLE');
      expect(resNull.label).toBe('Chưa có thông tin chấm bài');
      expect(resNull.score).toBeNull();

      const resNoTasks = getWritingEvaluationStatus(10, 'w1', { writing: null } as any);
      expect(resNoTasks.status).toBe('UNAVAILABLE');
      expect(resNoTasks.score).toBeNull();
    });
  });
});
