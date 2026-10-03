import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setShowLangDropdown(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', marginRight: '1rem' }}>
      <div 
        className="flex-center" 
        style={{ cursor: 'pointer', gap: '0.5rem', color: 'var(--text-secondary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
        onClick={() => setShowLangDropdown(!showLangDropdown)}
      >
        <Globe size={18} />
        <span style={{ fontWeight: 600 }}>{i18n.language === 'vi' ? 'Tiếng Việt' : 'English'}</span>
        <ChevronDown size={16} />
      </div>

      {showLangDropdown && (
        <div className="ed-card slide-up" style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          minWidth: '150px',
          zIndex: 1000,
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <div 
            onClick={() => changeLanguage('vi')}
            style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontWeight: 500, background: i18n.language === 'vi' ? 'var(--primary-light)' : 'transparent', color: i18n.language === 'vi' ? 'var(--primary)' : 'var(--text-primary)' }}
          >
            Tiếng Việt (VI)
          </div>
          <div 
            onClick={() => changeLanguage('en')}
            style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontWeight: 500, background: i18n.language === 'en' ? 'var(--primary-light)' : 'transparent', color: i18n.language === 'en' ? 'var(--primary)' : 'var(--text-primary)' }}
          >
            English (EN)
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
