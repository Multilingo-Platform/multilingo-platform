import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { createTestStore } from '../../../test-utils/renderWithStore';
import {
  initialState,
  setAnswer,
  setAttemptContext,
  lockAnswers,
  markSavePending,
  markSaveSuccess,
  type AnswerState,
} from '../store/answerSlice';
import { usePracticeFeedback } from '../hooks/usePracticeFeedback';
import * as attemptApi from '../api/attemptApi';
import { PracticeFeedbackContractError } from '../api/practiceFeedbackContract';
import type { WorkspaceResponse, PracticeFeedbackResponse } from '../types/api.types';
import type { Question } from '../types/exam.types';
import { practiceFeedbackFixture as createFixture } from './fixtures/practiceFeedback';

const practiceFeedbackFixture = createFixture();

vi.mock('../api/attemptApi', () => ({
  checkPracticeAnswer: vi.fn(),
}));

const mockQuestions: Question[] = [
  {
    question_id: 'q1',
    question_number: 1,
    type: 'SINGLE_CHOICE',
    question_text: 'Question 1',
    options: [
      { id: 'A', text: 'Option A' },
      { id: 'B', text: 'Option B' },
      { id: 'C', text: 'Option C' },
      { id: 'D', text: 'Option D' },
    ],
    media: null,
  },
  {
    question_id: 'q2',
    question_number: 2,
    type: 'SINGLE_CHOICE',
    question_text: 'Question 2',
    options: [
      { id: 'A', text: 'Option A' },
      { id: 'B', text: 'Option B' },
      { id: 'C', text: 'Option C' },
      { id: 'D', text: 'Option D' },
    ],
    media: null,
  },
  {
    question_id: 'q3',
    question_number: 3,
    type: 'ESSAY',
    question_text: 'Essay question',
    options: null,
    media: null,
  },
];

const practiceWorkspace: WorkspaceResponse = {
  attempt_id: 42,
  status: 'IN_PROGRESS',
  test_scope: 'FULL_EXAM',
  test_mode: 'PRACTICE',
  startTime: '2026-10-10T00:00:00Z',
  serverTime: '2026-10-10T00:00:00Z',
  deadline: null,
  gracePeriodSeconds: 15,
  lockedSections: [],
  version: 7,
  saved_answers: [],
  serverTimeOffset: 0,
  exam_snapshot: {
    exam_id: 1,
    code: 'TEST',
    type: 'IELTS',
    title: 'Test Exam',
    sections: [],
  },
};

function setupHook(options?: {
  workspace?: WorkspaceResponse | null;
  partId?: number | null;
  questions?: readonly Question[];
  isLocked?: boolean;
  preloadedAnswers?: Partial<AnswerState>;
  strictMode?: boolean;
}) {
  const store = createTestStore({
    answers: {
      ...initialState,
      attemptId: options?.workspace?.attempt_id ?? 42,
      contextRevision: 1,
      version: 7,
      isDirty: false,
      answers: {
        10: {
          q1: 'A',
          q2: 'B',
        },
      },
      ...options?.preloadedAnswers,
    },
  });

  const hook = renderHook(
    (props: {
      workspace: WorkspaceResponse | null;
      partId: number | null;
      questions?: readonly Question[];
      isLocked?: boolean;
    }) => {
      const opts: any = {
        workspace: props.workspace,
        partId: props.partId,
        questions: props.questions,
      };
      if (props.isLocked !== undefined) {
        opts.isLocked = props.isLocked;
      }
      return usePracticeFeedback(opts);
    },
    {
      initialProps: {
        workspace: options?.workspace !== undefined ? options.workspace : practiceWorkspace,
        partId: options?.partId !== undefined ? options.partId : 10,
        questions: options && 'questions' in options ? options.questions : mockQuestions,
        isLocked: options?.isLocked,
      },
      wrapper: ({ children }) => (
        <Provider store={store}>
          {options?.strictMode ? <React.StrictMode>{children}</React.StrictMode> : children}
        </Provider>
      ),
    }
  );

  return { ...hook, store };
}

