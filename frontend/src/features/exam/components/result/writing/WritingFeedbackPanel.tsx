import React, { useState } from 'react';
import { useWritingFeedback } from '../../../hooks/useWritingFeedback';
import { WritingFeedbackTask } from './WritingFeedbackTask';

export interface WritingFeedbackPanelProps {
  attemptId: number;
  partId: number;
  isOpen?: boolean;
  className?: string;
}

export const WritingFeedbackPanel: React.FC<WritingFeedbackPanelProps> = ({
  attemptId,
  partId,
  isOpen = true,
  className = '',
}) => {
  const currentIdentity = `${attemptId}:${partId}`;
  const [openedIdentity, setOpenedIdentity] = useState<{ id: string; opened: boolean }>({
    id: currentIdentity,
    opened: isOpen,
  });

  let isCurrentOpened = openedIdentity.opened;
  if (openedIdentity.id !== currentIdentity) {
    isCurrentOpened = isOpen;
    setOpenedIdentity({
      id: currentIdentity,
      opened: isOpen,
    });
  } else if (isOpen && !openedIdentity.opened) {
    isCurrentOpened = true;
    setOpenedIdentity({
      id: currentIdentity,
      opened: true,
    });
  }

  const enabled = isCurrentOpened;

  const { data, loading, refreshing, error, refreshError, reload } = useWritingFeedback(
    attemptId,
    partId,
    enabled
  );

  return (
    <div
      hidden={isOpen === false}
      className={`space-y-6 ${className}`}
      data-testid={`writing-feedback-panel-${partId}`}
    >
      {/* Header with Title and Refresh button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Nhận xét chi tiết phần thi Writing
          </h3>
          <p className="text-xs text-muted-foreground">
            Phần thi #{partId}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading || refreshing}
          aria-label={refreshing ? 'Đang cập nhật...' : 'Cập nhật nhận xét'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-background text-xs font-semibold text-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {refreshing ? 'Đang cập nhật...' : 'Cập nhật nhận xét'}
        </button>
      </div>

      {/* Refresh Warning Banner (Transient error during refresh) */}
      {refreshError && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
        >
          {refreshError.message}
        </div>
      )}

      {/* Loading state (initial fetch) */}
      {loading && !data && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center p-8 text-center space-y-3 rounded-xl border bg-muted/20"
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">
            Đang tải nhận xét Writing...
          </p>
        </div>
      )}

      {/* Initial load error state */}
      {error && !data && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 space-y-3"
        >
          <p className="text-sm font-semibold">{error.message}</p>
          {error.isTransient && (
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading || refreshing}
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Thử lại
            </button>
          )}
        </div>
      )}

      {/* Data loaded state */}
      {data && (
        <div className="space-y-6">
          {/* Part-level status banner for PENDING / QUEUED */}
          {(data.partStatus === 'PENDING' || data.partStatus === 'QUEUED') && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs md:text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 space-y-1"
            >
              <p className="font-semibold">
                Hệ thống đang tiến hành chấm điểm bài viết.
              </p>
              <p className="text-xs text-muted-foreground">
                Quá trình chấm có thể mất vài phút. Bạn có thể bấm nút &quot;Cập nhật nhận xét&quot; để kiểm tra kết quả mới nhất.
              </p>
            </div>
          )}

          {/* Tasks list */}
          {data.tasks && data.tasks.length > 0 ? (
            <div className="space-y-6">
              {data.tasks.map(task => (
                <WritingFeedbackTask key={task.questionId} task={task} />
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground italic rounded-xl border bg-muted/10">
              Không có dữ liệu bài viết trong phần thi này.
            </div>
          )}

          {/* AI Reference Disclaimer */}
          <footer className="rounded-lg border bg-muted/30 p-3.5 text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Lưu ý: </span>
            Các nhận xét, phân tích ngữ cảnh, điểm số ước tính và đề xuất chỉnh sửa từ AI chỉ mang tính chất tham khảo nhằm hỗ trợ người học cải thiện kỹ năng viết.
          </footer>
        </div>
      )}
    </div>
  );
};
