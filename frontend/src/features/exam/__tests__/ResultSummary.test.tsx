import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { ObjectiveResultSummary } from '../components/result/ObjectiveResultSummary';
import { WritingResultSummary } from '../components/result/WritingResultSummary';
import { normalizeAttemptResult } from '../api/resultContract';
import { attemptResultFixture } from './fixtures/attemptResult';
import { validAiDoneTextOnlyWire } from './fixtures/writingFeedback';

function summary() { return normalizeAttemptResult(attemptResultFixture(), 42).resultSummary!; }

describe('backend summary components', () => {
  it('shows raw score and backend accuracy rather than band or correct count', () => {
    render(<ObjectiveResultSummary objective={summary().objective} />);
    expect(screen.getByText('Điểm khách quan (raw)')).toBeInTheDocument();
    expect(screen.getAllByText('5,5')).toHaveLength(3);
    expect(screen.getAllByText('33,33%')).toHaveLength(3);
    const partTable = screen.getByRole('table', { name: 'Kết quả theo phần thi' });
    expect(within(partTable).getByRole('row', { name: /Phần đọc tiếng Việt/ })).toHaveTextContent('READING');
    expect(within(partTable).getByRole('columnheader', { name: 'Bỏ trống' })).toHaveAttribute('scope', 'col');
  });
  it('zero objective count is explanatory, not a zero-over-zero result', () => {
    const objective = { ...summary().objective, rawScore: 0, correct: 0, incorrect: 0, unanswered: 0, total: 0, accuracy: 0, bySkill: [], byPart: [] };
    render(<ObjectiveResultSummary objective={objective} />);
    expect(screen.getByText(/Không có câu khách quan/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('0/0')).not.toBeInTheDocument();
  });
  it.each([
    ['PENDING', 'Đang chờ chấm'], ['QUEUED', 'Đang chờ xử lý'],
    ['FAILED', 'Chấm Writing thất bại'], ['UNAVAILABLE', 'Chưa có kết quả chấm Writing'],
  ] as const)('shows Writing %s with null scores and backend word count', (status, label) => {
    const writing = summary().writing!;
    writing.status = status; writing.tasks[0].status = status;
    render(<WritingResultSummary writing={writing} />);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText('123')).toBeInTheDocument(); expect(screen.getByText('Chưa có điểm')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('keeps repeated question IDs in different parts and escapes labels', () => {
    const writing = summary().writing!;
    writing.tasks[0].label = '<img src=x onerror=alert(1)> Tiếng Việt';
    writing.tasks.push({ ...writing.tasks[0], partId: 21, label: 'Bài thứ hai' });
    const { container } = render(<WritingResultSummary writing={writing} />);
    expect(screen.getByText('<img src=x onerror=alert(1)> Tiếng Việt')).toBeInTheDocument();
    expect(screen.getByText('Bài thứ hai')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getAllByText(/Câu essay/)).toHaveLength(2);
  });
  it('does not create a Writing section when backend has none', () => {
    const { container } = render(<WritingResultSummary writing={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('TV3-21-05 Writing Result dynamic part integration', () => {
    it('TC_RS_01: groups tasks by partId in order of first appearance, supporting non-consecutive IDs and multiple tasks per part', () => {
      const writing: NonNullable<ReturnType<typeof summary>['writing']> = {
        status: 'PENDING',
        tasks: [
          { partId: 25, questionId: 'q1', label: 'Part 25 Essay 1', status: 'PENDING', wordCount: 150, score: null, maxScore: null },
          { partId: 10, questionId: 'q2', label: 'Part 10 Report', status: 'PENDING', wordCount: 200, score: null, maxScore: null },
          { partId: 25, questionId: 'q3', label: 'Part 25 Essay 2', status: 'PENDING', wordCount: 180, score: null, maxScore: null },
        ],
      };

      render(<WritingResultSummary writing={writing} attemptId={42} />);

      const partHeadings = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
      expect(partHeadings).toEqual(['Phần thi 25', 'Phần thi 10']);

      expect(screen.getByText('Part 25 Essay 1')).toBeInTheDocument();
      expect(screen.getByText('Part 25 Essay 2')).toBeInTheDocument();
      expect(screen.getByText('Part 10 Report')).toBeInTheDocument();
    });

    it('TC_RS_02: renders disclosure button "Xem nhận xét AI" with aria-expanded and aria-controls for each part when attemptId is provided', () => {
      const writing: NonNullable<ReturnType<typeof summary>['writing']> = {
        status: 'PENDING',
        tasks: [
          { partId: 20, questionId: 'q1', label: 'Essay 1', status: 'PENDING', wordCount: 100, score: null, maxScore: null },
          { partId: 30, questionId: 'q2', label: 'Essay 2', status: 'PENDING', wordCount: 120, score: null, maxScore: null },
        ],
      };

      render(<WritingResultSummary writing={writing} attemptId={42} />);

      const buttons = screen.getAllByRole('button', { name: /Xem nhận xét AI/i });
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
      expect(buttons[0]).toHaveAttribute('aria-controls', 'writing-feedback-part-20');
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'false');
      expect(buttons[1]).toHaveAttribute('aria-controls', 'writing-feedback-part-30');
    });

    it('TC_RS_03: toggling disclosure expands panel and reveals feedback panel; collapsing keeps panel mounted with hidden attribute', () => {
      const writing: NonNullable<ReturnType<typeof summary>['writing']> = {
        status: 'PENDING',
        tasks: [
          { partId: 20, questionId: 'q1', label: 'Essay 1', status: 'PENDING', wordCount: 100, score: null, maxScore: null },
        ],
      };

      const { container } = render(<WritingResultSummary writing={writing} attemptId={42} />);

      const toggleBtn = screen.getByRole('button', { name: /Xem nhận xét AI/i });
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

      // Before open: wrapper with ID exists in DOM with hidden attribute so aria-controls resolves, but panel is not mounted
      const initialContainer = container.querySelector('#writing-feedback-part-20');
      expect(initialContainer).not.toBeNull();
      expect(initialContainer).toHaveAttribute('hidden');
      expect(container.querySelector('[data-testid="writing-feedback-panel-20"]')).toBeNull();

      // Click to open
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
      const panelContainer = container.querySelector('#writing-feedback-part-20');
      expect(panelContainer).not.toBeNull();
      expect(panelContainer).not.toHaveAttribute('hidden');
      expect(container.querySelector('[data-testid="writing-feedback-panel-20"]')).not.toBeNull();

      // Click to collapse
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
      // Panel container remains mounted in DOM with hidden attribute
      expect(container.querySelector('#writing-feedback-part-20')).not.toBeNull();
      expect(container.querySelector('#writing-feedback-part-20')).toHaveAttribute('hidden');
      expect(container.querySelector('[data-testid="writing-feedback-panel-20"]')).not.toBeNull();

      // Click to reopen
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
      expect(container.querySelector('#writing-feedback-part-20')).not.toHaveAttribute('hidden');
      expect(container.querySelector('[data-testid="writing-feedback-panel-20"]')).not.toBeNull();
    });

    it('TC_RS_04: opening part A does not close part B (independent disclosures)', () => {
      const writing: NonNullable<ReturnType<typeof summary>['writing']> = {
        status: 'PENDING',
        tasks: [
          { partId: 10, questionId: 'q1', label: 'Task 1', status: 'PENDING', wordCount: 100, score: null, maxScore: null },
          { partId: 20, questionId: 'q2', label: 'Task 2', status: 'PENDING', wordCount: 120, score: null, maxScore: null },
        ],
      };

      const { container } = render(<WritingResultSummary writing={writing} attemptId={42} />);

      const buttons = screen.getAllByRole('button', { name: /Xem nhận xét AI/i });

      // Open Part 10
      fireEvent.click(buttons[0]);
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'false');
      expect(container.querySelector('#writing-feedback-part-10')).not.toHaveAttribute('hidden');
      expect(container.querySelector('#writing-feedback-part-20')).toHaveAttribute('hidden');
      expect(container.querySelector('[data-testid="writing-feedback-panel-20"]')).toBeNull();

      // Open Part 20
      fireEvent.click(buttons[1]);
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'true');
      expect(container.querySelector('#writing-feedback-part-10')).not.toHaveAttribute('hidden');
      expect(container.querySelector('#writing-feedback-part-20')).not.toHaveAttribute('hidden');
      expect(container.querySelector('[data-testid="writing-feedback-panel-20"]')).not.toBeNull();
    });

    it('TC_RS_05: does not render disclosure button when attemptId is null/undefined or when tasks array is empty', () => {
      const writing: NonNullable<ReturnType<typeof summary>['writing']> = {
        status: 'PENDING',
        tasks: [
          { partId: 10, questionId: 'q1', label: 'Task 1', status: 'PENDING', wordCount: 100, score: null, maxScore: null },
        ],
      };

      const { rerender } = render(<WritingResultSummary writing={writing} attemptId={null} />);
      expect(screen.queryByRole('button', { name: /nhận xét AI/i })).not.toBeInTheDocument();

      rerender(<WritingResultSummary writing={writing} attemptId={undefined} />);
      expect(screen.queryByRole('button', { name: /nhận xét AI/i })).not.toBeInTheDocument();

      rerender(<WritingResultSummary writing={{ status: 'UNAVAILABLE', tasks: [] }} attemptId={42} />);
      expect(screen.queryByRole('button', { name: /nhận xét AI/i })).not.toBeInTheDocument();
    });

    it('TC_RS_06: switching attemptId on same component instance resets disclosure state, keeping panel unmounted and preventing GET until opened', async () => {
      const mockGet = vi.spyOn(axiosClient, 'get').mockImplementation(async (url: string, config?: any) => {
        const match = url.match(/\/attempts\/(\d+)\/writing-feedback/);
        const matchedAttemptId = match ? Number(match[1]) : 42;
        return {
          success: true,
          data: {
            ...validAiDoneTextOnlyWire,
            attemptId: matchedAttemptId,
            partId: config?.params?.partId ?? 20,
          },
        };
      });

      const writing: NonNullable<ReturnType<typeof summary>['writing']> = {
        status: 'PENDING',
        tasks: [
          { partId: 20, questionId: 'q1', label: 'Essay 1', status: 'PENDING', wordCount: 100, score: null, maxScore: null },
        ],
      };

      const { container, rerender } = render(<WritingResultSummary writing={writing} attemptId={42} />);

      // Open part 20 on attempt 42
      const button42 = screen.getByRole('button', { name: /Xem nhận xét AI/i });
      expect(button42).toHaveAttribute('aria-expanded', 'false');
      await act(async () => {
        fireEvent.click(button42);
      });
      expect(button42).toHaveAttribute('aria-expanded', 'true');
      expect(container.querySelector('#writing-feedback-part-20')).not.toBeNull();
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith(
        '/v1/attempts/42/writing-feedback',
        expect.objectContaining({ params: { partId: 20 } })
      );

      // Switch to attempt 43 with same partId 20 on the SAME component instance
      await act(async () => {
        rerender(<WritingResultSummary writing={writing} attemptId={43} />);
      });

      // MUST be closed, wrapper hidden, panel unmounted, and NO GET request for attempt 43 dispatched
      const button43 = screen.getByRole('button', { name: /Xem nhận xét AI/i });
      expect(button43).toHaveAttribute('aria-expanded', 'false');
      expect(container.querySelector('#writing-feedback-part-20')).not.toBeNull();
      expect(container.querySelector('#writing-feedback-part-20')).toHaveAttribute('hidden');
      expect(container.querySelector('[data-testid="writing-feedback-panel-20"]')).toBeNull();
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Now open part 20 on attempt 43
      await act(async () => {
        fireEvent.click(button43);
      });
      expect(button43).toHaveAttribute('aria-expanded', 'true');
      expect(container.querySelector('#writing-feedback-part-20')).not.toBeNull();
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenCalledWith(
        '/v1/attempts/43/writing-feedback',
        expect.objectContaining({ params: { partId: 20 } })
      );

      // Collapse and reopen on attempt 43: does NOT dispatch a 3rd GET
      await act(async () => {
        fireEvent.click(button43); // collapse
      });
      expect(button43).toHaveAttribute('aria-expanded', 'false');
      expect(container.querySelector('#writing-feedback-part-20')).toHaveAttribute('hidden');

      await act(async () => {
        fireEvent.click(button43); // reopen
      });
      expect(button43).toHaveAttribute('aria-expanded', 'true');
      expect(container.querySelector('#writing-feedback-part-20')).not.toHaveAttribute('hidden');
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });
});
