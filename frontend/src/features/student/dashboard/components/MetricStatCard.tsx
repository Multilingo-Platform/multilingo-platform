import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, FileText, BookOpen, Trophy, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExamStats, StreakStats, VocabStats } from '../types/dashboard.types';

interface MetricStatCardProps {
  streak: StreakStats;
  examStats: ExamStats;
  vocabStats: VocabStats;
}

export const MetricStatCard: React.FC<MetricStatCardProps> = ({ streak, examStats, vocabStats }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const numberLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Card Thời lượng học */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500">
            {t('dashboard.metrics.study_time', 'Thời lượng học')}
          </span>
          <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-baseline gap-1.5">
            <span>{streak.totalLearningMinutes}</span>
            <span className="text-sm md:text-base font-medium text-slate-500">{t('dashboard.metrics.minutes', 'phút')}</span>
          </div>
          <div className="mt-2.5 text-sm text-slate-600 flex items-center gap-1.5 font-medium">
            <Trophy className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="truncate">
              {t('dashboard.metrics.record_days', { days: streak.highestStreak })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Card Tích lũy XP */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500">
            {t('dashboard.metrics.xp_accumulated', 'Tích lũy XP')}
          </span>
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-baseline gap-1.5">
            <span>{streak.totalXp.toLocaleString(numberLocale)}</span>
            <span className="text-sm md:text-base font-semibold text-amber-600">XP</span>
          </div>
          <div className="mt-2.5 text-sm text-slate-600 font-medium truncate">
            <span>{t('dashboard.metrics.xp_desc', 'Điểm kinh nghiệm học tập')}</span>
          </div>
        </div>
      </div>

      {/* 3. Card Năng lực thi thử */}
      <div
        className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group"
        onClick={() => navigate('/student/history')}
        title="Bấm để xem chi tiết trong Lịch sử làm bài"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500">
            {t('dashboard.metrics.exams_taken', 'Thi thử & Đánh giá')}
          </span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-baseline gap-1.5 flex-wrap">
            <span>{examStats.totalExamsTaken}</span>
            <span className="text-sm md:text-base font-medium text-slate-500">{t('dashboard.metrics.exams_unit', 'đề thi')}</span>
            {examStats.totalExamsTaken > 0 && (
              <span className="text-xs md:text-sm font-semibold px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 ml-1">
                {t('dashboard.metrics.avg_score', { score: examStats.averageScore })}
              </span>
            )}
          </div>
          <div className="mt-2.5 text-sm text-slate-600 truncate font-medium">
            {examStats.latestExamTitle ? (
              <span>{t('dashboard.metrics.latest_exam', { title: examStats.latestExamTitle })}</span>
            ) : (
              <span>{t('dashboard.metrics.no_exams', 'Chưa hoàn thành đề thi nào')}</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Card Bộ thẻ từ vựng (chỉ hiển thị số bộ thẻ, gọn gàng, không nhiễu) */}
      <div
        className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-orange-300 hover:shadow-xs transition-all cursor-pointer group"
        onClick={() => navigate('/student/flashcards')}
        title="Bấm để xem danh sách bộ thẻ từ vựng"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500">
            {t('dashboard.metrics.vocab_decks', 'Bộ thẻ từ vựng')}
          </span>
          <div className="p-2 rounded-xl bg-orange-50 text-orange-600 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-baseline gap-1.5 flex-wrap">
            <span>{vocabStats.totalDecks ?? 0}</span>
            <span className="text-sm md:text-base font-medium text-slate-500">
              {t('dashboard.metrics.decks_unit', 'bộ thẻ')}
            </span>
          </div>
          <div className="mt-2.5 text-sm text-slate-600 font-medium truncate">
            <span>{t('dashboard.metrics.decks_desc', 'Tạo mới & ôn tập từ vựng')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
