import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [nativeLang, setNativeLang] = useState('vi');
  const [targetLang, setTargetLang] = useState('en');
  const [targetCert, setTargetCert] = useState('IELTS');
  const [targetBand, setTargetBand] = useState('7.0');

  const handleFinish = () => {
    navigate('/student/library'); // Cập nhật theo UC05: Chuyển thẳng vào Kho đề thi
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
                Tiếng Anh
              </div>
              <div 
                className="ed-card flex-center" 
                style={{ padding: '1rem', cursor: 'pointer', border: targetLang === 'vi' ? '2px solid var(--primary)' : '1px solid var(--border-dark)', background: targetLang === 'vi' ? 'var(--primary-light)' : 'var(--bg-secondary)', color: targetLang === 'vi' ? 'var(--primary)' : 'var(--text-primary)', fontWeight: targetLang === 'vi' ? 600 : 500, boxShadow: 'none' }}
                onClick={() => setTargetLang('vi')}
              >
                Tiếng Việt
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 700, fontSize: '1.125rem' }}>3. Chứng chỉ mục tiêu & Điểm kỳ vọng (Target Band)</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <select 
                className="input-field" 
                value={targetCert} 
                onChange={(e) => setTargetCert(e.target.value)}
                style={{ flex: 1, cursor: 'pointer' }}
              >
                <option value="IELTS">IELTS Academic</option>
                <option value="TOEIC">TOEIC L&R</option>
                <option value="VSTEP">VSTEP B1-C1</option>
              </select>
              
              <select 
                className="input-field" 
                value={targetBand} 
                onChange={(e) => setTargetBand(e.target.value)}
                style={{ flex: 1, cursor: 'pointer' }}
              >
                {targetCert === 'IELTS' && (
                  <>
                    <option value="5.5">Band 5.5+</option>
                    <option value="6.5">Band 6.5+</option>
                    <option value="7.5">Band 7.5+</option>
                  </>
                )}
                {targetCert === 'TOEIC' && (
                  <>
                    <option value="500">500+ Điểm</option>
                    <option value="750">750+ Điểm</option>
                    <option value="900">900+ Điểm</option>
                  </>
                )}
                {targetCert === 'VSTEP' && (
                  <>
                    <option value="B1">Bậc 3 (B1)</option>
                    <option value="B2">Bậc 4 (B2)</option>
                    <option value="C1">Bậc 5 (C1)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <button className="btn btn-primary" style={{ marginTop: '1.5rem', padding: '1rem', fontSize: '1.125rem' }} onClick={handleFinish}>
            Hoàn tất & Vào thư viện đề thi
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
