import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';

const PublicLayout = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Top Navbar */}
      <header className="top-nav">
        <div className="container flex-between" style={{ height: '70px' }}>
          <div className="flex-center" style={{ gap: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, cursor: 'pointer', color: 'var(--primary)' }} onClick={() => navigate('/')}>
              Multilingo
            </h2>
            <nav style={{ display: 'flex', gap: '1.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <span style={{ cursor: 'pointer' }}>{t('publicLayout.features')}</span>
              <span style={{ cursor: 'pointer' }}>{t('publicLayout.ielts_test')}</span>
              <span style={{ cursor: 'pointer' }}>{t('publicLayout.vn_test')}</span>
            </nav>
          </div>
          
          <div className="flex-center" style={{ gap: '1rem' }}>
            {/* Language Switcher Dropdown */}
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

            <button className="btn btn-outline" onClick={() => navigate('/auth')}>{t('publicLayout.login')}</button>
            <button className="btn btn-primary" onClick={() => navigate('/auth')}>{t('publicLayout.register')}</button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)', padding: '3rem 0', marginTop: 'auto' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '1rem' }}>Multilingo</h3>
            <p style={{ maxWidth: '300px' }}>{t('publicLayout.footer_desc')}</p>
          </div>
          <div style={{ display: 'flex', gap: '4rem' }}>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700 }}>{t('publicLayout.products')}</h4>
              <p style={{ marginBottom: '0.5rem', cursor: 'pointer' }}>{t('publicLayout.ielts_test')}</p>
              <p style={{ marginBottom: '0.5rem', cursor: 'pointer' }}>Luyện thi TOEIC</p>
            </div>
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700 }}>{t('publicLayout.support')}</h4>
              <p style={{ marginBottom: '0.5rem', cursor: 'pointer' }}>{t('publicLayout.guide')}</p>
              <p style={{ marginBottom: '0.5rem', cursor: 'pointer' }}>{t('publicLayout.contact')}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
