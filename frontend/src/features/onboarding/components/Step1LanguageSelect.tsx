import React from 'react';
import { AlertCircle } from 'lucide-react';
import { FlagIcon } from './FlagIcon';

interface Step1LanguageSelectProps {
  nativeLanguage: string;
  targetLanguage: string;
  onNativeChange: (lang: string) => void;
  onTargetChange: (lang: string) => void;
}

const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', desc: 'Bản ngữ Việt Nam' },
  { code: 'en', name: 'Tiếng Anh (English)', desc: 'Ngôn ngữ toàn cầu' },
];

export const Step1LanguageSelect: React.FC<Step1LanguageSelectProps> = ({
  nativeLanguage,
  targetLanguage,
  onNativeChange,
  onTargetChange,
}) => {
  const isSameLanguage = nativeLanguage === targetLanguage;

  const handleSelectNative = (code: string) => {
    onNativeChange(code);
    if (code === targetLanguage) {
      onTargetChange(code === 'vi' ? 'en' : 'vi');
    }
  };

  const handleSelectTarget = (code: string) => {
    onTargetChange(code);
    if (code === nativeLanguage) {
      onNativeChange(code === 'vi' ? 'en' : 'vi');
    }
  };

  return (
    <div className="onboarding-step-content">
      <h2 className="onboarding-title">Ngôn ngữ của bạn</h2>
      <p className="onboarding-subtitle">
        Hãy chọn ngôn ngữ mẹ đẻ và ngôn ngữ bạn đang muốn học để cá nhân hóa đề thi và giao diện.
      </p>

      {isSameLanguage && (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} />
          <span>Ngôn ngữ mẹ đẻ và ngôn ngữ muốn học không được trùng nhau!</span>
        </div>
      )}

      {/* 1. Ngôn ngữ mẹ đẻ */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.85rem', fontWeight: 700, fontSize: '1rem', color: '#334155' }}>
          1. Ngôn ngữ mẹ đẻ (Native Language)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {LANGUAGES.map((lang) => (
            <div
              key={`native-${lang.code}`}
              className={`onboarding-option-card ${nativeLanguage === lang.code ? 'active' : ''}`}
              onClick={() => handleSelectNative(lang.code)}
              role="button"
              tabIndex={0}
              aria-pressed={nativeLanguage === lang.code}
              style={{ padding: '1.75rem 1rem' }}
            >
              <div className="onboarding-card-flag">
                <FlagIcon code={lang.code} width={64} height={48} />
              </div>
              <div className="onboarding-card-title" style={{ fontSize: '1.1rem' }}>{lang.name}</div>
              <div className="onboarding-card-desc">{lang.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Ngôn ngữ muốn học */}
      <div>
        <label style={{ display: 'block', marginBottom: '0.85rem', fontWeight: 700, fontSize: '1rem', color: '#334155' }}>
          2. Ngôn ngữ bạn muốn học & luyện thi (Target Language)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {LANGUAGES.map((lang) => (
            <div
              key={`target-${lang.code}`}
              className={`onboarding-option-card ${targetLanguage === lang.code ? 'active' : ''}`}
              onClick={() => handleSelectTarget(lang.code)}
              role="button"
              tabIndex={0}
              aria-pressed={targetLanguage === lang.code}
              style={{ padding: '1.75rem 1rem' }}
            >
              <div className="onboarding-card-flag">
                <FlagIcon code={lang.code} width={64} height={48} />
              </div>
              <div className="onboarding-card-title" style={{ fontSize: '1.1rem' }}>{lang.name}</div>
              <div className="onboarding-card-desc">{lang.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
