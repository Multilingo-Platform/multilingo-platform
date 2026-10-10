import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer from '../store/answerSlice';
import WorkspacePage from '../pages/WorkspacePage';
import * as axiosClientModule from '../../../core/api/axiosClient';

vi.mock('../../../core/api/axiosClient', () => ({
  default: {
    put: vi.fn(),
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const mockAxios = axiosClientModule.default as any;

// Canonical small reading + writing fixture inline
const canonicalExamSnapshot = {
  exam_id: 1,
  code: 'IELTS-TEST',
  title: 'IELTS Academic Test',
  type: 'IELTS',
  sections: [
    {
      id: 100,
      section_id: 100,
      skill_type: 'READING' as const,
      title: 'Reading Section',
      duration_minutes: 60,
      parts: [
        {
          id: 10,
          part_id: 10,
          title: 'Reading Part 1',
          contentHtml: '<p>Reading passage</p>',
          questions: [
            {
              id: 1,
              question_id: 'q_1',
              question_number: 1,
              type: 'SINGLE_CHOICE',
              question_text: 'Question 1: Choose A or B',
              options: [
                { id: 'A', text: 'Option A' },
                { id: 'B', text: 'Option B' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 200,
      section_id: 200,
      skill_type: 'WRITING' as const,
      title: 'Writing Section',
      duration_minutes: 60,
      parts: [
        {
          id: 20,
          part_id: 20,
          title: 'Writing Task 1',
          instruction: 'Write at least 150 words.',
          contentHtml: '<p>Writing prompt</p>',
          questions: [
            {
              id: 2,
              question_id: 'essay_1',
              question_number: 1,
              type: 'ESSAY',
              question_text: 'Describe the chart',
            },
          ],
        },
      ],
    },
  ],
};

function createTestStore() {
  return configureStore({
    reducer: { answers: answerReducer },
  });
}

function renderWorkspace(store: ReturnType<typeof createTestStore>, route = '/attempts/42/workspace') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
          <Route path="/attempts/:attemptId/result" element={<div data-testid="result-route-sentinel">Result Page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('TV3-07-06 Real Resume Contract & Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('remounts fresh store and resumes: GET v7 -> edit -> timer 15s -> PUT v8 -> remount fresh store -> GET v8', async () => {
    vi.useFakeTimers();

    const now = new Date('2026-10-10T12:00:00Z').getTime();
    vi.setSystemTime(now);

    const deadline = new Date(now + 3600_000).toISOString();
    const startTime = new Date(now - 60_000).toISOString();
    const serverTime = new Date(now).toISOString();

    // 1. Initial GET /v1/attempts/42/workspace returns v7 with answersA
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      code: 200,
      data: {
        attemptId: 42,
        status: 'IN_PROGRESS',
        testScope: 'FULL_EXAM',
        testMode: 'MOCK_TEST',
        startTime,
        deadline,
        serverTime,
        gracePeriodSeconds: 15,
        version: 7,
        savedAnswers: [
          { part_id: 10, answers: [{ question_id: 'q_1', answer: 'A' }] },
        ],
        lockedSections: [],
        examSnapshot: canonicalExamSnapshot,
      },
    });

    const store1 = createTestStore();
    const view1 = renderWorkspace(store1);

    // Flush microtasks for initial GET
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('IELTS Academic Test')).toBeInTheDocument();
    expect(store1.getState().answers.version).toBe(7);
    expect(store1.getState().answers.answers[10]?.['q_1']).toBe('A');

    // Assert UI radio A is checked and radio B is not checked on initial resume
    const radioA = screen.getByRole('radio', { name: /Option A/i });
    const radioB = screen.getByRole('radio', { name: /Option B/i });
    expect(radioA).toBeChecked();
    expect(radioB).not.toBeChecked();

    // Switch to Writing section (Part 20)
    // Section 100 will be locked after confirmation
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockAxios.post.mockResolvedValueOnce({ success: true, code: 200, data: null }); // lockSection
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      code: 200,
      data: {
        attemptId: 42,
        status: 'IN_PROGRESS',
        testScope: 'FULL_EXAM',
        testMode: 'MOCK_TEST',
        startTime,
        deadline,
        serverTime,
        gracePeriodSeconds: 15,
        version: 7,
        savedAnswers: [
          { part_id: 10, answers: [{ question_id: 'q_1', answer: 'A' }] },
        ],
        lockedSections: [100],
        examSnapshot: canonicalExamSnapshot,
      },
    });

    const writingPartBtn = screen.getByRole('button', { name: /Writing Task 1/i });
    await act(async () => {
      fireEvent.click(writingPartBtn);
      await Promise.resolve();
    });

    expect(mockAxios.post).toHaveBeenCalledWith('/v1/attempts/42/sections/100/lock');

    // User edits essay in Part 20
    const essayTextarea = screen.getByRole('textbox');
    await act(async () => {
      fireEvent.change(essayTextarea, { target: { value: 'Bài viết đã lưu' } });
    });

    expect(store1.getState().answers.isDirty).toBe(true);
    expect(store1.getState().answers.answers[20]?.['essay_1']).toBe('Bài viết đã lưu');

    // Mock PUT response version 8
    mockAxios.put.mockResolvedValueOnce({
      success: true,
      code: 200,
      data: { version: 8 },
    });

    // Advance 15s to trigger autosave debounce
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    // Verify PUT /v1/attempts/42/answers was called with version 7
    expect(mockAxios.put).toHaveBeenCalledWith(
      '/v1/attempts/42/answers',
      expect.objectContaining({ version: 7 })
    );

    expect(store1.getState().answers.version).toBe(8);
    expect(store1.getState().answers.isDirty).toBe(false);

    // Unmount view1
    view1.unmount();

    // 2. Simulate stale local draft on device from previous session
    localStorage.setItem(
      'exam_draft_42',
      JSON.stringify({ 10: { q_1: 'B' }, 20: { essay_1: 'Bản nháp cũ bị bỏ' } })
    );

    // Mock second GET /v1/attempts/42/workspace returning version 8 with answersB
    // Advance clock by 5 minutes to simulate time elapsed
    vi.setSystemTime(now + 300_000);

    mockAxios.get.mockResolvedValueOnce({
      success: true,
      code: 200,
      data: {
        attemptId: 42,
        status: 'IN_PROGRESS',
        testScope: 'FULL_EXAM',
        testMode: 'MOCK_TEST',
        startTime,
        deadline,
        serverTime: new Date(now + 300_000).toISOString(),
        gracePeriodSeconds: 15,
        version: 8,
        savedAnswers: [
          { part_id: 10, answers: [{ question_id: 'q_1', answer: 'A' }] },
          { part_id: 20, answers: [{ question_id: 'essay_1', answer: 'Bài viết đã lưu' }] },
        ],
        lockedSections: [100],
        examSnapshot: canonicalExamSnapshot,
      },
    });

    // Mount with FRESH Redux store (clean slate)
    const storeAfterRemount = createTestStore();
    renderWorkspace(storeAfterRemount);

    await act(async () => {
      await Promise.resolve();
    });

    // Assert server-authoritative hydration
    expect(storeAfterRemount.getState().answers.version).toBe(8);
    expect(storeAfterRemount.getState().answers.answers[20]?.['essay_1']).toBe('Bài viết đã lưu');
    expect(storeAfterRemount.getState().answers.answers[10]?.['q_1']).toBe('A');

    // Assert actual UI textarea reflects server-authoritative answer 'Bài viết đã lưu' and not stale draft
    const remountEssayTextarea = screen.getByRole('textbox');
    expect(remountEssayTextarea).toHaveValue('Bài viết đã lưu');
    expect(remountEssayTextarea).not.toHaveValue('Bản nháp cũ bị bỏ');

    // Stale local draft did not overwrite server state
    expect(screen.getByTestId('local-draft-notice')).toBeInTheDocument();
    expect(screen.getByText(/Đang dùng bản đã lưu trên máy chủ; bản nháp trên thiết bị chưa được khôi phục/i)).toBeInTheDocument();

    // Section 100 remains locked, Part 20 is active
    expect(screen.getByTestId('palette-q_1')).toBeDisabled();
    expect(screen.getByTestId('palette-essay_1')).not.toBeDisabled();

    // Verify timer reflects elapsed time (3600s - 300s = 3300s = 55:00)
    expect(screen.getByText('55:00')).toBeInTheDocument();

    // Resume did not create attempt or submit attempt
    expect(mockAxios.post).toHaveBeenCalledTimes(1); // Only the section lock from earlier
  });

  it('handles version conflict 1601 -> reload confirm -> GET version 9 -> resets conflict and allows editing with version 9', async () => {
    vi.useFakeTimers();

    const now = new Date('2026-10-10T12:00:00Z').getTime();
    vi.setSystemTime(now);

    const deadline = new Date(now + 3600_000).toISOString();
    const startTime = new Date(now - 60_000).toISOString();
    const serverTime = new Date(now).toISOString();

    // Initial GET returns version 7
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      code: 200,
      data: {
        attemptId: 42,
        status: 'IN_PROGRESS',
        testScope: 'FULL_EXAM',
        testMode: 'MOCK_TEST',
        startTime,
        deadline,
        serverTime,
        gracePeriodSeconds: 15,
        version: 7,
        savedAnswers: [],
        lockedSections: [],
        examSnapshot: canonicalExamSnapshot,
      },
    });

    const store = createTestStore();
    renderWorkspace(store);

    await act(async () => {
      await Promise.resolve();
    });

    // User chooses Option A in Reading Part 10
    const optionA = screen.getByLabelText('Option A');
    await act(async () => {
      fireEvent.click(optionA);
    });

    expect(store.getState().answers.isDirty).toBe(true);

    // Mock PUT error: Version conflict 1601
    mockAxios.put.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { code: 1601, message: 'Version conflict' },
      },
    });

    // Advance 15s to trigger autosave
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(store.getState().answers.saveStatus).toBe('conflict');

    const reloadBtn = screen.getByRole('button', { name: /tải lại bản mới nhất/i });
    expect(reloadBtn).toBeInTheDocument();

    // Mock reload GET returning version 9
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      code: 200,
      data: {
        attemptId: 42,
        status: 'IN_PROGRESS',
        testScope: 'FULL_EXAM',
        testMode: 'MOCK_TEST',
        startTime,
        deadline,
        serverTime,
        gracePeriodSeconds: 15,
        version: 9,
        savedAnswers: [
          { part_id: 10, answers: [{ question_id: 'q_1', answer: 'B' }] },
        ],
        lockedSections: [],
        examSnapshot: canonicalExamSnapshot,
      },
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => {
      fireEvent.click(reloadBtn);
      await Promise.resolve();
    });

    // Conflict reset and store updated to version 9
    expect(store.getState().answers.version).toBe(9);
    expect(store.getState().answers.saveStatus).toBe('idle');
    expect(store.getState().answers.isDirty).toBe(false);
    expect(store.getState().answers.answers[10]?.['q_1']).toBe('B');

    // Radio Option B is now checked from server
    const optionB = screen.getByLabelText('Option B') as HTMLInputElement;
    expect(optionB.checked).toBe(true);
  });

  it('resuming a terminal attempt redirects to result and sends neither PUT nor POST', async () => {
    vi.useFakeTimers();

    const now = new Date('2026-10-10T12:00:00Z').getTime();
    vi.setSystemTime(now);

    mockAxios.get.mockResolvedValueOnce({
      success: true,
      code: 200,
      data: {
        attemptId: 42,
        status: 'COMPLETED',
        testScope: 'FULL_EXAM',
        testMode: 'MOCK_TEST',
        startTime: new Date(now - 3600_000).toISOString(),
        deadline: new Date(now - 1000).toISOString(),
        serverTime: new Date(now).toISOString(),
        gracePeriodSeconds: 15,
        version: 12,
        savedAnswers: [],
        lockedSections: [],
        examSnapshot: canonicalExamSnapshot,
      },
    });

    const store = createTestStore();
    renderWorkspace(store);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('result-route-sentinel')).toBeInTheDocument();

    // Advance 30s
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(mockAxios.put).not.toHaveBeenCalled();
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it('recovers from GET failure on retry without creating duplicate intervals', async () => {
    vi.useFakeTimers();

    const now = new Date('2026-10-10T12:00:00Z').getTime();
    vi.setSystemTime(now);

    const deadline = new Date(now + 3600_000).toISOString();
    const startTime = new Date(now - 60_000).toISOString();
    const serverTime = new Date(now).toISOString();

    // 1. Initial GET fails with network error
    mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const store = createTestStore();
    renderWorkspace(store);

    await act(async () => {
      await Promise.resolve();
    });

    // Alert error banner is displayed
    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /thử lại/i });
    expect(retryBtn).toBeInTheDocument();

    // 2. Retry succeeds
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      code: 200,
      data: {
        attemptId: 42,
        status: 'IN_PROGRESS',
        testScope: 'FULL_EXAM',
        testMode: 'MOCK_TEST',
        startTime,
        deadline,
        serverTime,
        gracePeriodSeconds: 15,
        version: 7,
        savedAnswers: [],
        lockedSections: [],
        examSnapshot: canonicalExamSnapshot,
      },
    });

    await act(async () => {
      fireEvent.click(retryBtn);
      await Promise.resolve();
    });

    expect(screen.getByText('IELTS Academic Test')).toBeInTheDocument();
    expect(store.getState().answers.version).toBe(7);

    // User chooses Option A
    const optionA = screen.getByLabelText('Option A');
    await act(async () => {
      fireEvent.click(optionA);
    });

    expect(store.getState().answers.isDirty).toBe(true);

    mockAxios.put.mockResolvedValueOnce({
      success: true,
      code: 200,
      data: { version: 8 },
    });

    // Advance 15s
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    // Verify PUT was called exactly once (no duplicate interval)
    expect(mockAxios.put).toHaveBeenCalledTimes(1);
    expect(store.getState().answers.version).toBe(8);
  });
});
