import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { QuestionReviewCard } from '../components/review/QuestionReviewCard';
import type { ReviewQuestionDto } from '../types/api.types';

describe('QuestionReviewCard', () => {
  const baseQuestion: ReviewQuestionDto = {
    questionId: 'q_101',
    label: 'Câu 1',
    type: 'SINGLE_CHOICE',
    prompt: '<p>Choose the correct answer</p>',
    questionText: 'What is the main topic?',
    verdict: 'CORRECT',
    score: 1.0,
    userAnswer: 'A',
    correctAnswer: 'A',
    explanation: '<p>Paragraph 1 clearly states the main topic is climate change.</p>',
    options: [
      { id: 'A', text: 'Climate change', isCorrect: true },
      { id: 'B', text: 'Space travel', isCorrect: false },
      { id: 'C', text: 'Marine biology', isCorrect: false },
    ],
  };

  it('renders question header, label, verdict badge, and score', () => {
    render(<QuestionReviewCard question={baseQuestion} index={0} />);

    expect(screen.getByText('Câu 1')).toBeInTheDocument();
    expect(screen.getByText('Chính xác')).toBeInTheDocument();
    expect(screen.getByText(/Điểm: 1/i)).toBeInTheDocument();
    expect(screen.getByText('What is the main topic?')).toBeInTheDocument();
  });

  it('renders options with correct answer highlighted green and user choice marked', () => {
    render(<QuestionReviewCard question={baseQuestion} index={0} />);

    expect(screen.getByText('Climate change')).toBeInTheDocument();
    expect(screen.getByText('Space travel')).toBeInTheDocument();
    expect(screen.getByText('Marine biology')).toBeInTheDocument();

    const correctBadge = screen.getByText('Đáp án đúng');
    expect(correctBadge).toBeInTheDocument();
  });

  it('renders incorrect user choice highlighted red when verdict is WRONG', () => {
    const wrongQuestion: ReviewQuestionDto = {
      ...baseQuestion,
      verdict: 'WRONG',
      score: 0,
      userAnswer: 'B',
      correctAnswer: 'A',
    };

    render(<QuestionReviewCard question={wrongQuestion} index={0} />);

    expect(screen.getByText('Chưa chính xác')).toBeInTheDocument();
    expect(screen.getByText('Đáp án đúng')).toBeInTheDocument();
    expect(screen.getByText('Lựa chọn của bạn')).toBeInTheDocument();
  });

  it('renders "Chưa làm" when question is blank with no user answer', () => {
    const blankQuestion: ReviewQuestionDto = {
      ...baseQuestion,
      verdict: 'BLANK',
      score: 0,
      userAnswer: null,
      correctAnswer: 'A',
    };

    render(<QuestionReviewCard question={blankQuestion} index={0} />);

    expect(screen.getByText('Chưa làm')).toBeInTheDocument();
    expect(screen.getByText('Chưa trả lời')).toBeInTheDocument();
  });

  it.each([
    ['', 'chuỗi rỗng'],
    [null, 'null'],
    [[], 'mảng rỗng'],
  ])('renders option IDs and never selects empty-text options for user answer %s', (userAnswer, _description) => {
    const audioOnlyQuestion: ReviewQuestionDto = {
      ...baseQuestion,
      questionId: 'p1_audio_only',
      userAnswer,
      correctAnswer: null,
      verdict: 'BLANK',
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
      ],
    };

    render(<QuestionReviewCard question={audioOnlyQuestion} index={0} />);

    for (const optionId of ['A', 'B', 'C', 'D']) {
      expect(screen.getByTestId(`review-option-id-p1_audio_only-${optionId}`)).toHaveTextContent(optionId);
    }
    expect(screen.getByText('Chưa có lời thoại cho các lựa chọn. Vui lòng nghe audio để đối chiếu.')).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    expect(screen.queryByText('Đáp án đúng')).not.toBeInTheDocument();
  });

  it('matches a selected and correct empty-text option by ID, not by its empty text', () => {
    const audioOnlyQuestion: ReviewQuestionDto = {
      ...baseQuestion,
      questionId: 'p2_audio_only',
      userAnswer: 'B',
      correctAnswer: 'C',
      verdict: 'WRONG',
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
      ],
    };

    render(<QuestionReviewCard question={audioOnlyQuestion} index={0} />);

    const radios = screen.getAllByRole('radio');
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
    expect(radios[2]).not.toBeChecked();
    expect(screen.getByText('Đáp án đúng')).toBeInTheDocument();
    expect(screen.getByText('Lựa chọn của bạn')).toBeInTheDocument();
  });

  it('renders non-choice / text question with pre-wrapped text answer safely', () => {
    const textQuestion: ReviewQuestionDto = {
      questionId: 'essay_01',
      label: 'Writing Task 2',
      type: 'ESSAY',
      prompt: '<p>Write about technology.</p>',
      verdict: 'PENDING',
      score: null,
      userAnswer: 'Technology has revolutionized education.\nMany schools use AI tools.',
      correctAnswer: null,
      explanation: 'Giám khảo đang tiến hành chấm bài theo 4 tiêu chí.',
    };

    render(<QuestionReviewCard question={textQuestion} index={0} />);

    expect(screen.getByText('Writing Task 2')).toBeInTheDocument();
    expect(screen.getByText('Đang chấm')).toBeInTheDocument();
    expect(screen.getByText(/Technology has revolutionized education./i)).toBeInTheDocument();
    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();
    // Null score is displayed as --, never 0!
    expect(screen.queryByText('Điểm: 0')).not.toBeInTheDocument();
  });

  it('renders explanation using ExplanationBox and sanitizes html', () => {
    const htmlExplQuestion: ReviewQuestionDto = {
      ...baseQuestion,
      explanation: '<p>Safe text</p><script>alert("xss")</script>',
    };

    const { container } = render(<QuestionReviewCard question={htmlExplQuestion} index={0} />);

    expect(screen.getByTestId('explanation-box')).toBeInTheDocument();
    expect(screen.getByText('Safe text')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders question context when present', () => {
    const contextQuestion: ReviewQuestionDto = {
      ...baseQuestion,
      contextHtml: '<div class="passage">Passage context snippet</div>',
    };

    render(<QuestionReviewCard question={contextQuestion} index={0} />);
    expect(screen.getByText('Passage context snippet')).toBeInTheDocument();
  });

  it('renders FAILED writing task with "Chấm điểm không thành công" and never "Đang chấm"', () => {
    const essayQuestion: ReviewQuestionDto = {
      questionId: 'essay_01',
      label: 'Writing Task 1',
      type: 'ESSAY',
      verdict: 'PENDING',
      score: null,
      userAnswer: 'Essay text...',
    };

    const summary = {
      writing: {
        status: 'FAILED',
        tasks: [
          {
            partId: 10,
            questionId: 'essay_01',
            label: 'Task 1',
            status: 'FAILED',
            wordCount: 150,
            score: null,
            maxScore: null,
          },
        ],
      },
    } as any;

    render(
      <QuestionReviewCard
        question={essayQuestion}
        partId={10}
        resultSummary={summary}
        index={0}
      />
    );

    expect(screen.getByText('Chấm điểm không thành công')).toBeInTheDocument();
    expect(screen.queryByText('Đang chấm')).not.toBeInTheDocument();
    expect(screen.getByText('Điểm: --')).toBeInTheDocument();
  });

  it('distinguishes writing task status by partId for the same questionId', () => {
    const essayQuestion: ReviewQuestionDto = {
      questionId: 'essay_shared',
      label: 'Shared Task',
      type: 'ESSAY',
      verdict: 'PENDING',
      score: null,
      userAnswer: 'Essay text...',
    };

    const summary = {
      writing: {
        status: 'PENDING',
        tasks: [
          {
            partId: 10,
            questionId: 'essay_shared',
            label: 'Task Part 10',
            status: 'FAILED',
            wordCount: 100,
            score: null,
            maxScore: null,
          },
          {
            partId: 20,
            questionId: 'essay_shared',
            label: 'Task Part 20',
            status: 'PENDING',
            wordCount: 200,
            score: null,
            maxScore: null,
          },
        ],
      },
    } as any;

    const { unmount } = render(
      <QuestionReviewCard
        question={essayQuestion}
        partId={10}
        resultSummary={summary}
        index={0}
      />
    );
    expect(screen.getByText('Chấm điểm không thành công')).toBeInTheDocument();
    expect(screen.queryByText('Đang chấm')).not.toBeInTheDocument();
    unmount();

    render(
      <QuestionReviewCard
        question={essayQuestion}
        partId={20}
        resultSummary={summary}
        index={0}
      />
    );
    expect(screen.getByText('Đang chấm')).toBeInTheDocument();
    expect(screen.queryByText('Chấm điểm không thành công')).not.toBeInTheDocument();
  });

  it('preserves writing status badge and score -- when card is selected (isSelected=true)', () => {
    const essayQuestion: ReviewQuestionDto = {
      questionId: 'essay_main',
      label: 'Writing Task 2',
      type: 'ESSAY',
      verdict: 'PENDING',
      score: null,
      userAnswer: 'My essay submission...',
    };

    const summary = {
      writing: {
        status: 'FAILED',
        tasks: [
          {
            partId: 20,
            questionId: 'essay_main',
            label: 'Writing Task 2',
            status: 'FAILED',
            score: null,
          },
        ],
      },
    } as any;

    const { rerender } = render(
      <QuestionReviewCard
        question={essayQuestion}
        partId={20}
        resultSummary={summary}
        index={0}
        isSelected={false}
      />
    );
    expect(screen.getByText('Chấm điểm không thành công')).toBeInTheDocument();
    expect(screen.queryByText('Đang chấm')).not.toBeInTheDocument();

    // Rerender with isSelected = true (e.g. clicked from palette)
    rerender(
      <QuestionReviewCard
        question={essayQuestion}
        partId={20}
        resultSummary={summary}
        index={0}
        isSelected={true}
      />
    );
    expect(screen.getByText('Chấm điểm không thành công')).toBeInTheDocument();
    expect(screen.queryByText('Đang chấm')).not.toBeInTheDocument();
    expect(screen.getByText('Điểm: --')).toBeInTheDocument();
    const cardEl = screen.getByTestId('question-card-essay_main');
    expect(cardEl.className).toContain('ring-amber-300');
  });

  it('preserves QUEUED and UNAVAILABLE badges when card is selected', () => {
    const essayQuestion: ReviewQuestionDto = {
      questionId: 'essay_queued',
      label: 'Writing Task 1',
      type: 'ESSAY',
      verdict: 'PENDING',
      score: null,
      userAnswer: 'Short letter...',
    };

    const summary = {
      writing: {
        status: 'QUEUED',
        tasks: [
          {
            partId: 20,
            questionId: 'essay_queued',
            label: 'Writing Task 1',
            status: 'QUEUED',
            score: null,
          },
        ],
      },
    } as any;

    render(
      <QuestionReviewCard
        question={essayQuestion}
        partId={20}
        resultSummary={summary}
        index={0}
        isSelected={true}
      />
    );
    expect(screen.getByText('Đang chờ chấm')).toBeInTheDocument();
    expect(screen.queryByText('Đang chấm')).not.toBeInTheDocument();
  });

  it('renders rich HTML in questionText and options with sanitized markup and images', () => {
    const richQuestion: ReviewQuestionDto = {
      questionId: 'q_rich',
      label: 'Câu 10',
      type: 'SINGLE_CHOICE',
      prompt: '<p>Answer based on the diagram:</p>',
      questionText: '<p>Observe the diagram: <img src="https://cdn.example.com/chart.png" alt="bar chart" /> and choose <b>correct</b> statement.</p>',
      verdict: 'CORRECT',
      score: 1.0,
      userAnswer: 'opt_1',
      correctAnswer: 'opt_1',
      options: [
        {
          id: 'opt_1',
          text: '<p><b>Option A:</b> High growth <img src="https://cdn.example.com/growth.png" alt="growth" /></p>',
          isCorrect: true,
        },
        {
          id: 'opt_2',
          text: '<span>Option B: Decline</span>',
          isCorrect: false,
        },
      ],
    };

    render(<QuestionReviewCard question={richQuestion} index={0} />);

    // 1. Image in questionText is rendered as an HTMLImageElement
    const chartImg = screen.getByRole('img', { name: 'bar chart' });
    expect(chartImg).toBeInTheDocument();
    expect(chartImg).toHaveAttribute('src', 'https://cdn.example.com/chart.png');

    // 2. Image in option is rendered as an HTMLImageElement
    const growthImg = screen.getByRole('img', { name: 'growth' });
    expect(growthImg).toBeInTheDocument();
    expect(growthImg).toHaveAttribute('src', 'https://cdn.example.com/growth.png');

    // 3. Bold text is rendered inside a <b> tag, not literal "<b>" string
    expect(screen.getByText('High growth')).toBeInTheDocument();
    expect(screen.queryByText(/<img src=/i)).not.toBeInTheDocument();
  });

  it('strips malicious scripts from questionText and options while keeping user answer as plain text', () => {
    const xssQuestion: ReviewQuestionDto = {
      questionId: 'q_xss',
      label: 'Câu XSS',
      type: 'ESSAY',
      prompt: '<p>Prompt</p>',
      questionText: '<div>Safe title <script>alert("xss")</script><img src="x" onerror="evil()" /></div>',
      verdict: 'PENDING',
      score: null,
      userAnswer: '<p>User wrote literally this text & <script>doNotExecute()</script></p>',
    };

    render(<QuestionReviewCard question={xssQuestion} index={0} />);

    // Script tags are stripped by DOMPurify
    expect(document.querySelector('script')).toBeNull();

    // User answer is rendered as plain text, preserving literal characters without evaluating
    expect(screen.getByText(/User wrote literally this text & <script>doNotExecute\(\)<\/script>/i)).toBeInTheDocument();
  });

  it('strips autoplay from embedded video/audio in questionText and options, keeps autoplay=false and controls', () => {
    const mediaQuestion: ReviewQuestionDto = {
      questionId: 'q_media_autoplay',
      label: 'Câu Media',
      type: 'SINGLE_CHOICE',
      prompt: '<p>Listen and watch:</p>',
      questionText: '<p>Watch clip: <video autoplay muted controls src="/review-clip.mp4"></video></p>',
      verdict: 'CORRECT',
      score: 1.0,
      userAnswer: 'opt_1',
      correctAnswer: 'opt_1',
      options: [
        {
          id: 'opt_1',
          text: '<p>Listen track: <audio autoplay controls src="/review-track.mp3"></audio></p>',
          isCorrect: true,
        },
      ],
    };

    const { container } = render(<QuestionReviewCard question={mediaQuestion} index={0} />);

    // Video in questionText
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.autoplay).toBe(false);
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.hasAttribute('controls')).toBe(true);

    // Audio in option
    const audio = container.querySelector('audio') as HTMLAudioElement;
    expect(audio).toBeInTheDocument();
    expect(audio.autoplay).toBe(false);
    expect(audio.hasAttribute('autoplay')).toBe(false);
    expect(audio.hasAttribute('controls')).toBe(true);
  });
});
