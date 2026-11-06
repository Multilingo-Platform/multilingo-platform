import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileCheck, ArrowRight, Zap, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SuggestedAction } from '../types/dashboard.types';

interface SuggestedActionCardProps {
  actions: SuggestedAction[];
}

export const SuggestedActionCard: React.FC<SuggestedActionCardProps> = ({ actions }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const defaultActions: SuggestedAction[] = useMemo(() => [
    {
      type: 'VOCAB_REVIEW',
      badge: 'Từ vựng',
      title: 'Ôn tập từ vựng hôm nay',
      description: 'Củng cố trí nhớ dài hạn bằng phương pháp lặp lại ngắt quãng (SRS) cho các thẻ từ vựng của bạn.',
      buttonText: 'Ôn tập ngay',
      actionUrl: '/student/flashcards',
    },
    {
      type: 'EXAM_PRACTICE',
      badge: 'Luyện tập',
      title: 'Luyện đề thi thử tiếp theo',
      description: 'Cải thiện kỹ năng làm bài, duy trì phản xạ phòng thi và đánh giá sự tiến bộ qua từng bộ đề.',
      buttonText: 'Vào thư viện đề',
      actionUrl: '/student/library',
    },
  ], []);

  // Use provided actions if 2 or more exist; otherwise fallback to the 2 standard system actions
  const displayActions = actions && actions.length >= 2 ? actions : defaultActions;

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'VOCAB_REVIEW':
        return <BookOpen className="w-6 h-6 stroke-[2.2]" />;
      case 'EXAM_PRACTICE':
      case 'PLACEMENT_TEST':
        return <FileCheck className="w-6 h-6 stroke-[2.2]" />;
      default:
        return <Zap className="w-6 h-6 stroke-[2.2]" />;
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'VOCAB_REVIEW':
        return 'bg-orange-50 text-orange-700 border-orange-200/80';
      case 'EXAM_PRACTICE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getIconWrapperStyle = (type: string) => {
    switch (type) {
      case 'VOCAB_REVIEW':
        return 'bg-orange-50 text-orange-600 border-orange-100 group-hover:bg-orange-100';
      case 'EXAM_PRACTICE':
        return 'bg-indigo-50 text-indigo-600 border-indigo-100 group-hover:bg-indigo-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100 group-hover:bg-slate-100';
    }
  };

  return (
    <div className="space-y-3.5">
      <h3 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
        <Zap className="w-4 h-4 text-orange-500 fill-orange-500" />
        {t('dashboard.suggested.title', 'Hành động học tập đề xuất')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {displayActions.map((act) => {
          const isVocab = act.type === 'VOCAB_REVIEW';

          // Đa ngôn ngữ triệt để theo type
          const badgeText = isVocab
            ? t('dashboard.suggested.vocab_badge', 'Từ vựng')
            : t('dashboard.suggested.exam_badge', 'Luyện tập');

          const titleText = isVocab
            ? t('dashboard.suggested.vocab_title', 'Ôn tập từ vựng hôm nay')
            : t('dashboard.suggested.exam_title', 'Luyện đề thi thử tiếp theo');

          const descText = isVocab
            ? t('dashboard.suggested.vocab_desc', 'Củng cố trí nhớ dài hạn bằng phương pháp lặp lại ngắt quãng (SRS) cho các thẻ từ vựng của bạn.')
            : t('dashboard.suggested.exam_desc', 'Cải thiện kỹ năng làm bài, duy trì phản xạ phòng thi và đánh giá sự tiến bộ qua từng bộ đề.');

          const hintText = isVocab
            ? t('dashboard.suggested.vocab_hint', 'Lặp lại ngắt quãng SRS thông minh')
            : t('dashboard.suggested.exam_hint', 'Rèn luyện phản xạ phòng thi thực tế');

          const btnText = isVocab
            ? t('dashboard.suggested.vocab_btn', 'Ôn tập ngay')
            : t('dashboard.suggested.exam_btn', 'Vào thư viện đề');

          return (
            <div
              key={act.type + act.title}
              className="flex flex-col justify-between bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs hover:border-orange-300 hover:shadow-md transition-all group"
            >
              <div>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${getBadgeStyle(
                      act.type
                    )}`}
                  >
                    <span>{badgeText}</span>
                  </span>

                  {/* Icon vector đồ họa tinh tế, chuẩn UX */}
                  <div
                    className={`p-3 rounded-2xl border shadow-2xs group-hover:scale-105 transition-all shrink-0 ${getIconWrapperStyle(
                      act.type
                    )}`}
                  >
                    {getActionIcon(act.type)}
                  </div>
                </div>

                <h4 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                  {titleText}
                </h4>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  {descText}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium truncate">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span>{hintText}</span>
                </span>
                <button
                  type="button"
                  onClick={() => navigate(act.actionUrl)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition-all cursor-pointer shadow-xs hover:shadow-sm active:scale-98 shrink-0"
                >
                  <span>{btnText}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
