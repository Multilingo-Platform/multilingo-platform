import React, { useEffect, useRef } from 'react';

export interface TimeUpOverlayProps {
  isExpired: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  onSubmit: (reason: 'TIMEOUT_CLIENT') => Promise<void> | void;
  onRetry?: () => void;
  onNavigateToResult?: () => void;
}

export const TimeUpOverlay: React.FC<TimeUpOverlayProps> = ({
  isExpired,
  isSubmitting = false,
  error = null,
  onSubmit,
  onRetry,
  onNavigateToResult,
}) => {
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (isExpired && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      onSubmit('TIMEOUT_CLIENT');
    }
  }, [isExpired, onSubmit]);

  if (!isExpired) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-up-title"
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[99999] p-4 select-none animate-fade-in"
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden text-center p-8 transition-all scale-100 animate-slide-up">
        {/* Animated Clock Icon */}
        <div className="w-20 h-20 mx-auto rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-4xl mb-5 text-amber-600 shadow-inner">
          ⏰
        </div>

        <h2
          id="time-up-title"
          className="text-2xl font-bold text-slate-900 font-heading mb-2 tracking-tight"
        >
          Thời gian làm bài đã hết!
        </h2>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Hệ thống đang tự động thu bài và khóa tất cả các câu trả lời của bạn.
        </p>

        {error ? (
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-center gap-2">
              <span>⚠️</span>
              <span>Kết nối không ổn định, đang thử lại...</span>
            </div>
            <button
              id="btn-retry-submit"
              type="button"
              onClick={onRetry ?? (() => onSubmit('TIMEOUT_CLIENT'))}
              className="w-full py-3 px-4 rounded-xl font-heading font-bold text-sm bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 active:scale-98 transition-all cursor-pointer"
            >
              Thử lại ngay
            </button>
          </div>
        ) : isSubmitting ? (
          <div className="flex flex-col items-center gap-3 py-2 text-amber-700">
            <svg className="animate-spin h-7 w-7 text-amber-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs font-semibold text-slate-600">Đang gửi bài và xử lý điểm thi...</span>
          </div>
        ) : onNavigateToResult ? (
          <button
            id="btn-view-result"
            type="button"
            onClick={onNavigateToResult}
            className="w-full py-3 px-4 rounded-xl font-heading font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-98 transition-all cursor-pointer"
          >
            Xem kết quả thi
          </button>
        ) : null}
      </div>
    </div>
  );
};
