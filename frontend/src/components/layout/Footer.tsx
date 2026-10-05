import React from 'react';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <>
      <style>{`
        .footer-container {
          display: flex;
          justify-content: space-between;
          color: var(--text-secondary);
        }
        .footer-links {
          display: flex;
          gap: 4rem;
        }
        @media (max-width: 1024px) {
          .footer-container {
            flex-direction: column;
            gap: 2rem;
          }
          .footer-links {
            flex-direction: column;
            gap: 2rem;
          }
        }
      `}</style>
      <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)', padding: '3rem 0', marginTop: 'auto' }}>
        <div className="container footer-container">
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '1rem' }}>Multilingo</h3>
            <p style={{ maxWidth: '300px' }}>{t('publicLayout.footer_desc')}</p>
          </div>
          <div className="footer-links">
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
    </>
  );
};

export default Footer;
