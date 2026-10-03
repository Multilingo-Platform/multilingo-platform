import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import LanguageSwitcher from '../common/LanguageSwitcher';

const PublicLayout = () => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Top Navbar */}
      <Header
        navItems={
          <>

            <Link to="/exams" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}>
              {t('publicLayout.ielts_test')}
            </Link>

          </>
        }
        rightActions={
          <>
            <LanguageSwitcher />
            <Link to="/auth" className="btn btn-outline" style={{ textDecoration: 'none' }}>{t('publicLayout.login')}</Link>
            <Link to="/auth" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('publicLayout.register')}</Link>
          </>
        }
      />

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
