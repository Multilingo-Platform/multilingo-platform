import React from 'react';
import { Sparkles, CheckCircle2, Target, Award, Compass, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FlagIcon } from './FlagIcon';
import type { OnboardingData } from '../types';

interface Step4RoadmapSummaryProps {
  data: OnboardingData;
}

const CERT_LABELS: Record<string, { vi: string; en: string }> = {
  IELTS_ACADEMIC: { vi: 'IELTS Academic', en: 'IELTS Academic' },
  IELTS_GENERAL: { vi: 'IELTS General', en: 'IELTS General' },
  TOEIC_LR: { vi: 'TOEIC Listening & Reading', en: 'TOEIC Listening & Reading' },
  TOEIC_WRITING: { vi: 'TOEIC Writing', en: 'TOEIC Writing' },
  NLTV: { vi: 'Năng Lực Tiếng Việt (NLTV)', en: 'Vietnamese Proficiency (NLTV)' },
};

export const Step4RoadmapSummary: React.FC<Step4RoadmapSummaryProps> = ({ data }) => {
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const renderLanguageWithFlag = (langCode: string) => {
    let name = langCode;
    if (langCode === 'vi') name = isEn ? 'Vietnamese' : 'Tiếng Việt';
    else if (langCode === 'en') name = isEn ? 'English' : 'Tiếng Anh (English)';

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <FlagIcon code={langCode} size={18} />
        <span>{name}</span>
      </span>
    );
  };

  const formatScore = () => {
    if (data.targetCertificate.startsWith('IELTS')) return `Band ${data.targetScore.toFixed(1)}`;
    if (data.targetCertificate.startsWith('TOEIC')) return `${data.targetScore} ${isEn ? 'Points' : 'Điểm'}`;
    if (data.targetCertificate === 'NLTV') return `${isEn ? 'Level' : 'Bậc'} ${data.targetScore.toFixed(0)}`;
    return `${data.targetScore}`;
  };

  const getPersonalizedAdvice = () => {
    if (data.targetCertificate.startsWith('IELTS')) {
      return isEn
        ? 'Recommended Strategy: Focus on Skimming/Scanning tactics for Reading and keyword listening reflexes in Cambridge IELTS Tests.'
        : 'Lộ trình gợi ý: Tập trung củng cố chiến thuật Skimming/Scanning cho Reading và phản xạ nghe từ khóa Audio trong Cambridge IELTS Tests.';
    }
    if (data.targetCertificate.startsWith('TOEIC')) {
      return isEn
        ? 'Recommended Strategy: Master the pacing for TOEIC 200 questions, practice listening for Part 3-4, and manage time for Part 7 reading passages.'
        : 'Lộ trình gợi ý: Làm quen với tốc độ làm bài TOEIC 200 câu hỏi, luyện nghe Part 3-4 và quản lý thời gian Part 7 bài đọc dài.';
    }
    if (data.targetCertificate === 'NLTV') {
      return isEn
        ? 'Recommended Strategy: Enhance grammar competency, academic Vietnamese reading comprehension, and natural expression skills.'
        : 'Lộ trình gợi ý: Nâng cao năng lực ngữ pháp, khả năng đọc hiểu văn bản tiếng Việt học thuật và kỹ năng diễn đạt tự nhiên.';
    }
    return isEn
      ? 'Your study roadmap is ready for your targets.'
      : 'Lộ trình học tập đã được thiết kế sẵn sàng cho mục tiêu của bạn.';
  };

  const certLabelObj = CERT_LABELS[data.targetCertificate];
  const certLabel = certLabelObj ? (isEn ? certLabelObj.en : certLabelObj.vi) : data.targetCertificate;

  return (
    <div className="onboarding-step-content" style={{ textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', padding: '1rem', background: '#e0e7ff', borderRadius: '50%', color: '#4f46e5', marginBottom: '1rem' }}>
        <Sparkles size={36} />
      </div>
      
      <h2 className="onboarding-title">
        {isEn ? 'Your personalized roadmap is ready!' : 'Lộ trình của bạn đã sẵn sàng!'}
      </h2>
      <p className="onboarding-subtitle" style={{ maxWidth: '540px', margin: '0 auto 2rem auto' }}>
        {isEn
          ? 'Based on your selections, Multilingo has established a personalized study plan to optimize your preparation and achieve your goal.'
          : 'Dựa trên thông tin bạn cung cấp, Multilingo đã thiết lập kế hoạch học tập cá nhân hóa nhằm giúp bạn tối ưu hóa thời gian và chinh phục mục tiêu sớm nhất.'}
      </p>

      <div className="onboarding-summary-box" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
        <div className="onboarding-summary-row">
          <span className="onboarding-summary-label">
            <Compass size={18} color="#4f46e5" />
            <span>{isEn ? 'Languages' : 'Ngôn ngữ học'}</span>
          </span>
          <span className="onboarding-summary-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {renderLanguageWithFlag(data.nativeLanguage)}
            <span style={{ color: '#94a3b8' }}>➔</span>
            {renderLanguageWithFlag(data.targetLanguage)}
          </span>
        </div>

        <div className="onboarding-summary-row">
          <span className="onboarding-summary-label">
            <Award size={18} color="#4f46e5" />
            <span>{isEn ? 'Target Certificate' : 'Chứng chỉ mục tiêu'}</span>
          </span>
          <span className="onboarding-summary-val">
            {certLabel}
          </span>
        </div>

        <div className="onboarding-summary-row">
          <span className="onboarding-summary-label">
            <Target size={18} color="#4f46e5" />
            <span>{isEn ? 'Target Score' : 'Điểm số kỳ vọng'}</span>
          </span>
          <span className="onboarding-summary-val" style={{ color: '#4f46e5', fontSize: '1.15rem' }}>
            {formatScore()}
          </span>
        </div>
      </div>

      {/* Gợi ý lộ trình cá nhân hóa */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '1rem',
          textAlign: 'left',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: '#1e40af',
          lineHeight: 1.5,
        }}
      >
        <Lightbulb size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#1d4ed8' }}>
            {isEn ? 'Goal Achievement Strategy:' : 'Chiến thuật bứt phá mục tiêu:'}
          </strong>
          <span>{getPersonalizedAdvice()}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#16a34a', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.5rem' }}>
        <CheckCircle2 size={18} />
        <span>
          {isEn
            ? 'Profile configured and ready to sync with your learning dashboard.'
            : 'Hồ sơ đã được mã hóa và sẵn sàng đồng bộ vào bảng điều khiển học tập.'}
        </span>
      </div>
    </div>
  );
};
