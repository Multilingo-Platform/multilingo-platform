import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PracticeQuestionFeedback } from '../components/practice/PracticeQuestionFeedback';
import { PracticeRetryToolbar } from '../components/practice/PracticeRetryToolbar';
import type { PracticeFeedbackResponse } from '../types/api.types';
import type { PracticeQuestionFeedback as FeedbackState } from '../hooks/usePracticeFeedback';

describe('PracticeQuestionFeedback (AC-03, AC-07, AC-08)', () => {
  const baseFeedback: FeedbackState = {
    phase: 'idle',
    data: null,
    error: null,
  };

  const sampleCorrectData: PracticeFeedbackResponse = {
    attemptId: 42,
    partId: 10,
    questionId: 'q1',
    type: 'SINGLE_CHOICE',
    userAnswer: 'A',
    verdict: 'CORRECT',
    score: 1,
    correctAnswer: 'A',
    explanation: '<p>Đây là <strong>giải thích</strong> chi tiết.</p>',
  };

  const sampleWrongData: PracticeFeedbackResponse = {
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

  describe('Idle phase', () => {
    it('renders "Kiểm tra đáp án" button with accessible name for objective question', () => {
      const handleCheck = vi.fn();
      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={baseFeedback}
          onCheck={handleCheck}
        />
      );

      const button = screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();

      fireEvent.click(button);
      expect(handleCheck).toHaveBeenCalledTimes(1);
      expect(handleCheck).toHaveBeenCalledWith('q1');
    });

    it('disables check button when busy or disabled is true', () => {
      const handleCheck = vi.fn();
      const { rerender } = render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={baseFeedback}
          onCheck={handleCheck}
          busy={true}
        />
      );

      const buttonBusy = screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i });
      expect(buttonBusy).toBeDisabled();

      rerender(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={baseFeedback}
          onCheck={handleCheck}
          disabled={true}
        />
      );

      const buttonDisabled = screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i });
      expect(buttonDisabled).toBeDisabled();
    });
  });

  describe('Checking phase', () => {
    it('renders checking indicator with role="status" and disables check button', () => {
      const checkingFeedback: FeedbackState = {
        phase: 'checking',
        data: null,
        error: null,
      };

      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={checkingFeedback}
          onCheck={vi.fn()}
        />
      );

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveTextContent(/Đang kiểm tra đáp án/i);

      const button = screen.getByRole('button', { name: /Kiểm tra đáp án cho câu 1/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Ready phase (AC-03, AC-07, AC-08)', () => {
    it('renders correct verdict, score, answers and explanation with practice notice and role="status"', () => {
      const readyFeedback: FeedbackState = {
        phase: 'ready',
        data: sampleCorrectData,
        error: null,
      };

      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={readyFeedback}
          onCheck={vi.fn()}
        />
      );

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();

      // Verdict label & Practice context notice
      expect(screen.getByText('Chính xác')).toBeInTheDocument();
      expect(screen.getByText(/luyện tập/i)).toBeInTheDocument();

      // Score
      expect(screen.getByText(/Điểm:\s*1/i)).toBeInTheDocument();

      // User answer & correct answer
      expect(screen.getByText('A', { selector: '[data-testid="feedback-user-answer"]' })).toBeInTheDocument();
      expect(screen.getByText('A', { selector: '[data-testid="feedback-correct-answer"]' })).toBeInTheDocument();

      // Explanation rendered via HtmlContent
      expect(screen.getByText(/Đây là/i)).toBeInTheDocument();
      expect(screen.getByText('giải thích')).toBeInTheDocument();
    });

    it('renders wrong verdict and fixed fallback message when explanation is null/empty', () => {
      const readyFeedback: FeedbackState = {
        phase: 'ready',
        data: sampleWrongData,
        error: null,
      };

      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={readyFeedback}
          onCheck={vi.fn()}
        />
      );

      expect(screen.getByText('Chưa chính xác')).toBeInTheDocument();
      expect(screen.getByText('Chưa có giải thích chi tiết cho câu hỏi này.')).toBeInTheDocument();
    });

    it('renders partial and blank verdicts appropriately', () => {
      const partialFeedback: FeedbackState = {
        phase: 'ready',
        data: {
          ...sampleWrongData,
          verdict: 'BLANK',
          score: 0.5,
        },
        error: null,
      };

      const { rerender } = render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={partialFeedback}
          onCheck={vi.fn()}
        />
      );

      expect(screen.getByText('Chưa làm')).toBeInTheDocument();

      // When verdict is PARTIAL
      rerender(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={{
            ...partialFeedback,
            data: {
              ...sampleWrongData,
              // Cast to test PARTIAL verdict mapping
              verdict: 'PARTIAL' as any,
              score: 0.5,
            },
          }}
          onCheck={vi.fn()}
        />
      );

      expect(screen.getByText('Một phần')).toBeInTheDocument();
    });

    it('preserves multiline formatting in user and correct answers', () => {
      const multilineFeedback: FeedbackState = {
        phase: 'ready',
        data: {
          ...sampleCorrectData,
          userAnswer: 'Line 1\nLine 2\nLine 3',
          correctAnswer: 'Answer line 1\nAnswer line 2',
        },
        error: null,
      };

      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="FILL_IN_THE_BLANK"
          feedback={multilineFeedback}
          onCheck={vi.fn()}
        />
      );

      const userAnsEl = screen.getByTestId('feedback-user-answer');
      expect(userAnsEl).toHaveClass('whitespace-pre-wrap');
      expect(userAnsEl.textContent).toContain('Line 1\nLine 2\nLine 3');

      const correctAnsEl = screen.getByTestId('feedback-correct-answer');
      expect(correctAnsEl).toHaveClass('whitespace-pre-wrap');
      expect(correctAnsEl.textContent).toContain('Answer line 1\nAnswer line 2');
    });

    it('sanitizes script tags in explanation and does not execute script (XSS safe, AC-07)', () => {
      const xssFeedback: FeedbackState = {
        phase: 'ready',
        data: {
          ...sampleCorrectData,
          explanation: '<p>An toàn</p><script>window.__xss_vulnerable = true;</script>',
        },
        error: null,
      };

      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={xssFeedback}
          onCheck={vi.fn()}
        />
      );

      expect(screen.getByText('An toàn')).toBeInTheDocument();
      expect(document.querySelector('script')).toBeNull();
      expect((window as any).__xss_vulnerable).toBeUndefined();
    });

    it('renders script-like user and correct answers safely as text', () => {
      const scriptTextFeedback: FeedbackState = {
        phase: 'ready',
        data: {
          ...sampleCorrectData,
          userAnswer: '<script>alert(1)</script>',
          correctAnswer: '<img src=x onerror=alert(2) />',
        },
        error: null,
      };

      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="FILL_IN_THE_BLANK"
          feedback={scriptTextFeedback}
          onCheck={vi.fn()}
        />
      );

      const userAnsEl = screen.getByTestId('feedback-user-answer');
      expect(userAnsEl.textContent).toBe('<script>alert(1)</script>');
      expect(userAnsEl.querySelector('script')).toBeNull();

      const correctAnsEl = screen.getByTestId('feedback-correct-answer');
      expect(correctAnsEl.textContent).toBe('<img src=x onerror=alert(2) />');
      expect(correctAnsEl.querySelector('img')).toBeNull();
    });
  });

  describe('Error phase', () => {
    it('renders error message with role="alert" and shows retry button when retryable', () => {
      const handleCheck = vi.fn();
      const retryableErrorFeedback: FeedbackState = {
        phase: 'error',
        data: null,
        error: {
          message: 'Lỗi kết nối máy chủ. Vui lòng thử lại.',
          retryable: true,
        },
      };

      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={retryableErrorFeedback}
          onCheck={handleCheck}
        />
      );

      const alertEl = screen.getByRole('alert');
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveTextContent('Lỗi kết nối máy chủ. Vui lòng thử lại.');

      const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
      expect(retryBtn).toBeInTheDocument();
      expect(retryBtn).not.toBeDisabled();

      fireEvent.click(retryBtn);
      expect(handleCheck).toHaveBeenCalledWith('q1');
    });

    it('does not render retry button when error is non-retryable', () => {
      const nonRetryableErrorFeedback: FeedbackState = {
        phase: 'error',
        data: null,
        error: {
          message: 'Bài thi đã kết thúc. Vui lòng tải lại trang.',
          retryable: false,
        },
      };

      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={nonRetryableErrorFeedback}
          onCheck={vi.fn()}
        />
      );

      const alertEl = screen.getByRole('alert');
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveTextContent('Bài thi đã kết thúc. Vui lòng tải lại trang.');

      expect(screen.queryByRole('button', { name: /Thử lại/i })).toBeNull();
    });

    it('renders reload button and invokes onReload when error requires reload and onReload is provided', () => {
      const handleReload = vi.fn();
      const reloadRequiredError: FeedbackState = {
        phase: 'error',
        data: null,
        error: {
          message: 'Dữ liệu câu hỏi hoặc bài thi không hợp lệ. Vui lòng tải lại trang.',
          retryable: false,
        },
      };

      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={reloadRequiredError}
          onCheck={vi.fn()}
          onReload={handleReload}
        />
      );

      const reloadBtn = screen.getByRole('button', { name: /Tải lại trang/i });
      expect(reloadBtn).toBeInTheDocument();
      fireEvent.click(reloadBtn);
      expect(handleReload).toHaveBeenCalledTimes(1);
    });
  });

  describe('Question type constraints (ESSAY & unsupported types)', () => {
    it('renders essay notice and does not render check button for ESSAY question', () => {
      render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="ESSAY"
          feedback={baseFeedback}
          onCheck={vi.fn()}
        />
      );

      expect(screen.getByText('Câu tự luận chưa hỗ trợ kiểm tra tức thì')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Kiểm tra đáp án/i })).toBeNull();
    });

    it('does not render check button or essay notice for unsupported question type', () => {
      const { container } = render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="UNKNOWN_CUSTOM_TYPE"
          feedback={baseFeedback}
          onCheck={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /Kiểm tra đáp án/i })).toBeNull();
      expect(screen.queryByText('Câu tự luận chưa hỗ trợ kiểm tra tức thì')).toBeNull();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Accessibility & Focus (AC-08)', () => {
    it('does not automatically shift focus upon rendering or state change', () => {
      const externalInput = document.createElement('input');
      document.body.appendChild(externalInput);
      externalInput.focus();
      expect(document.activeElement).toBe(externalInput);

      const { rerender } = render(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={baseFeedback}
          onCheck={vi.fn()}
        />
      );

      // Focus should still remain where it was
      expect(document.activeElement).toBe(externalInput);

      rerender(
        <PracticeQuestionFeedback
          questionId="q1"
          questionNumber={1}
          questionType="SINGLE_CHOICE"
          feedback={{
            phase: 'ready',
            data: sampleCorrectData,
            error: null,
          }}
          onCheck={vi.fn()}
        />
      );

      expect(document.activeElement).toBe(externalInput);
      document.body.removeChild(externalInput);
    });
  });
});

