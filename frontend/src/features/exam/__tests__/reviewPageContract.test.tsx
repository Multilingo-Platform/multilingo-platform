import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { ExamResultPage } from '../pages/ExamResultPage';
import ExamReviewPage from '../pages/ExamReviewPage';
import answerReducer from '../store/answerSlice';
import { attemptResultFixture, multiPartAttemptResultFixture, resultEnvelope } from './fixtures/attemptResult';
import { attemptReviewFixture, reviewEnvelope } from './fixtures/attemptReview';

vi.mock('../../../core/api/axiosClient', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
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

function RouteControls() {
  const navigate = useNavigate();
  return (
    <nav aria-label="Test route controls" className="sr-only">
      <button onClick={() => navigate('/attempts/42/review?partId=10')}>Go Part 10</button>
      <button onClick={() => navigate('/attempts/42/review?partId=15')}>Go Part 15</button>
      <button onClick={() => navigate('/attempts/42/review?partId=20')}>Go Part 20</button>
    </nav>
  );
}

function createTestStore(initialAnswers = {}) {
  return configureStore({
    reducer: { answers: answerReducer },
    preloadedState: {
      answers: {
        answers: initialAnswers,
        version: 1,
        saveStatus: 'idle',
        lastSavedAt: null,
        error: null,
      } as any,
    },
  });
}

function mount(
  initialEntries: string[] = ['/attempts/42/result'],
  strict = false,
  store = createTestStore()
) {
  const content = (
    <Provider store={store}>
      <MemoryRouter initialEntries={initialEntries}>
        <RouteControls />
        <Routes>
          <Route path="/attempts/:attemptId/result" element={<ExamResultPage />} />
          <Route path="/attempts/:attemptId/review" element={<ExamReviewPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return render(strict ? <StrictMode>{content}</StrictMode> : content);
}

describe('TV3-14 real review page pipeline (only HTTP/browser mocked)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('result route → CTA click → review route → GET scoped part and renders questions, answers, verdicts, explanations', async () => {
    const resultWire = multiPartAttemptResultFixture(42);
    const reviewPart10Wire = attemptReviewFixture(42, 10);

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') {
        return resultEnvelope(resultWire) as any;
      }
      if (url === '/v1/attempts/42/review/10') {
        return reviewEnvelope(reviewPart10Wire) as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    mount(['/attempts/42/result']);

    // 1. Result page displays CTA
    const cta = await screen.findByRole('link', { name: /xem bài làm và lời giải/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/attempts/42/review?partId=10');

    // 2. Click CTA navigates to review route
    fireEvent.click(cta);

    // 3. Review page loads and renders header with scoped attemptId & partId
    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });

    // 4. Navigation tabs reflect dynamic reviewParts
    expect(screen.getByRole('button', { name: 'Phần đọc tiếng Việt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Phần nghe tiếng Việt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bài viết tiếng Việt' })).toBeInTheDocument();

    // 5. Questions rendered with prompt, user answer, correct answer, and explanation
    expect(screen.getByText('What does AI offer?')).toBeInTheDocument();
    expect(screen.getByText('AI provides personalized learning pathways according to the text.')).toBeInTheDocument();
    expect(screen.getByText('Is it adaptive?')).toBeInTheDocument();

    // 6. HTTP calls were strictly GET and only for result + selected Part 10
    const requestedUrls = http.get.mock.calls.map(call => call[0]);
    expect(requestedUrls).toContain('/v1/attempts/42/result');
    expect(requestedUrls).toContain('/v1/attempts/42/review/10');
    expect(requestedUrls).not.toContain('/v1/attempts/42/review/15');
    expect(requestedUrls).not.toContain('/v1/attempts/42/review/20');

    // Zero mutations
    expect(http.post).not.toHaveBeenCalled();
    expect(http.put).not.toHaveBeenCalled();
  });

  it('switching part tab fetches only the newly selected part and does not request others', async () => {
    const resultWire = multiPartAttemptResultFixture(42);
    const reviewPart10Wire = attemptReviewFixture(42, 10);
    const reviewPart15Wire = {
      ...attemptReviewFixture(42, 15),
      partTitle: 'Listening Part 15',
      skill: 'LISTENING',
      partStats: {
        score: 1.0,
        correctCount: 1,
        incorrectCount: 0,
        unansweredCount: 0,
        totalQuestions: 1,
        accuracy: 100.0,
        isCorrectFlags: { l1: true },
      },
      userAnswers: { l1: 'A' },
      questions: [
        {
          questionId: 'l1',
          type: 'SINGLE_CHOICE',
          questionText: 'Listen to the audio',
          prompt: 'Select what you hear',
          label: 'Question L1',
          explanation: 'Speaker explicitly said train leaves at 9 AM.',
          correctAnswer: 'A',
          userAnswer: 'A',
          verdict: 'CORRECT',
          score: 1.0,
          options: [
            { id: 'A', text: '9:00 AM', isCorrect: true },
            { id: 'B', text: '10:00 AM', isCorrect: false },
          ],
        },
      ],
      questionGroups: [
        {
          groupId: 'g151',
          title: 'Listening Group',
          instruction: 'Listen carefully',
          contentHtml: '<p>Conversation</p>',
          audioUrl: null,
          questions: [
            {
              questionId: 'l1',
              type: 'SINGLE_CHOICE',
              questionText: 'Listen to the audio',
              prompt: 'Select what you hear',
              label: 'Question L1',
              explanation: 'Speaker explicitly said train leaves at 9 AM.',
              correctAnswer: 'A',
              userAnswer: 'A',
              verdict: 'CORRECT',
              score: 1.0,
              options: [
                { id: 'A', text: '9:00 AM', isCorrect: true },
                { id: 'B', text: '10:00 AM', isCorrect: false },
              ],
            },
          ],
        },
      ],
    };

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(reviewPart10Wire) as any;
      if (url === '/v1/attempts/42/review/15') return reviewEnvelope(reviewPart15Wire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    mount(['/attempts/42/review?partId=10']);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });

    // Click tab for Part 15
    const part15Tab = screen.getByRole('button', { name: 'Phần nghe tiếng Việt' });
    fireEvent.click(part15Tab);

    // Review page updates to Part 15
    await screen.findByRole('heading', { name: /Bài thi #42 - Part 15/i });
    expect(screen.getByText('Listen to the audio')).toBeInTheDocument();
    expect(screen.getByText('Speaker explicitly said train leaves at 9 AM.')).toBeInTheDocument();

    const reviewCalls = http.get.mock.calls
      .map(call => call[0])
      .filter(url => url.includes('/review/'));

    expect(reviewCalls).toEqual([
      '/v1/attempts/42/review/10',
      '/v1/attempts/42/review/15',
    ]);
  });

  it('direct access without partId query parameter automatically defaults to the first backend Part', async () => {
    const resultWire = multiPartAttemptResultFixture(42);
    const reviewPart10Wire = attemptReviewFixture(42, 10);

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(reviewPart10Wire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    mount(['/attempts/42/review']);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });
    expect(screen.getByText('What does AI offer?')).toBeInTheDocument();

    expect(http.get).toHaveBeenCalledWith('/v1/attempts/42/review/10', expect.anything());
  });

  it.each(['', ' ', '-5', '010', '1e1', '10.0', '0xA', 'abc', '999'])(
    'foreign or invalid partId query parameter "%s" fail-closed: renders alert and NEVER calls review API',
    async (rawPartId) => {
      const resultWire = multiPartAttemptResultFixture(42);

      http.get.mockImplementation(async (url: string) => {
        if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
        throw new Error(`Unexpected GET ${url}`);
      });

      mount([`/attempts/42/review?partId=${encodeURIComponent(rawPartId)}`]);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/phần thi không hợp lệ/i);

      // Verify review API was NEVER called
      const reviewCalls = http.get.mock.calls
        .map(call => call[0])
        .filter(url => url.includes('/review/'));
      expect(reviewCalls).toHaveLength(0);
    }
  );

  it('clicking redirect button on invalid query alert navigates to first valid Part', async () => {
    const resultWire = multiPartAttemptResultFixture(42);

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    mount(['/attempts/42/review?partId=999']);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/phần thi không hợp lệ/i);

    // Click redirect button to first valid Part
    const redirectBtn = screen.getByRole('button', { name: /chuyển đến phần đọc tiếng việt/i });

    const reviewPart10Wire = attemptReviewFixture(42, 10);
    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(reviewPart10Wire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    fireEvent.click(redirectBtn);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });
    expect(screen.getByText('What does AI offer?')).toBeInTheDocument();
  });

  it('race condition Part A → B → A: late-arriving stale response does not overwrite active selection', async () => {
    const resultWire = multiPartAttemptResultFixture(42);
    const deferredPart10 = deferred();
    const reviewPart15Wire = {
      ...attemptReviewFixture(42, 15),
      partTitle: 'Listening Part 15',
      skill: 'LISTENING',
      partStats: {
        score: 1.0,
        correctCount: 1,
        incorrectCount: 0,
        unansweredCount: 0,
        totalQuestions: 1,
        accuracy: 100.0,
        isCorrectFlags: { l1: true },
      },
      userAnswers: { l1: 'A' },
      questions: [
        {
          questionId: 'l1',
          type: 'SINGLE_CHOICE',
          questionText: 'Question from Part 15',
          prompt: 'Select',
          label: 'Q15',
          explanation: 'Part 15 explanation',
          correctAnswer: 'A',
          userAnswer: 'A',
          verdict: 'CORRECT',
          score: 1.0,
          options: [{ id: 'A', text: 'Ans A', isCorrect: true }],
        },
      ],
      questionGroups: [
        {
          groupId: 'g151',
          title: 'Listening Group',
          instruction: 'Listen carefully',
          contentHtml: '<p>Conversation</p>',
          audioUrl: null,
          questions: [
            {
              questionId: 'l1',
              type: 'SINGLE_CHOICE',
              questionText: 'Question from Part 15',
              prompt: 'Select',
              label: 'Q15',
              explanation: 'Part 15 explanation',
              correctAnswer: 'A',
              userAnswer: 'A',
              verdict: 'CORRECT',
              score: 1.0,
              options: [{ id: 'A', text: 'Ans A', isCorrect: true }],
            },
          ],
        },
      ],
    };

    http.get.mockImplementation((url: string) => {
      if (url === '/v1/attempts/42/result') return Promise.resolve(resultEnvelope(resultWire) as any);
      if (url === '/v1/attempts/42/review/10') return deferredPart10.promise as any;
      if (url === '/v1/attempts/42/review/15') return Promise.resolve(reviewEnvelope(reviewPart15Wire) as any);
      return Promise.reject(new Error(`Unexpected ${url}`));
    });

    mount(['/attempts/42/review?partId=10']);

    // Initially loading Part 10 (pending deferred)
    await screen.findByRole('status');

    // Route navigation changes to Part 15 before Part 10 finishes
    const goPart15Btn = screen.getByRole('button', { name: 'Go Part 15' });
    fireEvent.click(goPart15Btn);

    // Part 15 resolves immediately
    await screen.findByRole('heading', { name: /Bài thi #42 - Part 15/i });
    expect(screen.getByText('Question from Part 15')).toBeInTheDocument();

    // Now Part 10 finishes late
    await act(async () => {
      deferredPart10.resolve(reviewEnvelope(attemptReviewFixture(42, 10)));
      await Promise.resolve();
    });

    // UI STILL shows Part 15! Part 10 did not overwrite Part 15
    expect(screen.getByRole('heading', { name: /Bài thi #42 - Part 15/i })).toBeInTheDocument();
    expect(screen.getByText('Question from Part 15')).toBeInTheDocument();
    expect(screen.queryByText('What does AI offer?')).not.toBeInTheDocument();
  });

  it('permission error (403/401) clears previous review data and displays error alert', async () => {
    const resultWire = multiPartAttemptResultFixture(42);
    const reviewPart10Wire = attemptReviewFixture(42, 10);

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(reviewPart10Wire) as any;
      if (url === '/v1/attempts/42/review/15') {
        const forbiddenErr: any = new Error('Forbidden');
        forbiddenErr.response = {
          status: 403,
          data: { code: 403, message: 'Bạn không có quyền truy cập phần thi này' },
        };
        throw forbiddenErr;
      }
      throw new Error(`Unexpected ${url}`);
    });

    mount(['/attempts/42/review?partId=10']);

    // Part 10 loads successfully
    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });
    expect(screen.getByText('What does AI offer?')).toBeInTheDocument();

    // Switch to Part 15 which responds with 403
    const part15Tab = screen.getByRole('button', { name: 'Phần nghe tiếng Việt' });
    fireEvent.click(part15Tab);

    // Alert rendered
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Lỗi khi tải kết quả ôn tập/i);

    // Previous Part 10 data is NOT retained
    expect(screen.queryByText('What does AI offer?')).not.toBeInTheDocument();
  });

  it('data isolation: leaves Redux answers and local draft untouched, never calls workspace or exam APIs', async () => {
    localStorage.setItem('exam_draft_42', JSON.stringify({ 10: { q1: 'DRAFT_ANSWER' } }));
    const store = createTestStore({
      10: { answers: { q1: { questionId: 'q1', answer: 'REDUX_ANSWER' } } },
    });

    const resultWire = multiPartAttemptResultFixture(42);
    const reviewPart10Wire = attemptReviewFixture(42, 10);

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(reviewPart10Wire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    mount(['/attempts/42/review?partId=10'], false, store);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });

    // 1. Redux answers untouched
    const state = store.getState();
    expect((state.answers.answers as any)?.[10]?.answers?.q1?.answer).toBe('REDUX_ANSWER');

    // 2. localStorage draft untouched
    expect(localStorage.getItem('exam_draft_42')).toContain('DRAFT_ANSWER');

    // 3. No workspace or exam structure API calls
    const allUrls = http.get.mock.calls.map(c => c[0]);
    for (const url of allUrls) {
      expect(url).not.toMatch(/\/v1\/exams\//);
      expect(url).not.toMatch(/\/workspace/);
    }

    // 4. No PUT / POST requests
    expect(http.post).not.toHaveBeenCalled();
    expect(http.put).not.toHaveBeenCalled();
  });

  it('StrictMode double-mount handles initial signal abort gracefully without broken UI', async () => {
    const resultWire = multiPartAttemptResultFixture(42);
    const reviewPart10Wire = attemptReviewFixture(42, 10);

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(reviewPart10Wire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    mount(['/attempts/42/review?partId=10'], true);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });
    expect(screen.getByText('What does AI offer?')).toBeInTheDocument();
  });

  it('real pipeline: renders Part-level passage and grouped audio from wire responses, stops audio on part switch', async () => {
    const pauseSpy = vi.fn();
    HTMLMediaElement.prototype.pause = pauseSpy;

    const resultWire = multiPartAttemptResultFixture(42);
    const reviewPart10Wire = {
      ...attemptReviewFixture(42, 10),
      examData: {
        title: 'Reading Passage 1',
        contentHtml: '<div class="passage-text">Full Part 10 Reading Passage Content.</div>',
        sharedAudio: { url: 'https://cdn.example.com/part10-audio.mp3' },
      },
      questionGroups: [
        {
          groupId: 'g_listening',
          instruction: 'Listen to the audio excerpt',
          contentHtml: '<p>Excerpt transcript</p>',
          sharedAudio: { url: 'https://cdn.example.com/group-audio-stream.mp3' },
          questions: [
            {
              questionId: 'q1',
              type: 'SINGLE_CHOICE',
              questionText: 'What does AI offer?',
              verdict: 'CORRECT',
            },
          ],
        },
      ],
    };
    const reviewPart15Wire = {
      ...attemptReviewFixture(42, 15),
      partTitle: 'Part 15 Audio Test',
      skill: 'LISTENING',
      examData: {
        title: 'Part 15 Audio Test',
      },
      questionGroups: [],
      questions: [
        {
          questionId: 'q15',
          type: 'SINGLE_CHOICE',
          questionText: 'Question 15',
          verdict: 'CORRECT',
          score: 1.0,
        },
      ],
    };

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(reviewPart10Wire) as any;
      if (url === '/v1/attempts/42/review/15') return reviewEnvelope(reviewPart15Wire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    mount(['/attempts/42/review?partId=10']);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });

    // 1. Part-level stimulus rendered
    expect(screen.getByTestId('part-stimulus')).toBeInTheDocument();
    expect(screen.getByText('Full Part 10 Reading Passage Content.')).toBeInTheDocument();

    // 2. Part-level audio rendered without autoplay
    const partAudio = screen.getByTestId('part-audio').querySelector('audio');
    expect(partAudio).toBeInTheDocument();
    expect(partAudio?.src).toBe('https://cdn.example.com/part10-audio.mp3');
    expect(partAudio?.autoplay).toBe(false);

    // 3. Group-level audio rendered
    const groupAudio = screen.getByTestId('group-audio').querySelector('audio');
    expect(groupAudio).toBeInTheDocument();
    expect(groupAudio?.src).toBe('https://cdn.example.com/group-audio-stream.mp3');

    // 4. Switching to Part 15 triggers cleanup / pause on existing audio
    const tabPart15 = screen.getByRole('button', { name: 'Phần nghe tiếng Việt' });
    fireEvent.click(tabPart15);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 15/i });
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('real pipeline: displays FAILED writing task with "Chấm điểm không thành công" and score "--", never "Đang chấm"', async () => {
    const resultWire = {
      ...multiPartAttemptResultFixture(42),
      resultSummary: {
        ...attemptResultFixture(42).resultSummary,
        writing: {
          status: 'FAILED',
          tasks: [
            {
              partId: 20,
              questionId: 'essay_main',
              label: 'Writing Task 2',
              status: 'FAILED',
              wordCount: 220,
              score: null,
              maxScore: null,
            },
          ],
        },
      },
    };

    const reviewPart20Wire = {
      ...attemptReviewFixture(42, 20),
      partTitle: 'Part 20 Writing Essay',
      skill: 'WRITING',
      questions: [
        {
          questionId: 'essay_main',
          type: 'ESSAY',
          label: 'Writing Task 2',
          prompt: 'Write an argumentative essay on technology.',
          verdict: 'PENDING',
          score: null,
          userAnswer: 'Technology has revolutionized learning across the globe.',
          correctAnswer: null,
          explanation: 'AI grading pipeline failed due to timeout.',
        },
      ],
      questionGroups: [],
    };

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/20') return reviewEnvelope(reviewPart20Wire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    mount(['/attempts/42/review?partId=20']);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 20/i });

    // 1. Shows "Chấm điểm không thành công" (FAILED)
    expect(screen.getByText('Chấm điểm không thành công')).toBeInTheDocument();

    // 2. Never displays "Đang chấm" for FAILED task anywhere on page
    expect(screen.queryByText(/Đang chấm/i)).not.toBeInTheDocument();

    // 3. Displays null score as "--"
    expect(screen.getByText('Điểm: --')).toBeInTheDocument();

    // 4. Palette legend shows "1 Chấm không thành công"
    expect(screen.getByText(/1 Chấm không thành công/i)).toBeInTheDocument();

    // 5. Selecting question card (e.g. clicking palette button) preserves FAILED badge and score --
    const btn = screen.getByRole('button', { name: /Writing Task 2/i });
    fireEvent.click(btn);

    expect(screen.getByText('Chấm điểm không thành công')).toBeInTheDocument();
    expect(screen.queryByText(/Đang chấm/i)).not.toBeInTheDocument();
    expect(screen.getByText('Điểm: --')).toBeInTheDocument();
    const cardEl = screen.getByTestId('question-card-essay_main');
    expect(cardEl.className).toContain('ring-amber-300');
  });

  it('RD08 real pipeline: preserves literal authored TEXT through normalizer and card', async () => {
    const resultWire = multiPartAttemptResultFixture(42);
    const reviewPart10Wire = {
      ...attemptReviewFixture(42, 10),
      questions: [
        {
          questionId: 'q_rich_wire',
          type: 'SINGLE_CHOICE',
          prompt: '<p>Look at the figure:</p>',
          questionText: '<p>Examine the chart: <img src="https://cdn.example.com/wire-chart.png" alt="wire chart figure" /> and pick the <b>trend</b>.</p>',
          verdict: 'CORRECT',
          score: 1.0,
          userAnswer: 'opt_a',
          correctAnswer: 'opt_a',
          options: [
            {
              id: 'opt_a',
              text: '<p><b>Upward</b> <img src="https://cdn.example.com/upward.png" alt="upward arrow" /></p>',
              isCorrect: true,
            },
            {
              id: 'opt_b',
              text: 'Downward <script>maliciousCode()</script>',
              isCorrect: false,
            },
          ],
        },
      ],
      questionGroups: [],
    };

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(reviewPart10Wire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    mount(['/attempts/42/review?partId=10']);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });

    expect(screen.queryByRole('img', { name: 'wire chart figure' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'upward arrow' })).toBeNull();
    expect(screen.getByText(reviewPart10Wire.questions[0].questionText)).toBeInTheDocument();
    expect(screen.getByText(reviewPart10Wire.questions[0].options[0].text)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('real pipeline: preserves audio-only option IDs without treating empty text as an answer', async () => {
    const resultWire = multiPartAttemptResultFixture(42);
    const reviewPart10Wire = {
      ...attemptReviewFixture(42, 10),
      questions: [
        {
          questionId: 'p1_audio_only_wire',
          type: 'SINGLE_CHOICE',
          label: 'Question 1',
          verdict: 'BLANK',
          score: 0,
          userAnswer: '',
          correctAnswer: '',
          options: [
            { id: 'A', text: '' },
            { id: 'B', text: '' },
            { id: 'C', text: '' },
            { id: 'D', text: '' },
          ],
        },
      ],
      questionGroups: [],
    };

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(reviewPart10Wire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    mount(['/attempts/42/review?partId=10']);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });

    for (const optionId of ['A', 'B', 'C', 'D']) {
      expect(screen.getByTestId(`review-option-id-p1_audio_only_wire-${optionId}`)).toHaveTextContent(optionId);
    }
    expect(screen.getByText('Chưa có lời thoại cho các lựa chọn. Vui lòng nghe audio để đối chiếu.')).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    expect(screen.queryByText('Đáp án đúng')).not.toBeInTheDocument();
  });

  it('RD08 real pipeline: excludes embedded executable media from canonical sources and clears on Part switch', async () => {
    const pauseSpy = vi.fn();
    HTMLMediaElement.prototype.pause = pauseSpy;

    const resultWire = multiPartAttemptResultFixture(42);
    const reviewPart10Wire = {
      ...attemptReviewFixture(42, 10),
      examData: {
        title: 'Part 10 Reading',
        contentHtml: '<p>Passage with video: <video autoplay controls src="https://cdn.example.com/stimulus-clip.mp4"></video></p>',
      },
      questions: [
        {
          questionId: 'q_media_wire',
          type: 'SINGLE_CHOICE',
          prompt: '<p>Prompt with audio: <audio autoplay controls src="https://cdn.example.com/prompt-audio.mp3"></audio></p>',
          questionText: '<p>Question with video: <video autoplay muted controls src="https://cdn.example.com/q-video.mp4"></video></p>',
          verdict: 'CORRECT',
          score: 1.0,
          userAnswer: 'opt_1',
          correctAnswer: 'opt_1',
          options: [
            {
              id: 'opt_1',
              text: '<p>Option with audio: <audio autoplay controls src="https://cdn.example.com/opt-audio.mp3"></audio></p>',
              isCorrect: true,
            },
          ],
        },
      ],
      questionGroups: [],
    };

    const reviewPart15Wire = attemptReviewFixture(42, 15);

    http.get.mockImplementation(async (url: string) => {
      if (url === '/v1/attempts/42/result') return resultEnvelope(resultWire) as any;
      if (url === '/v1/attempts/42/review/10') return reviewEnvelope(reviewPart10Wire) as any;
      if (url === '/v1/attempts/42/review/15') return reviewEnvelope(reviewPart15Wire) as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    const { container } = mount(['/attempts/42/review?partId=10']);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 10/i });

    expect(container.querySelector('video, audio')).toBeNull();
    expect(screen.getByText(reviewPart10Wire.questions[0].questionText)).toBeInTheDocument();

    // Switching to Part 15 pauses all media
    const tabPart15 = screen.getByRole('button', { name: 'Phần nghe tiếng Việt' });
    fireEvent.click(tabPart15);

    await screen.findByRole('heading', { name: /Bài thi #42 - Part 15/i });
    expect(container.querySelector('video[autoplay], audio[autoplay]')).toBeNull();
  });
});
