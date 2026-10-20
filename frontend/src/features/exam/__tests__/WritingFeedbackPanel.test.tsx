import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import axiosClient from '../../../core/api/axiosClient';
import { WritingFeedbackPanel } from '../components/result/writing/WritingFeedbackPanel';
import * as useWritingFeedbackModule from '../hooks/useWritingFeedback';
import { normalizeWritingFeedback } from '../api/writingFeedbackContract';
import {
  validAiDoneTextOnlyWire,
  validPendingWire,
} from './fixtures/writingFeedback';
import { REFRESH_WARNING_MESSAGE } from '../utils/writingFeedbackErrors';

describe('WritingFeedbackPanel Component (AC-03, AC-07, AC-08, AC-09)', () => {
  const mockReload = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC_PANEL_01: does not enable hook when isOpen=false initially; enables when isOpen becomes true and shows loading', () => {
    const useHookSpy = vi.spyOn(useWritingFeedbackModule, 'useWritingFeedback').mockReturnValue({
      data: null,
      loading: true,
      refreshing: false,
      error: null,
      refreshError: null,
      reload: mockReload,
    });

    const { rerender } = render(
      <WritingFeedbackPanel attemptId={101} partId={202} isOpen={false} />
    );

    // Initial render with isOpen=false should pass enabled=false
    expect(useHookSpy).toHaveBeenLastCalledWith(101, 202, false);

    // Rerender with isOpen=true
    rerender(<WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />);
    expect(useHookSpy).toHaveBeenLastCalledWith(101, 202, true);

    // Shows loading role="status"
    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/Đang tải nhận xét/i)).toBeInTheDocument();
  });

  it('TC_PANEL_02: renders tasks, AI disclaimer and native refresh button when data is loaded', () => {
    const data = normalizeWritingFeedback(validAiDoneTextOnlyWire, 101, 202);
    vi.spyOn(useWritingFeedbackModule, 'useWritingFeedback').mockReturnValue({
      data,
      loading: false,
      refreshing: false,
      error: null,
      refreshError: null,
      reload: mockReload,
    });

    render(<WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />);

    // Renders task title and content
    expect(screen.getByText('Task 1: Academic Essay')).toBeInTheDocument();

    // Renders disclaimer
    expect(
      screen.getByText(/tham khảo/i)
    ).toBeInTheDocument();

    // Renders native refresh button
    const refreshBtn = screen.getByRole('button', { name: /Cập nhật nhận xét/i });
    expect(refreshBtn).toBeInTheDocument();
    expect(refreshBtn).not.toBeDisabled();
  });

  it('TC_PANEL_03: clicking refresh button calls reload; disabled when loading or refreshing', () => {
    const data = normalizeWritingFeedback(validAiDoneTextOnlyWire, 101, 202);
    const useHookSpy = vi.spyOn(useWritingFeedbackModule, 'useWritingFeedback');

    useHookSpy.mockReturnValue({
      data,
      loading: false,
      refreshing: false,
      error: null,
      refreshError: null,
      reload: mockReload,
    });

    const { rerender } = render(
      <WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />
    );

    const refreshBtn = screen.getByRole('button', { name: /Cập nhật nhận xét/i });
    fireEvent.click(refreshBtn);
    expect(mockReload).toHaveBeenCalledTimes(1);

    // When refreshing=true, button is disabled and text indicates updating
    useHookSpy.mockReturnValue({
      data,
      loading: false,
      refreshing: true,
      error: null,
      refreshError: null,
      reload: mockReload,
    });

    rerender(<WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />);
    const busyBtn = screen.getByRole('button', { name: /Đang cập nhật|Cập nhật nhận xét/i });
    expect(busyBtn).toBeDisabled();
    expect(screen.getByText(/Đang cập nhật/i)).toBeInTheDocument();
  });

  it('TC_PANEL_04: displays transient error with role="alert" and native retry button', () => {
    vi.spyOn(useWritingFeedbackModule, 'useWritingFeedback').mockReturnValue({
      data: null,
      loading: false,
      refreshing: false,
      error: {
        kind: 'server',
        status: 500,
        message: 'Hệ thống chấm điểm đang gặp sự sự cố. Vui lòng thử lại sau.',
        isTransient: true,
      },
      refreshError: null,
      reload: mockReload,
    });

    render(<WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Hệ thống chấm điểm đang gặp sự/i);

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('TC_PANEL_05: displays non-transient error (403, contract) with role="alert" and no retry button', () => {
    vi.spyOn(useWritingFeedbackModule, 'useWritingFeedback').mockReturnValue({
      data: null,
      loading: false,
      refreshing: false,
      error: {
        kind: 'forbidden',
        status: 403,
        message: 'Bạn không có quyền xem nhận xét của bài thi này.',
        isTransient: false,
      },
      refreshError: null,
      reload: mockReload,
    });

    render(<WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Bạn không có quyền xem nhận xét/i);
    expect(screen.queryByRole('button', { name: /Thử lại/i })).not.toBeInTheDocument();
  });

  it('TC_PANEL_06: displays refreshError warning banner while preserving existing feedback data', () => {
    const data = normalizeWritingFeedback(validAiDoneTextOnlyWire, 101, 202);
    vi.spyOn(useWritingFeedbackModule, 'useWritingFeedback').mockReturnValue({
      data,
      loading: false,
      refreshing: false,
      error: null,
      refreshError: {
        kind: 'timeout',
        message: REFRESH_WARNING_MESSAGE,
        isTransient: true,
      },
      reload: mockReload,
    });

    render(<WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />);

    // Preserves existing data
    expect(screen.getByText('Task 1: Academic Essay')).toBeInTheDocument();

    // Renders warning banner
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(REFRESH_WARNING_MESSAGE);
  });

  it('TC_PANEL_07: displays PENDING / QUEUED state message with role="status" and manual refresh button', () => {
    const data = normalizeWritingFeedback(validPendingWire, 101, 202);
    vi.spyOn(useWritingFeedbackModule, 'useWritingFeedback').mockReturnValue({
      data,
      loading: false,
      refreshing: false,
      error: null,
      refreshError: null,
      reload: mockReload,
    });

    render(<WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />);

    // Status announcement
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/đang được xử lý|đang chờ|tiến hành chấm/i).length).toBeGreaterThanOrEqual(1);

    // Manual refresh button available
    const refreshBtn = screen.getByRole('button', { name: /Cập nhật nhận xét/i });
    expect(refreshBtn).toBeInTheDocument();
    fireEvent.click(refreshBtn);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('TC_PANEL_08: supports hidden attribute when isOpen collapses after being opened', () => {
    const data = normalizeWritingFeedback(validAiDoneTextOnlyWire, 101, 202);
    vi.spyOn(useWritingFeedbackModule, 'useWritingFeedback').mockReturnValue({
      data,
      loading: false,
      refreshing: false,
      error: null,
      refreshError: null,
      reload: mockReload,
    });

    const { container, rerender } = render(
      <WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />
    );

    const rootEl = container.firstElementChild as HTMLElement;
    expect(rootEl).not.toHaveAttribute('hidden');

    // Collapse panel
    rerender(<WritingFeedbackPanel attemptId={101} partId={202} isOpen={false} />);
    expect(rootEl).toHaveAttribute('hidden');

    // Reopen panel
    rerender(<WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />);
    expect(rootEl).not.toHaveAttribute('hidden');
    expect(screen.getByText('Task 1: Academic Essay')).toBeInTheDocument();
  });

  describe('TV3-21-04-R2: identity-scoped opened latch with real hook', () => {
    function deferred() {
      let resolve!: (value: unknown) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      });
      return { promise, resolve, reject };
    }

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('switching from opened A to closed B does not dispatch GET for B until B is opened', async () => {
      const mockGet = vi.spyOn(axiosClient, 'get').mockResolvedValue({
        success: true,
        data: validAiDoneTextOnlyWire,
      });

      let renderResult!: ReturnType<typeof render>;
      await act(async () => {
        renderResult = render(
          <WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />
        );
      });
      const { rerender } = renderResult;

      // A was opened: GET for A should be called
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith(
        '/v1/attempts/101/writing-feedback',
        expect.objectContaining({ params: { partId: 202 } })
      );

      // Switch to B with isOpen=false
      act(() => {
        rerender(
          <WritingFeedbackPanel attemptId={102} partId={203} isOpen={false} />
        );
      });

      // B is closed: MUST NOT dispatch GET for B
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Switch part of same attempt: attemptId 101, partId 203, isOpen=false
      act(() => {
        rerender(
          <WritingFeedbackPanel attemptId={101} partId={203} isOpen={false} />
        );
      });

      // Still closed: MUST NOT dispatch GET
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Now open B (102, 203) for the first time
      await act(async () => {
        rerender(
          <WritingFeedbackPanel attemptId={102} partId={203} isOpen={true} />
        );
      });

      // Now GET for B should be called
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenCalledWith(
        '/v1/attempts/102/writing-feedback',
        expect.objectContaining({ params: { partId: 203 } })
      );
    });

    it('same identity open -> close -> open does not refetch, and collapse while loading does not abort request', async () => {
      const pendingDef = deferred();
      const mockGet = vi.spyOn(axiosClient, 'get').mockReturnValue(pendingDef.promise as never);

      const { rerender } = render(
        <WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />
      );

      expect(mockGet).toHaveBeenCalledTimes(1);
      const signal = mockGet.mock.calls[0][1]?.signal;

      // Collapse while loading
      act(() => {
        rerender(
          <WritingFeedbackPanel attemptId={101} partId={202} isOpen={false} />
        );
      });

      // Signal must NOT be aborted by collapse
      expect(signal?.aborted).toBe(false);

      // Resolve the pending fetch
      await act(async () => {
        pendingDef.resolve({
          success: true,
          data: validAiDoneTextOnlyWire,
        });
      });

      // Reopen panel
      act(() => {
        rerender(
          <WritingFeedbackPanel attemptId={101} partId={202} isOpen={true} />
        );
      });

      // Still 1 GET, no duplicate request
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Task 1: Academic Essay')).toBeInTheDocument();
    });
  });
});

