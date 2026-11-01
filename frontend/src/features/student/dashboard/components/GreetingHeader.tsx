import React from 'react';
import { useTranslation } from 'react-i18next';
import type { UserProfileSummary } from '../types/dashboard.types';

interface GreetingHeaderProps {
  userProfile: UserProfileSummary;
}

export const GreetingHeader: React.FC<GreetingHeaderProps> = ({ userProfile }) => {
  const { t } = useTranslation();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greeting.morning', 'Chào buổi sáng');
    if (hour < 18) return t('dashboard.greeting.afternoon', 'Chào buổi chiều');
    return t('dashboard.greeting.evening', 'Chào buổi tối');
  };

  const displayName = userProfile.fullName || t('dashboard.greeting.student', 'Học viên');
  const targetLang = userProfile.targetLanguage?.toLowerCase();

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center flex-wrap gap-2">
          <span>{getGreeting()}, {displayName}!</span>
          <span className="inline-block" aria-hidden="true">👋</span>
        </h1>

        <p className="text-sm md:text-base text-slate-600 mt-1.5 font-normal leading-relaxed">
          {t('dashboard.greeting.subtitle', 'Hôm nay bạn muốn học kỹ năng gì? Hãy cùng duy trì chuỗi học tập nhé!')}
        </p>
      </div>

      {targetLang && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/80 border border-slate-200 text-xs font-semibold text-slate-700 self-start md:self-auto">
          <span>
            {t('dashboard.greeting.learning', 'Đang học:')} {targetLang === 'en' ? t('dashboard.greeting.lang_en', 'Tiếng Anh') : targetLang === 'vi' ? t('dashboard.greeting.lang_vi', 'Tiếng Việt') : targetLang.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
};


