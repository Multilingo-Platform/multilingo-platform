import React, { useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import ScopeModePicker from '../components/ScopeModePicker';
import { createAttempt } from '../api/attemptApi';
import type { CreateAttemptRequest, TestMode, TestScope } from '../types/api.types';

const ExamStartPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialMode = (searchParams.get('mode') as TestMode) || undefined;
  const initialScope = (searchParams.get('scope') as TestScope) || undefined;

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
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#ef4444', fontWeight: 600 }}>Exam ID không hợp lệ</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', color: '#111827', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid #e5e7eb',
        padding: '0.875rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/" style={{
            color: '#d97706', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#b45309'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#d97706'; }}
          >
            ← Quay lại Trang chủ
          </Link>
          <span style={{ color: '#d1d5db' }}>|</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: '#4b5563', fontSize: '0.875rem' }}>
            Thiết lập phòng thi
          </span>
        </div>

        <div style={{
          fontSize: '0.75rem', fontWeight: 600, color: '#065f46',
          backgroundColor: '#ecfdf5', padding: '3px 10px', borderRadius: '9999px',
          border: '1px solid #a7f3d0',
        }}>
          🟢 Hệ thống sẵn sàng
        </div>
      </header>

      {/* Main Form Container */}
      <main style={{ maxWidth: '780px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%', flex: 1 }}>
        {/* Exam Overview Banner */}
        <div className="ed-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span className="badge-orange">
              📝 Đề thi #{examId}
            </span>
            <span className="badge-green">
              {examId === '2' ? 'IELTS General Reading' : 'IELTS Academic Reading'}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>
              Chuẩn Format CBT Quốc tế
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: '1.75rem',
            color: '#111827',
            marginBottom: '0.75rem',
            letterSpacing: '-0.01em',
          }}>
            {examId === '2' ? 'IELTS General Reading - Practice 02' : 'IELTS Academic Reading - Cambridge 19 Test 01'}
          </h1>
          <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {examId === '2'
              ? 'Bài thi luyện tập đọc hiểu chuyên sâu, hỗ trợ tra từ điển ngữ cảnh AI và luyện tập linh hoạt không áp lực thời gian.'
              : 'Bài thi chuẩn hóa cấu trúc 3 Passages học thuật (40 câu hỏi), bao gồm dạng bài True / False / Not Given, Matching Headings, và Summary Completion.'}
          </p>

          {/* Quick Info Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem',
            padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', border: '1px solid #e5e7eb',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>⏱️ Thời lượng</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
                {examId === '2' ? 'Không giới hạn' : '60 - 180 Phút'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>📋 Số câu hỏi</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
                {examId === '2' ? 'Đầy đủ Part' : '40 Câu'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>📖 Cấu trúc</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Passages CBT</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>👥 Thí sinh</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>12,450+</div>
            </div>
          </div>
        </div>

        {/* Scope and Mode Picker Form */}
        <div className="ed-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <ScopeModePicker
            examId={parseInt(examId, 10)}
            initialMode={initialMode}
            initialScope={initialScope}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Important Rules & Instructions */}
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '1rem',
          padding: '1.25rem 1.5rem',
          color: '#92400e',
          fontSize: '0.875rem',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💡</span> Lưu ý quan trọng khi làm bài:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            <li><strong>Autosave thông minh:</strong> Từng câu trả lời của bạn được lưu tức thì vào máy chủ đám mây.</li>
            <li><strong>Tra từ tại chỗ:</strong> Bôi đen từ vựng trong bài đọc để tra cứu phiên âm, nghĩa tiếng Việt và lưu Flashcard.</li>
            <li><strong>Giữ nguyên tab:</strong> Không tải lại trang (F5) khi đang làm bài. Đồng hồ sẽ đếm ngược liên tục.</li>
          </ul>
        </div>
      </main>

      <footer style={{
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        padding: '1.25rem',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.8rem',
      }}>
        © 2026 Multilingo Platform • Hỗ trợ kỹ thuật: support@multilingo.edu.vn
      </footer>
    </div>
  );
};

export default ExamStartPage;
