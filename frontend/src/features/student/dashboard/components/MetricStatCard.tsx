import React from 'react';
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
  const numberLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Card Thời lượng học */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500">
            {t('dashboard.metrics.study_time', 'Thời lượng học')}
          </span>
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-baseline gap-1.5">
            <span>{streak.totalLearningMinutes}</span>
            <span className="text-sm md:text-base font-medium text-slate-500">{t('dashboard.metrics.minutes', 'phút')}</span>
          </div>
          <div className="mt-2.5 text-sm text-slate-600 flex items-center gap-1.5 font-medium">
            <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="truncate">
              {t('dashboard.metrics.record_days', { days: streak.highestStreak })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Card Tích lũy XP */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500">
            {t('dashboard.metrics.xp_accumulated', 'Tích lũy XP')}
          </span>
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-baseline gap-1.5">
            <span>{streak.totalXp.toLocaleString(numberLocale)}</span>
            <span className="text-sm md:text-base font-semibold text-indigo-600">XP</span>
          </div>
          <div className="mt-2.5 text-sm text-slate-600 font-medium truncate">
            <span>{t('dashboard.metrics.xp_desc', 'Điểm kinh nghiệm học tập')}</span>
          </div>
        </div>
      </div>

      {/* 3. Card Năng lực thi thử */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500">
            {t('dashboard.metrics.exams_taken', 'Thi thử & Đánh giá')}
          </span>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
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

      {/* 4. Card Vốn từ vựng */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500">
            {t('dashboard.metrics.vocab_handbook', 'Sổ tay từ vựng')}
          </span>
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-baseline gap-1.5 flex-wrap">
            <span>{vocabStats.totalWords}</span>
            <span className="text-sm md:text-base font-medium text-slate-500">{t('dashboard.metrics.words_saved', 'từ đã lưu')}</span>
            {vocabStats.totalWords > 0 && (
              <span className="text-xs md:text-sm font-semibold px-2 py-0.5 rounded-md bg-purple-100/80 text-purple-800 ml-1">
                {t('dashboard.metrics.mastery_rate', { percent: vocabStats.masteryRate })}
              </span>
            )}
          </div>
          <div className="mt-2.5 text-sm text-slate-600 font-medium truncate">
            {vocabStats.dueTodayCount > 0 ? (
              <span className="text-amber-700 font-semibold">
                {t('dashboard.metrics.words_due', { count: vocabStats.dueTodayCount })}
              </span>
            ) : (
              <span>{t('dashboard.metrics.all_cards_done', 'Đã hoàn thành toàn bộ thẻ')}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


