import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check, Globe } from 'lucide-react';

// Lá cờ Việt Nam (SVG chuẩn tỉ lệ)
export const VietnamFlag: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ 
  className = 'w-5 h-3.5', 
  style 
}) => (
  <svg 
    viewBox="0 0 30 20" 
    className={className} 
    style={{ 
      borderRadius: '2px', 
      overflow: 'hidden', 
      boxShadow: '0 0 1px rgba(0,0,0,0.25)', 
      display: 'inline-block', 
      verticalAlign: 'middle',
      ...style 
    }}
  >
    <rect width="30" height="20" fill="#DA251D" />
    <polygon
      points="15,4 16.55,8.76 21.56,8.76 17.5,11.71 19.05,16.47 15,13.53 10.95,16.47 12.5,11.71 8.44,8.76 13.45,8.76"
      fill="#FFFF00"
    />
  </svg>
);

// Lá cờ Vương Quốc Anh (Union Jack chuẩn)
export const UKFlag: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ 
  className = 'w-5 h-3.5', 
  style 
}) => (
  <svg 
    viewBox="0 0 60 30" 
    className={className} 
    style={{ 
      borderRadius: '2px', 
      overflow: 'hidden', 
      boxShadow: '0 0 1px rgba(0,0,0,0.25)', 
      display: 'inline-block', 
      verticalAlign: 'middle',
      ...style 
    }}
  >
    <clipPath id="uk-flag-clip-switcher">
      <rect width="60" height="30" rx="2" />
    </clipPath>
    <g clipPath="url(#uk-flag-clip-switcher)">
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </g>
  </svg>
);

export interface LanguageItem {
  code: string;
  shortCode: string;
  name: string;
  nativeName: string;
  flag: React.ReactNode;
}

export const SUPPORTED_LANGUAGES: LanguageItem[] = [
  {
    code: 'vi',
    shortCode: 'VIE',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    flag: <VietnamFlag className="w-5 h-3.5 shrink-0" />,
  },
  {
    code: 'en',
    shortCode: 'ENG',
    name: 'English',
    nativeName: 'English',
    flag: <UKFlag className="w-5 h-3.5 shrink-0" />,
  },
];

export interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'inline';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'dropdown' }) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tìm ngôn ngữ hiện tại, mặc định là VIE (vi)
  const currentLang = SUPPORTED_LANGUAGES.find((lang) => lang.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  // Giao diện dạng inline (Segmented control) tối ưu cho Mobile Drawer
  if (variant === 'inline') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', width: '100%' }}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isSelected = i18n.language === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelectLanguage(lang.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.625rem 0.85rem',
                borderRadius: '12px',
                border: isSelected ? '1.5px solid var(--primary, #ea580c)' : '1px solid var(--border-light, #e2e8f0)',
                background: isSelected ? '#fff7ed' : '#ffffff',
                color: isSelected ? 'var(--primary, #c2410c)' : 'var(--text-primary, #334155)',
                fontWeight: isSelected ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 1px 3px rgba(234, 88, 12, 0.1)' : 'none'
              }}
            >
              {lang.flag}
              <span>{lang.nativeName}</span>
              {isSelected && <Check size={14} color="#c2410c" style={{ marginLeft: 'auto' }} />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative inline-block text-left" style={{ position: 'relative' }}>
      {/* Nút bấm trên Header: Ảnh quốc gia + Mã viết tắt (ví dụ: VIE) + Mũi tên */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-sm hover:shadow active:scale-[0.98]"
        style={{
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.35rem 0.75rem',
          borderRadius: '50px',
          border: '1px solid var(--border-light, #e2e8f0)',
          background: 'white',
          color: 'var(--text-primary, #1e293b)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          {currentLang.flag}
        </span>
        <span style={{ fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-primary, #0f172a)' }}>
          {currentLang.shortCode}
        </span>
        <ChevronDown 
          size={14} 
          style={{ 
            color: 'var(--text-secondary, #64748b)', 
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }} 
        />
      </button>

      {/* Dropdown Menu chuyển ngôn ngữ */}
      {isOpen && (
        <div
          className="ed-card slide-up"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            minWidth: '200px',
            background: 'white',
            borderRadius: '16px',
            padding: '0.5rem',
            boxShadow: '0 12px 30px -4px rgba(16, 24, 40, 0.12), 0 4px 12px -2px rgba(16, 24, 40, 0.08)',
            border: '1px solid var(--border-light, #e2e8f0)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          <div 
            style={{ 
              padding: '0.5rem 0.75rem 0.35rem', 
              fontSize: '0.6875rem', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '0.75px', 
              color: 'var(--text-secondary, #94a3b8)',
              borderBottom: '1px solid var(--border-light, #f1f5f9)',
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>{i18n.language === 'vi' ? 'Chọn ngôn ngữ' : 'Select language'}</span>
            <Globe size={13} />
          </div>

          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = i18n.language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.875rem',
                  background: isSelected ? '#fff7ed' : 'transparent',
                  color: isSelected ? '#c2410c' : 'var(--text-primary, #1e293b)',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  {lang.flag}
                  <span>{lang.nativeName}</span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      background: isSelected ? '#ffedd5' : '#f1f5f9',
                      color: isSelected ? '#ea580c' : '#64748b',
                    }}
                  >
                    {lang.shortCode}
                  </span>
                </div>

                {isSelected && <Check size={16} color="#ea580c" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