describe('TV3-16-02 usePracticeFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state and idle feedback', () => {
    it('initializes with busy=false, blockedMessage=null, wrongQuestionIds=[]', () => {
      const { result } = setupHook();
      expect(result.current.busy).toBe(false);
      expect(result.current.blockedMessage).toBeNull();
      expect(result.current.wrongQuestionIds).toEqual([]);
      expect(result.current.getFeedback('q1')).toEqual({
        phase: 'idle',
        data: null,
        error: null,
      });
    });
  });

  describe('Eligibility and scope guards (AC-01, AC-07)', () => {
    it('does not check if workspace is null', async () => {
      const { result } = setupHook({ workspace: null });
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
    });

    it('does not check if workspace is MOCK_TEST', async () => {
      const { result } = setupHook({
        workspace: { ...practiceWorkspace, test_mode: 'MOCK_TEST' },
      });
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
    });

    it('does not check if workspace is COMPLETED/SUBMITTED', async () => {
      const { result } = setupHook({
        workspace: { ...practiceWorkspace, status: 'COMPLETED' },
      });
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
    });

    it('does not check if submission isLocked is true', async () => {
      const { result } = setupHook({ isLocked: true });
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
    });

    it('does not check if Redux answers isLocked is true even when isLocked prop is omitted', async () => {
      const { result } = setupHook({
        preloadedAnswers: { isLocked: true },
      });
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
      expect(result.current.getFeedback('q1')).toEqual({
        phase: 'idle',
        data: null,
        error: null,
      });
    });

    it('does not check if Redux lockAnswers is dispatched even when isLocked prop is omitted', async () => {
      const { result, store } = setupHook();
      act(() => {
        store.dispatch(lockAnswers({ attemptId: 42, contextRevision: 1 }));
      });
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
      expect(result.current.getFeedback('q1')).toEqual({
        phase: 'idle',
        data: null,
        error: null,
      });
    });

    it('aborts in-flight check and clears active flight when Redux lockAnswers is dispatched while pending', async () => {
      let capturedSignal!: AbortSignal;
      let resolvePromise!: (val: any) => void;
      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementation(
        (_attemptId, _req, options) => {
          if (options?.signal) capturedSignal = options.signal;
          return new Promise((resolve) => {
            resolvePromise = resolve;
          });
        }
      );

      const { result, store } = setupHook();

      let checkPromise!: Promise<void>;
      act(() => {
        checkPromise = result.current.check('q1');
      });

      expect(result.current.busy).toBe(true);
      expect(result.current.getFeedback('q1').phase).toBe('checking');
      expect(capturedSignal.aborted).toBe(false);

      // Redux submit lock is activated during submission
      act(() => {
        store.dispatch(lockAnswers({ attemptId: 42, contextRevision: 1 }));
      });

      expect(capturedSignal.aborted).toBe(true);
      expect(result.current.busy).toBe(false);
      expect(result.current.getFeedback('q1').phase).toBe('idle');

      // Even if API promise resolves later with feedback, it must be ignored
      await act(async () => {
        resolvePromise(practiceFeedbackFixture);
        await checkPromise;
      });

      expect(result.current.getFeedback('q1')).toEqual({
        phase: 'idle',
        data: null,
        error: null,
      });
    });

    it('aborts in-flight check and clears active flight when isLocked prop becomes true while pending', async () => {
      let capturedSignal!: AbortSignal;
      let resolvePromise!: (val: any) => void;
      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementation(
        (_attemptId, _req, options) => {
          if (options?.signal) capturedSignal = options.signal;
          return new Promise((resolve) => {
            resolvePromise = resolve;
          });
        }
      );

      const { result, rerender } = setupHook({ isLocked: false });

      let checkPromise!: Promise<void>;
      act(() => {
        checkPromise = result.current.check('q1');
      });

      expect(result.current.busy).toBe(true);
      expect(result.current.getFeedback('q1').phase).toBe('checking');
      expect(capturedSignal.aborted).toBe(false);

      // isLocked prop is updated to true
      rerender({
        workspace: practiceWorkspace,
        partId: 10,
        questions: mockQuestions,
        isLocked: true,
      });

      expect(capturedSignal.aborted).toBe(true);
      expect(result.current.busy).toBe(false);
      expect(result.current.getFeedback('q1').phase).toBe('idle');

      await act(async () => {
        resolvePromise(practiceFeedbackFixture);
        await checkPromise;
      });

      expect(result.current.getFeedback('q1')).toEqual({
        phase: 'idle',
        data: null,
        error: null,
      });
    });

    it('does not check if Redux attemptId mismatches workspace attempt_id', async () => {
      const { result } = setupHook({
        preloadedAnswers: { attemptId: 999 }, // mismatch with 42
      });
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
    });

    it('does not check if partId is null or invalid', async () => {
      const { result } = setupHook({ partId: null });
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
    });

    it('does not check if questions list is omitted/undefined (API not called, feedback remains idle)', async () => {
      const { result } = setupHook({ questions: undefined });
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
      expect(result.current.getFeedback('q1')).toEqual({
        phase: 'idle',
        data: null,
        error: null,
      });
    });

    it('does not check if questions list is empty array (API not called, feedback remains idle)', async () => {
      const { result } = setupHook({ questions: [] });
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
      expect(result.current.getFeedback('q1')).toEqual({
        phase: 'idle',
        data: null,
        error: null,
      });
    });

    it('does not check question not present in questions list', async () => {
      const { result } = setupHook();
      await act(async () => {
        await result.current.check('unknown_question_id');
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
      expect(result.current.getFeedback('unknown_question_id')).toEqual({
        phase: 'idle',
        data: null,
        error: null,
      });
    });

    it('does not check ESSAY question, sets fixed notice and error phase', async () => {
      const { result } = setupHook();
      await act(async () => {
        await result.current.check('q3'); // ESSAY
      });
      expect(attemptApi.checkPracticeAnswer).not.toHaveBeenCalled();
      const fb = result.current.getFeedback('q3');
      expect(fb.phase).toBe('error');
      expect(fb.error?.message).toContain('Câu tự luận chưa hỗ trợ kiểm tra tức thì');
      expect(fb.error?.retryable).toBe(false);
    });
  });


  describe('Happy path check and reading store answers (TC_16_01, AC-02, AC-03)', () => {
    it('reads answer from store, calls API with exact tuple and sets ready feedback', async () => {
      const mockFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'CORRECT',
        score: 1,
        userAnswer: 'A',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockFeedback);

      const { result } = setupHook();

      let checkPromise!: Promise<void>;
      act(() => {
        checkPromise = result.current.check('q1');
      });

      expect(result.current.busy).toBe(true);
      expect(result.current.getFeedback('q1').phase).toBe('checking');

      await act(async () => {
        await checkPromise;
      });

      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledWith(
        42,
        { partId: 10, questionId: 'q1', answer: 'A' },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );

      expect(result.current.busy).toBe(false);
      const fb = result.current.getFeedback('q1');
      expect(fb.phase).toBe('ready');
      expect(fb.data).toEqual(mockFeedback);
      expect(fb.error).toBeNull();
      expect(result.current.wrongQuestionIds).toEqual([]);
    });

    it('identifies WRONG question and populates wrongQuestionIds according to question order', async () => {
      const mockWrongFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q2',
        verdict: 'WRONG',
        score: 0,
        userAnswer: 'B',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockWrongFeedback);

      const { result } = setupHook();

      await act(async () => {
        await result.current.check('q2');
      });

      const fb = result.current.getFeedback('q2');
      expect(fb.phase).toBe('ready');
      expect(fb.data?.verdict).toBe('WRONG');
      expect(result.current.wrongQuestionIds).toEqual(['q2']);
    });
  });

  describe('Single-flight mutex & concurrent requests (TC_16_06, AC-04)', () => {
    it('blocks second check call while first check is in flight', async () => {
      let resolveFirst!: (value: PracticeFeedbackResponse) => void;
      vi.mocked(attemptApi.checkPracticeAnswer).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      );

      const { result } = setupHook();

      let p1!: Promise<void>;
      act(() => {
        p1 = result.current.check('q1');
      });

      expect(result.current.busy).toBe(true);

      // Attempt second check while first is running
      await act(async () => {
        await result.current.check('q2');
      });

      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveFirst({
          ...practiceFeedbackFixture,
          partId: 10,
          questionId: 'q1',
        });
        await p1;
      });

      expect(result.current.busy).toBe(false);
    });
  });

  describe('Answer revision tracking and A -> B -> A race condition (TC_16_07, AC-04, AC-06)', () => {
    it('discards response if target answer was edited A -> B -> A during flight, preserving Redux version', async () => {
      let resolveFlight!: (value: PracticeFeedbackResponse) => void;
      vi.mocked(attemptApi.checkPracticeAnswer).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFlight = resolve;
        })
      );

      const { result, store } = setupHook();

      let checkPromise!: Promise<void>;
      act(() => {
        checkPromise = result.current.check('q1');
      });

      expect(result.current.busy).toBe(true);

      // Learner edits answer: A -> B
      act(() => {
        store.dispatch(setAnswer({ partId: 10, questionId: 'q1', value: 'B' }));
      });

      // Learner edits answer back: B -> A
      act(() => {
        store.dispatch(setAnswer({ partId: 10, questionId: 'q1', value: 'A' }));
      });

      // Flight now resolves with response for original 'A'
      await act(async () => {
        resolveFlight({
          ...practiceFeedbackFixture,
          partId: 10,
          questionId: 'q1',
          userAnswer: 'A',
          verdict: 'CORRECT',
        });
        await checkPromise;
      });

      // Response MUST be discarded because revision changed during flight!
      expect(result.current.getFeedback('q1').data).toBeNull();
      expect(result.current.getFeedback('q1').phase).toBe('idle');

      // Redux version and dirty state must not be altered by usePracticeFeedback
      expect(store.getState().answers.version).toBe(7);
      expect(result.current.busy).toBe(false);
    });

    it('invalidates cached feedback when target question answer is changed in Redux', async () => {
      const mockWrongFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'WRONG',
        userAnswer: 'A',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockWrongFeedback);

      const { result, store } = setupHook();

      await act(async () => {
        await result.current.check('q1');
      });

      expect(result.current.getFeedback('q1').phase).toBe('ready');
      expect(result.current.wrongQuestionIds).toEqual(['q1']);

      // Learner edits question q1
      act(() => {
        store.dispatch(setAnswer({ partId: 10, questionId: 'q1', value: 'C' }));
      });

      // Cached feedback for q1 must be cleared immediately
      expect(result.current.getFeedback('q1').phase).toBe('idle');
      expect(result.current.getFeedback('q1').data).toBeNull();
      expect(result.current.wrongQuestionIds).toEqual([]);
    });

    it('does NOT invalidate cached feedback of other questions when another question is edited', async () => {
      const mockWrongFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'WRONG',
        userAnswer: 'A',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockWrongFeedback);

      const { result, store } = setupHook();

      await act(async () => {
        await result.current.check('q1');
      });

      expect(result.current.getFeedback('q1').phase).toBe('ready');

      // Learner edits unrelated question q2
      act(() => {
        store.dispatch(setAnswer({ partId: 10, questionId: 'q2', value: 'D' }));
      });

      // q1 feedback remains untouched
      expect(result.current.getFeedback('q1').phase).toBe('ready');
      expect(result.current.getFeedback('q1').data?.verdict).toBe('WRONG');
      expect(result.current.wrongQuestionIds).toEqual(['q1']);
    });

    it('does NOT invalidate cached feedback on autosave save acknowledgment (markSaveSuccess)', async () => {
      const mockCorrectFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'CORRECT',
        userAnswer: 'A',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockCorrectFeedback);

      const { result, store } = setupHook();

      await act(async () => {
        await result.current.check('q1');
      });

      expect(result.current.getFeedback('q1').phase).toBe('ready');

      // Autosave succeeds: server version increments to 8, saveStatus becomes saved
      act(() => {
        store.dispatch(
          markSavePending({
            attemptId: 42,
            contextRevision: 1,
            requestId: 'save-1',
            pendingVersion: 0,
          })
        );
        store.dispatch(
          markSaveSuccess({
            attemptId: 42,
            contextRevision: 1,
            requestId: 'save-1',
            pendingVersion: 0,
            savedAt: Date.now(),
            serverVersion: 8,
          })
        );
      });

      // Feedback for q1 remains intact
      expect(result.current.getFeedback('q1').phase).toBe('ready');
      expect(result.current.getFeedback('q1').data?.verdict).toBe('CORRECT');
    });
  });

  describe('Part switching and context changes (TC_16_08, AC-04)', () => {
    it('aborts in-flight request when partId changes', async () => {
      let capturedSignal!: AbortSignal;
      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementation(
        (_attemptId, _req, options) => {
          if (options?.signal) capturedSignal = options.signal;
          return new Promise(() => {}); // never resolves
        }
      );

      const { result, rerender } = setupHook({ partId: 10 });

      act(() => {
        void result.current.check('q1');
      });

      expect(result.current.busy).toBe(true);
      expect(capturedSignal.aborted).toBe(false);

      // Learner switches part to 20
      rerender({
        workspace: practiceWorkspace,
        partId: 20,
        questions: mockQuestions,
        isLocked: false,
      });

      expect(capturedSignal.aborted).toBe(true);
      expect(result.current.busy).toBe(false);
      expect(result.current.getFeedback('q1').phase).toBe('idle');
    });

    it('preserves settled feedback in memory when navigating back to same Part in same attempt context', async () => {
      const mockFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'CORRECT',
        userAnswer: 'A',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockFeedback);

      const { result, rerender } = setupHook({ partId: 10 });

      await act(async () => {
        await result.current.check('q1');
      });

      expect(result.current.getFeedback('q1').phase).toBe('ready');

      // Navigate to part 20
      rerender({
        workspace: practiceWorkspace,
        partId: 20,
        questions: mockQuestions,
        isLocked: false,
      });

      // On part 20, q1 has no feedback
      expect(result.current.getFeedback('q1').phase).toBe('idle');

      // Navigate back to part 10
      rerender({
        workspace: practiceWorkspace,
        partId: 10,
        questions: mockQuestions,
        isLocked: false,
      });

      // Feedback for part 10 is still in memory
      expect(result.current.getFeedback('q1').phase).toBe('ready');
      expect(result.current.getFeedback('q1').data?.verdict).toBe('CORRECT');
    });

    it('clears all feedback on attempt context change (rehydrate, new attempt)', async () => {
      const mockFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'CORRECT',
        userAnswer: 'A',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockFeedback);

      const { result, store } = setupHook({ partId: 10 });

      await act(async () => {
        await result.current.check('q1');
      });

      expect(result.current.getFeedback('q1').phase).toBe('ready');

      // Store context changes (e.g. rehydrate or new attempt)
      act(() => {
        store.dispatch(
          setAttemptContext({
            attemptId: 43,
            version: 1,
            savedAnswers: [],
          })
        );
      });

      expect(result.current.getFeedback('q1').phase).toBe('idle');
      expect(result.current.getFeedback('q1').data).toBeNull();
    });

    it('discards stale response after same-attempt rehydrate if answer is edited while check is pending', async () => {
      let resolvePromise!: (val: any) => void;
      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      const { result, store } = setupHook({ partId: 10 });

      // Rehydrate same attempt (attemptId: 42) with savedAnswers containing q1 = 'A'
      act(() => {
        store.dispatch(
          setAttemptContext({
            attemptId: 42,
            version: 8,
            savedAnswers: [
              {
                part_id: 10,
                answers: [{ question_id: 'q1', answer: 'A' }],
              },
            ],
          })
        );
      });

      // Hook starts check for q1 while answer in store is 'A'
      let checkPromise!: Promise<void>;
      act(() => {
        checkPromise = result.current.check('q1');
      });

      expect(result.current.busy).toBe(true);
      expect(result.current.getFeedback('q1').phase).toBe('checking');

      // Learner clears/modifies q1 to null
      act(() => {
        store.dispatch(
          setAnswer({
            partId: 10,
            questionId: 'q1',
            value: null,
          })
        );
      });

      // API settles with feedback for 'A'
      const mockFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'CORRECT',
        userAnswer: 'A',
      };

      await act(async () => {
        resolvePromise(mockFeedback);
        await checkPromise;
      });

      // Stale response must be discarded because answer was modified after check was launched
      expect(result.current.getFeedback('q1')).toEqual({
        phase: 'idle',
        data: null,
        error: null,
      });
    });

    it('preserves ready feedback after same-attempt rehydrate when unrelated dispatch (save/flag) occurs', async () => {
      const mockFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'CORRECT',
        userAnswer: 'A',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValue(mockFeedback);

      const { result, store } = setupHook({ partId: 10 });

      // Rehydrate same attempt (attemptId: 42) with savedAnswers containing q1 = 'A'
      act(() => {
        store.dispatch(
          setAttemptContext({
            attemptId: 42,
            version: 8,
            savedAnswers: [
              {
                part_id: 10,
                answers: [{ question_id: 'q1', answer: 'A' }],
              },
            ],
          })
        );
      });

      // Check q1 and settle feedback to ready
      await act(async () => {
        await result.current.check('q1');
      });

      expect(result.current.getFeedback('q1').phase).toBe('ready');
      expect(result.current.getFeedback('q1').data?.verdict).toBe('CORRECT');

      // Dispatch unrelated action (markSavePending / markSaveSuccess) without modifying answer
      act(() => {
        store.dispatch(
          markSavePending({
            attemptId: 42,
            contextRevision: 2,
            requestId: 'save-after-rehydrate',
            pendingVersion: 0,
          })
        );
        store.dispatch(
          markSaveSuccess({
            attemptId: 42,
            contextRevision: 2,
            requestId: 'save-after-rehydrate',
            pendingVersion: 0,
            savedAt: Date.now(),
            serverVersion: 9,
          })
        );
      });

      // Feedback for q1 must remain intact ('ready') and NOT be invalidated
      expect(result.current.getFeedback('q1').phase).toBe('ready');
      expect(result.current.getFeedback('q1').data?.verdict).toBe('CORRECT');
    });
  });

  describe('Error classification and blocking behavior (TC_16_09)', () => {
    it('handles 401/403: clears solutions in memory and sets blockedMessage', async () => {
      const mockFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'CORRECT',
        userAnswer: 'A',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockFeedback);

      const { result } = setupHook();

      // First check succeeds
      await act(async () => {
        await result.current.check('q1');
      });
      expect(result.current.getFeedback('q1').phase).toBe('ready');

      // Second check returns 403
      vi.mocked(attemptApi.checkPracticeAnswer).mockRejectedValueOnce({
        response: { status: 403, data: { message: 'Forbidden' } },
      });

      await act(async () => {
        await result.current.check('q2');
      });

      // Solutions cleared
      expect(result.current.getFeedback('q1').data).toBeNull();
      expect(result.current.getFeedback('q2').data).toBeNull();
      expect(result.current.blockedMessage).toBeTruthy();
      expect(result.current.blockedMessage).toContain('hết hạn hoặc không có quyền');

      // Subsequent check blocked
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(2);
    });

    it('handles 409: blocks feedback and prompts authoritative reload', async () => {
      vi.mocked(attemptApi.checkPracticeAnswer).mockRejectedValueOnce({
        response: { status: 409, data: { message: 'Conflict' } },
      });

      const { result } = setupHook();

      await act(async () => {
        await result.current.check('q1');
      });

      expect(result.current.blockedMessage).toBeTruthy();
      expect(result.current.blockedMessage).toContain('tải lại trang');
      expect(result.current.getFeedback('q1').phase).toBe('error');
      expect(result.current.getFeedback('q1').error?.retryable).toBe(false);
      expect(result.current.getFeedback('q1').error?.message).toContain('tải lại trang');
    });

    it('handles 400/404/422: sets non-retryable error on question and sets blockedMessage', async () => {
      vi.mocked(attemptApi.checkPracticeAnswer).mockRejectedValueOnce({
        response: { status: 422, data: { message: 'Unprocessable' } },
      });

      const { result } = setupHook();

      await act(async () => {
        await result.current.check('q1');
      });

      const fb = result.current.getFeedback('q1');
      expect(fb.phase).toBe('error');
      expect(fb.error?.retryable).toBe(false);
      expect(fb.error?.message).toContain('tải lại trang');
      expect(result.current.blockedMessage).toBeTruthy();
      expect(result.current.blockedMessage).toContain('tải lại trang');

      // Subsequent check blocked
      await act(async () => {
        await result.current.check('q2');
      });
      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);
    });

    it('handles edit-during-flight race on 401/403: clears prior solutions, sets blockedMessage, ends busy, and blocks subsequent checks', async () => {
      // Step 1: q1 check succeeds and stores ready solution
      const mockFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'CORRECT',
        userAnswer: 'A',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockFeedback);

      const { result, store } = setupHook();

      await act(async () => {
        await result.current.check('q1');
      });
      expect(result.current.getFeedback('q1').phase).toBe('ready');
      expect(result.current.getFeedback('q1').data).not.toBeNull();

      // Step 2: start check on q2 with deferred promise
      let rejectCheckQ2!: (err: any) => void;
      const pendingQ2Promise = new Promise<PracticeFeedbackResponse>((_, reject) => {
        rejectCheckQ2 = reject;
      });
      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementationOnce(() => pendingQ2Promise);

      act(() => {
        void result.current.check('q2');
      });
      expect(result.current.busy).toBe(true);
      expect(result.current.getFeedback('q2').phase).toBe('checking');

      // Step 3: user edits q2 in Redux while check is in-flight (race condition)
      act(() => {
        store.dispatch(setAnswer({ partId: 10, questionId: 'q2', value: 'A' }));
      });

      // Step 4: check on q2 rejects with 403
      await act(async () => {
        rejectCheckQ2({
          response: { status: 403, data: { message: 'Forbidden' } },
        });
      });

      // Assertions:
      // Busy must end
      expect(result.current.busy).toBe(false);
      // blockedMessage must be set
      expect(result.current.blockedMessage).toBeTruthy();
      expect(result.current.blockedMessage).toContain('hết hạn hoặc không có quyền');
      // Prior solution for q1 must be wiped
      expect(result.current.getFeedback('q1').data).toBeNull();
      // Question q2 phase is error with non-retryable
      expect(result.current.getFeedback('q2').phase).toBe('error');
      expect(result.current.getFeedback('q2').error?.retryable).toBe(false);

      // Subsequent check on q1 or q2 is blocked without issuing HTTP requests
      await act(async () => {
        await result.current.check('q1');
        await result.current.check('q2');
      });
      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(2);
    });

    it('handles edit-during-flight race on 409: sets blockedMessage for authoritative reload, ends busy, and blocks subsequent checks', async () => {
      let rejectCheckQ1!: (err: any) => void;
      const pendingQ1Promise = new Promise<PracticeFeedbackResponse>((_, reject) => {
        rejectCheckQ1 = reject;
      });
      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementationOnce(() => pendingQ1Promise);

      const { result, store } = setupHook();

      act(() => {
        void result.current.check('q1');
      });
      expect(result.current.busy).toBe(true);

      // User edits answer while in-flight (A -> B -> A)
      act(() => {
        store.dispatch(setAnswer({ partId: 10, questionId: 'q1', value: 'B' }));
        store.dispatch(setAnswer({ partId: 10, questionId: 'q1', value: 'A' }));
      });

      // Server rejects with 409
      await act(async () => {
        rejectCheckQ1({
          response: { status: 409, data: { message: 'Conflict' } },
        });
      });

      expect(result.current.busy).toBe(false);
      expect(result.current.blockedMessage).toBeTruthy();
      expect(result.current.blockedMessage).toContain('tải lại trang');
      expect(result.current.getFeedback('q1').phase).toBe('error');
      expect(result.current.getFeedback('q1').error?.retryable).toBe(false);

      // Subsequent check is blocked
      await act(async () => {
        await result.current.check('q1');
      });
      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);
    });

    it('handles edit-during-flight race on 422: sets blockedMessage for reload, ends busy, and blocks subsequent checks', async () => {
      let rejectCheckQ1!: (err: any) => void;
      const pendingQ1Promise = new Promise<PracticeFeedbackResponse>((_, reject) => {
        rejectCheckQ1 = reject;
      });
      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementationOnce(() => pendingQ1Promise);

      const { result, store } = setupHook();

      act(() => {
        void result.current.check('q1');
      });
      expect(result.current.busy).toBe(true);

      // User edits answer while in-flight
      act(() => {
        store.dispatch(setAnswer({ partId: 10, questionId: 'q1', value: 'B' }));
      });

      // Server rejects with 422
      await act(async () => {
        rejectCheckQ1({
          response: { status: 422, data: { message: 'Unprocessable' } },
        });
      });

      expect(result.current.busy).toBe(false);
      expect(result.current.blockedMessage).toBeTruthy();
      expect(result.current.blockedMessage).toContain('tải lại trang');
      expect(result.current.getFeedback('q1').phase).toBe('error');
      expect(result.current.getFeedback('q1').error?.retryable).toBe(false);

      // Subsequent check is blocked
      await act(async () => {
        await result.current.check('q2');
      });
      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);
    });

    it('discards stale error when context or part changes while in-flight and does NOT block new context', async () => {
      let rejectFlight!: (err: any) => void;
      const pendingPromise = new Promise<PracticeFeedbackResponse>((_, reject) => {
        rejectFlight = reject;
      });
      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementationOnce(() => pendingPromise);

      const { result, rerender, store } = setupHook({
        workspace: { ...practiceWorkspace, attempt_id: 42 },
        partId: 10,
      });

      act(() => {
        void result.current.check('q1');
      });
      expect(result.current.busy).toBe(true);

      // Context changes: navigate to attempt 43
      act(() => {
        store.dispatch(
          setAttemptContext({
            attemptId: 43,
            version: 1,
            savedAnswers: [],
          })
        );
      });
      rerender({
        workspace: { ...practiceWorkspace, attempt_id: 43 },
        partId: 10,
        questions: mockQuestions,
        isLocked: false,
      });

      // Now old in-flight request for attempt 42 rejects with 403
      await act(async () => {
        rejectFlight({
          response: { status: 403, data: { message: 'Forbidden' } },
        });
      });

      // The new context (attempt 43) must NOT be blocked!
      expect(result.current.blockedMessage).toBeNull();
      expect(result.current.getFeedback('q1').phase).toBe('idle');
      expect(result.current.busy).toBe(false);
    });

    it('handles timeout: sets retryable error on question', async () => {
      vi.mocked(attemptApi.checkPracticeAnswer).mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      });

      const { result } = setupHook();

      await act(async () => {
        await result.current.check('q1');
      });

      const fb = result.current.getFeedback('q1');
      expect(fb.phase).toBe('error');
      expect(fb.error?.retryable).toBe(true);
      expect(fb.error?.message).toContain('Hết thời gian chờ');
    });

    it('handles contract error: sets retryable error on question', async () => {
      vi.mocked(attemptApi.checkPracticeAnswer).mockRejectedValueOnce(
        new PracticeFeedbackContractError('Tuple mismatch')
      );

      const { result } = setupHook();

      await act(async () => {
        await result.current.check('q1');
      });

      const fb = result.current.getFeedback('q1');
      expect(fb.phase).toBe('error');
      expect(fb.error?.retryable).toBe(true);
      expect(fb.error?.message).toContain('không hợp lệ');
    });

    it('rejects feedback with fixed contract error when response type does not match workspace question type', async () => {
      // Question q1 has type 'SINGLE_CHOICE'
      // Mock API returns response with type 'MULTIPLE_CHOICE'
      const mismatchedResponse: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        type: 'MULTIPLE_CHOICE',
        verdict: 'CORRECT',
        correctAnswer: ['A', 'B'],
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mismatchedResponse);

      const { result } = setupHook();

      await act(async () => {
        await result.current.check('q1');
      });

      const fb = result.current.getFeedback('q1');
      expect(fb.phase).toBe('error');
      expect(fb.data).toBeNull();
      expect(fb.error).toEqual({
        message: 'Dữ liệu phản hồi từ máy chủ không hợp lệ. Vui lòng thử lại.',
        retryable: true,
      });
    });
  });


  describe('hideFeedback and suspend operations', () => {
    it('hideFeedback resets feedback for specified question IDs only', async () => {
      const mockFb1: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'WRONG',
      };
      const mockFb2: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q2',
        verdict: 'CORRECT',
      };
      vi.mocked(attemptApi.checkPracticeAnswer)
        .mockResolvedValueOnce(mockFb1)
        .mockResolvedValueOnce(mockFb2);

      const { result } = setupHook();

      await act(async () => {
        await result.current.check('q1');
        await result.current.check('q2');
      });

      expect(result.current.getFeedback('q1').phase).toBe('ready');
      expect(result.current.getFeedback('q2').phase).toBe('ready');

      act(() => {
        result.current.hideFeedback(['q1']);
      });

      expect(result.current.getFeedback('q1').phase).toBe('idle');
      expect(result.current.getFeedback('q1').data).toBeNull();
      expect(result.current.getFeedback('q2').phase).toBe('ready');
    });

    it('suspend cancels in-flight request and clears all feedback in memory', async () => {
      let capturedSignal!: AbortSignal;
      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementation(
        (_attemptId, _req, options) => {
          if (options?.signal) capturedSignal = options.signal;
          return new Promise(() => {});
        }
      );

      const { result } = setupHook();

      act(() => {
        void result.current.check('q1');
      });

      expect(result.current.busy).toBe(true);

      act(() => {
        result.current.suspend();
      });

      expect(capturedSignal.aborted).toBe(true);
      expect(result.current.busy).toBe(false);
      expect(result.current.getFeedback('q1').phase).toBe('idle');
    });
  });

  describe('Storage isolation and Redux purity (AC-06, AC-07)', () => {
    it('never writes to localStorage or sessionStorage during feedback operations', async () => {
      const mockFeedback: PracticeFeedbackResponse = {
        ...practiceFeedbackFixture,
        partId: 10,
        questionId: 'q1',
        verdict: 'CORRECT',
      };
      vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockFeedback);

      const { result } = setupHook();

      await act(async () => {
        await result.current.check('q1');
      });

      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('Lifecycle and navigation edge cases (AC-04)', () => {
    it('StrictMode mount and cleanup works cleanly with double-invoked effects', async () => {
      let capturedSignal!: AbortSignal;
      let resolveCheck!: (val: any) => void;
      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementation(
        (_attemptId, _req, options) => {
          if (options?.signal) capturedSignal = options.signal;
          return new Promise((resolve) => {
            resolveCheck = resolve;
          });
        }
      );

      const { result } = setupHook({ strictMode: true });

      // In StrictMode, mount -> cleanup -> mount happens. Hook should be in clean idle state.
      expect(result.current.busy).toBe(false);
      expect(result.current.getFeedback('q1').phase).toBe('idle');

      act(() => {
        void result.current.check('q1');
      });

      expect(result.current.busy).toBe(true);
      expect(capturedSignal.aborted).toBe(false);

      await act(async () => {
        resolveCheck({
          attemptId: 42,
          partId: 10,
          questionId: 'q1',
          type: 'SINGLE_CHOICE',
          userAnswer: 'A',
          verdict: 'CORRECT',
          score: 1,
          correctAnswer: 'A',
          explanation: null,
        });
      });

      expect(result.current.busy).toBe(false);
      expect(result.current.getFeedback('q1').phase).toBe('ready');
      expect(result.current.getFeedback('q1').data?.verdict).toBe('CORRECT');
    });

    it('route navigation A -> B -> A aborts in-flight flight and late-settled response is discarded', async () => {
      let resolveFlightA1!: (val: any) => void;
      let capturedSignalA1!: AbortSignal;

      vi.mocked(attemptApi.checkPracticeAnswer).mockImplementation(
        (_attemptId, _req, options) => {
          if (options?.signal) capturedSignalA1 = options.signal;
          return new Promise((resolve) => {
            resolveFlightA1 = resolve;
          });
        }
      );

      const { result, rerender, store } = setupHook({
        workspace: { ...practiceWorkspace, attempt_id: 42 },
        partId: 10,
      });

      act(() => {
        void result.current.check('q1');
      });

      expect(result.current.busy).toBe(true);
      expect(capturedSignalA1.aborted).toBe(false);

      // Navigate to route B (attempt 43)
      act(() => {
        store.dispatch(
          setAttemptContext({
            attemptId: 43,
            version: 1,
            savedAnswers: [],
          })
        );
      });
      rerender({
        workspace: { ...practiceWorkspace, attempt_id: 43 },
        partId: 10,
        questions: mockQuestions,
        isLocked: false,
      });

      expect(capturedSignalA1.aborted).toBe(true);
      expect(result.current.busy).toBe(false);
      expect(result.current.getFeedback('q1').phase).toBe('idle');

      // Navigate back to route A (attempt 42)
      act(() => {
        store.dispatch(
          setAttemptContext({
            attemptId: 42,
            version: 7,
            savedAnswers: [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }],
          })
        );
      });
      rerender({
        workspace: { ...practiceWorkspace, attempt_id: 42 },
        partId: 10,
        questions: mockQuestions,
        isLocked: false,
      });

      expect(result.current.busy).toBe(false);
      expect(result.current.getFeedback('q1').phase).toBe('idle');

      // Now late flight A1 resolves!
      await act(async () => {
        resolveFlightA1({
          attemptId: 42,
          partId: 10,
          questionId: 'q1',
          type: 'SINGLE_CHOICE',
          userAnswer: 'A',
          verdict: 'CORRECT',
          score: 1,
          correctAnswer: 'A',
          explanation: null,
        });
      });

      // Crucial: late response from flight A1 MUST be discarded, phase remains idle, data is null
      expect(result.current.getFeedback('q1').phase).toBe('idle');
      expect(result.current.getFeedback('q1').data).toBeNull();
      expect(result.current.busy).toBe(false);
    });
  });
});
