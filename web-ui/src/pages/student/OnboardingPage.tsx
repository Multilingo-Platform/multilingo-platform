import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [nativeLang, setNativeLang] = useState('vi');
  const [targetLang, setTargetLang] = useState('en');

  const handleFinish = () => {
    navigate('/student/dashboard');
  };

  return (
    <div className="flex-center slide-up" style={{ minHeight: '100vh', padding: '2rem', background: 'var(--bg-primary)' }}>
      <div className="ed-card" style={{ width: '100%', maxWidth: '600px', padding: '3rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>Cá nhân hóa lộ trình</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>Hãy cho chúng tôi biết mục tiêu học tập của bạn để hệ thống gợi ý bài thi phù hợp.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 700, fontSize: '1.125rem' }}>1. Ngôn ngữ mẹ đẻ của bạn là gì?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div 
                className="ed-card flex-center" 
                style={{ padding: '1rem', cursor: 'pointer', border: nativeLang === 'vi' ? '2px solid var(--primary)' : '1px solid var(--border-dark)', background: nativeLang === 'vi' ? 'var(--primary-light)' : 'var(--bg-secondary)', color: nativeLang === 'vi' ? 'var(--primary)' : 'var(--text-primary)', fontWeight: nativeLang === 'vi' ? 600 : 500, boxShadow: 'none' }}
                onClick={() => setNativeLang('vi')}
              >
                Tiếng Việt
              </div>
              <div 
                className="ed-card flex-center" 
                style={{ padding: '1rem', cursor: 'pointer', border: nativeLang === 'en' ? '2px solid var(--primary)' : '1px solid var(--border-dark)', background: nativeLang === 'en' ? 'var(--primary-light)' : 'var(--bg-secondary)', color: nativeLang === 'en' ? 'var(--primary)' : 'var(--text-primary)', fontWeight: nativeLang === 'en' ? 600 : 500, boxShadow: 'none' }}
                onClick={() => setNativeLang('en')}
              >
                Tiếng Anh
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 700, fontSize: '1.125rem' }}>2. Bạn muốn học/thi ngôn ngữ nào?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div 
                className="ed-card flex-center" 
                style={{ padding: '1rem', cursor: 'pointer', border: targetLang === 'en' ? '2px solid var(--primary)' : '1px solid var(--border-dark)', background: targetLang === 'en' ? 'var(--primary-light)' : 'var(--bg-secondary)', color: targetLang === 'en' ? 'var(--primary)' : 'var(--text-primary)', fontWeight: targetLang === 'en' ? 600 : 500, boxShadow: 'none' }}
                onClick={() => setTargetLang('en')}
              >
                Tiếng Anh (IELTS, TOEIC)
              </div>
              <div 
                className="ed-card flex-center" 
                style={{ padding: '1rem', cursor: 'pointer', border: targetLang === 'vi' ? '2px solid var(--primary)' : '1px solid var(--border-dark)', background: targetLang === 'vi' ? 'var(--primary-light)' : 'var(--bg-secondary)', color: targetLang === 'vi' ? 'var(--primary)' : 'var(--text-primary)', fontWeight: targetLang === 'vi' ? 600 : 500, boxShadow: 'none' }}
                onClick={() => setTargetLang('vi')}
              >
                Tiếng Việt (Năng lực TV)
              </div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.125rem' }} onClick={handleFinish}>
            Hoàn tất & Bắt đầu học
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
