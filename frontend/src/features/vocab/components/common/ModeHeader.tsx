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
      <header className="w-full bg-card border-b border-border/60 sticky top-0 z-20 backdrop-blur-md bg-card/90">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Nút quay lại & Tiêu đề chế độ */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBackClick}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors focus:outline-none"
              title={t('vocab.deck_detail.back_to_decks')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground truncate flex items-center gap-2">
                <span>{title}</span>
                <span className="text-xs font-normal text-muted-foreground hidden sm:inline">
                  • {deckName}
                </span>
              </h1>
              {currentIndex !== undefined && totalItems !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {currentIndex} / {totalItems} {t('vocab.deck_detail.word_col').toLowerCase()}
                </p>
              )}
            </div>
          </div>

          {/* Đồng hồ đếm ngược (nếu có) */}
          {showTimer && secondsLeft !== undefined && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                secondsLeft <= 10
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 animate-pulse'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatSecondsToMmSs(secondsLeft)}</span>
            </div>
          )}
        </div>

        {/* Thanh tiến độ học tập mảnh */}
        {totalItems !== undefined && totalItems > 0 && (
          <div className="w-full h-1 bg-muted overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </header>

      {/* Modal xác nhận thoát giữa chừng */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-xl border border-border">
            <h3 className="text-lg font-bold text-foreground mb-2">
              {t('vocab.session.quit_title')}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {t('vocab.session.quit_confirm')}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-foreground hover:bg-accent/60 transition-colors"
              >
                {t('vocab.actions.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  onBack();
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-sm"
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
