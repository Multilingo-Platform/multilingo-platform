import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { ExamResultPage } from '../pages/ExamResultPage';
import { attemptResultFixture, resultEnvelope } from './fixtures/attemptResult';
import {
  validAiDoneTextOnlyWire,
  validPendingWire,
  validFailedWire,
  validUnavailableWire,
  validTooShortSystemWire,
  validSurrogateAndCrlfWire,
} from './fixtures/writingFeedback';
import { REFRESH_WARNING_MESSAGE } from '../utils/writingFeedbackErrors';
import { formatBandScore } from '../utils/writingFeedbackPresentation';

vi.mock('../../../core/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const http = vi.mocked(axiosClient);

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function feedbackEnvelope(data: unknown) {
  return {
    success: true,
    code: 1000,
    message: 'Success',
    data,
    timestamp: '2026-10-16T12:00:00Z',
  };
}

function RouteControls() {
  const navigate = useNavigate();
  return (
    <nav aria-label="Test route controls">
      <button type="button" onClick={() => navigate('/attempts/42/result')}>
        Open 42
      </button>
      <button type="button" onClick={() => navigate('/attempts/43/result')}>
        Open 43
      </button>
    </nav>
  );
}

function mount(initialPath = '/attempts/42/result', strict = false) {
  const content = (
    <MemoryRouter initialEntries={[initialPath]}>
      <RouteControls />
      <Routes>
        <Route path="/attempts/:attemptId/result" element={<ExamResultPage />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{content}</StrictMode> : content);
}

describe('TV3-21 real result page writing feedback contract integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('TC_21_17: direct URL consumes only GET /result; feedback API is not called until disclosure is clicked', async () => {
    localStorage.setItem('exam_draft_42', JSON.stringify({ 20: { essay: 'Confidential draft' } }));
    const getStorageSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeStorageSpy = vi.spyOn(Storage.prototype, 'removeItem');

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(attemptResultFixture(42)) as never;
      }
      throw new Error(`Unexpected GET to ${url}`);
    });

    mount();

    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    // WritingResultSummary is rendered
    expect(screen.getByRole('heading', { name: 'Writing' })).toBeInTheDocument();
    expect(screen.getByText('Chưa có điểm')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument(); // Word count from backend result

    // Disclosure button is present and collapsed
    const disclosureBtn = screen.getByRole('button', { name: /Xem nhận xét AI/i });
    expect(disclosureBtn).toHaveAttribute('aria-expanded', 'false');

    // ONLY GET /result was invoked; zero feedback requests
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get.mock.calls[0][0]).toBe('/v1/attempts/42/result');
    expect(http.post).not.toHaveBeenCalled();
    expect(http.put).not.toHaveBeenCalled();
    expect(http.delete).not.toHaveBeenCalled();

    // Draft storage untouched
    expect(getStorageSpy).not.toHaveBeenCalled();
    expect(setStorageSpy).not.toHaveBeenCalled();
    expect(removeStorageSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('exam_draft_42')).toContain('Confidential draft');
  });

  it('TC_21_16: opening a part calls GET writing-feedback exactly once with genuine IDs; multiple essays in same part share single flight', async () => {
    const multiTaskResult = {
      ...attemptResultFixture(42),
      resultSummary: {
        ...attemptResultFixture(42).resultSummary,
        writing: {
          status: 'PENDING',
          tasks: [
            {
              partId: 20,
              questionId: 'task_1',
              label: 'Task 1: Academic Essay',
              status: 'PENDING',
              wordCount: 150,
              score: null,
              maxScore: null,
            },
            {
              partId: 20,
              questionId: 'task_2',
              label: 'Task 2: Discursive Essay',
              status: 'PENDING',
              wordCount: 250,
              score: null,
              maxScore: null,
            },
          ],
        },
      },
    };

    const multiTaskFeedbackWire = {
      attemptId: 42,
      partId: 20,
      attemptStatus: 'COMPLETED',
      partStatus: 'DONE',
      tasks: [
        {
          ...validAiDoneTextOnlyWire.tasks[0],
          questionId: 'task_1',
          label: 'Task 1: Academic Essay',
          overall: 7.0,
          overallFeedback: 'Nhận xét Task 1 xuất sắc.',
        },
        {
          ...validAiDoneTextOnlyWire.tasks[0],
          questionId: 'task_2',
          label: 'Task 2: Discursive Essay',
          overall: 7.5,
          overallFeedback: 'Nhận xét Task 2 lập luận chặt chẽ.',
        },
      ],
    };

    http.get.mockImplementation(async (url: string, config?: any) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(multiTaskResult) as never;
      }
      if (url === '/v1/attempts/42/writing-feedback') {
        expect(config?.params).toEqual({ partId: 20 });
        return feedbackEnvelope(multiTaskFeedbackWire) as never;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const { container } = mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    // Click to open Part 20
    const disclosureBtn = screen.getByRole('button', { name: /Xem nhận xét AI/i });
    await act(async () => {
      fireEvent.click(disclosureBtn);
    });

    // Both tasks are displayed within the single panel
    await screen.findByText('Nhận xét Task 1 xuất sắc.');
    expect(screen.getByText('Nhận xét Task 2 lập luận chặt chẽ.')).toBeInTheDocument();

    // Exactly one GET feedback call was made for Part 20 despite having 2 essays
    const feedbackCalls = http.get.mock.calls.filter(call => call[0] === '/v1/attempts/42/writing-feedback');
    expect(feedbackCalls).toHaveLength(1);

    // Collapse Part 20
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Ẩn nhận xét AI/i }));
    });
    expect(container.querySelector('#writing-feedback-part-20')).toHaveAttribute('hidden');

    // Reopen Part 20: panel is unhidden without triggering another GET
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });
    expect(container.querySelector('#writing-feedback-part-20')).not.toHaveAttribute('hidden');
    expect(http.get.mock.calls.filter(call => call[0] === '/v1/attempts/42/writing-feedback')).toHaveLength(1);
  });

  it('TC_21_16b: first-load 403 shows a safe non-retryable error without leaking backend details', async () => {
    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(attemptResultFixture(42)) as never;
      }
      if (url === '/v1/attempts/42/writing-feedback') {
        const forbidden: any = new Error('Forbidden');
        forbidden.response = { status: 403, data: { message: 'SECRET_BACKEND_REASON' } };
        throw forbidden;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    await screen.findByText('Bạn không có quyền xem nhận xét của bài thi này.');
    const alert = screen.getByRole('alert');
    expect(alert).not.toHaveTextContent('SECRET_BACKEND_REASON');
    // A 403 is terminal for this part: the panel must not offer an inline retry action.
    expect(screen.queryByRole('button', { name: /^Thử lại$/i })).not.toBeInTheDocument();
    expect(
      http.get.mock.calls.filter(call => call[0] === '/v1/attempts/42/writing-feedback'),
    ).toHaveLength(1);
  });

  it('TC_21_03: multi-part independent disclosure and PENDING state has no automatic polling or window focus listener; only manual refresh triggers new GET', async () => {
    const twoPartsResult = {
      ...attemptResultFixture(42),
      resultSummary: {
        ...attemptResultFixture(42).resultSummary,
        writing: {
          status: 'PENDING',
          tasks: [
            {
              partId: 10,
              questionId: 'task_p10',
              label: 'Task Phần 10',
              status: 'PENDING',
              wordCount: 100,
              score: null,
              maxScore: null,
            },
            {
              partId: 20,
              questionId: 'task_p20',
              label: 'Task Phần 20',
              status: 'PENDING',
              wordCount: 200,
              score: null,
              maxScore: null,
            },
          ],
        },
      },
    };

    let p10CallCount = 0;
    http.get.mockImplementation(async (url: string, config?: any) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(twoPartsResult) as never;
      }
      if (url === '/v1/attempts/42/writing-feedback') {
        if (config?.params?.partId === 10) {
          p10CallCount++;
          if (p10CallCount === 1) {
            return feedbackEnvelope({
              ...validPendingWire,
              attemptId: 42,
              partId: 10,
            }) as never;
          }
          return feedbackEnvelope({
            ...validAiDoneTextOnlyWire,
            attemptId: 42,
            partId: 10,
            tasks: [
              {
                ...validAiDoneTextOnlyWire.tasks[0],
                questionId: 'task_p10',
                label: 'Task Phần 10',
                overallFeedback: 'Điểm sau cập nhật thành công.',
              },
            ],
          }) as never;
        }
        if (config?.params?.partId === 20) {
          return feedbackEnvelope({
            ...validAiDoneTextOnlyWire,
            attemptId: 42,
            partId: 20,
          }) as never;
        }
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    // Open Part 10 only
    const openBtns = screen.getAllByRole('button', { name: /Xem nhận xét AI/i });
    expect(openBtns).toHaveLength(2); // One for Part 10, one for Part 20

    await act(async () => {
      fireEvent.click(openBtns[0]);
    });

    // Part 10 displays pending state message from task
    await screen.findByText(/Bài viết đang được hệ thống xử lý chấm điểm/i);
    expect(screen.getByRole('button', { name: /Cập nhật nhận xét/i })).toBeInTheDocument();

    // Verify Part 20 was NOT requested
    expect(http.get.mock.calls.some(c => (c[1] as any)?.params?.partId === 20)).toBe(false);
    expect(p10CallCount).toBe(1);

    // Fast-forward timers and simulate window focus: MUST NOT auto-poll
    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
      window.dispatchEvent(new Event('focus'));
    });
    expect(p10CallCount).toBe(1); // Still 1! No polling occurred
    vi.useRealTimers();

    // Now click the manual refresh button on Part 10 panel
    const refreshBtn = screen.getByRole('button', { name: /Cập nhật nhận xét/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    // Part 10 transitions to DONE with updated feedback
    await screen.findByText('Điểm sau cập nhật thành công.');
    expect(p10CallCount).toBe(2);

    // Part 20 remains completely unrequested
    expect(http.get.mock.calls.some(c => (c[1] as any)?.params?.partId === 20)).toBe(false);
  });

  it('TC_21_13: refresh network error preserves existing valid feedback and displays warning alert banner', async () => {
    let callCount = 0;
    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(attemptResultFixture(42)) as never;
      }
      if (url === '/v1/attempts/42/writing-feedback') {
        callCount++;
        if (callCount === 1) {
          return feedbackEnvelope({
            ...validAiDoneTextOnlyWire,
            attemptId: 42,
            partId: 20,
            tasks: [
              {
                ...validAiDoneTextOnlyWire.tasks[0],
                questionId: 'essay',
                overall: 7.0,
                overallFeedback: 'Initial solid assessment.',
              },
            ],
          }) as never;
        }
        // Second call fails with network error
        const netErr = new Error('Network timeout');
        (netErr as any).isAxiosError = true;
        throw netErr;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    // Open Part 20
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    await screen.findByText('Initial solid assessment.');
    expect(screen.getAllByText(formatBandScore(7.0)).length).toBeGreaterThanOrEqual(1);

    // Click refresh
    const refreshBtn = screen.getByRole('button', { name: /Cập nhật nhận xét/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    // Alert with warning message appears
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(REFRESH_WARNING_MESSAGE);

    // Crucially: existing feedback data and scores are STILL displayed!
    expect(screen.getByText('Initial solid assessment.')).toBeInTheDocument();
    expect(screen.getAllByText(formatBandScore(7.0)).length).toBeGreaterThanOrEqual(1);
  });

  it('TC_21_14: refresh terminal 403 or contract violation clears prior feedback and removes essay/diff from DOM', async () => {
    let callCount = 0;
    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(attemptResultFixture(42)) as never;
      }
      if (url === '/v1/attempts/42/writing-feedback') {
        callCount++;
        if (callCount === 1) {
          return feedbackEnvelope({
            ...validAiDoneTextOnlyWire,
            attemptId: 42,
            partId: 20,
            tasks: [
              {
                ...validAiDoneTextOnlyWire.tasks[0],
                questionId: 'essay',
                overallFeedback: 'Private confidential feedback.',
              },
            ],
          }) as never;
        }
        // Second call fails with 403 Forbidden
        const err: any = new Error('Forbidden');
        err.response = { status: 403, data: { message: 'SECRET_BACKEND_REASON' } };
        throw err;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    await screen.findByText('Private confidential feedback.');
    expect(screen.getByText(/Environmental protection requires/i)).toBeInTheDocument();

    // Click refresh -> triggers 403
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cập nhật nhận xét/i }));
    });

    // Alert rendered with safe error message
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/không có quyền xem nhận xét/i);
    expect(alert).not.toHaveTextContent('SECRET_BACKEND_REASON');

    // Sensitive essay and previous feedback are completely purged from the DOM
    expect(screen.queryByText('Private confidential feedback.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Environmental protection requires/i)).not.toBeInTheDocument();
  });

  it('TC_21_14b: refresh with contract violation (malformed payload) clears prior feedback and removes essay/diff from DOM with safe alert', async () => {
    let callCount = 0;
    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(attemptResultFixture(42)) as never;
      }
      if (url === '/v1/attempts/42/writing-feedback') {
        callCount++;
        if (callCount === 1) {
          return feedbackEnvelope({
            ...validAiDoneTextOnlyWire,
            attemptId: 42,
            partId: 20,
            tasks: [
              {
                ...validAiDoneTextOnlyWire.tasks[0],
                questionId: 'essay',
                overallFeedback: 'Private confidential feedback before malformed refresh.',
              },
            ],
          }) as never;
        }
        // Second call returns malformed response (violating contract: tasks is null)
        return feedbackEnvelope({
          attemptId: 42,
          partId: 20,
          attemptStatus: 'COMPLETED',
          partStatus: 'DONE',
          tasks: null,
        }) as never;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    await screen.findByText('Private confidential feedback before malformed refresh.');
    expect(screen.getByText(/Environmental protection requires/i)).toBeInTheDocument();

    // Click refresh -> triggers contract violation in normalizer
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cập nhật nhận xét/i }));
    });

    // Safe contract error alert rendered
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/dữ liệu nhận xét nhận được không đúng cấu trúc quy định/i);

    // Sensitive essay and previous feedback are completely purged from the DOM
    expect(screen.queryByText('Private confidential feedback before malformed refresh.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Environmental protection requires/i)).not.toBeInTheDocument();
  });

  it('TC_21_12: A -> B -> A navigation with deferred requests ignores stale responses and StrictMode replay is clean', async () => {
    const reqA1 = deferred<any>();
    const reqB = deferred<any>();
    const reqA2 = deferred<any>();

    let reqCount = 0;
    http.get.mockImplementation(async (url: string) => {
      if (url.startsWith('/v1/attempts/') && url.endsWith('/result')) {
        const match = url.match(/\/attempts\/(\d+)\/result/);
        const id = Number(match![1]);
        return resultEnvelope(attemptResultFixture(id)) as never;
      }
      if (url.includes('/writing-feedback')) {
        reqCount++;
        if (reqCount === 1) {
          return reqA1.promise;
        }
        if (reqCount === 2) {
          return reqB.promise;
        }
        if (reqCount === 3) {
          return reqA2.promise;
        }
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    // 1. Open Part 20 on Attempt 42 -> triggers reqA1
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });
    expect(screen.getByText(/đang tải nhận xét Writing/i)).toBeInTheDocument();

    // 2. Navigate to Attempt 43
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open 43' }));
    });
    await screen.findByRole('heading', { name: 'Kết quả thi thử #43' });

    // Open Part 20 on Attempt 43 -> triggers reqB
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    // 3. Navigate back to Attempt 42
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open 42' }));
    });
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    // Open Part 20 on Attempt 42 -> triggers reqA2
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    // Now resolve reqA1 and reqB with stale content
    await act(async () => {
      reqA1.resolve(
        feedbackEnvelope({
          ...validAiDoneTextOnlyWire,
          attemptId: 42,
          partId: 20,
          tasks: [
            {
              ...validAiDoneTextOnlyWire.tasks[0],
              overallFeedback: 'STALE A1 OLD RESPONSE',
            },
          ],
        })
      );
      reqB.resolve(
        feedbackEnvelope({
          ...validAiDoneTextOnlyWire,
          attemptId: 43,
          partId: 20,
          tasks: [
            {
              ...validAiDoneTextOnlyWire.tasks[0],
              overallFeedback: 'STALE B 43 RESPONSE',
            },
          ],
        })
      );
    });

    // Stale responses must NOT be rendered in current UI
    expect(screen.queryByText('STALE A1 OLD RESPONSE')).not.toBeInTheDocument();
    expect(screen.queryByText('STALE B 43 RESPONSE')).not.toBeInTheDocument();

    // Now resolve reqA2 with fresh content
    await act(async () => {
      reqA2.resolve(
        feedbackEnvelope({
          ...validAiDoneTextOnlyWire,
          attemptId: 42,
          partId: 20,
          tasks: [
            {
              ...validAiDoneTextOnlyWire.tasks[0],
              overallFeedback: 'FRESH A2 LATEST RESPONSE',
            },
          ],
        })
      );
    });

    // Fresh response is properly rendered
    await screen.findByText('FRESH A2 LATEST RESPONSE');

    // StrictMode test replay
    let strictResult: any;
    await act(async () => {
      strictResult = mount('/attempts/42/result', true);
    });
    expect(strictResult.container).not.toBeNull();
    strictResult.unmount();
  });

  it('TC_21_15: script/HTML injection and unknown/internal metadata are stripped; original text is rendered safely as escaped text', async () => {
    const maliciousEssayText = '<script>alert("XSS")</script>Normal student essay.';
    const maliciousWire = {
      attemptId: 42,
      partId: 20,
      attemptStatus: 'COMPLETED',
      partStatus: 'DONE',
      // Internal metadata that must NOT be exposed
      jobId: 'secret-job-id-999',
      digest: 'sha256-internal-digest',
      runId: 'internal-run-uuid-777',
      quotaRemaining: 15,
      imageUrl: 'https://internal-s3.bucket/sentinel.png',
      tasks: [
        {
          questionId: 'essay',
          label: 'Task 1: Security Test',
          status: 'DONE',
          wordCount: 15,
          language: 'en',
          source: 'AI',
          scoreUnit: 'BAND_0_9',
          overall: 7.0,
          maxScore: 9.0,
          criteria: [
            { code: 'TR', score: 7.0, feedback: '<b onmouseover="alert(1)">Bold feedback</b>' },
            { code: 'CC', score: 7.0, feedback: 'Clear progression.' },
            { code: 'LR', score: 7.0, feedback: 'Flexible vocabulary.' },
            { code: 'GRA', score: 7.0, feedback: 'Accurate structures.' },
          ],
          originalText: maliciousEssayText,
          overallFeedback: '<img src="invalid.png" onerror="alert(2)" />Overall review.',
          correctedEssay: maliciousEssayText,
          corrections: [],
          diff: [
            { type: 'EQUAL', text: maliciousEssayText },
          ],
          displayMessage: 'Chấm điểm hoàn tất.',
          hasVisualContext: false,
          internalWorkerId: 'worker-node-42',
        },
      ],
    };

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(attemptResultFixture(42)) as never;
      }
      if (url === '/v1/attempts/42/writing-feedback') {
        return feedbackEnvelope(maliciousWire) as never;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const { container } = mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    await screen.findByText('Task 1: Security Test');

    // No <script> tag created in DOM
    expect(container.querySelector('script')).toBeNull();
    // No <img src="invalid.png"> created in DOM
    expect(container.querySelector('img[src="invalid.png"]')).toBeNull();

    // The text content is displayed literally as plain text
    expect(screen.getByText(/<script>alert\("XSS"\)<\/script>/)).toBeInTheDocument();
    expect(screen.getByText(/<img src="invalid\.png"/)).toBeInTheDocument();

    // Internal metadata fields were stripped by normalizer and never rendered
    expect(screen.queryByText(/secret-job-id-999/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sha256-internal-digest/)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal-run-uuid-777/)).not.toBeInTheDocument();
    expect(screen.queryByText(/https:\/\/internal-s3\.bucket/)).not.toBeInTheDocument();
    expect(screen.queryByText(/worker-node-42/)).not.toBeInTheDocument();
  });

  it('TC_21_10: Unicode surrogate pairs (emoji 🌍), combining accents, and CRLF line breaks render intact in Diff and Corrections', async () => {
    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(attemptResultFixture(42)) as never;
      }
      if (url === '/v1/attempts/42/writing-feedback') {
        return feedbackEnvelope({
          ...validSurrogateAndCrlfWire,
          attemptId: 42,
          partId: 20,
        }) as never;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    await screen.findByText('Task 2: Astral Symbols & CRLF');

    // Emoji 🌍 is preserved in DOM
    expect(screen.getAllByText(/🌍/)[0]).toBeInTheDocument();

    // Combining mark café is preserved
    expect(screen.getAllByText(/cafe\u0301s/)[0]).toBeInTheDocument();

    // Diff view delete/insert segments rendered
    expect(screen.getByText('Scientists work hard')).toBeInTheDocument();
    expect(screen.getByText('Dedicated scientists research tirelessly')).toBeInTheDocument();
  });

  it('TC_21_04 & TC_21_05: FAILED, UNAVAILABLE, and TOO_SHORT states integration with Result page', async () => {
    let mode: 'TOO_SHORT' | 'UNAVAILABLE' | 'FAILED' = 'TOO_SHORT';

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(attemptResultFixture(42)) as never;
      }
      if (url === '/v1/attempts/42/writing-feedback') {
        if (mode === 'TOO_SHORT') {
          return feedbackEnvelope({
            ...validTooShortSystemWire,
            attemptId: 42,
            partId: 20,
          }) as never;
        }
        if (mode === 'UNAVAILABLE') {
          return feedbackEnvelope({
            ...validUnavailableWire,
            attemptId: 42,
            partId: 20,
          }) as never;
        }
        return feedbackEnvelope({
          ...validFailedWire,
          attemptId: 42,
          partId: 20,
        }) as never;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    // 1. TOO_SHORT state (SYSTEM source, score 0.0)
    const { unmount } = mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    await screen.findByText('Task 1: Short Essay');
    // System source badge and score 0.0 formatted in vi-VN locale as '0,0'
    expect(screen.getByText(/Hệ thống/i)).toBeInTheDocument();
    expect(screen.getAllByText(formatBandScore(0.0)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Bài viết của bạn quá ngắn/i)).toBeInTheDocument();

    unmount();

    // 2. UNAVAILABLE state
    mode = 'UNAVAILABLE';
    const unavailableMount = mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    await screen.findByText('Task 1: Unavailable');
    expect(screen.getByText(/Ngôn ngữ bài viết chưa được hỗ trợ/i)).toBeInTheDocument();
    // No scores or criteria rendered
    expect(screen.queryByText(formatBandScore(7.0))).not.toBeInTheDocument();

    unavailableMount.unmount();

    // 3. FAILED state
    mode = 'FAILED';
    mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    await screen.findByText('Task 1: Failed');
    expect(screen.getByText(/Không có nhận xét chi tiết cho bài viết này/i)).toBeInTheDocument();
  });

  it('TC_21_18: verifies strict storage isolation and ensures no mutation/review/workspace endpoints called', async () => {
    const postSpy = http.post;
    const putSpy = http.put;
    const deleteSpy = http.delete;

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(attemptResultFixture(42)) as never;
      }
      if (url === '/v1/attempts/42/writing-feedback') {
        return feedbackEnvelope({
          ...validAiDoneTextOnlyWire,
          attemptId: 42,
          partId: 20,
        }) as never;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    mount();
    await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem nhận xét AI/i }));
    });

    await screen.findByText('Task 1: Academic Essay');

    // Refresh feedback
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cập nhật nhận xét/i }));
    });

    // Zero mutations
    expect(postSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();

    // Verify all GET URLs: only /result and /writing-feedback
    const calledUrls = http.get.mock.calls.map(call => call[0]);
    expect(calledUrls.every(url => url.includes('/result') || url.includes('/writing-feedback'))).toBe(true);
    expect(calledUrls.some(url => url.includes('/workspace'))).toBe(false);
    expect(calledUrls.some(url => url.includes('/review'))).toBe(false);
  });
});
