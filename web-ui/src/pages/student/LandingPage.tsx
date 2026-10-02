import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="slide-up">
      {/* Hero Section */}
      <section style={{ padding: '6rem 0', textAlign: 'center', background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="badge badge-orange" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>{t('landing.badge')}</div>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '1.5rem', lineHeight: 1.2, color: 'var(--text-primary)' }}>
            {t('landing.title_1')} <br />
            <span style={{ color: 'var(--primary)' }}>{t('landing.title_2')}</span>
          </h1>
          <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
            {t('landing.desc')}
          </p>
          <div className="flex-center" style={{ gap: '1rem' }}>
            <button className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }} onClick={() => navigate('/auth')}>
              {t('landing.start_btn')} <ArrowRight size={20} />
            </button>
            <button className="btn btn-outline" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
              {t('landing.explore_btn')}
            </button>
          </div>
        </div>
      </section>

      {/* Feature Highlight */}
      <section style={{ padding: '4rem 0', background: 'var(--bg-primary)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 800, marginBottom: '3rem' }}>{t('landing.why_choose')}</h2>
          <div className="dashboard-grid">
            {[
              { title: t('landing.f1_title'), desc: t('landing.f1_desc') },
              { title: t('landing.f2_title'), desc: t('landing.f2_desc') },
              { title: t('landing.f3_title'), desc: t('landing.f3_desc') }
            ].map((feature, i) => (
              <div key={i} className="ed-card" style={{ padding: '2rem' }}>
                <CheckCircle size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{feature.title}</h3>
                <p style={{ color: 'var(--text-secondary)' }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
