import { validAiDoneTextOnlyWire } from './writingFeedback';
import type { ExamReviewResponse } from '../../types/api.types';

/**
 * TV3-22-03 lifecycle wire fixtures.
 *
 * These fixtures deliberately use the backend wire shape (camelCase and snake_case aliases) so the
 * lifecycle test exercises the real normalizers (`examApi`, `attemptApi`, `resultContract`,
 * `reviewContract`, `writingFeedbackContract`) instead of pre-normalized objects.
 */

export const LIFECYCLE_EXAM_ID = 1;
export const LIFECYCLE_ATTEMPT_ID = 77;
export const LIFECYCLE_WRITING_SECTION_ID = 200;
export const LIFECYCLE_WRITING_PART_ID = 201;
export const LIFECYCLE_ESSAY_QUESTION_ID = 'essay';

export function lifecycleEnvelope(data: unknown) {
  return {
    success: true,
    code: 1000,
    message: 'Success',
    data,
    timestamp: '2026-10-19T00:00:00Z',
  };
}

export function lifecycleExamStructure() {
  return {
    id: LIFECYCLE_EXAM_ID,
    code: 'TV3-22-LIFECYCLE',
    title: 'TV3 Lifecycle Exam',
    type: 'IELTS',
    durationMinutes: 60,
    sections: [
      {
        id: LIFECYCLE_WRITING_SECTION_ID,
        skillType: 'WRITING',
        title: 'Writing',
        durationMinutes: 60,
        orderIndex: 1,
        parts: [
          {
            id: LIFECYCLE_WRITING_PART_ID,
            partNumber: 1,
            title: 'Writing Task 1',
          },
        ],
      },
    ],
  };
}

function essayQuestion() {
  return {
    id: 1,
    question_id: LIFECYCLE_ESSAY_QUESTION_ID,
    questionId: LIFECYCLE_ESSAY_QUESTION_ID,
    question_number: 1,
    questionNumber: 1,
    type: 'ESSAY',
    question_text: 'Describe the chart in at least 120 words.',
    prompt: 'Describe the chart in at least 120 words.',
  };
}

/** Snapshot without correct answers, as returned by GET workspace / POST attempts. */
export function lifecycleWritingSnapshot() {
  const question = essayQuestion();
  return {
    exam_id: LIFECYCLE_EXAM_ID,
    code: 'TV3-22-LIFECYCLE',
    title: 'TV3 Lifecycle Exam',
    type: 'IELTS',
    sections: [
      {
        id: LIFECYCLE_WRITING_SECTION_ID,
        section_id: LIFECYCLE_WRITING_SECTION_ID,
        skill_type: 'WRITING',
        title: 'Writing',
        duration_minutes: 60,
        parts: [
          {
            id: LIFECYCLE_WRITING_PART_ID,
            part_id: LIFECYCLE_WRITING_PART_ID,
            part_number: 1,
            title: 'Writing Task 1',
            instruction: 'Write a report describing the chart.',
            questions: [question],
            question_groups: [
              {
                group_id: 'writing-task-1',
                instruction: null,
                questions: [question],
              },
            ],
            questionGroups: [
              {
                group_id: 'writing-task-1',
                instruction: null,
                questions: [question],
              },
            ],
          },
        ],
      },
    ],
  };
}

export interface LifecycleWorkspaceOptions {
  attemptId?: number;
  version?: number;
  essay?: string;
  mode?: 'MOCK_TEST' | 'PRACTICE';
}

export function lifecycleWorkspace(options: LifecycleWorkspaceOptions = {}) {
  const attemptId = options.attemptId ?? LIFECYCLE_ATTEMPT_ID;
  const mode = options.mode ?? 'MOCK_TEST';
  const snapshot = lifecycleWritingSnapshot();
  const savedAnswers = [
    {
      part_id: LIFECYCLE_WRITING_PART_ID,
      answers: [
        {
          question_id: LIFECYCLE_ESSAY_QUESTION_ID,
          answer: options.essay ?? 'SERVER_A',
        },
      ],
    },
  ];

  return {
    attempt_id: attemptId,
    attemptId,
    status: 'IN_PROGRESS',
    test_scope: 'SINGLE_PART',
    testScope: 'SINGLE_PART',
    test_mode: mode,
    testMode: mode,
    startTime: '2026-10-18T00:00:00Z',
    serverTime: '2026-10-18T00:00:00Z',
    deadline: mode === 'MOCK_TEST' ? '2030-01-01T00:00:00Z' : null,
    gracePeriodSeconds: 15,
    grace_period_seconds: 15,
    lockedSections: [],
    locked_sections: [],
    version: options.version ?? 7,
    savedAnswers,
    saved_answers: savedAnswers,
    exam_snapshot: snapshot,
    examSnapshot: snapshot,
  };
}

