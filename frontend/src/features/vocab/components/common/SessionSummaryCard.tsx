import React from 'react';
import { Trophy, Zap, RotateCcw, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface SessionStatItem {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  colorClass?: string;
}

export interface SessionSummaryCardProps {
  title?: string;
  subtitle?: string;
  earnedXp?: number;
  accuracyPercent?: number;
  correctCount?: number;
  correctCountLabel?: string;
  incorrectCount?: number;
  incorrectCountLabel?: string;
  totalCards?: number;
  totalCardsLabel?: string;
  extraStats?: SessionStatItem[];
  children?: React.ReactNode;
  onPlayAgain?: () => void;
  playAgainText?: string;
  onBackToDeck: () => void;
  backToDeckText?: string;
  isHighScore?: boolean;
}

export const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({
  title,
  subtitle,
  earnedXp,
  accuracyPercent,
  correctCount,
  correctCountLabel,
  incorrectCount,
  incorrectCountLabel,
  totalCards,
  totalCardsLabel,
  extraStats = [],
  children,
  onPlayAgain,
  playAgainText,
  onBackToDeck,
  backToDeckText,
  isHighScore = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-lg p-6 sm:p-8 border border-slate-200 shadow-sm text-center animate-in zoom-in-95 duration-150 select-none">
      {/* Biểu tượng Vinh danh cúp vàng gọn gàng, không đổ bóng */}
      <div className="relative inline-flex items-center justify-center mb-3">
        <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
          <Trophy className="w-6 h-6" />
        </div>
        {isHighScore && (
          <span className="absolute -top-1.5 -right-3 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500 text-white">
            {t('vocab.session.high_score')}
          </span>
        )}
      </div>

      {/* Tiêu đề & Phụ đề nhẹ nhàng */}
      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mb-1">
        {title || t('vocab.session.completed_title')}
      </h2>
      <p className="text-xs sm:text-sm text-slate-500 font-normal mb-3">
        {subtitle || 'Bạn đã hoàn thành xuất sắc phiên học từ vựng.'}
      </p>

      {/* Huy hiệu XP thanh thoát, phẳng */}
      {earnedXp !== undefined && earnedXp > 0 && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-50 text-amber-700 font-medium text-xs sm:text-sm mb-4 border border-amber-200">
          <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
          <span>+{earnedXp} XP</span>
        </div>
      )}

      {/* Lưới thống kê 4 chỉ số: phẳng, sạch sẽ, không màu phủ loang lỗ */}
      <div className="grid grid-cols-2 gap-3 my-4 text-left">
        {totalCards !== undefined && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block mb-0.5 font-normal">
              {totalCardsLabel || t('vocab.session.cards_reviewed')}
            </span>
            <span className="text-xl sm:text-2xl font-semibold text-slate-800 tracking-tight">
              {totalCards}
            </span>
          </div>
        )}

        {accuracyPercent !== undefined && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block mb-0.5 font-normal">
              {t('vocab.session.accuracy')}
            </span>
            <span className="text-xl sm:text-2xl font-semibold text-slate-800 tracking-tight">
              {accuracyPercent}%
            </span>
          </div>
        )}

        {correctCount !== undefined && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 block mb-0.5 font-normal">
                {correctCountLabel || t('vocab.session.cards_remembered')}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-xl sm:text-2xl font-semibold text-emerald-600 tracking-tight">
              {correctCount}
            </span>
          </div>
        )}

        {incorrectCount !== undefined && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 block mb-0.5 font-normal">
                {incorrectCountLabel || t('vocab.actions.forgotten')}
              </span>
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <span className="text-xl sm:text-2xl font-semibold text-rose-600 tracking-tight">
              {incorrectCount}
            </span>
          </div>
        )}

        {extraStats.map((stat, i) => (
          <div key={i} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 block mb-0.5 font-normal">{stat.label}</span>
              {stat.icon && <span className="shrink-0">{stat.icon}</span>}
            </div>
            <span className={`text-xl sm:text-2xl font-semibold tracking-tight ${stat.colorClass || 'text-slate-800'}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Nội dung bổ sung nếu có */}
      {children && <div className="mt-4">{children}</div>}

      {/* Các nút hành động: phẳng, bo góc vừa vặn, không đổ bóng đậm */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
        {onPlayAgain && (
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-lg font-medium text-sm text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>{playAgainText || t('vocab.actions.play_again')}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onBackToDeck}
          className="w-full sm:flex-1 py-2.5 px-4 rounded-lg font-medium text-sm text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backToDeckText || t('vocab.actions.back_to_deck')}</span>
        </button>
      </div>
    </div>
  );
};
