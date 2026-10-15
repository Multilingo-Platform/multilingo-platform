import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileCheck, ArrowRight, Zap } from 'lucide-react';
import type { SuggestedAction } from '../types/dashboard.types';

interface SuggestedActionCardProps {
  actions: SuggestedAction[];
}

const DEFAULT_ACTIONS: SuggestedAction[] = [
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
];

export const SuggestedActionCard: React.FC<SuggestedActionCardProps> = ({ actions }) => {
  const navigate = useNavigate();

  // Use provided actions if 2 or more exist; otherwise fallback to the 2 standard system actions
  const displayActions = actions && actions.length >= 2 ? actions : DEFAULT_ACTIONS;

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'VOCAB_REVIEW':
        return <BookOpen className="w-4 h-4 text-amber-600" />;
      case 'EXAM_PRACTICE':
      case 'PLACEMENT_TEST':
        return <FileCheck className="w-4 h-4 text-indigo-600" />;
      default:
        return <Zap className="w-4 h-4 text-amber-600" />;
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'VOCAB_REVIEW':
        return 'bg-amber-50 text-amber-800 border-amber-200/70';
      case 'EXAM_PRACTICE':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200/70';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-3.5">
      <h3 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
        Hành động học tập đề xuất
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayActions.map((act) => (
          <div
            key={act.type + act.title}
            className="flex flex-col justify-between bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs hover:border-amber-300/80 hover:shadow-sm transition-all group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${getBadgeStyle(
                    act.type
                  )}`}
                >
                  {getActionIcon(act.type)}
                  <span>{act.badge}</span>
                </span>
              </div>
              <h4 className="text-base md:text-lg font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                {act.title}
              </h4>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                {act.description}
              </p>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => navigate(act.actionUrl)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-98"
              >
                <span>{act.buttonText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};



