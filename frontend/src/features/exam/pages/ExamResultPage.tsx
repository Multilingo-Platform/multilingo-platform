import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

// CSS-only confetti dots
const ConfettiDot = ({ style }: { style: React.CSSProperties }) => (
  <div style={{
    position: 'absolute',
    width: '8px', height: '8px',
    borderRadius: '2px',
    ...style,
  }} />
);

const DOTS = [
  { color: '#2151DA', top: '10%', left: '15%', delay: '0s' },
  { color: '#10B981', top: '20%', left: '80%', delay: '0.1s' },
  { color: '#F59E0B', top: '5%', left: '50%', delay: '0.05s' },
  { color: '#EF4444', top: '15%', left: '35%', delay: '0.15s' },
  { color: '#60a5fa', top: '8%', left: '65%', delay: '0.2s' },
  { color: '#a78bfa', top: '25%', left: '10%', delay: '0.08s' },
];

const ExamResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#0F172A', color: '#F8FAFC',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative confetti */}
      <div aria-hidden="true">
        {DOTS.map((d, i) => (
          <ConfettiDot
            key={i}
            style={{
              backgroundColor: d.color,
              top: d.top, left: d.left,
              opacity: show ? 1 : 0,
              transform: show ? 'translateY(0) rotate(45deg)' : 'translateY(-20px) rotate(0)',
              transition: `opacity 0.6s ease ${d.delay}, transform 0.6s ease ${d.delay}`,
            }}
          />
        ))}
      </div>

      {/* Background glow */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '40%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '400px', height: '400px',
        background: 'radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: '480px', width: '100%',
        background: 'rgba(30,41,59,0.7)',
        border: '1px solid rgba(51,65,85,0.7)',
        borderRadius: '1.5rem',
        padding: '2.5rem 2rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        textAlign: 'center',
        backdropFilter: 'blur(4px)',
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}>
        {/* Success checkmark */}
        <div style={{
          width: '4.5rem', height: '4.5rem', borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
          border: '2px solid rgba(16,185,129,0.4)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', marginBottom: '1.5rem',
          boxShadow: '0 0 32px rgba(16,185,129,0.2)',
        }}>
          ✅
        </div>

        <h1 style={{
          fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.75rem',
          color: '#F8FAFC', marginBottom: '0.75rem', lineHeight: 1.2,
        }}>
          Nộp bài thành công!
        </h1>
        <p style={{ color: '#94A3B8', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          Phiên thi <span style={{ color: '#F8FAFC', fontWeight: 600 }}>#{attemptId}</span> đã được ghi nhận.
          Kết quả và phân tích chi tiết sẽ được thêm trong Sprint 04.
        </p>

        {/* Info table */}
        <div style={{
          background: 'rgba(15,23,42,0.6)',
          border: '1px solid rgba(51,65,85,0.5)',
          borderRadius: '1rem', padding: '1rem 1.25rem',
          textAlign: 'left', marginBottom: '2rem',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Attempt ID</span>
              <span style={{ fontSize: '0.8125rem', color: '#e2e8f0', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                #{attemptId}
              </span>
            </div>
            <div style={{ height: '1px', background: 'rgba(51,65,85,0.5)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Trạng thái</span>
              <span style={{
                fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-heading)',
                padding: '2px 10px', borderRadius: '9999px',
                background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)',
              }}>
                ✓ COMPLETED
              </span>
            </div>
            <div style={{ height: '1px', background: 'rgba(51,65,85,0.5)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Chấm điểm AI</span>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Sprint 04</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link
            to="/"
            style={{
              flex: 1, padding: '0.75rem',
              background: '#263549', color: '#cbd5e1',
              border: '1px solid #334155', borderRadius: '0.75rem',
              textDecoration: 'none', textAlign: 'center',
              fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.875rem',
              transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#2d3f55'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#263549'; }}
          >
            🏠 Trang chủ
          </Link>
          <Link
            to="/exams/1/start"
            style={{
              flex: 1, padding: '0.75rem',
              background: '#2151DA', color: 'white',
              border: 'none', borderRadius: '0.75rem',
              textDecoration: 'none', textAlign: 'center',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem',
              boxShadow: '0 4px 16px rgba(33,81,218,0.3)',
              transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1a3fb5'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#2151DA'; }}
          >
            ✨ Làm bài mới
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ExamResultPage;
