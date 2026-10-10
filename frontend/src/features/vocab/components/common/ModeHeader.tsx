import React, { useState } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatSecondsToMmSs } from '../../utils/vocabFormatters';

export interface ModeHeaderProps {
  title: string;
  deckName: string;
  currentIndex?: number;
  totalItems?: number;
  secondsLeft?: number;
  showTimer?: boolean;
  onBack: () => void;
  confirmOnBack?: boolean;
}

export const ModeHeader: React.FC<ModeHeaderProps> = ({
  title,
  deckName,
  currentIndex,
  totalItems,
  secondsLeft,
  showTimer = false,
  onBack,
  confirmOnBack = true,
}) => {
  const { t } = useTranslation();
  const [showExitModal, setShowExitModal] = useState(false);

  const handleBackClick = () => {
    if (confirmOnBack) {
      setShowExitModal(true);
    } else {
      onBack();
    }
  };

  const progressPercent =
    currentIndex !== undefined && totalItems && totalItems > 0
      ? Math.min(100, Math.round((currentIndex / totalItems) * 100))
      : 0;

  return (
    <>
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Nút quay lại & Tiêu đề chế độ */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBackClick}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
              title={t('vocab.deck_detail.back_to_decks')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate flex items-center gap-2">
                <span>{title}</span>
                <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                  • {deckName}
                </span>
              </h1>
              {currentIndex !== undefined && totalItems !== undefined && (
                <p className="text-xs text-slate-600 font-medium">
                  {currentIndex} / {totalItems} {t('vocab.deck_detail.word_col').toLowerCase()}
                </p>
              )}
            </div>
          </div>

          {/* Đồng hồ đếm ngược (nếu có) */}
          {showTimer && secondsLeft !== undefined && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold transition-colors ${
                secondsLeft <= 10
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatSecondsToMmSs(secondsLeft)}</span>
            </div>
          )}
        </div>

        {/* Thanh tiến độ học tập mảnh */}
        {totalItems !== undefined && totalItems > 0 && (
          <div className="w-full h-1 bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </header>

      {/* Modal xác nhận thoát giữa chừng */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {t('vocab.session.quit_title')}
            </h3>
            <p className="text-sm text-slate-600 mb-6 font-medium">
              {t('vocab.session.quit_confirm')}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 rounded-md text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                {t('vocab.actions.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  onBack();
                }}
                className="px-4 py-2 rounded-md text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-xs"
              >
                {t('vocab.actions.back_to_deck')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
