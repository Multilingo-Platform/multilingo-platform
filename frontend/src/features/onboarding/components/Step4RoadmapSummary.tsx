import React from 'react';
import { Sparkles, CheckCircle2, Target, Award, Compass } from 'lucide-react';
import { FlagIcon } from './FlagIcon';
import type { OnboardingData } from '../types';

interface Step4RoadmapSummaryProps {
  data: OnboardingData;
}

const renderLanguageWithFlag = (langCode: string) => {
  const name = langCode === 'vi' ? 'Tiếng Việt' : langCode === 'en' ? 'Tiếng Anh (English)' : langCode;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <FlagIcon code={langCode} size={18} />
      <span>{name}</span>
    </span>
  );
};

const CERT_LABELS: Record<string, string> = {
  IELTS_ACADEMIC: 'IELTS Academic',
  TOEIC_LR: 'TOEIC Listening & Reading',
  TOEIC_WRITING: 'TOEIC Writing',
  NLTV: 'Năng Lực Tiếng Việt (NLTV)',
};

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Mới bắt đầu (A1 - A2)',
  ELEMENTARY: 'Sơ cấp (B1)',
  INTERMEDIATE: 'Trung cấp (B2)',
  ADVANCED: 'Nâng cao (C1 - C2)',
};

export const Step4RoadmapSummary: React.FC<Step4RoadmapSummaryProps> = ({ data }) => {
  const formatScore = () => {
    if (data.targetCertificate.startsWith('IELTS')) return `Band ${data.targetScore.toFixed(1)}`;
    if (data.targetCertificate.startsWith('TOEIC')) return `${data.targetScore} Điểm`;
    if (data.targetCertificate === 'NLTV') return `Bậc ${data.targetScore.toFixed(0)}`;
    return `${data.targetScore}`;
  };

  return (
    <div className="onboarding-step-content" style={{ textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', padding: '1rem', background: '#e0e7ff', borderRadius: '50%', color: '#4f46e5', marginBottom: '1rem' }}>
        <Sparkles size={36} />
      </div>
      
      <h2 className="onboarding-title">Lộ trình của bạn đã sẵn sàng!</h2>
      <p className="onboarding-subtitle" style={{ maxWidth: '520px', margin: '0 auto 2rem auto' }}>
        Dựa trên thông tin bạn cung cấp, Multilingo đã thiết lập kế hoạch học tập cá nhân hóa nhằm giúp bạn tối ưu hóa thời gian và chinh phục mục tiêu sớm nhất.
      </p>

      <div className="onboarding-summary-box" style={{ textAlign: 'left' }}>
        <div className="onboarding-summary-row">
          <span className="onboarding-summary-label">
            <Compass size={18} color="#4f46e5" />
            <span>Ngôn ngữ học</span>
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
            <span>Chứng chỉ mục tiêu</span>
          </span>
          <span className="onboarding-summary-val">
            {CERT_LABELS[data.targetCertificate] || data.targetCertificate}
          </span>
        </div>

        <div className="onboarding-summary-row">
          <span className="onboarding-summary-label">
            <Target size={18} color="#4f46e5" />
            <span>Điểm số kỳ vọng</span>
          </span>
          <span className="onboarding-summary-val" style={{ color: '#4f46e5', fontSize: '1.15rem' }}>
            {formatScore()}
          </span>
        </div>

        <div className="onboarding-summary-row">
          <span className="onboarding-summary-label">
            <Sparkles size={18} color="#4f46e5" />
            <span>Trình độ xuất phát</span>
          </span>
          <span className="onboarding-summary-val">
            {data.currentLevel ? (LEVEL_LABELS[data.currentLevel] || data.currentLevel) : 'Trung cấp (B2)'}
          </span>
        </div>

        <div className="onboarding-summary-row">
          <span className="onboarding-summary-label">
            <CheckCircle2 size={18} color="#4f46e5" />
            <span>Thời lượng học mỗi ngày</span>
          </span>
          <span className="onboarding-summary-val" style={{ color: '#059669' }}>
            {data.dailyMinutes} phút / ngày
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#16a34a', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.5rem' }}>
        <CheckCircle2 size={18} />
        <span>Hồ sơ đã được mã hóa và sẵn sàng đồng bộ vào bảng điều khiển học tập.</span>
      </div>
    </div>
  );
};
