import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import ScopeModePicker from '../components/ScopeModePicker';
import { createAttempt } from '../api/attemptApi';
import type { CreateAttemptRequest } from '../types/api.types';

const ExamStartPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (req: CreateAttemptRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const workspace = await createAttempt(req);
      navigate(`/attempts/${workspace.attempt_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tạo phiên thi. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!examId) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#EF4444', fontWeight: 500 }}>Exam ID không hợp lệ</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0F172A', color: '#F8FAFC' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid rgba(51,65,85,0.5)',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <Link to="/" style={{
          color: '#94A3B8', textDecoration: 'none', fontSize: '0.875rem',
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#e2e8f0'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#94A3B8'; }}
        >
          ← Trang chủ
        </Link>
        <span style={{ color: 'rgba(51,65,85,0.6)' }}>|</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: '#cbd5e1', fontSize: '0.875rem' }}>
          Thiết lập phiên thi
        </span>
      </header>

      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        {/* Hero */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.375rem 0.75rem',
            background: 'rgba(33,81,218,0.1)', border: '1px solid rgba(33,81,218,0.3)',
            borderRadius: '9999px', color: '#3b5fe8', fontSize: '0.75rem', fontWeight: 500,
            marginBottom: '1rem',
          }}>
            📝 Exam #{examId}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.875rem',
            color: '#F8FAFC', marginBottom: '0.5rem', lineHeight: 1.2,
          }}>
            Thiết lập phiên thi
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Chọn phạm vi và chế độ thi phù hợp với mục tiêu luyện tập của bạn.
          </p>
        </div>

        {/* Form card */}
        <div style={{
          background: 'rgba(30,41,59,0.6)',
          border: '1px solid rgba(51,65,85,0.6)',
          borderRadius: '1rem',
          padding: '1.5rem 2rem',
          boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
        }}>
          <ScopeModePicker
            examId={parseInt(examId, 10)}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </main>
    </div>
  );
};

export default ExamStartPage;
