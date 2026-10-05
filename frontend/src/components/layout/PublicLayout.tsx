import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Footer from './Footer';

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
            <Link to="/login" className="btn btn-outline" style={{ textDecoration: 'none' }}>{t('publicLayout.login')}</Link>
            <Link to="/register" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('publicLayout.register')}</Link>
          </>
        }
      />

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default PublicLayout;
