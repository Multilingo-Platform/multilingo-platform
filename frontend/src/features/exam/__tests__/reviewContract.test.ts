import { describe, expect, it } from 'vitest';
import { normalizeAttemptReview, ReviewContractError } from '../api/reviewContract';
import { attemptReviewFixture } from './fixtures/attemptReview';

describe('TV3-14 review contract normalizer', () => {
  it('normalizes valid TV3-13 review payload and preserves backend structure without mutating input', () => {
    const wire = attemptReviewFixture(42, 10);
    const original = structuredClone(wire);
    const result = normalizeAttemptReview(wire, 42, 10);

    expect(result).toMatchObject({
      attemptId: 42,
      partId: 10,
      partTitle: 'Reading Passage 1',
      skill: 'READING',
      partStats: {
        score: 1.0,
        correctCount: 1,
        incorrectCount: 1,
        unansweredCount: 0,
        totalQuestions: 2,
        accuracy: 50.0,
      },
      questions: [
        {
          questionId: 'q1',
          type: 'SINGLE_CHOICE',
          verdict: 'CORRECT',
          score: 1.0,
          userAnswer: 'A',
          correctAnswer: 'A',
          explanation: 'AI provides personalized learning pathways according to the text.',
        },
        {
          questionId: 'q2',
          type: 'SINGLE_CHOICE',
          verdict: 'WRONG',
          score: 0.0,
          userAnswer: 'C',
          correctAnswer: 'B',
          explanation: 'The second paragraph explains adaptive learning.',
        },
      ],
    });
    expect(result.questions[0].options?.[0]).toMatchObject({ id: 'A', text: 'Option A description', isCorrect: true });
    expect(wire).toEqual(original);
  });

  it('preserves answer-value union without coercion (string, array, record, null)', () => {
    const wire: any = attemptReviewFixture(42, 10);
    wire.questions.push({
      questionId: 'q_arr',
      type: 'MULTIPLE_CHOICE',
      questionText: 'Choose two',
      prompt: null,
      label: null,
      explanation: null,
      correctAnswer: ['A', 'B'],
      userAnswer: ['A', 'B'],
      verdict: 'CORRECT',
      score: 1.0,
      options: [],
    });
    wire.questions.push({
      questionId: 'q_rec',
      type: 'MATCHING',
      questionText: 'Match definitions',
      prompt: null,
      label: null,
      explanation: null,
      correctAnswer: { '1': 'X', '2': 'Y' },
      userAnswer: { '1': 'X', '2': 'Y' },
      verdict: 'CORRECT',
      score: 2.0,
      options: [],
    });
    wire.questions.push({
      questionId: 'q_null',
      type: 'SINGLE_CHOICE',
      questionText: 'Blank answer',
      prompt: null,
      label: null,
      explanation: null,
      correctAnswer: 'A',
      userAnswer: null,
      verdict: 'BLANK',
      score: 0.0,
      options: [],
    });
    wire.partStats.totalQuestions = 5;
    wire.partStats.correctCount = 3;
    wire.partStats.incorrectCount = 1;
    wire.partStats.unansweredCount = 1;

    const result = normalizeAttemptReview(wire, 42, 10);
    const byId = Object.fromEntries(result.questions.map(q => [q.questionId, q]));

    expect(byId.q_arr.userAnswer).toEqual(['A', 'B']);
    expect(byId.q_rec.userAnswer).toEqual({ '1': 'X', '2': 'Y' });
    expect(byId.q_null.userAnswer).toBeNull();
  });

  it('accepts ESSAY task with PENDING verdict and null scores/answers', () => {
    const wire = {
      attemptId: 42,
      partId: 20,
      partTitle: 'Writing Task 1',
      skill: 'WRITING',
      partStats: {
        score: 0,
        correctCount: 0,
        incorrectCount: 0,
        unansweredCount: 0,
        totalQuestions: 0,
        accuracy: 0,
      },
      userAnswers: { essay_1: 'My essay submission...' },
      questions: [
        {
          questionId: 'essay_1',
          type: 'ESSAY',
          questionText: 'Discuss impacts of AI',
          prompt: null,
          label: 'Task 1',
          explanation: null,
          correctAnswer: null,
          userAnswer: 'My essay submission...',
          verdict: 'PENDING',
          score: null,
          options: null,
        },
      ],
      questionGroups: [],
    };

    const result = normalizeAttemptReview(wire, 42, 20);
    expect(result.questions[0].verdict).toBe('PENDING');
    expect(result.questions[0].score).toBeNull();
    expect(result.questions[0].correctAnswer).toBeNull();
  });

  it('rejects attemptId or partId mismatch', () => {
    const wire = attemptReviewFixture(42, 10);
    expect(() => normalizeAttemptReview(wire, 999, 10)).toThrow(ReviewContractError);
    expect(() => normalizeAttemptReview(wire, 42, 999)).toThrow(ReviewContractError);
  });

  it.each([0, -1, 1.5, NaN, Infinity, '42', null, undefined])(
    'rejects invalid expected attemptId %j',
    invalidId => {
      const wire = attemptReviewFixture(42, 10);
      expect(() => normalizeAttemptReview(wire, invalidId as any, 10)).toThrow(ReviewContractError);
    }
  );

  it.each([0, -1, 1.5, NaN, Infinity, '10', null, undefined])(
    'rejects invalid expected partId %j',
    invalidPartId => {
      const wire = attemptReviewFixture(42, 10);
      expect(() => normalizeAttemptReview(wire, 42, invalidPartId as any)).toThrow(ReviewContractError);
    }
  );

  it.each([null, undefined, 'string', 123, true, []])(
    'rejects non-record payload %j',
    payload => {
      expect(() => normalizeAttemptReview(payload, 42, 10)).toThrow(ReviewContractError);
    }
  );

  it('rejects duplicate question IDs within the same part', () => {
    const wire = attemptReviewFixture(42, 10);
    wire.questions.push({ ...wire.questions[0] });
    expect(() => normalizeAttemptReview(wire, 42, 10)).toThrow(ReviewContractError);
  });

  it.each([
    { questionId: '' },
    { questionId: 123 },
    { questionId: null },
    { questionId: undefined },
    { questionId: {} },
  ])('rejects invalid questionId %j', override => {
    const wire = attemptReviewFixture(42, 10);
    Object.assign(wire.questions[0], override);
    expect(() => normalizeAttemptReview(wire, 42, 10)).toThrow(ReviewContractError);
  });

  it.each([
    'COMPLETED',
    'UNKNOWN',
    'TRUE',
    'FALSE',
    'PASS',
    1,
    null,
    undefined,
  ])('rejects invalid verdict %j', verdict => {
    const wire = attemptReviewFixture(42, 10);
    Object.assign(wire.questions[0], { verdict });
    expect(() => normalizeAttemptReview(wire, 42, 10)).toThrow(ReviewContractError);
  });

  it('rejects question with mismatched partId outside scope', () => {
    const wire = attemptReviewFixture(42, 10);
    Object.assign(wire.questions[0], { partId: 99 });
    expect(() => normalizeAttemptReview(wire, 42, 10)).toThrow(ReviewContractError);
  });

  it.each([
    { totalQuestions: -1 },
    { correctCount: -1 },
    { incorrectCount: -1 },
    { unansweredCount: -1 },
    { totalQuestions: 3 }, // sum mismatch: 1+1+0 !== 3
    { accuracy: 101 },
    { accuracy: -1 },
  ])('rejects invalid partStats %j', override => {
    const wire = attemptReviewFixture(42, 10);
    Object.assign(wire.partStats, override);
    expect(() => normalizeAttemptReview(wire, 42, 10)).toThrow(ReviewContractError);
  });

  it.each([
    'invalid',
    123,
    {},
  ])('rejects non-array questionGroups %j', questionGroups => {
    const wire = { ...attemptReviewFixture(42, 10), questionGroups };
    expect(() => normalizeAttemptReview(wire, 42, 10)).toThrow(ReviewContractError);
  });

  it('rejects non-object group item in questionGroups', () => {
    const wire = { ...attemptReviewFixture(42, 10), questionGroups: ['invalid-group'] };
    expect(() => normalizeAttemptReview(wire, 42, 10)).toThrow(ReviewContractError);
  });

  it('rejects duplicate question ID within a single question group', () => {
    const wire = attemptReviewFixture(42, 10);
    wire.questionGroups = [
      {
        groupId: 'g1',
        instruction: 'Instruction',
        contentHtml: '<p>Content</p>',
        questions: [
          { questionId: 'q1', type: 'SINGLE_CHOICE', questionText: 'Q1 text', verdict: 'CORRECT' },
          { questionId: 'q1', type: 'SINGLE_CHOICE', questionText: 'Q1 text', verdict: 'CORRECT' },
        ],
      },
    ];
    expect(() => normalizeAttemptReview(wire, 42, 10)).toThrow(ReviewContractError);
  });

  it('rejects duplicate question ID across different question groups', () => {
    const wire = attemptReviewFixture(42, 10);
    wire.questionGroups = [
      {
        groupId: 'g1',
        instruction: 'Instruction 1',
        contentHtml: '<p>Content 1</p>',
        questions: [
          { questionId: 'q1', type: 'SINGLE_CHOICE', questionText: 'Q1 text', verdict: 'CORRECT' },
        ],
      },
      {
        groupId: 'g2',
        instruction: 'Instruction 2',
        contentHtml: '<p>Content 2</p>',
        questions: [
          { questionId: 'q1', type: 'SINGLE_CHOICE', questionText: 'Q1 text', verdict: 'CORRECT' },
        ],
      },
    ];
    expect(() => normalizeAttemptReview(wire, 42, 10)).toThrow(ReviewContractError);
  });

  it('rejects question in group that does not exist in canonical flat questions list', () => {
    const wire = attemptReviewFixture(42, 10);
    // wire has questions: ['q1', 'q2']. Group has 'foreign-q'
    wire.questionGroups = [
      {
        groupId: 'g1',
        instruction: 'Instruction',
        contentHtml: '<p>Content</p>',
        questions: [
          { questionId: 'foreign-q', type: 'SINGLE_CHOICE', questionText: 'Foreign text', verdict: 'CORRECT' },
        ],
      },
    ];
    expect(() => normalizeAttemptReview(wire, 42, 10)).toThrow(ReviewContractError);
  });

  it('accepts valid groups where question IDs exist in flat questions and are unique across groups', () => {
    const wire = attemptReviewFixture(42, 10);
    wire.questionGroups = [
      {
        groupId: 'g1',
        instruction: 'Answer passage 1',
        contentHtml: '<p>Passage 1</p>',
        questions: [
          { questionId: 'q1', type: 'SINGLE_CHOICE', questionText: 'Q1 text', verdict: 'CORRECT' },
        ],
      },
      {
        groupId: 'g2',
        instruction: 'Answer passage 2',
        contentHtml: '<p>Passage 2</p>',
        questions: [
          { questionId: 'q2', type: 'SINGLE_CHOICE', questionText: 'Q2 text', verdict: 'WRONG' },
        ],
      },
    ];
    const normalized = normalizeAttemptReview(wire, 42, 10);
    expect(normalized.questionGroups).toHaveLength(2);
    expect(normalized.questionGroups![0].questions![0].questionId).toBe('q1');
    expect(normalized.questionGroups![1].questions![0].questionId).toBe('q2');
  });
});