describe('PracticeRetryToolbar (AC-05, AC-08)', () => {
  it('renders wrong count 0 without claiming all questions are correct', () => {
    render(
      <PracticeRetryToolbar
        wrongCount={0}
        retryActive={false}
        onStartRetry={vi.fn()}
        onStopRetry={vi.fn()}
      />
    );

    const countEl = screen.getByTestId('retry-wrong-count');
    expect(countEl).toHaveTextContent(/0 câu sai/i);

    // Verify it NEVER claims all questions are correct
    expect(screen.queryByText(/tất cả đều đúng/i)).toBeNull();
    expect(screen.queryByText(/100%/i)).toBeNull();

    // "Luyện lại câu sai" button is disabled when wrongCount is 0
    const retryBtn = screen.getByRole('button', { name: /Luyện lại câu sai/i });
    expect(retryBtn).toBeDisabled();

    // "Về toàn bộ câu" button is not visible when retryActive is false
    expect(screen.queryByRole('button', { name: /Về toàn bộ câu/i })).toBeNull();
  });

  it('enables "Luyện lại câu sai" button when wrongCount > 0 and calls onStartRetry', () => {
    const handleStartRetry = vi.fn();
    render(
      <PracticeRetryToolbar
        wrongCount={3}
        retryActive={false}
        onStartRetry={handleStartRetry}
        onStopRetry={vi.fn()}
      />
    );

    const countEl = screen.getByTestId('retry-wrong-count');
    expect(countEl).toHaveTextContent(/3 câu sai/i);

    const retryBtn = screen.getByRole('button', { name: /Luyện lại câu sai/i });
    expect(retryBtn).not.toBeDisabled();

    fireEvent.click(retryBtn);
    expect(handleStartRetry).toHaveBeenCalledTimes(1);
  });

  it('renders "Về toàn bộ câu" button and active indicator when retryActive is true', () => {
    const handleStopRetry = vi.fn();
    render(
      <PracticeRetryToolbar
        wrongCount={3}
        retryActive={true}
        onStartRetry={vi.fn()}
        onStopRetry={handleStopRetry}
      />
    );

    // Shows active retry badge / indicator
    expect(screen.getByText(/Đang luyện lại câu sai/i)).toBeInTheDocument();

    // "Luyện lại câu sai" button is disabled while retry is already active
    const retryBtn = screen.getByRole('button', { name: /Luyện lại câu sai/i });
    expect(retryBtn).toBeDisabled();

    // "Về toàn bộ câu" button is visible and clickable
    const stopBtn = screen.getByRole('button', { name: /Về toàn bộ câu/i });
    expect(stopBtn).toBeInTheDocument();
    expect(stopBtn).not.toBeDisabled();

    fireEvent.click(stopBtn);
    expect(handleStopRetry).toHaveBeenCalledTimes(1);
  });

  it('disables toolbar buttons when disabled prop is true', () => {
    render(
      <PracticeRetryToolbar
        wrongCount={2}
        retryActive={true}
        disabled={true}
        onStartRetry={vi.fn()}
        onStopRetry={vi.fn()}
      />
    );

    const retryBtn = screen.getByRole('button', { name: /Luyện lại câu sai/i });
    expect(retryBtn).toBeDisabled();

    const stopBtn = screen.getByRole('button', { name: /Về toàn bộ câu/i });
    expect(stopBtn).toBeDisabled();
  });
});
