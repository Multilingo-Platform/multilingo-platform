import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import axiosClient from './api/axiosClient';
import ExamStartPage from './features/exam/pages/ExamStartPage';
import WorkspacePage from './features/exam/pages/WorkspacePage';
import ExamResultPage from './features/exam/pages/ExamResultPage';

const TEST_CASES = [
  { id: 1, attemptId: 17, label: 'Mock Test (3h Timer)', route: '/attempts/17', badge: 'MOCK' },
  { id: 2, attemptId: 18, label: 'Practice Mode (No Timer)', route: '/attempts/18', badge: 'PRACTICE' },
  { id: 3, attemptId: 19, label: 'Single Skill Reading', route: '/attempts/19', badge: 'SKILL' },
  { id: 4, attemptId: 20, label: 'Submit Flow Test', route: '/attempts/20', badge: 'MOCK' },
  { id: 5, attemptId: 21, label: 'Completed (Redirect)', route: '/attempts/21', badge: 'DONE' },
];

function getBadgeStyle(badge: string): string {
  switch (badge) {
    case 'MOCK': return 'background:rgba(33,81,218,0.15);color:#3b5fe8;border:1px solid rgba(33,81,218,0.3)';
    case 'PRACTICE': return 'background:rgba(16,185,129,0.15);color:#10B981;border:1px solid rgba(16,185,129,0.3)';
    case 'SKILL': return 'background:rgba(33,81,218,0.15);color:#3b5fe8;border:1px solid rgba(33,81,218,0.3)';
    default: return 'background:#263549;color:#94A3B8;border:1px solid #334155';
  }
}

function HomePage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    axiosClient.get('/test/hello')
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'));
  }, []);

  const statusStyle =
    status === 'ok'
      ? 'background:rgba(16,185,129,0.1);color:#10B981;border:1px solid rgba(16,185,129,0.3)'
      : status === 'error'
      ? 'background:rgba(239,68,68,0.1);color:#EF4444;border:1px solid rgba(239,68,68,0.3)'
      : 'background:#263549;color:#94A3B8;border:1px solid #334155';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0F172A', color: '#F8FAFC' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid rgba(51,65,85,0.5)',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: '1.25rem',
            background: 'linear-gradient(to right, #2151DA, #60a5fa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Multilingo
          </span>
          <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Exam Platform</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.375rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500,
          ...Object.fromEntries(statusStyle.split(';').filter(Boolean).map(s => {
            const [k, v] = s.split(':');
            return [k.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v.trim()];
          })),
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            backgroundColor: status === 'ok' ? '#10B981' : status === 'error' ? '#EF4444' : '#94A3B8',
            display: 'inline-block',
            animation: status === 'ok' ? 'pulse 2s infinite' : 'none',
          }} />
          {status === 'ok' ? 'Backend Connected' : status === 'error' ? 'Backend Offline' : 'Checking...'}
        </div>
      </header>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            lineHeight: 1.15,
            marginBottom: '1rem',
            color: '#F8FAFC',
          }}>
            Luyện thi IELTS<br />
            <span style={{
              background: 'linear-gradient(to right, #2151DA, #60a5fa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              thông minh &amp; hiệu quả
            </span>
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '1.125rem', maxWidth: '500px', margin: '0 auto' }}>
            Hệ thống luyện thi với Timer tự động, Autosave thông minh và báo cáo phân tích chi tiết.
          </p>
        </div>

        {/* Primary CTAs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          <Link to="/exams/1/start" style={{
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
            padding: '1.5rem',
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, #2151DA, #1e3a8a)',
            textDecoration: 'none',
            boxShadow: '0 8px 32px rgba(33,81,218,0.25)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.02)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; }}>
            <div style={{ fontSize: '2rem' }}>⏱️</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: '#fff' }}>Mock Test (IELTS)</div>
            <div style={{ color: '#bfdbfe', fontSize: '0.875rem', lineHeight: 1.5 }}>Thi thật với đồng hồ đếm ngược, tự động nộp bài khi hết giờ.</div>
            <div style={{ marginTop: '0.5rem', color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', fontWeight: 600 }}>Bắt đầu thi →</div>
          </Link>

          <Link to="/exams/2/start" style={{
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
            padding: '1.5rem',
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, #065f46, #134e4a)',
            textDecoration: 'none',
            boxShadow: '0 8px 32px rgba(6,78,59,0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.02)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; }}>
            <div style={{ fontSize: '2rem' }}>📖</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: '#fff' }}>Practice Mode</div>
            <div style={{ color: '#a7f3d0', fontSize: '0.875rem', lineHeight: 1.5 }}>Luyện tập không áp lực, không có đồng hồ đếm ngược.</div>
            <div style={{ marginTop: '0.5rem', color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', fontWeight: 600 }}>Bắt đầu luyện →</div>
          </Link>
        </div>

        {/* Testcases */}
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.125rem', color: '#cbd5e1', marginBottom: '1rem' }}>
            📋 Dev Testcases
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {TEST_CASES.map((tc) => (
              <Link
                key={tc.id}
                to={tc.route}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(30,41,59,0.6)',
                  border: '1px solid rgba(51,65,85,0.6)',
                  textDecoration: 'none',
                  transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = '#1E293B';
                  (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.01)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(30,41,59,0.6)';
                  (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                    {tc.label}
                  </span>
                  <span style={{
                    flexShrink: 0, fontSize: '0.7rem', padding: '2px 8px',
                    borderRadius: '9999px', fontWeight: 600,
                    ...Object.fromEntries(getBadgeStyle(tc.badge).split(';').filter(Boolean).map(s => {
                      const [k, v] = s.split(':');
                      return [k.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v?.trim()];
                    })),
                  }}>
                    {tc.badge}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                  Attempt #{tc.attemptId} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/exams/:examId/start" element={<ExamStartPage />} />
      <Route path="/attempts/:attemptId" element={<WorkspacePage />} />
      <Route path="/attempts/:attemptId/result" element={<ExamResultPage />} />
    </Routes>
  );
}

export default App;