/** Result payload where every value is owned by the result GET, not by the submit receipt. */
export function lifecycleResult(attemptId = LIFECYCLE_ATTEMPT_ID, mode: 'MOCK_TEST' | 'PRACTICE' = 'MOCK_TEST') {
  const stats = {
    rawScore: 7,
    correct: 1,
    incorrect: 0,
    unanswered: 0,
    total: 1,
    accuracy: 100,
  };

  return {
    attemptId,
    status: 'AI_GRADING',
    testScope: 'SINGLE_PART',
    testMode: mode,
    startTime: '2026-10-18T00:00:00Z',
    endTime: '2026-10-18T00:40:00Z',
    timeSpentSeconds: 2400,
    overallScore: 7,
    summaryAvailable: true,
    resultSummary: {
      partResults: {
        [String(LIFECYCLE_WRITING_PART_ID)]: {
          [LIFECYCLE_ESSAY_QUESTION_ID]: {
            questionId: LIFECYCLE_ESSAY_QUESTION_ID,
            verdict: 'PENDING',
            score: 0,
          },
        },
      },
      totalScore: 7,
      correctCount: 1,
      totalObjectiveCount: 1,
      sectionScores: { WRITING: 7 },
      objective: {
        ...stats,
        scoreUnit: 'RAW_OBJECTIVE',
        bySkill: [{ ...stats, skill: 'WRITING' }],
        byPart: [
          {
            ...stats,
            partId: LIFECYCLE_WRITING_PART_ID,
            label: 'Writing Task 1',
            skill: 'WRITING',
          },
        ],
      },
      writing: {
        status: 'PENDING',
        tasks: [
          {
            partId: LIFECYCLE_WRITING_PART_ID,
            questionId: LIFECYCLE_ESSAY_QUESTION_ID,
            label: 'Task 1: Chart description',
            status: 'PENDING',
            wordCount: 154,
            score: null,
            maxScore: null,
          },
        ],
      },
    },
    reviewParts: [{ id: LIFECYCLE_WRITING_PART_ID, label: 'Writing Task 1' }],
  };
}

/** Review payload scoped to the Writing Part. */
export function lifecycleReview(
  attemptId = LIFECYCLE_ATTEMPT_ID,
  partId = LIFECYCLE_WRITING_PART_ID
): ExamReviewResponse {
  return {
    attemptId,
    partId,
    partTitle: 'Writing Task 1',
    skill: 'WRITING',
    partStats: {
      score: 0,
      correctCount: 0,
      incorrectCount: 0,
      unansweredCount: 1,
      totalQuestions: 1,
      accuracy: 0,
      isCorrectFlags: {},
    },
    userAnswers: { [LIFECYCLE_ESSAY_QUESTION_ID]: 'C' },
    questions: [
      {
        questionId: LIFECYCLE_ESSAY_QUESTION_ID,
        type: 'ESSAY',
        questionText: 'Describe the chart in at least 120 words.',
        prompt: 'Write a report describing the chart.',
        label: 'Question 1',
        explanation: 'Use a clear overview and support it with key figures.',
        correctAnswer: null,
        userAnswer: 'C',
        verdict: 'PENDING',
        score: null,
        options: null,
      },
    ],
    questionGroups: [],
    examData: { title: 'Writing Task 1' },
    partResult: {},
    isCorrectFlags: {},
  };
}

/**
 * Review payload with A-C audio-only options (empty text) plus HTML-like option/explanation text.
 * Used to prove empty option IDs stay visible and unsafe markup is sanitized.
 */
export function lifecycleEmptyOptionReview(
  attemptId = LIFECYCLE_ATTEMPT_ID,
  partId = LIFECYCLE_WRITING_PART_ID
): ExamReviewResponse {
  return {
    attemptId,
    partId,
    partTitle: 'Listening Task 1',
    skill: 'LISTENING',
    partStats: {
      score: 0,
      correctCount: 0,
      incorrectCount: 1,
      unansweredCount: 1,
      totalQuestions: 2,
      accuracy: 0,
      isCorrectFlags: { 'q-empty': false, 'q-html': false },
    },
    userAnswers: { 'q-empty': null, 'q-html': 'A' },
    questions: [
      {
        questionId: 'q-empty',
        type: 'SINGLE_CHOICE',
        questionText: 'Choose the statement that matches the audio.',
        label: 'Question 1',
        explanation: null,
        correctAnswer: null,
        userAnswer: null,
        verdict: 'BLANK',
        score: 0,
        options: [
          { id: 'A', text: '' },
          { id: 'B', text: '   ' },
          { id: 'C', content: '' },
        ],
      },
      {
        questionId: 'q-html',
        type: 'SINGLE_CHOICE',
        questionText: 'Choose the safe option.',
        label: 'Question 2',
        explanation:
          '<script>window.__tv3Pwned = "explanation"</script><b>Safe explanation</b>',
        correctAnswer: 'B',
        userAnswer: 'A',
        verdict: 'WRONG',
        score: 0,
        options: [
          {
            id: 'A',
            text: '<img src=x onerror="window.__tv3Pwned = \'option\'">Safe option text',
          },
          { id: 'B', text: '<b>Visible bold</b> answer', isCorrect: true },
          { id: 'C', text: '<script>window.__tv3Pwned = "option"</script>Safe C' },
        ],
      },
    ],
    questionGroups: [],
    examData: { title: 'Listening Task 1' },
    partResult: {},
    isCorrectFlags: { 'q-empty': false, 'q-html': false },
  };
}

/** Valid AI feedback re-scoped to the lifecycle attempt/part/question. */
export function lifecycleWritingFeedback(
  attemptId = LIFECYCLE_ATTEMPT_ID,
  partId = LIFECYCLE_WRITING_PART_ID
) {
  return {
    ...validAiDoneTextOnlyWire,
    attemptId,
    partId,
    tasks: [
      {
        ...validAiDoneTextOnlyWire.tasks[0],
        questionId: LIFECYCLE_ESSAY_QUESTION_ID,
        label: 'Task 1: Chart description',
      },
    ],
  };
}
