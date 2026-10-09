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
  earnedXp?: number;
  accuracyPercent?: number;
  correctCount?: number;
  incorrectCount?: number;
  totalCards?: number;
  extraStats?: SessionStatItem[];
  onPlayAgain?: () => void;
  onBackToDeck: () => void;
  isHighScore?: boolean;
}

export const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({
  title,
  earnedXp,
  accuracyPercent,
  correctCount,
  incorrectCount,
  totalCards,
  extraStats = [],
  onPlayAgain,
  onBackToDeck,
  isHighScore = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-lg mx-auto bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-xl text-center animate-in zoom-in-95 duration-300">
      {/* Biểu tượng Vinh danh */}
      <div className="relative inline-flex items-center justify-center mb-4">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-inner">
          <Trophy className="w-10 h-10 animate-bounce" />
        </div>
        {isHighScore && (
          <span className="absolute -top-2 -right-4 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white shadow-md animate-pulse">
            {t('vocab.session.high_score')}
          </span>
        )}
      </div>

      {/* Tiêu đề & Lời chúc */}
      <h2 className="text-xl sm:text-2xl font-black text-foreground mb-1">
        {title || t('vocab.session.completed_title')}
      </h2>

      {/* Huy hiệu XP nhận được */}
      {earnedXp !== undefined && earnedXp > 0 && (
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold text-sm my-3 border border-amber-200 dark:border-amber-800/40">
          <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
          <span>+{earnedXp} XP</span>
        </div>
      )}

      {/* Lưới thống kê chi tiết */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-6 text-left">
        {totalCards !== undefined && (
          <div className="p-3.5 rounded-2xl bg-muted/60 border border-border/40">
            <span className="text-xs text-muted-foreground block mb-0.5">
              {t('vocab.session.cards_reviewed')}
            </span>
            <span className="text-lg font-bold text-foreground">{totalCards}</span>
          </div>
        )}

        {correctCount !== undefined && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 block mb-0.5 font-medium">
                {t('vocab.session.cards_remembered')}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {correctCount}
            </span>
          </div>
        )}

        {incorrectCount !== undefined && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-rose-600 dark:text-rose-400 block mb-0.5 font-medium">
                {t('vocab.actions.forgotten')}
              </span>
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <span className="text-lg font-bold text-rose-600 dark:text-rose-400">
              {incorrectCount}
            </span>
          </div>
        )}

        {accuracyPercent !== undefined && (
          <div className="p-3.5 rounded-2xl bg-muted/60 border border-border/40">
            <span className="text-xs text-muted-foreground block mb-0.5">
              {t('vocab.session.accuracy')}
            </span>
            <span className="text-lg font-bold text-foreground">
              {accuracyPercent}%
            </span>
          </div>
        )}

        {extraStats.map((stat, i) => (
          <div key={i} className="p-3.5 rounded-2xl bg-muted/60 border border-border/40">
            <span className="text-xs text-muted-foreground block mb-0.5">{stat.label}</span>
            <span className={`text-lg font-bold ${stat.colorClass || 'text-foreground'}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Các nút hành động */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        {onPlayAgain && (
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl font-semibold text-sm text-foreground bg-accent hover:bg-accent/80 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t('vocab.actions.play_again')}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onBackToDeck}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl font-semibold text-sm text-white bg-amber-500 hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('vocab.actions.back_to_deck')}</span>
        </button>
      </div>
    </div>
  );
};
