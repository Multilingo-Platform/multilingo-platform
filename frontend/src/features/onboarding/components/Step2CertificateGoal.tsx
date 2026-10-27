import React, { useEffect } from 'react';
import { Award, BookOpen, PenTool, Globe } from 'lucide-react';
import { FlagIcon } from './FlagIcon';
import type { TargetCertificate } from '../types';

interface Step2CertificateGoalProps {
  targetLanguage: string;
  targetCertificate: TargetCertificate;
  targetScore: number;
  onCertChange: (cert: TargetCertificate) => void;
  onScoreChange: (score: number) => void;
}

interface CertConfig {
  id: TargetCertificate;
  language: 'en' | 'vi';
  title: string;
  badge: string;
  icon: React.ReactNode;
  desc: string;
  minScore: number;
  maxScore: number;
  step: number;
  defaultScore: number;
  presetChips: { label: string; value: number }[];
}

const CERT_CONFIGS: CertConfig[] = [
  {
    id: 'IELTS_ACADEMIC',
    language: 'en',
    title: 'IELTS Academic',
    badge: 'Phổ biến',
    icon: <Award size={22} />,
    desc: 'Du học & xét tuyển đại học',
    minScore: 4.0,
    maxScore: 9.0,
    step: 0.5,
    defaultScore: 7.0,
    presetChips: [
      { label: 'Band 5.5', value: 5.5 },
      { label: 'Band 6.5', value: 6.5 },
      { label: 'Band 7.0', value: 7.0 },
      { label: 'Band 7.5', value: 7.5 },
      { label: 'Band 8.0+', value: 8.0 },
    ],
  },
  {
    id: 'TOEIC_LR',
    language: 'en',
    title: 'TOEIC L&R',
    badge: 'Chuẩn DN',
    icon: <BookOpen size={22} />,
    desc: 'Tốt nghiệp & tuyển dụng DN',
    minScore: 200,
    maxScore: 990,
    step: 5,
    defaultScore: 750,
    presetChips: [
      { label: '500+ Điểm', value: 500 },
      { label: '650+ Điểm', value: 650 },
      { label: '750+ Điểm', value: 750 },
      { label: '850+ Điểm', value: 850 },
      { label: '900+ Điểm', value: 900 },
    ],
  },
  {
    id: 'TOEIC_WRITING',
    language: 'en',
    title: 'TOEIC Writing',
    badge: 'Kỹ năng Viết',
    icon: <PenTool size={22} />,
    desc: 'Viết thư & luận chuyên nghiệp',
    minScore: 50,
    maxScore: 200,
    step: 10,
    defaultScore: 160,
    presetChips: [
      { label: '110 Điểm', value: 110 },
      { label: '140 Điểm', value: 140 },
      { label: '160 Điểm', value: 160 },
      { label: '180 Điểm', value: 180 },
      { label: '200 Điểm', value: 200 },
    ],
  },
  {
    id: 'NLTV',
    language: 'vi',
    title: 'Năng Lực Tiếng Việt',
    badge: 'NLTV',
    icon: <Globe size={22} />,
    desc: 'Khung năng lực 6 bậc Việt Nam',
    minScore: 1.0,
    maxScore: 6.0,
    step: 1.0,
    defaultScore: 4.0,
    presetChips: [
      { label: 'Bậc 3 (B1)', value: 3.0 },
      { label: 'Bậc 4 (B2)', value: 4.0 },
      { label: 'Bậc 5 (C1)', value: 5.0 },
      { label: 'Bậc 6 (C2)', value: 6.0 },
    ],
  },
];

