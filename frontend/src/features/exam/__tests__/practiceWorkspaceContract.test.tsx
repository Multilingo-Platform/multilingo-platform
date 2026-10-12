import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import answerReducer, { setAttemptContext } from '../store/answerSlice';
import WorkspacePage from '../pages/WorkspacePage';
import axiosClient from '../../../core/api/axiosClient';

vi.mock('../../../core/api/axiosClient', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

const http = vi.mocked(axiosClient);
const now = Date.parse('2026-10-10T12:00:00Z');

const mockExamSnapshot = {
  exam_id: 1,
  code: 'TV3-16',
  title: 'Practice Contract Exam',
  type: 'IELTS',
  sections: [
    {
      id: 100,
      section_id: 100,
      skill_type: 'READING' as const,
      title: 'Reading Section',
      parts: [
        {
          id: 10,
          part_id: 10,
          title: 'Part 1',
          content: {
            part_title: 'Part 1 Reading',
            content_html: '<p>Reading passage 1</p>',
            question_groups: [
              {
                group_id: 'g1',
                instruction: 'Choose the correct answer',
                questions: [
                  {
                    id: 1,
                    question_id: 'q1',
                    question_number: 1,
                    type: 'SINGLE_CHOICE',
                    question_text: 'What is the answer for Q1 in Part 1?',
                    options: [
                      { id: 'A', text: 'Option A' },
                      { id: 'B', text: 'Option B' },
                    ],
                  },
                  {
                    id: 2,
                    question_id: 'q2',
                    question_number: 2,
                    type: 'SINGLE_CHOICE',
                    question_text: 'What is the answer for Q2 in Part 1?',
                    options: [
                      { id: 'A', text: 'Option A' },
                      { id: 'B', text: 'Option B' },
                    ],
                  },
                ],
              },
            ],
          },
        },
        {
          id: 20,
          part_id: 20,
          title: 'Part 2',
          content: {
            part_title: 'Part 2 Reading',
            content_html: '<p>Reading passage 2</p>',
            question_groups: [
              {
                group_id: 'g2',
                instruction: 'Choose the correct answer',
                questions: [
                  {
                    id: 3,
                    question_id: 'q1', // Same question_id 'q1' as Part 10 to verify cross-part isolation
                    question_number: 3,
                    type: 'SINGLE_CHOICE',
                    question_text: 'What is the answer for Q1 in Part 2?',
                    options: [
                      { id: 'A', text: 'Part 2 Option A' },
                      { id: 'B', text: 'Part 2 Option B' },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
};

function practiceWorkspace(
  version = 7,
  savedAnswers: Array<{ part_id: number; answers: Array<{ question_id: string; answer: string }> }> = [
    { part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] },
  ]
) {
  return {
    success: true,
    data: {
      attemptId: 42,
      status: 'IN_PROGRESS',
      testScope: 'FULL_EXAM',
      testMode: 'PRACTICE',
      startTime: new Date(now - 60000).toISOString(),
      serverTime: new Date(now).toISOString(),
      deadline: null, // Practice mode must have null deadline
      gracePeriodSeconds: 15,
      lockedSections: [],
      version,
      savedAnswers,
      examSnapshot: structuredClone(mockExamSnapshot),
    },
  };
}

function mockWorkspace(version = 7, deadline = now + 3600000) {
  return {
    success: true,
    data: {
      attemptId: 42,
      status: 'IN_PROGRESS',
      testScope: 'FULL_EXAM',
      testMode: 'MOCK_TEST',
      startTime: new Date(now - 60000).toISOString(),
      serverTime: new Date(now).toISOString(),
      deadline: new Date(deadline).toISOString(),
      gracePeriodSeconds: 15,
      lockedSections: [],
      version,
      savedAnswers: [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }],
      examSnapshot: structuredClone(mockExamSnapshot),
    },
  };
}

function mount(initialRoute = '/attempts/42/workspace', strict = false) {
  const store = configureStore({ reducer: { answers: answerReducer } });
  const content = (
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
          <Route
            path="/attempts/:attemptId/result"
            element={<div data-testid="confirmed-result">Result Page</div>}
          />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return { store, ...render(strict ? <StrictMode>{content}</StrictMode> : content) };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function submitExam() {
  fireEvent.click(screen.getByRole('button', { name: /^🚀?\s*nộp bài$/i }));
  const confirmBtns = screen.getAllByRole('button', { name: /nộp bài/i });
  const modalBtn = confirmBtns[confirmBtns.length - 1];
  if (modalBtn.hasAttribute('disabled')) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
  }
  fireEvent.click(modalBtn);
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.resetAllMocks();
  localStorage.clear();
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TV3-16 Practice Workspace Integration Contract', () => {
  it('TC_16_13: full Practice lifecycle (GET v7 -> edit B -> check WRONG -> retry edit A -> check CORRECT -> autosave PUT v8 -> submit baseVersion 8 / finalAnswers A)', async () => {
    http.get.mockResolvedValueOnce(practiceWorkspace(7, [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }]) as never);

    const view = mount();
    await flush();

    // Verify initial load: Q1 option A is selected
    const q1El = document.getElementById('q-q1')!;
    expect(q1El).toBeInTheDocument();
    const radioA = within(q1El).getByRole('radio', { name: 'Option A' });
    const radioB = within(q1El).getByRole('radio', { name: 'Option B' });
    expect(radioA).toBeChecked();
    expect(radioB).not.toBeChecked();

    // Step 1: Edit answer from A to B
    fireEvent.click(radioB);
    expect(radioB).toBeChecked();
    expect(view.store.getState().answers.answers[10]?.q1).toBe('B');
    expect(view.store.getState().answers.version).toBe(7);
    expect(view.store.getState().answers.isDirty).toBe(true);

    // Step 2: Check feedback for Q1 (returns WRONG)
    http.post.mockResolvedValueOnce({
      success: true,
      data: {
        attemptId: 42,
        partId: 10,
        questionId: 'q1',
        type: 'SINGLE_CHOICE',
        userAnswer: 'B',
        verdict: 'WRONG',
        score: 0,
        correctAnswer: 'A',
        explanation: 'Option A is the correct answer according to the text.',
      },
    } as never);

    const checkBtnQ1 = within(q1El).getByRole('button', { name: /kiểm tra đáp án/i });
    fireEvent.click(checkBtnQ1);
    await flush();

    // Verify feedback API call
    expect(http.post).toHaveBeenCalledOnce();
    expect(http.post.mock.calls[0][0]).toBe('/v1/attempts/42/practice-feedback');
    expect(http.post.mock.calls[0][1]).toEqual({
      partId: 10,
      questionId: 'q1',
      answer: 'B',
    });

    // Verify feedback UI: WRONG verdict displayed
    expect(within(q1El).getByText(/chưa chính xác/i)).toBeInTheDocument();
    expect(within(q1El).getByText(/Option A is the correct answer/i)).toBeInTheDocument();

    // Invariant: Practice check does NOT change Redux version or answers, does NOT trigger autosave PUT
    expect(view.store.getState().answers.version).toBe(7);
    expect(view.store.getState().answers.answers[10]?.q1).toBe('B');
    expect(http.put).not.toHaveBeenCalled();

    // Step 3: Retry round
    // Retry toolbar should display wrong count: "Luyện lại câu sai (1)"
    const retryBtn = screen.getByRole('button', { name: /luyện lại câu sai/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);

    // In retry mode: toolbar shows "Về toàn bộ câu", non-wrong questions are filtered out
    expect(screen.getByRole('button', { name: /về toàn bộ câu/i })).toBeInTheDocument();
    expect(document.getElementById('q-q1')).toBeInTheDocument();
    expect(document.getElementById('q-q2')).not.toBeInTheDocument();

    // Step 4: Edit answer in retry mode from B to A
    const q1InRetry = document.getElementById('q-q1')!;
    const radioAInRetry = within(q1InRetry).getByRole('radio', { name: 'Option A' });
    fireEvent.click(radioAInRetry);
    expect(view.store.getState().answers.answers[10]?.q1).toBe('A');

    // Step 5: Check feedback for Q1 (returns CORRECT)
    http.post.mockResolvedValueOnce({
      success: true,
      data: {
        attemptId: 42,
        partId: 10,
        questionId: 'q1',
        type: 'SINGLE_CHOICE',
        userAnswer: 'A',
        verdict: 'CORRECT',
        score: 1,
        correctAnswer: 'A',
        explanation: 'Excellent, option A is correct.',
      },
    } as never);

    const checkBtnRetry = within(q1InRetry).getByRole('button', { name: /kiểm tra đáp án/i });
    fireEvent.click(checkBtnRetry);
    await flush();

    // Verify CORRECT feedback displayed
    expect(within(q1InRetry).getByText(/chính xác/i)).toBeInTheDocument();

    // Invariant: Q1 stays in the retry round even after becoming CORRECT
    expect(document.getElementById('q-q1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /về toàn bộ câu/i })).toBeInTheDocument();

    // Step 6: Autosave PUT A returns v8
    http.put.mockResolvedValueOnce({
      success: true,
      data: { version: 8 },
    } as never);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(http.put).toHaveBeenCalledOnce();
    expect(http.put.mock.calls[0][0]).toBe('/v1/attempts/42/answers');
    expect(http.put.mock.calls[0][1]).toEqual({
      version: 7,
      answers: [
        {
          part_id: 10,
          answers: [{ question_id: 'q1', answer: 'A' }],
        },
      ],
    });

    await flush();
    expect(view.store.getState().answers.version).toBe(8);
    expect(view.store.getState().answers.isDirty).toBe(false);

    // Step 7: Submit finalAnswers A / baseVersion 8
    http.post.mockResolvedValueOnce({
      success: true,
      data: {
        attemptId: 42,
        status: 'COMPLETED',
        redirectUrl: '/attempts/42/result',
      },
    } as never);

    await submitExam();

    // Verify submit payload
    const submitCall = http.post.mock.calls.find((call) => call[0] === '/v1/attempts/42/submit');
    expect(submitCall).toBeDefined();
    expect(submitCall![1]).toEqual({
      reason: 'MANUAL',
      baseVersion: 8,
      finalAnswers: [
        {
          part_id: 10,
          answers: [{ question_id: 'q1', answer: 'A' }],
        },
      ],
    });

    // Confirmed result rendered
    expect(screen.getByTestId('confirmed-result')).toBeInTheDocument();

    // Invariant assertion: Exactly one PUT was executed throughout the whole flow
    expect(http.put).toHaveBeenCalledTimes(1);
  });

  it('TC_16_07: race condition - edit answer during pending check discards stale feedback', async () => {
    http.get.mockResolvedValueOnce(practiceWorkspace(7, [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }]) as never);

    let resolveFeedback!: (value: unknown) => void;
    http.post.mockReturnValueOnce(new Promise((r) => { resolveFeedback = r; }) as never);

    const view = mount();
    await flush();

    const q1El = document.getElementById('q-q1')!;
    const radioB = within(q1El).getByRole('radio', { name: 'Option B' });
    const radioA = within(q1El).getByRole('radio', { name: 'Option A' });

    // Click check for Q1 with answer 'A'
    const checkBtn = within(q1El).getByRole('button', { name: /kiểm tra đáp án/i });
    fireEvent.click(checkBtn);
    expect(within(q1El).getByText(/đang kiểm tra/i)).toBeInTheDocument();

    // User edits answer from A to B while check is pending
    fireEvent.click(radioB);
    expect(view.store.getState().answers.answers[10]?.q1).toBe('B');

    // And then edits back from B to A (A -> B -> A revision increment)
    fireEvent.click(radioA);
    expect(view.store.getState().answers.answers[10]?.q1).toBe('A');

    // Server responds with stale feedback for old revision
    await act(async () => {
      resolveFeedback({
        success: true,
        data: {
          attemptId: 42,
          partId: 10,
          questionId: 'q1',
          type: 'SINGLE_CHOICE',
          userAnswer: 'A',
          verdict: 'WRONG',
          score: 0,
          correctAnswer: 'B',
          explanation: 'Stale explanation',
        },
      });
    });
    await flush();

    // Verify stale feedback was discarded: feedback remains idle, check button is restored
    expect(within(q1El).queryByText(/chưa chính xác/i)).not.toBeInTheDocument();
    expect(within(q1El).queryByText(/Stale explanation/i)).not.toBeInTheDocument();
    expect(within(q1El).getByRole('button', { name: /kiểm tra đáp án/i })).toBeInTheDocument();
  });

  it('TC_16_08: race condition - part change during pending check discards stale feedback', async () => {
    http.get.mockResolvedValueOnce(practiceWorkspace(7, [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }]) as never);

    let resolveFeedback!: (value: unknown) => void;
    http.post.mockReturnValueOnce(new Promise((r) => { resolveFeedback = r; }) as never);

    mount();
    await flush();

    const q1Part1 = document.getElementById('q-q1')!;
    const checkBtn = within(q1Part1).getByRole('button', { name: /kiểm tra đáp án/i });
    fireEvent.click(checkBtn);
    expect(within(q1Part1).getByText(/đang kiểm tra/i)).toBeInTheDocument();

    // While check is pending, navigate to Part 2
    const part2NavBtn = screen.getByRole('button', { name: /Part 2/i });
    fireEvent.click(part2NavBtn);

    // Verify Part 2 is rendered
    expect(screen.getByText(/What is the answer for Q1 in Part 2\?/i)).toBeInTheDocument();

    // Server responds with feedback for Part 1 Q1
    await act(async () => {
      resolveFeedback({
        success: true,
        data: {
          attemptId: 42,
          partId: 10,
          questionId: 'q1',
          type: 'SINGLE_CHOICE',
          userAnswer: 'A',
          verdict: 'WRONG',
          score: 0,
          correctAnswer: 'B',
          explanation: 'Part 1 Q1 explanation',
        },
      });
    });
    await flush();

    // Navigate back to Part 1
    const part1NavBtn = screen.getByRole('button', { name: /Part 1/i });
    fireEvent.click(part1NavBtn);

    // Verify Part 1 Q1 does not render stale verdict
    const q1Part1Again = document.getElementById('q-q1')!;
    expect(within(q1Part1Again).queryByText(/chưa chính xác/i)).not.toBeInTheDocument();
    expect(within(q1Part1Again).getByRole('button', { name: /kiểm tra đáp án/i })).toBeInTheDocument();
  });

  it('TC_16_08: race condition - attempt rehydrate during pending check discards stale feedback', async () => {
    http.get.mockResolvedValueOnce(practiceWorkspace(7, [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }]) as never);

    let resolveFeedback!: (value: unknown) => void;
    http.post.mockReturnValueOnce(new Promise((r) => { resolveFeedback = r; }) as never);

    const view = mount();
    await flush();

    const q1El = document.getElementById('q-q1')!;
    const checkBtn = within(q1El).getByRole('button', { name: /kiểm tra đáp án/i });
    fireEvent.click(checkBtn);

    // Dispatch same-attempt setAttemptContext (rehydration increments contextRevision 1 -> 2)
    act(() => {
      view.store.dispatch(
        setAttemptContext({
          attemptId: 42,
          version: 7,
          savedAnswers: [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }],
        })
      );
    });

    // Server responds with feedback for old revision
    await act(async () => {
      resolveFeedback({
        success: true,
        data: {
          attemptId: 42,
          partId: 10,
          questionId: 'q1',
          type: 'SINGLE_CHOICE',
          userAnswer: 'A',
          verdict: 'CORRECT',
          score: 1,
          correctAnswer: 'A',
          explanation: 'Rehydrate explanation',
        },
      });
    });
    await flush();

    // Stale completion is dropped
    expect(within(q1El).queryByText(/chính xác/i)).not.toBeInTheDocument();
  });

  it('TC_16_08: race condition - submitting during pending check aborts flight and discards late response', async () => {
    http.get.mockResolvedValueOnce(practiceWorkspace(7, [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }]) as never);

    let capturedSignal: { aborted?: boolean } | undefined;
    let resolveFeedback: ((val: unknown) => void) | undefined;
    const feedbackDeferred = new Promise(resolve => {
      resolveFeedback = resolve;
    });

    http.post.mockImplementation((url, _data, config) => {
      if (url === '/v1/attempts/42/practice-feedback') {
        capturedSignal = config?.signal as { aborted?: boolean } | undefined;
        return feedbackDeferred;
      }
      if (url === '/v1/attempts/42/submit') {
        return Promise.resolve({
          success: true,
          data: { attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' },
        });
      }
      return Promise.resolve({ success: true, data: null });
    });

    mount();
    await flush();

    // Start checking Q1
    const q1El = document.getElementById('q-q1')!;
    fireEvent.click(within(q1El).getByRole('button', { name: /kiểm tra đáp án/i }));

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    // Submit exam
    await submitExam();

    // In-flight feedback signal was aborted immediately
    expect(capturedSignal?.aborted).toBe(true);

    // Navigated to result
    expect(screen.getByTestId('confirmed-result')).toBeInTheDocument();

    const putCallsBeforeLateSettle = http.put.mock.calls.length;

    // Late settlement of feedback request with sentinel explanation payload
    await act(async () => {
      resolveFeedback?.({
        success: true,
        data: {
          attemptId: 42,
          partId: 10,
          questionId: 'q1',
          type: 'SINGLE_CHOICE',
          userAnswer: 'A',
          verdict: 'CORRECT',
          score: 1,
          correctAnswer: 'A',
          explanation: 'SENTINEL_LATE_EXPLANATION_DISCARDED',
        },
      });
      await flush();
    });

    // Verify late feedback response was discarded: sentinel explanation is NOT rendered and no extra write occurred
    expect(screen.queryByText(/SENTINEL_LATE_EXPLANATION_DISCARDED/)).not.toBeInTheDocument();
    expect(http.put.mock.calls.length).toBe(putCallsBeforeLateSettle);
    expect(screen.getByTestId('confirmed-result')).toBeInTheDocument();
  });

  it('TC_16_14: fresh store remount hydrates backend answers and leaves feedback and retry un-restored (memory-only)', async () => {
    // Stage 1: Previous session left local draft in localStorage
    localStorage.setItem('exam_draft_42', JSON.stringify({ 10: { q1: 'LocalDraftB' } }));

    // Backend returns version 8 with saved answers
    http.get.mockResolvedValueOnce(practiceWorkspace(8, [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }]) as never);

    // Mount with completely fresh Redux store
    const view = mount();
    await flush();

    // Backend answers are hydrated (Option A selected, not localStorage draft)
    const q1El = document.getElementById('q-q1')!;
    const radioA = within(q1El).getByRole('radio', { name: 'Option A' });
    expect(radioA).toBeChecked();
    expect(view.store.getState().answers.answers[10]?.q1).toBe('A');
    expect(view.store.getState().answers.version).toBe(8);

    // Local draft notice is rendered indicating server data was prioritized
    expect(screen.getByTestId('local-draft-notice')).toBeInTheDocument();

    // Crucial invariant: Feedback is memory-only, not restored from storage or backend
    expect(within(q1El).queryByText(/chính xác/i)).not.toBeInTheDocument();
    expect(within(q1El).queryByText(/chưa chính xác/i)).not.toBeInTheDocument();
    expect(within(q1El).getByRole('button', { name: /kiểm tra đáp án/i })).toBeInTheDocument();

    // Retry mode is NOT restored: all questions (Q1, Q2) are visible, toolbar is hidden
    expect(document.getElementById('q-q1')).toBeInTheDocument();
    expect(document.getElementById('q-q2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /về toàn bộ câu/i })).not.toBeInTheDocument();
  });

  it('TC_16_01 / AC-01: cross-part question ID isolation - same question ID across two Parts does not share verdict', async () => {
    http.get.mockResolvedValueOnce(practiceWorkspace(7, [
      { part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] },
      { part_id: 20, answers: [{ question_id: 'q1', answer: 'B' }] },
    ]) as never);

    // Mock feedback for Part 10 Q1 -> CORRECT
    http.post.mockResolvedValueOnce({
      success: true,
      data: {
        attemptId: 42,
        partId: 10,
        questionId: 'q1',
        type: 'SINGLE_CHOICE',
        userAnswer: 'A',
        verdict: 'CORRECT',
        score: 1,
        correctAnswer: 'A',
        explanation: 'Part 1 Q1 is correct.',
      },
    } as never);

    mount();
    await flush();

    // Check Part 10 Q1
    const q1Part1 = document.getElementById('q-q1')!;
    fireEvent.click(within(q1Part1).getByRole('button', { name: /kiểm tra đáp án/i }));
    await flush();

    // Part 10 Q1 displays CORRECT
    expect(within(q1Part1).getByText(/chính xác/i)).toBeInTheDocument();

    // Navigate to Part 2 (which also has a question with ID 'q1')
    fireEvent.click(screen.getByRole('button', { name: /Part 2/i }));

    // In Part 2, Q1 has NO verdict and renders the check button in idle state
    const q1Part2 = document.getElementById('q-q1')!;
    expect(within(q1Part2).queryByText(/chính xác/i)).not.toBeInTheDocument();
    expect(within(q1Part2).getByRole('button', { name: /kiểm tra đáp án/i })).toBeInTheDocument();

    // Navigate back to Part 1
    fireEvent.click(screen.getByRole('button', { name: /Part 1/i }));

    // Part 1 Q1 still maintains its CORRECT verdict
    const q1Part1Again = document.getElementById('q-q1')!;
    expect(within(q1Part1Again).getByText(/chính xác/i)).toBeInTheDocument();
  });

  it('TC_16_12: Mock mode isolation - no check buttons, no retry toolbar, zero calls to practice-feedback', async () => {
    http.get.mockResolvedValueOnce(mockWorkspace(7) as never);

    mount();
    await flush();

    // Verify no check answer buttons exist in the document
    expect(screen.queryByRole('button', { name: /kiểm tra đáp án/i })).not.toBeInTheDocument();

    // Verify no retry toolbar exists
    expect(screen.queryByRole('button', { name: /luyện lại câu sai/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /về toàn bộ câu/i })).not.toBeInTheDocument();

    // Zero calls to practice-feedback
    expect(http.post).not.toHaveBeenCalled();
  });

  it('AC-06 / AC-07: Practice check API isolation - does not call autosave PUT, submit POST, or mutate Redux version/answers', async () => {
    http.get.mockResolvedValueOnce(practiceWorkspace(7, [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }]) as never);

    http.post.mockResolvedValueOnce({
      success: true,
      data: {
        attemptId: 42,
        partId: 10,
        questionId: 'q1',
        type: 'SINGLE_CHOICE',
        userAnswer: 'A',
        verdict: 'CORRECT',
        score: 1,
        correctAnswer: 'A',
        explanation: 'Isolation check passed.',
      },
    } as never);

    const view = mount();
    await flush();

    const q1El = document.getElementById('q-q1')!;
    fireEvent.click(within(q1El).getByRole('button', { name: /kiểm tra đáp án/i }));
    await flush();

    // Calls ONLY practice-feedback endpoint
    expect(http.post).toHaveBeenCalledOnce();
    expect(http.post.mock.calls[0][0]).toBe('/v1/attempts/42/practice-feedback');

    // Never calls autosave PUT
    expect(http.put).not.toHaveBeenCalled();

    // Never calls result GET
    const resultCalls = http.get.mock.calls.filter((call) => call[0].includes('/result'));
    expect(resultCalls).toHaveLength(0);

    // Redux version and answers remain unchanged
    expect(view.store.getState().answers.version).toBe(7);
    expect(view.store.getState().answers.answers[10]?.q1).toBe('A');
  });

  it('TC_16_09: 409 conflict during Practice feedback shows reload alert, preserves local draft, and avoids false result navigation', async () => {
    http.get.mockResolvedValueOnce(practiceWorkspace(7, [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }]) as never);

    http.post.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { message: 'Phiên thi đã có thay đổi mới hơn từ thiết bị khác' },
      },
    });

    const view = mount();
    await flush();

    // Edit answer
    const q1El = document.getElementById('q-q1')!;
    fireEvent.click(within(q1El).getByRole('radio', { name: 'Option B' }));

    // Click check answer -> 409 conflict
    fireEvent.click(within(q1El).getByRole('button', { name: /kiểm tra đáp án/i }));
    await flush();

    // Verify alert message is displayed
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('Dữ liệu bài thi đã thay đổi trên máy chủ'))).toBe(true);

    // Check button in Q1 is replaced by authoritative reload button in error state
    expect(within(q1El).queryByRole('button', { name: /kiểm tra đáp án/i })).not.toBeInTheDocument();
    expect(within(q1El).getByRole('button', { name: /tải lại trang/i })).toBeInTheDocument();

    // Does NOT navigate to result
    expect(screen.queryByTestId('confirmed-result')).not.toBeInTheDocument();

    // Local answers in Redux are preserved
    expect(view.store.getState().answers.answers[10]?.q1).toBe('B');
  });

  it('TC_16_15: A11y and responsive layout - status role, alert role, accessible button names, and viewport resizing', async () => {
    http.get.mockResolvedValueOnce(practiceWorkspace(7, [{ part_id: 10, answers: [{ question_id: 'q1', answer: 'A' }] }]) as never);

    let resolveFeedback!: (value: unknown) => void;
    http.post.mockReturnValueOnce(new Promise((r) => { resolveFeedback = r; }) as never);

    mount();
    await flush();

    // Viewport 375px (mobile): main is not restricted by splitRatio
    await act(async () => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));
    });

    const mainEl = screen.getByRole('main');
    const asideEl = document.querySelector('aside');
    expect(asideEl).toBeInTheDocument();
    expect(mainEl.style.width).toBe('');

    const q1El = document.getElementById('q-q1')!;
    const checkBtn = within(q1El).getByRole('button', { name: /kiểm tra đáp án cho câu 1/i });
    expect(checkBtn).toHaveAttribute('aria-label', 'Kiểm tra đáp án cho câu 1');

    // Click check: status role for checking spinner
    fireEvent.click(checkBtn);
    const statusSpinner = within(q1El).getByRole('status');
    expect(statusSpinner).toHaveTextContent(/đang kiểm tra đáp án/i);

    // Resolve feedback: status role for feedback card
    await act(async () => {
      resolveFeedback({
        success: true,
        data: {
          attemptId: 42,
          partId: 10,
          questionId: 'q1',
          type: 'SINGLE_CHOICE',
          userAnswer: 'A',
          verdict: 'CORRECT',
          score: 1,
          correctAnswer: 'A',
          explanation: 'Long explanation text that wraps properly across viewports: ' + 'A'.repeat(200),
        },
      });
    });
    await flush();

    const readyStatus = within(q1El).getByRole('status');
    expect(readyStatus).toHaveTextContent(/chính xác/i);

    // Viewport 768px (tablet)
    await act(async () => {
      window.innerWidth = 768;
      window.dispatchEvent(new Event('resize'));
    });
    expect(within(q1El).getByRole('status')).toBeInTheDocument();
    expect(mainEl.style.width).toBe('50%');

    // Viewport 1280px (desktop)
    await act(async () => {
      window.innerWidth = 1280;
      window.dispatchEvent(new Event('resize'));
    });
    expect(within(q1El).getByRole('status')).toBeInTheDocument();
    expect(mainEl.style.width).toBe('50%');
  });
});
