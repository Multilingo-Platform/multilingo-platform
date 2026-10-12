import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer, { initialState, setAttemptContext } from '../store/answerSlice';
import WorkspacePage from '../pages/WorkspacePage';
import * as workspaceHookModule from '../hooks/useWorkspace';
import * as attemptApi from '../api/attemptApi';
import type { WorkspaceResponse, PracticeFeedbackResponse } from '../types/api.types';
import { useAutosave } from '../hooks/useAutosave';

vi.mock('../hooks/useWorkspace');
vi.mock('../api/attemptApi');
vi.mock('../hooks/useAutosave', () => ({ useAutosave: vi.fn() }));

function setAutosaveController() {
  vi.mocked(useAutosave).mockReturnValue({
    pauseAndWait: vi.fn().mockResolvedValue({ status: 'ready' }),
    resume: vi.fn(),
    draftWarning: null,
  });
}
beforeEach(() => {
  setAutosaveController();
  vi.clearAllMocks();
});

const mockExamSnapshot = {
  exam_id: 1,
  code: 'TEST',
  title: 'Test Exam',
  type: 'IELTS',
  sections: [
    {
      id: 1,
      section_id: 1,
      title: 'Reading Section',
      skill_type: 'READING' as const,
      parts: [
        {
          id: 10,
          part_id: 10,
          title: 'Part 1',
          content: {
            part_title: 'Part 1',
            content_html: '<p>Reading passage text</p>',
            question_groups: [
              {
                group_id: 'g1',
                instruction: 'Choose the correct answer',
                questions: [
                  {
                    question_id: 'q1',
                    question_number: 1,
                    type: 'SINGLE_CHOICE',
                    question_text: 'What is the answer for Q1?',
                    options: [
                      { id: 'A', text: 'Option A' },
                      { id: 'B', text: 'Option B' },
                    ],
                  },
                  {
                    question_id: 'q2',
                    question_number: 2,
                    type: 'SINGLE_CHOICE',
                    question_text: 'What is the answer for Q2?',
                    options: [
                      { id: 'A', text: 'Option A' },
                      { id: 'B', text: 'Option B' },
                    ],
                  },
                ],
              },
              {
                group_id: 'g2',
                instruction: 'Essay task instruction',
                questions: [
                  {
                    question_id: 'q3',
                    question_number: 3,
                    type: 'ESSAY',
                    question_text: 'Write an essay about AI',
                    options: null,
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
            part_title: 'Part 2',
            question_groups: [
              {
                group_id: 'g3',
                questions: [
                  {
                    question_id: 'q4',
                    question_number: 4,
                    type: 'SINGLE_CHOICE',
                    question_text: 'Part 2 Question',
                    options: [{ id: 'A', text: 'Opt A' }],
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

const basePracticeWorkspace: WorkspaceResponse = {
  attempt_id: 42,
  status: 'IN_PROGRESS' as const,
  test_scope: 'FULL_EXAM' as const,
  test_mode: 'PRACTICE' as const,
  startTime: new Date(Date.now() - 60_000).toISOString(),
  deadline: null,
  serverTime: new Date().toISOString(),
  gracePeriodSeconds: 15,
  lockedSections: [],
  exam_snapshot: mockExamSnapshot as any,
  version: 1,
  saved_answers: [],
  serverTimeOffset: 0,
};

function makeStore(initialAnswers: Record<number, Record<string, any>> = {}) {
  return configureStore({
    reducer: { answers: answerReducer },
    preloadedState: {
      answers: {
        ...initialState,
        attemptId: 42,
        contextRevision: 1,
        version: 1,
        answers: initialAnswers,
        isDirty: false,
        lastSavedAt: null,
        saveStatus: 'idle' as const,
        pendingVersion: 0,
        flags: {},
        highlights: {},
      },
    },
  });
}

function renderWorkspace(store: ReturnType<typeof makeStore>) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/attempts/42/workspace']}>
        <Routes>
          <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
          <Route path="/attempts/:attemptId/result" element={<div data-testid="result-route">Result Page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

function mockHookResult(overrides: Partial<workspaceHookModule.UseWorkspaceResult> = {}): workspaceHookModule.UseWorkspaceResult {
  return {
    workspace: basePracticeWorkspace,
    loading: false,
    error: null,
    ready: true,
    retry: vi.fn(),
    refreshing: false,
    refreshError: null,
    refreshMetadata: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('WorkspacePractice Integration (TC_16_01, TC_16_10, TC_16_12, AC-01, AC-05, AC-07, AC-08)', () => {
  it('does NOT render practice check button or retry toolbar in MOCK_TEST mode', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...basePracticeWorkspace,
          test_mode: 'MOCK_TEST',
          deadline: new Date(Date.now() + 3600_000).toISOString(),
        },
      })
    );

    const store = makeStore();
    renderWorkspace(store);

    // No "Kiểm tra đáp án" button in MOCK_TEST
    expect(screen.queryByRole('button', { name: /Kiểm tra đáp án/i })).toBeNull();
    // No "Luyện lại câu sai" toolbar in MOCK_TEST
    expect(screen.queryByRole('button', { name: /Luyện lại câu sai/i })).toBeNull();
  });

  it('renders check button in PRACTICE mode and POSTs exact tuple payload to checkPracticeAnswer', async () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());

    const mockFeedbackResponse: PracticeFeedbackResponse = {
      attemptId: 42,
      partId: 10,
      questionId: 'q1',
      type: 'SINGLE_CHOICE',
      userAnswer: 'B',
      verdict: 'WRONG',
      score: 0,
      correctAnswer: 'A',
      explanation: '<p>Lý do chọn A</p>',
    };

    vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockFeedbackResponse);

    const store = makeStore({ 10: { q1: 'B' } });
    renderWorkspace(store);

    // Check button exists for Q1
    const checkBtnQ1 = screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i });
    expect(checkBtnQ1).toBeInTheDocument();

    fireEvent.click(checkBtnQ1);

    await waitFor(() => {
      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);
    });

    expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledWith(
      42,
      { partId: 10, questionId: 'q1', answer: 'B' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Feedback card appears with verdict "Chưa chính xác" and explanation
    await waitFor(() => {
      expect(screen.getByText('Chưa chính xác')).toBeInTheDocument();
      expect(screen.getByText('Lý do chọn A')).toBeInTheDocument();
    });
  });

  it('renders notice and hides check button for ESSAY question in PRACTICE mode', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());

    const store = makeStore();
    renderWorkspace(store);

    // Q3 is ESSAY
    expect(screen.getByText('Câu tự luận chưa hỗ trợ kiểm tra tức thì')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kiểm tra đáp án cho câu 3/i })).toBeNull();
  });

  it('handles retry flow: filters question groups to wrong question, preserves context, and exits retry', async () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());

    const mockWrongFeedback: PracticeFeedbackResponse = {
      attemptId: 42,
      partId: 10,
      questionId: 'q1',
      type: 'SINGLE_CHOICE',
      userAnswer: 'B',
      verdict: 'WRONG',
      score: 0,
      correctAnswer: 'A',
      explanation: null,
    };
    vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockWrongFeedback);

    const store = makeStore({ 10: { q1: 'B' } });
    renderWorkspace(store);

    // Check Q1 to generate WRONG feedback
    const checkBtn = screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText('Chưa chính xác')).toBeInTheDocument();
    });

    // Toolbar shows 1 wrong question
    expect(screen.getByTestId('retry-wrong-count')).toHaveTextContent(/1 câu sai/i);

    const startRetryBtn = screen.getByRole('button', { name: /Luyện lại câu sai/i });
    expect(startRetryBtn).not.toBeDisabled();

    // Start retry
    fireEvent.click(startRetryBtn);

    // In retry mode:
    // 1. Q1 is visible
    expect(screen.getByText('What is the answer for Q1?')).toBeInTheDocument();
    // 2. Q2 and Q3 are filtered out (not visible)
    expect(screen.queryByText('What is the answer for Q2?')).toBeNull();
    expect(screen.queryByText('Write an essay about AI')).toBeNull();
    // 3. Group context/instruction for Q1 is preserved
    expect(screen.getByText('Choose the correct answer')).toBeInTheDocument();

    // 4. "Về toàn bộ câu" button appears
    const stopRetryBtn = screen.getByRole('button', { name: /Về toàn bộ câu/i });
    expect(stopRetryBtn).toBeInTheDocument();

    // Stop retry
    fireEvent.click(stopRetryBtn);

    // All questions are restored
    expect(screen.getByText('What is the answer for Q1?')).toBeInTheDocument();
    expect(screen.getByText('What is the answer for Q2?')).toBeInTheDocument();
    expect(screen.getAllByText('Write an essay about AI').length).toBeGreaterThan(0);
  });

  it('handles 403 error on check: displays alert, clears checking spinner, disables controls, blocks subsequent checks, and does not navigate to result', async () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());
    vi.mocked(attemptApi.checkPracticeAnswer).mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Forbidden' } },
    });

    const store = makeStore({ 10: { q1: 'B' } });
    renderWorkspace(store);

    const checkBtn = screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);
    });

    // Alert appears with role="alert"
    await waitFor(() => {
      expect(screen.getAllByText(/Phiên làm việc đã hết hạn hoặc không có quyền kiểm tra đáp án/i).length).toBeGreaterThan(0);
    });
    const alertBoxes = screen.getAllByRole('alert');
    expect(alertBoxes.some(b => b.textContent?.includes('Phiên làm việc đã hết hạn hoặc không có quyền kiểm tra đáp án'))).toBe(true);

    // Checking spinner is not running
    expect(screen.queryByText('Đang kiểm tra đáp án...')).toBeNull();

    // Check button for Q1 is replaced by error state; other check buttons are disabled
    expect(screen.queryByRole('button', { name: /Kiểm tra đáp án cho câu 1/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 2/i })).toBeDisabled();

    // Toolbar is disabled
    const retryToolbarBtn = screen.getByRole('button', { name: /Luyện lại câu sai/i });
    expect(retryToolbarBtn).toBeDisabled();

    // Clicking check on another question does not trigger any new checkPracticeAnswer POST
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 2/i }));
    expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);

    // No navigation to result route
    expect(screen.queryByTestId('result-route')).toBeNull();
  });

  it('handles 409 conflict error on check: displays alert with reload button, disables controls, handles reload cancellation/confirm/failure, and does not navigate to result', async () => {
    const mockRetry = vi.fn();
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({ retry: mockRetry })
    );
    vi.mocked(attemptApi.checkPracticeAnswer).mockRejectedValueOnce({
      response: { status: 409, data: { message: 'Conflict' } },
    });

    // Store has dirty answer
    const store = configureStore({
      reducer: { answers: answerReducer },
      preloadedState: {
        answers: {
          ...initialState,
          attemptId: 42,
          contextRevision: 1,
          version: 1,
          answers: { 10: { q1: 'B' } },
          isDirty: true,
          lastSavedAt: null,
          saveStatus: 'idle' as const,
          pendingVersion: 0,
          flags: {},
          highlights: {},
        },
      },
    });

    renderWorkspace(store);

    const checkBtn = screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);
    });

    // Alert appears with role="alert"
    await waitFor(() => {
      expect(screen.getAllByText(/Dữ liệu bài thi đã thay đổi trên máy chủ. Vui lòng tải lại trang để tiếp tục/i).length).toBeGreaterThan(0);
    });
    const alertBoxes = screen.getAllByRole('alert');
    expect(alertBoxes.some(b => b.textContent?.includes('Dữ liệu bài thi đã thay đổi trên máy chủ. Vui lòng tải lại trang để tiếp tục'))).toBe(true);

    // Checking spinner is not running
    expect(screen.queryByText('Đang kiểm tra đáp án...')).toBeNull();

    // Check button for Q1 is replaced by error state; other check buttons are disabled
    expect(screen.queryByRole('button', { name: /Kiểm tra đáp án cho câu 1/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 2/i })).toBeDisabled();

    // Subsequent check is blocked
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 2/i }));
    expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);

    // "Tải lại trang" reload button is present in the alert
    const reloadButtons = screen.getAllByRole('button', { name: /Tải lại trang/i });
    expect(reloadButtons.length).toBeGreaterThan(0);
    const reloadBtn = reloadButtons[0];

    // Case 1: User cancels reload confirmation
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(reloadBtn);
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockRetry).not.toHaveBeenCalled();
    // Answers and dirty state preserved
    expect(store.getState().answers.answers[10].q1).toBe('B');
    expect(store.getState().answers.isDirty).toBe(true);

    // Case 2: User confirms, but localStorage draft write fails
    confirmSpy.mockReturnValue(true);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fireEvent.click(reloadBtn);
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Không thể giữ bản nháp trên thiết bị'));
    expect(mockRetry).not.toHaveBeenCalled();

    // Case 3: User confirms and draft write succeeds -> calls authoritative retry
    setItemSpy.mockImplementation(() => {});
    fireEvent.click(reloadBtn);
    expect(setItemSpy).toHaveBeenCalledWith('exam_draft_42', expect.any(String));
    expect(mockRetry).toHaveBeenCalledTimes(1);

    // Verify no navigation to result route
    expect(screen.queryByTestId('result-route')).toBeNull();

    confirmSpy.mockRestore();
    setItemSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('handles 422 error on check: displays alert with reload button, disables controls, and blocks subsequent checks', async () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());
    vi.mocked(attemptApi.checkPracticeAnswer).mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Unprocessable' } },
    });

    const store = makeStore({ 10: { q1: 'B' } });
    renderWorkspace(store);

    const checkBtn = screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);
    });

    // Alert appears with role="alert"
    await waitFor(() => {
      expect(screen.getAllByText(/Dữ liệu câu hỏi hoặc bài thi không hợp lệ. Vui lòng tải lại trang/i).length).toBeGreaterThan(0);
    });
    const alertBoxes = screen.getAllByRole('alert');
    expect(alertBoxes.some(b => b.textContent?.includes('Dữ liệu câu hỏi hoặc bài thi không hợp lệ. Vui lòng tải lại trang'))).toBe(true);

    // Checking spinner is not running
    expect(screen.queryByText('Đang kiểm tra đáp án...')).toBeNull();

    // Check button for Q1 is replaced by error state; other check buttons are disabled
    expect(screen.queryByRole('button', { name: /Kiểm tra đáp án cho câu 1/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 2/i })).toBeDisabled();

    // Reload button exists
    expect(screen.getAllByRole('button', { name: /Tải lại trang/i }).length).toBeGreaterThan(0);

    // Subsequent check is blocked
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 2/i }));
    expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(1);

    // No navigation to result route
    expect(screen.queryByTestId('result-route')).toBeNull();
  });

  it('practice submit regression (TC_16_13): while retry is active with edited answer and pending check, confirms submit -> submit runs immediately with new finalAnswers, aborts feedback, stops retry, no extra PUT, and late feedback does not render solution', async () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());

    // Step 1: Initial check on Q1 returns WRONG to start retry
    const mockWrongFeedback: PracticeFeedbackResponse = {
      attemptId: 42,
      partId: 10,
      questionId: 'q1',
      type: 'SINGLE_CHOICE',
      userAnswer: 'B',
      verdict: 'WRONG',
      score: 0,
      correctAnswer: 'A',
      explanation: null,
    };
    vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockWrongFeedback);

    // Pre-populate all questions so countdown is 0
    const store = makeStore({ 10: { q1: 'B', q2: 'A', q3: 'Essay answer' }, 20: { q4: 'A' } });
    renderWorkspace(store);

    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i }));
    await waitFor(() => {
      expect(screen.getByText('Chưa chính xác')).toBeInTheDocument();
    });

    // Start retry
    const startRetryBtn = screen.getByRole('button', { name: /Luyện lại câu sai/i });
    fireEvent.click(startRetryBtn);
    expect(screen.getByRole('button', { name: /Về toàn bộ câu/i })).toBeInTheDocument();
    expect(screen.queryByText('What is the answer for Q2?')).toBeNull();

    // Step 2: In retry mode, user modifies answer from 'B' to 'A'
    const radioA = screen.getByRole('radio', { name: /Option A/i });
    fireEvent.click(radioA);
    expect(store.getState().answers.answers[10].q1).toBe('A');

    // Step 3: User clicks check on Q1 again -> create deferred pending request
    let resolveFeedback!: (val: PracticeFeedbackResponse) => void;
    let capturedSignal: AbortSignal | undefined;
    const pendingFeedbackPromise = new Promise<PracticeFeedbackResponse>((resolve) => {
      resolveFeedback = resolve;
    });

    vi.mocked(attemptApi.checkPracticeAnswer).mockImplementationOnce((_id, _req, options) => {
      capturedSignal = options?.signal;
      return pendingFeedbackPromise;
    });

    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i }));
    expect(screen.getByText('Đang kiểm tra đáp án...')).toBeInTheDocument();
    expect(capturedSignal?.aborted).toBe(false);

    // Step 4: User submits while check is still pending
    vi.mocked(attemptApi.submitAttempt).mockResolvedValueOnce({
      attempt_id: 42,
      status: 'SUBMITTED',
      redirect_url: '/attempts/42/result',
    });

    // Click "Nộp bài" to open modal, then confirm submit in modal
    fireEvent.click(screen.getByRole('button', { name: /nộp bài/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2);
    });
    const confirmBtn = screen.getAllByRole('button', { name: /nộp bài/i })[1];
    fireEvent.click(confirmBtn);

    // Assert: submitAttempt was called immediately without waiting for feedback!
    await waitFor(() => {
      expect(attemptApi.submitAttempt).toHaveBeenCalledTimes(1);
    });

    // Assert: feedback request signal was aborted!
    expect(capturedSignal?.aborted).toBe(true);

    // Assert: retry was stopped -> "Về toàn bộ câu" is gone, Q2 is restored
    expect(screen.queryByRole('button', { name: /Về toàn bộ câu/i })).toBeNull();
    expect(screen.getByText('What is the answer for Q2?')).toBeInTheDocument();

    // Assert: submit payload contains the edited answer 'A'
    expect(attemptApi.submitAttempt).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        reason: 'MANUAL',
        baseVersion: 1,
        finalAnswers: expect.arrayContaining([
          expect.objectContaining({
            part_id: 10,
            answers: expect.arrayContaining([
              expect.objectContaining({ question_id: 'q1', answer: 'A' }),
            ]),
          }),
        ]),
      }),
      expect.anything()
    );

    // Assert: no extra autosave PUT was called!
    expect(vi.mocked(attemptApi.autosaveAnswers)).not.toHaveBeenCalled();

    // Step 5: Late feedback settles after submit
    resolveFeedback({
      attemptId: 42,
      partId: 10,
      questionId: 'q1',
      type: 'SINGLE_CHOICE',
      userAnswer: 'A',
      verdict: 'CORRECT',
      score: 1,
      correctAnswer: 'A',
      explanation: '<p>Late explanation</p>',
    });

    // Wait and verify late response does NOT render solution
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Late explanation')).toBeNull();
    expect(screen.queryByTestId('feedback-correct-answer')).toBeNull();
  });

  it('handles edit-during-check race on 403: clears prior solution, displays alert, disables controls, blocks subsequent checks, and does not navigate to result', async () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());

    // Step 1: Q1 check succeeds and renders solution
    const mockFeedbackQ1: PracticeFeedbackResponse = {
      attemptId: 42,
      partId: 10,
      questionId: 'q1',
      type: 'SINGLE_CHOICE',
      userAnswer: 'A',
      verdict: 'CORRECT',
      score: 1,
      correctAnswer: 'A',
      explanation: '<p>Q1 explanation</p>',
    };
    vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockFeedbackQ1);

    const store = makeStore({ 10: { q1: 'A', q2: 'B' } });
    renderWorkspace(store);

    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i }));
    await waitFor(() => {
      expect(screen.getByText('Chính xác')).toBeInTheDocument();
      expect(screen.getByText('Q1 explanation')).toBeInTheDocument();
    });

    // Step 2: Q2 check starts with deferred pending request
    let rejectCheckQ2!: (err: any) => void;
    const pendingQ2Promise = new Promise<PracticeFeedbackResponse>((_, reject) => {
      rejectCheckQ2 = reject;
    });
    vi.mocked(attemptApi.checkPracticeAnswer).mockImplementationOnce(() => pendingQ2Promise);

    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 2/i }));
    expect(screen.getByText('Đang kiểm tra đáp án...')).toBeInTheDocument();

    // Step 3: User edits Q2 option while Q2 check is pending (race)
    const radioQ2OptionA = screen.getAllByRole('radio', { name: /Option A/i })[1];
    fireEvent.click(radioQ2OptionA);
    expect(store.getState().answers.answers[10].q2).toBe('A');

    // Step 4: Q2 check rejects with 403
    act(() => {
      rejectCheckQ2({
        response: { status: 403, data: { message: 'Forbidden' } },
      });
    });

    // Step 5: Assert alert appears, spinner ends, controls disabled, Q1 solution wiped
    await waitFor(() => {
      expect(
        screen.getAllByText(/Phiên làm việc đã hết hạn hoặc không có quyền kiểm tra đáp án/i).length
      ).toBeGreaterThan(0);
    });

    // Spinner is gone
    expect(screen.queryByText('Đang kiểm tra đáp án...')).toBeNull();

    // Q1 prior solution is cleared
    expect(screen.queryByText('Chính xác')).toBeNull();
    expect(screen.queryByText('Q1 explanation')).toBeNull();

    // Buttons are disabled
    expect(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Kiểm tra đáp án cho câu 2/i })).toBeNull();

    // Clicking check does not fire any new POST
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i }));
    expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledTimes(2);

    // No navigation to result route
    expect(screen.queryByTestId('result-route')).toBeNull();
  });

  it('stops retry round and restores question palette/groups when Redux contextRevision changes in same attempt (P2 edge case)', async () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());

    const mockFeedbackWrong: PracticeFeedbackResponse = {
      attemptId: 42,
      partId: 10,
      questionId: 'q1',
      type: 'SINGLE_CHOICE',
      userAnswer: 'B',
      verdict: 'WRONG',
      score: 0,
      correctAnswer: 'A',
      explanation: null,
    };
    vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(mockFeedbackWrong);

    const store = makeStore({ 10: { q1: 'B', q2: 'A' } });
    renderWorkspace(store);

    // Q1 check returns WRONG
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i }));
    await waitFor(() => {
      expect(screen.getByText('Chưa chính xác')).toBeInTheDocument();
    });

    // Start retry round
    fireEvent.click(screen.getByRole('button', { name: /Luyện lại câu sai/i }));
    expect(screen.getByRole('button', { name: /Về toàn bộ câu/i })).toBeInTheDocument();
    expect(screen.queryByText('What is the answer for Q2?')).toBeNull(); // Q2 hidden

    // Same attempt rehydrate occurs (dispatch setAttemptContext with same attemptId 42, version 2)
    act(() => {
      store.dispatch(
        setAttemptContext({
          attemptId: 42,
          version: 2,
          savedAnswers: [
            { part_id: 10, answers: [{ question_id: 'q1', answer: 'B' }, { question_id: 'q2', answer: 'A' }] },
          ],
        })
      );
    });

    // Retry round must end synchronously on render:
    // "Về toàn bộ câu" toolbar exit button is gone
    expect(screen.queryByRole('button', { name: /Về toàn bộ câu/i })).toBeNull();
    // Q2 question is restored in question groups
    expect(screen.getByText('What is the answer for Q2?')).toBeInTheDocument();
    // Palette has all questions enabled
    const paletteQ2 = screen.getByTestId('palette-q2');
    expect(paletteQ2).toHaveAttribute('aria-disabled', 'false');
  });
});

