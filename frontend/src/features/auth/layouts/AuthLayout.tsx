import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  isLogin: boolean;
  onToggleMode: () => void;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children, isLogin, onToggleMode }) => {
  const { t } = useTranslation();
  return (
    <div className="auth-page-wrapper">
      <div className="auth-bg-decor" />

      <div className="auth-card-container slide-up">
        {/* Centered Auth Card */}
        <div className="auth-card">
          {/* Card Header: Brand Logo & Back to Home */}
          <div className="auth-card-top">
            <Link to="/" className="auth-brand-badge">
              <div className="auth-brand-icon">
                🌐
              </div>
              <span className="auth-brand-name">Multilingo</span>
            </Link>

            <Link to="/" className="auth-back-btn">
              ← {t('auth.back_home')}
            </Link>
          </div>

          <div style={{ marginBottom: '1.15rem', textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1f2937', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
              {title}
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              {subtitle}
            </p>
          </div>

          {children}

          {/* Toggle Login/Register */}
          <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid #f3f4f6', fontSize: '0.875rem', color: '#6b7280' }}>
            {isLogin ? t('auth.no_account') : t('auth.has_account')}
            <button
              type="button"
              style={{
                color: '#c25e2e',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                marginLeft: '0.35rem',
                fontSize: '0.875rem'
              }}
              onClick={onToggleMode}
            >
              {isLogin ? t('auth.register_now') : t('auth.login_now')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
