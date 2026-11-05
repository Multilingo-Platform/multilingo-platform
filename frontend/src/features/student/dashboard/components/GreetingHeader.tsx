import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 text-white shadow-md shadow-orange-500/10 p-5 sm:p-6 md:py-6 md:px-8">
      {/* Vòng trang trí nền tạo hiệu ứng ánh sáng mờ tinh tế */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-16 left-8 w-64 h-64 rounded-full bg-yellow-300/20 blur-2xl" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Lời chào & Phụ đề */}
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center flex-wrap gap-2 leading-snug">
            <span>{getGreeting()}, {displayName}!</span>
            <span className="inline-block" aria-hidden="true">👋</span>
          </h1>

          <p className="text-sm sm:text-base text-orange-50/95 font-medium mt-1 leading-relaxed">
            {t('dashboard.greeting.subtitle', 'Hôm nay bạn muốn học kỹ năng gì? Hãy cùng duy trì chuỗi học tập nhé!')}
          </p>
        </div>

        {/* Các huy hiệu trạng thái gọn gàng */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
          {targetLang && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-xs border border-white/30 text-xs sm:text-sm font-bold text-white shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-yellow-300"></span>
              {t('dashboard.greeting.learning', 'Đang học:')} {targetLang === 'en' ? t('dashboard.greeting.lang_en', 'Tiếng Anh') : targetLang === 'vi' ? t('dashboard.greeting.lang_vi', 'Tiếng Việt') : targetLang.toUpperCase()}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-xs border border-white/30 text-xs sm:text-sm font-bold text-white shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>{t('dashboard.greeting.streak_reminder', 'Duy trì chuỗi học tập mỗi ngày')}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
