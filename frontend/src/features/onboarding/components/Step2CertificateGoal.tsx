import React, { useEffect } from 'react';
import { Award, BookOpen, PenTool, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  titleKey?: string;
  badge: string;
  badgeKey?: string;
  icon: React.ReactNode;
  descKey: string;
  defaultDesc: string;
  minScore: number;
  maxScore: number;
  step: number;
  defaultScore: number;
  presetChips: { value: number; labelEn?: string; labelVi?: string }[];
}

const CERT_CONFIGS: CertConfig[] = [
  {
    id: 'IELTS_ACADEMIC',
    language: 'en',
    title: 'IELTS Academic',
    badge: 'Phổ biến',
    badgeKey: 'onboarding.step2.badge_popular',
    icon: <Award size={22} />,
    descKey: 'onboarding.step2.cert_ielts_desc',
    defaultDesc: 'Du học & xét tuyển đại học',
    minScore: 4.0,
    maxScore: 9.0,
    step: 0.5,
    defaultScore: 7.0,
    presetChips: [
      { value: 5.5 },
      { value: 6.5 },
      { value: 7.0 },
      { value: 7.5 },
      { value: 8.0 },
    ],
  },
  {
    id: 'TOEIC_LR',
    language: 'en',
    title: 'TOEIC L&R',
    badge: 'Chuẩn DN',
    badgeKey: 'onboarding.step2.badge_standard',
    icon: <BookOpen size={22} />,
    descKey: 'onboarding.step2.cert_toeic_desc',
    defaultDesc: 'Tốt nghiệp & tuyển dụng DN',
    minScore: 200,
    maxScore: 990,
    step: 5,
    defaultScore: 750,
    presetChips: [
      { value: 500 },
      { value: 650 },
      { value: 750 },
      { value: 850 },
      { value: 900 },
    ],
  },
  {
    id: 'TOEIC_WRITING',
    language: 'en',
    title: 'TOEIC Writing',
    badge: 'Kỹ năng Viết',
    badgeKey: 'onboarding.step2.badge_writing',
    icon: <PenTool size={22} />,
    descKey: 'onboarding.step2.cert_toeic_writing_desc',
    defaultDesc: 'Viết thư & luận chuyên nghiệp',
    minScore: 50,
    maxScore: 200,
    step: 10,
    defaultScore: 160,
    presetChips: [
      { value: 110 },
      { value: 140 },
      { value: 160 },
      { value: 180 },
      { value: 200 },
    ],
  },
  {
    id: 'NLTV',
    language: 'vi',
    title: 'Năng Lực Tiếng Việt',
    titleKey: 'onboarding.step2.cert_nltv_title',
    badge: 'NLTV',
    badgeKey: 'onboarding.step2.badge_nltv',
    icon: <Globe size={22} />,
    descKey: 'onboarding.step2.cert_nltv_desc',
    defaultDesc: 'Khung năng lực 6 bậc Việt Nam',
    minScore: 1.0,
    maxScore: 6.0,
    step: 1.0,
    defaultScore: 4.0,
    presetChips: [
      { value: 3.0, labelVi: 'Bậc 3 (B1)', labelEn: 'Level 3 (B1)' },
      { value: 4.0, labelVi: 'Bậc 4 (B2)', labelEn: 'Level 4 (B2)' },
      { value: 5.0, labelVi: 'Bậc 5 (C1)', labelEn: 'Level 5 (C1)' },
      { value: 6.0, labelVi: 'Bậc 6 (C2)', labelEn: 'Level 6 (C2)' },
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
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const getCertTitle = (cfg: CertConfig) => (cfg.titleKey ? t(cfg.titleKey, cfg.title) : cfg.title);

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
    if (activeConfig.id.startsWith('TOEIC')) return `${score} ${isEn ? 'pts' : 'Điểm'}`;
    if (activeConfig.id === 'NLTV') {
      const levelMap: Record<number, string> = {
        3: isEn ? 'Level 3 (B1)' : 'Bậc 3 (B1)',
        4: isEn ? 'Level 4 (B2)' : 'Bậc 4 (B2)',
        5: isEn ? 'Level 5 (C1)' : 'Bậc 5 (C1)',
        6: isEn ? 'Level 6 (C2)' : 'Bậc 6 (C2)',
      };
      return levelMap[score] || (isEn ? `Level ${score.toFixed(0)}` : `Bậc ${score.toFixed(0)}`);
    }
    return `${score}`;
  };

  const formatChipLabel = (chip: { value: number; labelEn?: string; labelVi?: string }) => {
    if (isEn && chip.labelEn) return chip.labelEn;
    if (!isEn && chip.labelVi) return chip.labelVi;
    if (activeConfig.id.startsWith('IELTS')) return `Band ${chip.value}`;
    if (activeConfig.id.startsWith('TOEIC')) return `${chip.value}+ ${isEn ? 'pts' : 'Điểm'}`;
    return `${chip.value}`;
  };

  const targetLangLabel = targetLanguage === 'vi'
    ? t('onboarding.step1.lang_vi', 'Tiếng Việt')
    : t('onboarding.step1.lang_en', 'Tiếng Anh');

  return (
    <div className="onboarding-step-content">
      <h2 className="onboarding-title">{t('onboarding.step2.title', 'Mục tiêu chứng chỉ')}</h2>
      <p className="onboarding-subtitle">
        {t('onboarding.step2.subtitle', 'Chọn chứng chỉ và điểm số bạn mong muốn chinh phục để Multilingo đề xuất lộ trình phù hợp.')}{' '}
        (
        <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span>{targetLangLabel}</span>
          <FlagIcon code={targetLanguage} size={18} />
        </strong>
        )
      </p>

      {/* Danh sách chứng chỉ phù hợp */}
      <div style={{ marginBottom: '1.75rem' }}>
        <label style={{ display: 'block', marginBottom: '0.85rem', fontWeight: 700, fontSize: '1rem', color: '#334155' }}>
          {t('onboarding.step2.cert_label', '1. Chọn chứng chỉ mục tiêu')}:
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
              <div className="onboarding-card-title">{getCertTitle(cfg)}</div>
              <div className="onboarding-card-desc">{t(cfg.descKey, cfg.defaultDesc)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Điểm kỳ vọng */}
      <div className="onboarding-score-container">
        <div className="onboarding-score-header">
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', display: 'block' }}>
              {t('onboarding.step2.score_label', '2. Điểm số / Bậc mục tiêu mong muốn')}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {t('onboarding.step2.score_val', { score: getCertTitle(activeConfig) })}
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
          {activeConfig.presetChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              className={`onboarding-chip ${targetScore === chip.value ? 'active' : ''}`}
              onClick={() => onScoreChange(chip.value)}
            >
              {formatChipLabel(chip)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
