import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import answerReducer from '../store/answerSlice';
import ExamStartPage from '../pages/ExamStartPage';
import WorkspacePage from '../pages/WorkspacePage';
import { ExamResultPage } from '../pages/ExamResultPage';
import ExamReviewPage from '../pages/ExamReviewPage';
import axiosClient from '../../../core/api/axiosClient';
import i18n from '../../../i18n';
import {
  LIFECYCLE_ATTEMPT_ID,
  LIFECYCLE_ESSAY_QUESTION_ID,
  LIFECYCLE_EXAM_ID,
  LIFECYCLE_WRITING_PART_ID,
  LIFECYCLE_WRITING_SECTION_ID,
  lifecycleEmptyOptionReview,
  lifecycleEnvelope,
  lifecycleExamStructure,
  lifecycleResult,
  lifecycleReview,
  lifecycleWorkspace,
  lifecycleWritingFeedback,
} from './fixtures/tv3Regression';

/**
 * TV3-22-03 — end-to-end frontend lifecycle contract.
 *
 * The real router, pages, hooks, Redux reducers and API normalizers run here. Only the HTTP
 * boundary, the clock and the browser media boundary are mocked, so these tests fail if a page
 * gains a shortcut that bypasses the production pipeline.
 */

vi.mock('../../../core/api/axiosClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const http = vi.mocked(axiosClient);
const TEST_NOW = Date.parse('2026-10-18T00:05:00Z');
const WORKSPACE_URL = `/v1/attempts/${LIFECYCLE_ATTEMPT_ID}/workspace`;
const RESULT_URL = `/v1/attempts/${LIFECYCLE_ATTEMPT_ID}/result`;
const FEEDBACK_URL = `/v1/attempts/${LIFECYCLE_ATTEMPT_ID}/writing-feedback`;
const REVIEW_URL = `/v1/attempts/${LIFECYCLE_ATTEMPT_ID}/review/${LIFECYCLE_WRITING_PART_ID}`;

function mount(initialPath: string) {
  const store = configureStore({ reducer: { answers: answerReducer } });
  const content = (
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/exams/:examId/start" element={<ExamStartPage />} />
          <Route path="/attempts/:attemptId" element={<WorkspacePage />} />
          <Route path="/attempts/:attemptId/result" element={<ExamResultPage />} />
          <Route path="/attempts/:attemptId/review" element={<ExamReviewPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return { store, ...render(content) };
}

interface ApiOptions {
  workspace?: ReturnType<typeof lifecycleWorkspace>;
  result?: ReturnType<typeof lifecycleResult>;
  review?: ReturnType<typeof lifecycleReview>;
  feedback?: ReturnType<typeof lifecycleWritingFeedback>;
}

function installApi(options: ApiOptions = {}) {
  const workspace = options.workspace ?? lifecycleWorkspace();
  http.get.mockImplementation(async (url: string, config?: unknown) => {
    if (url === `/v1/exams/${LIFECYCLE_EXAM_ID}/structure`) {
      return lifecycleEnvelope(lifecycleExamStructure()) as never;
    }
    if (url === WORKSPACE_URL) {
      return lifecycleEnvelope(workspace) as never;
    }
    if (url === RESULT_URL) {
      return lifecycleEnvelope(options.result ?? lifecycleResult()) as never;
    }
    if (url === FEEDBACK_URL) {
      expect((config as { params?: unknown } | undefined)?.params).toEqual({
        partId: LIFECYCLE_WRITING_PART_ID,
      });
      return lifecycleEnvelope(options.feedback ?? lifecycleWritingFeedback()) as never;
    }
    if (url === REVIEW_URL) {
      return lifecycleEnvelope(options.review ?? lifecycleReview()) as never;
    }
    throw new Error(`unexpected GET ${url}`);
  });
  http.post.mockImplementation(async (url: string) => {
    if (url === '/v1/attempts') {
      return lifecycleEnvelope(workspace) as never;
    }
    throw new Error(`unexpected POST ${url}`);
  });
  http.put.mockRejectedValue(new Error('unexpected PUT'));
  http.delete.mockRejectedValue(new Error('unexpected DELETE'));
}

/** Flush React state updates, promise continuations and zero-delay timers. */
async function settle(rounds = 8) {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
}

function essayAnswers(essay: string) {
  return [
    {
      part_id: LIFECYCLE_WRITING_PART_ID,
      answers: [{ question_id: LIFECYCLE_ESSAY_QUESTION_ID, answer: essay }],
    },
  ];
}

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  vi.resetAllMocks();
  localStorage.clear();
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  delete (window as { __tv3Pwned?: unknown }).__tv3Pwned;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TV3-22 lifecycle: picker → workspace → submit → result → review', () => {
  it('creates the selected attempt, hydrates the server workspace, and never merges a stale local draft', async () => {
    localStorage.setItem(
      `exam_draft_${LIFECYCLE_ATTEMPT_ID}`,
      JSON.stringify({ [LIFECYCLE_WRITING_PART_ID]: { [LIFECYCLE_ESSAY_QUESTION_ID]: 'LOCAL_DRAFT_MUST_NOT_WIN' } }),
    );
    installApi();

    const { store } = mount(`/exams/${LIFECYCLE_EXAM_ID}/start`);

    expect(await screen.findByRole('heading', { name: 'TV3 Lifecycle Exam' })).toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith(`/v1/exams/${LIFECYCLE_EXAM_ID}/structure`);

    fireEvent.click(screen.getByRole('button', { name: /Một phần/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Writing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Writing Task 1' }));
    fireEvent.click(screen.getByRole('button', { name: /Mock Test/ }));

    const start = screen.getByRole('button', { name: /Bắt đầu làm bài/ });
    expect(start).not.toBeDisabled();
    fireEvent.click(start);

    expect(await screen.findByDisplayValue('SERVER_A')).toBeInTheDocument();
    expect(http.post).toHaveBeenCalledWith('/v1/attempts', {
      examId: LIFECYCLE_EXAM_ID,
      testScope: 'SINGLE_PART',
      testMode: 'MOCK_TEST',
      targetSectionId: LIFECYCLE_WRITING_SECTION_ID,
      targetPartId: LIFECYCLE_WRITING_PART_ID,
    });
    expect(http.get).toHaveBeenCalledWith(WORKSPACE_URL);

    // The local backup is only announced; the authoritative server snapshot owns the editor.
    expect(screen.getByTestId('local-draft-notice')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('SERVER_A');
    expect(store.getState().answers.answers[LIFECYCLE_WRITING_PART_ID]?.[LIFECYCLE_ESSAY_QUESTION_ID]).toBe('SERVER_A');
    expect(store.getState().answers.version).toBe(7);
    expect(document.body.textContent).not.toContain('LOCAL_DRAFT_MUST_NOT_WIN');
  });

  it('waits for the autosave barrier, submits baseVersion/finalAnswers once, then reads result, feedback and review from their GET endpoints', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    installApi();

    let resolvePut!: (value: unknown) => void;
    http.put.mockReturnValueOnce(new Promise(resolve => { resolvePut = resolve; }) as never);
    http.post.mockImplementation(async (url: string) => {
      if (url === `/v1/attempts/${LIFECYCLE_ATTEMPT_ID}/submit`) {
        return lifecycleEnvelope({
          attemptId: LIFECYCLE_ATTEMPT_ID,
          status: 'COMPLETED',
          redirectUrl: `/attempts/${LIFECYCLE_ATTEMPT_ID}/result`,
        }) as never;
      }
      throw new Error(`unexpected POST ${url}`);
    });

    mount(`/attempts/${LIFECYCLE_ATTEMPT_ID}`);
    await settle();

    expect(screen.getByRole('textbox')).toHaveValue('SERVER_A');

    // Autosave PUT v7/B is deliberately deferred while the learner keeps editing.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'B' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    await settle();
    expect(http.put).toHaveBeenCalledOnce();
    expect(http.put.mock.calls[0][1]).toEqual({ version: 7, answers: essayAnswers('B') });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'C' } });
    fireEvent.click(screen.getByRole('button', { name: /^🚀?\s*nộp bài$/i }));

    const confirm = document.getElementById('btn-confirm-submit');
    expect(confirm).not.toBeNull();
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm!);
    await settle();

    // The barrier must not release a second PUT or a speculative POST.
    expect(http.put).toHaveBeenCalledOnce();
    expect(http.post).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeDisabled();

    await act(async () => {
      resolvePut({ success: true, data: { version: 8 } });
    });
    await settle();

    expect(http.post).toHaveBeenCalledOnce();
    expect(http.post.mock.calls[0][0]).toBe(`/v1/attempts/${LIFECYCLE_ATTEMPT_ID}/submit`);
    expect(http.post.mock.calls[0][1]).toEqual({
      reason: 'MANUAL',
      baseVersion: 8,
      finalAnswers: essayAnswers('C'),
    });

    // The submit receipt only routes; the result page owns every displayed value.
    expect(screen.getByRole('heading', { name: `Kết quả thi thử #${LIFECYCLE_ATTEMPT_ID}` })).toBeInTheDocument();
    expect(http.get.mock.calls.some(call => call[0] === RESULT_URL)).toBe(true);
    expect(http.get.mock.calls.filter(call => call[0] === FEEDBACK_URL)).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Kết quả Writing' })).toBeInTheDocument();
    expect(screen.getByText('154')).toBeInTheDocument();

    // Feedback is disclosure-scoped: one request for the Writing Part only.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });
    await settle();
    expect(http.get.mock.calls.filter(call => call[0] === FEEDBACK_URL)).toHaveLength(1);
    const feedbackPanel = screen.getByTestId(`writing-feedback-panel-${LIFECYCLE_WRITING_PART_ID}`);
    expect(within(feedbackPanel).getByText('Task 1: Chart description')).toBeInTheDocument();
    expect(
      within(feedbackPanel).getByText('A well-written response with clear argumentation and solid structure.'),
    ).toBeInTheDocument();

    // Review re-reads the result metadata, then scopes the review request to the selected Part.
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: /Xem bài làm và lời giải/i }));
    });
    await settle();
    expect(
      screen.getByRole('heading', { name: `Bài thi #${LIFECYCLE_ATTEMPT_ID} - Part ${LIFECYCLE_WRITING_PART_ID}` }),
    ).toBeInTheDocument();
    expect(screen.getByTestId(`question-card-${LIFECYCLE_ESSAY_QUESTION_ID}`)).toBeInTheDocument();
    expect(
      screen.getByText('Use a clear overview and support it with key figures.'),
    ).toBeInTheDocument();
    expect(http.get.mock.calls.filter(call => call[0] === REVIEW_URL)).toHaveLength(1);
    expect(
      http.get.mock.calls.filter(call => typeof call[0] === 'string' && call[0].includes('/review/'))
        .every(call => call[0] === REVIEW_URL),
    ).toBe(true);
    expect(http.get.mock.calls.filter(call => call[0] === RESULT_URL).length).toBeGreaterThanOrEqual(2);
    expect(http.put).toHaveBeenCalledOnce();
    expect(http.post).toHaveBeenCalledOnce();
  });

  it('renders empty A–C option ids and sanitizes HTML-like review content without executing it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    installApi({ review: lifecycleEmptyOptionReview() });

    const { container } = mount(
      `/attempts/${LIFECYCLE_ATTEMPT_ID}/review?partId=${LIFECYCLE_WRITING_PART_ID}`,
    );
    await settle();

    const emptyCard = screen.getByTestId('question-card-q-empty');
    expect(screen.getByTestId('review-option-id-q-empty-A')).toBeInTheDocument();
    expect(screen.getByTestId('review-option-id-q-empty-B')).toBeInTheDocument();
    expect(screen.getByTestId('review-option-id-q-empty-C')).toBeInTheDocument();
    expect(screen.getByText(/Chưa có lời thoại cho các lựa chọn/)).toBeInTheDocument();

    const emptyRadios = within(emptyCard).getAllByRole('radio');
    expect(emptyRadios).toHaveLength(3);
    emptyRadios.forEach(radio => {
      expect(radio).not.toBeChecked();
      expect(radio).toBeDisabled();
    });
    expect(within(emptyCard).getByText(/Chưa trả lời/)).toBeInTheDocument();

    const htmlCard = screen.getByTestId('question-card-q-html');
    expect(within(htmlCard).getByText('Safe option text')).toBeInTheDocument();
    // The sanitizer keeps semantic markup, so the phrase is split across <b> and text nodes.
    expect(htmlCard.textContent).toContain('Visible bold answer');
    expect(within(htmlCard).getByText('Safe C')).toBeInTheDocument();
    expect(within(htmlCard).getByText('Safe explanation')).toBeInTheDocument();
    expect(within(htmlCard).getByText(/Đáp án đúng/)).toBeInTheDocument();

    expect((window as { __tv3Pwned?: unknown }).__tv3Pwned).toBeUndefined();
    expect(container.querySelector('script')).toBeNull();
    // DOMPurify keeps the inert image URL but strips executable event handlers.
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container.ownerDocument.body.innerHTML).not.toContain('window.__tv3Pwned');
  });
});
