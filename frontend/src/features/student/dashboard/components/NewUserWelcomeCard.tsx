import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, ArrowRight, Compass } from 'lucide-react';
import type { SuggestedAction } from '../types/dashboard.types';

interface NewUserWelcomeCardProps {
  placementAction?: SuggestedAction;
}

export const NewUserWelcomeCard: React.FC<NewUserWelcomeCardProps> = ({ placementAction }) => {
  const navigate = useNavigate();

  const handleStartPlacement = () => {
    navigate(placementAction?.actionUrl || '/student/library');
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-6 md:p-7 shadow-xs">
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 backdrop-blur-xs text-xs font-semibold mb-2.5">
          <Compass className="w-3.5 h-3.5" />
          <span>Chào mừng học viên mới!</span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          Bắt đầu hành trình ngoại ngữ cùng Multilingo 🎉
        </h2>
        <p className="mt-1.5 text-sm md:text-base text-amber-50 leading-relaxed font-normal">
          {placementAction?.description ||
            'Hãy làm một bài kiểm tra đánh giá đầu vào ngắn để hệ thống đo lường trình độ và thiết lập mục tiêu học tập cá nhân hóa cho riêng bạn.'}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleStartPlacement}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-amber-800 hover:bg-amber-50 font-semibold text-sm shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            <Target className="w-4 h-4" />
            <span>{placementAction?.buttonText || 'Bắt đầu làm bài test đầu vào'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Decorative background shapes */}
      <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute right-24 top-0 -translate-y-8 w-40 h-40 rounded-full bg-orange-400/20 blur-xl pointer-events-none" />
    </div>
  );
};
