import React from 'react';
import type { UserProfileSummary } from '../types/dashboard.types';

interface GreetingHeaderProps {
  userProfile: UserProfileSummary;
}

export const GreetingHeader: React.FC<GreetingHeaderProps> = ({ userProfile }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  const displayName = userProfile.fullName || 'Học viên';

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 md:p-6 shadow-xs">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center flex-wrap gap-2">
        <span>{getGreeting()}, {displayName}!</span>
        <span className="inline-block" aria-hidden="true">👋</span>
      </h1>

      <p className="text-sm md:text-base text-slate-600 mt-1.5 font-normal leading-relaxed">
        Hôm nay bạn muốn học kỹ năng gì? Hãy cùng duy trì chuỗi học tập nhé!
      </p>
    </div>
  );
};


