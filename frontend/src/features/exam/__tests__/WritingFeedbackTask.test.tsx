import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WritingFeedbackTask } from '../components/result/writing/WritingFeedbackTask';
import { normalizeWritingFeedback } from '../api/writingFeedbackContract';
import {
  validAiDoneTextOnlyWire,
  validAiDoneVisualWire,
  validTooShortSystemWire,
  validPendingWire,
  validQueuedWire,
  validFailedWire,
  validUnavailableWire,
} from './fixtures/writingFeedback';
import type { WritingFeedbackTask as WritingFeedbackTaskData } from '../types/api.types';

describe('WritingFeedbackTask Component (AC-04, AC-05, AC-08, AC-09)', () => {
  it('TC_TASK_01: renders regular AI DONE text-only task with canonical criteria, score, diff and corrections', () => {
    const response = normalizeWritingFeedback(validAiDoneTextOnlyWire, 101, 202);
    const task = response.tasks[0];

    render(<WritingFeedbackTask task={task} />);

    // Header & metadata
    expect(screen.getByText('Task 1: Academic Essay')).toBeInTheDocument();
    expect(screen.getByText(/15/)).toBeInTheDocument();
    expect(screen.getByText(/Đã có kết quả/i)).toBeInTheDocument();
    expect(screen.getByText(/Chấm bởi AI/i)).toBeInTheDocument();

    // Overall score
    expect(screen.getAllByText(/7,0/).length).toBeGreaterThanOrEqual(1);

    // 4 Canonical criteria names & feedbacks
    expect(screen.getByRole('heading', { name: /Task Response/i })).toBeInTheDocument();
    expect(screen.getByText('Strong task response addressing all parts.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Coherence & Cohesion/i })).toBeInTheDocument();
    expect(screen.getByText('Clear progression throughout with appropriate cohesive devices.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Lexical Resource/i })).toBeInTheDocument();
    expect(screen.getByText('Sufficient range of vocabulary with flexibility.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Grammatical Range & Accuracy/i })).toBeInTheDocument();
    expect(screen.getByText('Good mix of simple and complex sentence structures.')).toBeInTheDocument();

    // Overall feedback
    expect(screen.getByText('A well-written response with clear argumentation and solid structure.')).toBeInTheDocument();

    // Diff view & corrections
    expect(screen.getByRole('button', { name: 'So sánh' })).toBeInTheDocument();
    expect(screen.getByText('Added "global" for stronger academic collocation.')).toBeInTheDocument();

    // No visual observations for text-only
    expect(screen.queryByTestId('visual-observations')).not.toBeInTheDocument();
  });

  it('TC_TASK_02: renders visual observations when task has visual context and observations', () => {
    const response = normalizeWritingFeedback(validAiDoneVisualWire, 101, 202);
    const task = response.tasks[0];

    render(<WritingFeedbackTask task={task} />);

    const visualSection = screen.getByTestId('visual-observations');
    expect(visualSection).toBeInTheDocument();
    expect(
      screen.getByText('Biểu đồ cột thể hiện mức tiêu thụ năng lượng sạch tăng gấp đôi trong thập kỷ vừa qua.')
    ).toBeInTheDocument();
    expect(screen.getAllByText(/7,5/).length).toBeGreaterThanOrEqual(1);
  });

  it('TC_TASK_03: renders TOO_SHORT task with SYSTEM source, score 0,0 and no AI badge', () => {
    const response = normalizeWritingFeedback(validTooShortSystemWire, 101, 202);
    const task = response.tasks[0];

    render(<WritingFeedbackTask task={task} />);

    expect(screen.getByText('Task 1: Short Essay')).toBeInTheDocument();
    expect(screen.getByText(/Hệ thống/i)).toBeInTheDocument();
    expect(screen.queryByText(/Chấm bởi AI/i)).not.toBeInTheDocument();

    // Score 0,0
    expect(screen.getAllByText(/0,0/).length).toBeGreaterThanOrEqual(1);

    // Explanatory message
    expect(
      screen.getByText(/Bài viết của bạn quá ngắn/i)
    ).toBeInTheDocument();
  });

  it('TC_TASK_04: renders PENDING / QUEUED task with status message and without score or diff', () => {
    const pendingResponse = normalizeWritingFeedback(validPendingWire, 101, 202);
    const pendingTask = pendingResponse.tasks[0];

    const { rerender } = render(<WritingFeedbackTask task={pendingTask} />);

    expect(screen.getByText(/Đang chờ chấm/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'So sánh' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Task Response/i)).not.toBeInTheDocument();

    const queuedResponse = normalizeWritingFeedback(validQueuedWire, 101, 202);
    const queuedTask = queuedResponse.tasks[0];

    rerender(<WritingFeedbackTask task={queuedTask} />);

    expect(screen.getByText(/Đang trong hàng đợi/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'So sánh' })).not.toBeInTheDocument();
  });

  it('TC_TASK_05: renders FAILED / UNAVAILABLE task with safe mapped reason messages and no scores', () => {
    const unavailResponse = normalizeWritingFeedback(validUnavailableWire, 101, 202);
    const unavailTask = unavailResponse.tasks[0];

    const { rerender } = render(<WritingFeedbackTask task={unavailTask} />);

    expect(screen.getAllByText(/Chưa có nhận xét/i).length).toBeGreaterThanOrEqual(1);
    // UNSUPPORTED_LANGUAGE mapped message
    expect(screen.getByText('Chưa hỗ trợ chấm Writing tiếng Việt.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'So sánh' })).not.toBeInTheDocument();

    const failedResponse = normalizeWritingFeedback(validFailedWire, 101, 202);
    const failedTask = failedResponse.tasks[0];

    rerender(<WritingFeedbackTask task={failedTask} />);

    expect(screen.getAllByText(/Chấm điểm thất bại/i).length).toBeGreaterThanOrEqual(1);
    // BLOCKED is unknown reason code -> maps to default safe message
    expect(screen.getByText('Không có nhận xét chi tiết cho bài viết này.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'So sánh' })).not.toBeInTheDocument();
  });

  it('shows a truthful Vietnamese-specific message for unsupported NLTV writing', () => {
    const response = normalizeWritingFeedback(validUnavailableWire, 101, 202);
    const task = { ...response.tasks[0], language: 'vi' };

    render(<WritingFeedbackTask task={task} />);

    expect(screen.getByText('Chưa hỗ trợ chấm Writing tiếng Việt.')).toBeInTheDocument();
    expect(screen.queryByText(/Điểm Overall/i)).not.toBeInTheDocument();
  });

  it('TC_TASK_06: safely renders HTML-like content as inert text nodes without DOM injection', () => {
    const response = normalizeWritingFeedback(validAiDoneTextOnlyWire, 101, 202);
    const maliciousTask: WritingFeedbackTaskData = {
      ...response.tasks[0],
      label: 'Dangerous <script>alert("xss")</script> Title',
      overallFeedback: 'Review with <img src=x onerror=alert(1)> image tag.',
      hasVisualContext: true,
      visualObservations: '<div onclick="steal()">Click me</div> visual text',
    };

    render(<WritingFeedbackTask task={maliciousTask} />);

    // Text is preserved literally
    expect(screen.getByText(/Dangerous <script>alert\("xss"\)<\/script> Title/)).toBeInTheDocument();
    expect(screen.getByText(/Review with <img src=x onerror=alert\(1\)> image tag\./)).toBeInTheDocument();
    expect(screen.getByText(/<div onclick="steal\(\)">Click me<\/div> visual text/)).toBeInTheDocument();

    // No actual malicious DOM elements injected
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('TC_TASK_07: sorts criteria canonically TR -> CC -> LR -> GRA even if received out of order', () => {
    const response = normalizeWritingFeedback(validAiDoneTextOnlyWire, 101, 202);
    const unorderedTask: WritingFeedbackTaskData = {
      ...response.tasks[0],
      criteria: [
        { code: 'GRA', score: 7.0, feedback: 'GRA feedback' },
        { code: 'TR', score: 8.0, feedback: 'TR feedback' },
        { code: 'LR', score: 7.5, feedback: 'LR feedback' },
        { code: 'CC', score: 6.5, feedback: 'CC feedback' },
      ],
    };

    render(<WritingFeedbackTask task={unorderedTask} />);

    const criteriaTitles = screen
      .getAllByRole('heading', { level: 4 })
      .map(h => h.textContent ?? '')
      .filter(text => /(Task Response|Coherence & Cohesion|Lexical Resource|Grammatical Range & Accuracy)/.test(text));

    // Should be TR, CC, LR, GRA
    expect(criteriaTitles[0]).toMatch(/Task Response/);
    expect(criteriaTitles[1]).toMatch(/Coherence & Cohesion/);
    expect(criteriaTitles[2]).toMatch(/Lexical Resource/);
    expect(criteriaTitles[3]).toMatch(/Grammatical Range & Accuracy/);
  });

  it('TC_TASK_08 (TV3-21-04-R1): does not render raw displayMessage in PENDING or QUEUED state even with sensitive markers', () => {
    const rawPendingWithMarker = {
      ...validPendingWire,
      tasks: [
        {
          ...validPendingWire.tasks[0],
          reasonCode: 'UNKNOWN_INTERNAL_REASON',
          displayMessage: 'RAW_PROVIDER_TOKEN_INTERNAL_MARKER: secret_12345',
        },
      ],
    };

    const normalizedPending = normalizeWritingFeedback(rawPendingWithMarker, 101, 202);
    const pendingTask = normalizedPending.tasks[0];

    const { rerender } = render(<WritingFeedbackTask task={pendingTask} />);

    // Must NOT render the raw displayMessage or sensitive marker
    expect(screen.queryByText(/RAW_PROVIDER_TOKEN_INTERNAL_MARKER/)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret_12345/)).not.toBeInTheDocument();
    // Must render safe fixed fallback message
    expect(
      screen.getByText('Vui lòng bấm nút "Cập nhật nhận xét" phía trên để kiểm tra kết quả khi hoàn tất.')
    ).toBeInTheDocument();

    const rawQueuedWithMarker = {
      ...validQueuedWire,
      tasks: [
        {
          ...validQueuedWire.tasks[0],
          reasonCode: null,
          displayMessage: 'RAW_QUEUE_DEBUG_PAYLOAD: internal_queue_state',
        },
      ],
    };

    const normalizedQueued = normalizeWritingFeedback(rawQueuedWithMarker, 101, 202);
    const queuedTask = normalizedQueued.tasks[0];

    rerender(<WritingFeedbackTask task={queuedTask} />);

    expect(screen.queryByText(/RAW_QUEUE_DEBUG_PAYLOAD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal_queue_state/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Vui lòng bấm nút "Cập nhật nhận xét" phía trên để kiểm tra kết quả khi hoàn tất.')
    ).toBeInTheDocument();
  });
});