export const Step2CertificateGoal: React.FC<Step2CertificateGoalProps> = ({
  targetLanguage,
  targetCertificate,
  targetScore,
  onCertChange,
  onScoreChange,
}) => {
  // Lọc chứng chỉ ứng với ngôn ngữ muốn học
  const visibleConfigs = CERT_CONFIGS.filter(
    (c) => c.language === (targetLanguage === 'vi' ? 'vi' : 'en')
  );

  const activeConfig =
    visibleConfigs.find((c) => c.id === targetCertificate) || visibleConfigs[0] || CERT_CONFIGS[0];

  // Tự động chuyển chứng chỉ và điểm số hợp lệ nếu chứng chỉ hiện tại không thuộc ngôn ngữ mục tiêu
  useEffect(() => {
    if (!visibleConfigs.some((c) => c.id === targetCertificate) && visibleConfigs.length > 0) {
      const fallback = visibleConfigs[0];
      onCertChange(fallback.id);
      onScoreChange(fallback.defaultScore);
    }
  }, [targetLanguage, targetCertificate, visibleConfigs, onCertChange, onScoreChange]);

  const handleSelectCert = (cert: TargetCertificate) => {
    onCertChange(cert);
    const cfg = visibleConfigs.find((c) => c.id === cert);
    if (cfg) {
      onScoreChange(cfg.defaultScore);
    }
  };

  const formatScoreDisplay = (score: number) => {
    if (activeConfig.id.startsWith('IELTS')) return `Band ${score.toFixed(1)}`;
    if (activeConfig.id.startsWith('TOEIC')) return `${score} Điểm`;
    if (activeConfig.id === 'NLTV') {
      const levelMap: Record<number, string> = { 3: 'Bậc 3 (B1)', 4: 'Bậc 4 (B2)', 5: 'Bậc 5 (C1)', 6: 'Bậc 6 (C2)' };
      return levelMap[score] || `Bậc ${score.toFixed(0)}`;
    }
    return `${score}`;
  };

  return (
    <div className="onboarding-step-content">
      <h2 className="onboarding-title">Mục tiêu chứng chỉ</h2>
      <p className="onboarding-subtitle">
        Các chứng chỉ tương ứng với ngôn ngữ{' '}
        <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span>{targetLanguage === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'}</span>
          <FlagIcon code={targetLanguage} size={18} />
        </strong>{' '}
        bạn đã chọn:
      </p>

      {/* Danh sách chứng chỉ phù hợp */}
      <div style={{ marginBottom: '1.75rem' }}>
        <label style={{ display: 'block', marginBottom: '0.85rem', fontWeight: 700, fontSize: '1rem', color: '#334155' }}>
          Chọn loại chứng chỉ mục tiêu:
        </label>
        <div className="onboarding-grid" style={{ gridTemplateColumns: visibleConfigs.length === 1 ? '1fr' : undefined }}>
          {visibleConfigs.map((cfg) => (
            <div
              key={cfg.id}
              className={`onboarding-option-card ${activeConfig.id === cfg.id ? 'active' : ''}`}
              onClick={() => handleSelectCert(cfg.id)}
              role="button"
              tabIndex={0}
              aria-pressed={activeConfig.id === cfg.id}
            >
              <div className="onboarding-card-icon">{cfg.icon}</div>
              <div className="onboarding-card-title">{cfg.title}</div>
              <div className="onboarding-card-desc">{cfg.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Điểm kỳ vọng */}
      <div className="onboarding-score-container">
        <div className="onboarding-score-header">
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', display: 'block' }}>
              Điểm kỳ vọng (Target Score)
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Mục tiêu phấn đấu của bạn cho kỳ thi {activeConfig.title}
            </span>
          </div>
          <div className="onboarding-score-value">{formatScoreDisplay(targetScore)}</div>
        </div>

        <input
          type="range"
          className="onboarding-range-slider"
          min={activeConfig.minScore}
          max={activeConfig.maxScore}
          step={activeConfig.step}
          value={targetScore}
          onChange={(e) => onScoreChange(parseFloat(e.target.value))}
        />

        <div className="onboarding-chips-group">
          {activeConfig.presetChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className={`onboarding-chip ${targetScore === chip.value ? 'active' : ''}`}
              onClick={() => onScoreChange(chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
