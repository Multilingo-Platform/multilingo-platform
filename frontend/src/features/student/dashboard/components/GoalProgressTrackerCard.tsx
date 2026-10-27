import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Award, TrendingUp, ArrowRight, CheckCircle2, AlertCircle, Sliders } from 'lucide-react';
import type { GoalProgress } from '../types/dashboard.types';

interface GoalProgressTrackerCardProps {
  goalProgress?: GoalProgress | null;
}

const CERT_NAMES: Record<string, string> = {
  IELTS_ACADEMIC: 'IELTS Academic',
  IELTS_GENERAL: 'IELTS General',
  TOEIC_LR: 'TOEIC Listening & Reading',
  TOEIC_WRITING: 'TOEIC Writing',
  NLTV: 'Năng Lực Tiếng Việt (NLTV)',
};

export const GoalProgressTrackerCard: React.FC<GoalProgressTrackerCardProps> = ({ goalProgress }) => {
  const navigate = useNavigate();

  if (!goalProgress) {
    return null;
  }

  const { targetCertificate, targetScore, recentAverageScore, progressPercent, recentExamCount, recentScores } = goalProgress;
  const certName = CERT_NAMES[targetCertificate] || targetCertificate;

  const formatScore = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '--';
    if (targetCertificate.startsWith('IELTS')) return `Band ${val.toFixed(1)}`;
    if (targetCertificate.startsWith('TOEIC')) return `${Math.round(val)} Điểm`;
    if (targetCertificate === 'NLTV') return `Bậc ${val.toFixed(1)}`;
    return `${val}`;
  };

  const getAdvice = () => {
    if (recentExamCount === 0) {
      return 'Bạn chưa có bài thi nào hoàn thành. Hãy làm bài thi đầu tiên để bắt đầu theo dõi thanh đo tiến độ!';
    }
    if (progressPercent >= 100) {
      return 'Xuất sắc! Điểm trung bình 5 bài gần nhất đã đạt mục tiêu kỳ vọng. Hãy duy trì phong độ này cho kỳ thi thực tế!';
    }
    if (progressPercent >= 80) {
      return 'Phong độ rất tốt! Bạn đã đi được phần lớn chặng đường. Hãy rà soát lại các câu sai trong lịch sử làm bài để bứt phá.';
    }
    return 'Hãy tiếp tục kiên trì luyện tập đều đặn để nâng cao điểm trung bình và nhanh chóng chạm mốc mục tiêu!';
  };

  // Render 5 pills/dots
  const pills = [];
  const maxSlots = 5;
  for (let i = 0; i < maxSlots; i++) {
    const item = recentScores && recentScores[i];
    if (item) {
      pills.push({
        id: item.attemptId,
        scoreText: item.score !== null ? formatScore(item.score) : '--',
        label: `Bài ${i + 1}`,
        title: item.examTitle,
        filled: true,
      });
    } else {
      pills.push({
        id: `empty-${i}`,
        scoreText: '--',
        label: `Bài ${i + 1}`,
        title: 'Chưa làm',
        filled: false,
      });
    }
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/60 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                Mục Tiêu Học Tập
              </span>
              <span className="text-xs text-slate-500 font-medium">5 bài gần nhất</span>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
              <span>{certName}</span>
              <span className="text-indigo-600 font-extrabold">• {formatScore(targetScore)}</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/onboarding?mode=edit')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors cursor-pointer border border-slate-200 shadow-2xs"
            title="Thay đổi chứng chỉ hoặc điểm mục tiêu"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Đổi mục tiêu</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/student/library')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/80 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <span>Luyện đề mục tiêu</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Stats & Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 items-center">
        {/* Left: Score Comparison */}
        <div className="lg:col-span-4 flex items-center justify-around sm:justify-start sm:gap-8 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Trung bình 5 bài</span>
            <div className="text-2xl font-black text-slate-900 flex items-baseline gap-1 mt-0.5">
              <span>{formatScore(recentAverageScore)}</span>
              {recentExamCount > 0 && (
                <span className="text-xs font-normal text-slate-500">
                  ({recentExamCount}/5 bài)
                </span>
              )}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          <div>
            <span className="text-xs text-slate-500 font-medium block">Mức độ đạt được</span>
            <div className="text-2xl font-black text-indigo-600 mt-0.5 flex items-center gap-1.5">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              <span>{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* Right: Progress Bar & Milestone Pills */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1 text-slate-600">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Tiến trình hoàn thành mục tiêu</span>
            </span>
            <span className="text-indigo-600 font-bold">{progressPercent}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500"
              style={{ width: `${Math.min(100, Math.max(progressPercent, 4))}%` }}
            />
          </div>

          {/* 5 Milestone Pills */}
          <div className="grid grid-cols-5 gap-2 pt-1">
            {pills.map((pill, idx) => (
              <div
                key={pill.id}
                title={pill.title}
                className={`p-2 rounded-lg text-center transition-all ${
                  pill.filled
                    ? 'bg-indigo-50/70 border border-indigo-200/80 text-indigo-900 shadow-2xs'
                    : 'bg-slate-50 border border-dashed border-slate-200 text-slate-400'
                }`}
              >
                <div className="text-[11px] font-medium text-slate-500 uppercase">{pill.label}</div>
                <div className={`text-xs md:text-sm font-bold truncate mt-0.5 ${pill.filled ? 'text-indigo-700' : 'text-slate-400'}`}>
                  {pill.scoreText}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer advice */}
      <div className="flex items-start gap-2.5 pt-3 border-t border-slate-100 text-xs sm:text-sm text-slate-600">
        {progressPercent >= 100 ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        )}
        <p className="leading-relaxed">
          <strong className="text-slate-800">Lời khuyên Multilingo: </strong>
          {getAdvice()}
        </p>
      </div>
    </div>
  );
};
