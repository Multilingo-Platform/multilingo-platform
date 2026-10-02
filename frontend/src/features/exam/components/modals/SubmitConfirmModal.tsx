import React, { useState, useEffect } from 'react';

export interface SubmitConfirmModalProps {
  open?: boolean;
  total?: number;
  answered?: number;
  totalQuestions?: number;
  answeredCount?: number;
  unansweredCount?: number;
  cooldownSeconds?: number;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const SubmitConfirmModal: React.FC<SubmitConfirmModalProps> = ({
  open = true,
  total,
  answered,
  totalQuestions,
  answeredCount,
  unansweredCount: propUnanswered,
  cooldownSeconds,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const effectiveTotal = total ?? totalQuestions;
  const effectiveAnswered = answered ?? answeredCount;

  let unanswered = 0;
  if (propUnanswered !== undefined) {
    unanswered = propUnanswered;
  } else if (effectiveTotal !== undefined && effectiveAnswered !== undefined) {
    unanswered = Math.max(0, effectiveTotal - effectiveAnswered);
  }

  const hasUnanswered = unanswered > 0;
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    if (!open) return;
    const initialCooldown = hasUnanswered ? (cooldownSeconds ?? 2) : 0;
    setCountdown(initialCooldown);
    if (initialCooldown <= 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open, hasUnanswered, cooldownSeconds]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
      className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-opacity animate-fade-in"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden transition-all scale-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shrink-0 text-amber-600">
            🚀
          </div>
          <div>
            <h3
              id="submit-modal-title"
              className="text-slate-900 font-bold text-lg font-heading"
            >
              Xác nhận nộp bài thi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Kiểm tra thông tin trước khi hoàn tất</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {hasUnanswered ? (
            <div className="flex items-start gap-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900">
              <span className="text-lg shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Bạn còn {unanswered} câu chưa làm!
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Các câu bỏ trống sẽ không được tính điểm. Bạn có chắc chắn muốn nộp không?
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900">
              <span className="text-lg shrink-0 mt-0.5">🎉</span>
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Bạn đã trả lời đầy đủ các câu hỏi!
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Sẵn sàng gửi bài để hệ thống bắt đầu chấm điểm.
                </p>
              </div>
            </div>
          )}

          <p className="text-sm text-slate-600 leading-relaxed">
            Sau khi nộp bài, hệ thống sẽ kết thúc bài thi và chuyển sang báo cáo chấm điểm. Bạn{' '}
            <strong className="text-slate-900 font-semibold">không thể chỉnh sửa lại</strong> các câu
            trả lời.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button
            id="btn-confirm-submit"
            type="button"
            disabled={countdown > 0 || isLoading}
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl font-heading font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 ${
              countdown > 0 || isLoading
                ? 'bg-amber-300 text-amber-800 cursor-not-allowed opacity-80'
                : 'bg-amber-600 hover:bg-amber-700 active:scale-98 text-white shadow-md shadow-amber-600/20 cursor-pointer'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Đang nộp bài...</span>
              </>
            ) : countdown > 0 ? (
              <span>Nộp bài ngay ({countdown}s)</span>
            ) : (
              <span>Nộp bài ngay</span>
            )}
          </button>

          {onCancel && (
            <button
              id="btn-cancel-submit"
              type="button"
              disabled={isLoading}
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 rounded-xl font-heading font-semibold text-sm bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 active:scale-98 transition-all duration-150 cursor-pointer disabled:opacity-50"
            >
              Tiếp tục làm bài
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
