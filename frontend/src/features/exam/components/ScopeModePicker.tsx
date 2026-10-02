import React, { useState } from 'react';
import type { CreateAttemptRequest, TestMode, TestScope } from '../types/api.types';

interface ScopeModePickerProps {
  examId: number;
  onSubmit: (req: CreateAttemptRequest) => void;
  isLoading: boolean;
  error: string | null;
}

const SCOPE_OPTIONS: { value: TestScope; label: string; desc: string; icon: string }[] = [
  { value: 'FULL_EXAM', label: 'Toàn bộ đề', desc: 'Đầy đủ tất cả các phần và câu hỏi', icon: '📋' },
  { value: 'SINGLE_SKILL', label: 'Một kỹ năng', desc: 'Chọn 1 kỹ năng trọng tâm để luyện tập', icon: '🎯' },
  { value: 'SINGLE_PART', label: 'Một phần', desc: 'Luyện riêng từng Part trong kỹ năng', icon: '📌' },
];

const MODE_OPTIONS: { value: TestMode; label: string; desc: string; icon: string; activeColor: string }[] = [
  { value: 'MOCK_TEST', label: 'Mock Test', desc: 'Đồng hồ đếm ngược, tự động nộp bài khi hết giờ', icon: '⏱️', activeColor: '#d97706' },
  { value: 'PRACTICE', label: 'Practice', desc: 'Không giới hạn thời gian, tự do tra từ AI', icon: '📖', activeColor: '#059669' },
];

const SECTION_OPTIONS = [
  { value: '1', label: '📖 Reading' },
  { value: '2', label: '🎧 Listening' },
  { value: '3', label: '✍️ Writing' },
];

const PART_OPTIONS = [
  { value: '1', label: 'Part 1' },
  { value: '2', label: 'Part 2' },
  { value: '3', label: 'Part 3' },
];

const cardBase: React.CSSProperties = {
  textAlign: 'left',
  padding: '1.125rem',
  borderRadius: '0.875rem',
  border: '1px solid #e5e7eb',
  background: '#ffffff',
  cursor: 'pointer',
  transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
  width: '100%',
  color: 'inherit',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
};

const cardActiveAmber: React.CSSProperties = {
  ...cardBase,
  border: '2px solid #d97706',
  background: '#fffbeb',
  boxShadow: '0 4px 12px rgba(217,119,6,0.12)',
};

const cardActiveGreen: React.CSSProperties = {
  ...cardBase,
  border: '2px solid #059669',
  background: '#ecfdf5',
  boxShadow: '0 4px 12px rgba(5,150,105,0.12)',
};

const pillBase: React.CSSProperties = {
  padding: '0.375rem 1rem',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  border: '1px solid #d1d5db',
  background: '#ffffff',
  color: '#4b5563',
  cursor: 'pointer',
  transition: 'all 0.2s',
  fontFamily: 'var(--font-heading)',
};

const pillActive: React.CSSProperties = {
  ...pillBase,
  background: '#d97706',
  border: '1px solid #d97706',
  color: '#ffffff',
  boxShadow: '0 2px 4px rgba(217,119,6,0.25)',
};

const Spinner = () => (
  <svg style={{ animation: 'spin 1s linear infinite', height: '1rem', width: '1rem', display: 'inline' }} viewBox="0 0 24 24" fill="none">
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const ScopeModePicker: React.FC<ScopeModePickerProps> = ({ examId, onSubmit, isLoading, error }) => {
  const [scope, setScope] = useState<TestScope | ''>('');
  const [mode, setMode] = useState<TestMode | ''>('');
  const [sectionId, setSectionId] = useState('');
  const [partId, setPartId] = useState('');

  const needsSection = scope === 'SINGLE_SKILL' || scope === 'SINGLE_PART';
  const needsPart = scope === 'SINGLE_PART';
  const isValid =
    scope !== '' && mode !== '' &&
    (!needsSection || sectionId !== '') &&
    (!needsPart || partId !== '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !scope || !mode) return;
    onSubmit({
      exam_id: examId,
      test_scope: scope as TestScope,
      test_mode: mode as TestMode,
      section_id: needsSection && sectionId ? parseInt(sectionId, 10) : null,
      part_id: needsPart && partId ? parseInt(partId, 10) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Thiết lập phiên thi" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Step 1: Scope */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.875rem' }}>
          <span style={{
            width: '1.5rem', height: '1.5rem', borderRadius: '50%',
            background: '#d97706', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 800, flexShrink: 0,
          }}>1</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#111827' }}>
            Chọn phạm vi bài thi
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setScope(opt.value); setSectionId(''); setPartId(''); }}
              style={scope === opt.value ? cardActiveAmber : cardBase}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{opt.icon}</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '0.25rem' }}>{opt.label}</div>
              <div style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: 1.5 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Section picker */}
      {needsSection && (
        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.8rem', color: '#4b5563', marginBottom: '0.75rem' }}>
            ↳ Chọn kỹ năng:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {SECTION_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => { setSectionId(opt.value); setPartId(''); }}
                style={sectionId === opt.value ? pillActive : pillBase}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsPart && sectionId && (
        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.8rem', color: '#4b5563', marginBottom: '0.75rem' }}>
            ↳ Chọn phần:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {PART_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setPartId(opt.value)}
                style={partId === opt.value ? pillActive : pillBase}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Mode */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.875rem' }}>
          <span style={{
            width: '1.5rem', height: '1.5rem', borderRadius: '50%',
            background: '#d97706', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 800, flexShrink: 0,
          }}>2</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#111827' }}>
            Chọn chế độ làm bài
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
          {MODE_OPTIONS.map((opt) => {
            const isActive = mode === opt.value;
            const style: React.CSSProperties = isActive
              ? (opt.activeColor === '#059669' ? cardActiveGreen : cardActiveAmber)
              : cardBase;
            return (
              <button key={opt.value} type="button" onClick={() => setMode(opt.value)} style={style}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '1.75rem' }}>{opt.icon}</div>
                  {opt.value === 'MOCK_TEST' && (
                    <span className="badge-orange" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                      Khuyên dùng
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '0.25rem' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: 1.5 }}>
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.875rem 1.25rem',
          background: '#fee2e2', border: '1px solid #fca5a5',
          borderRadius: '0.75rem', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 500,
          animation: 'fadeIn 0.2s ease-out',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        id="btn-start-exam"
        disabled={!isValid || isLoading}
        style={{
          width: '100%', padding: '1rem',
          borderRadius: '0.875rem',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.05rem',
          border: 'none', cursor: isValid && !isLoading ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
          ...(isValid && !isLoading
            ? {
                background: '#d97706', color: '#ffffff',
                boxShadow: '0 4px 16px rgba(217,119,6,0.3)',
              }
            : {
                background: '#f3f4f6', color: '#9ca3af',
                border: '1px solid #e5e7eb',
              }),
        }}
        onMouseEnter={e => { if (isValid && !isLoading) (e.currentTarget as HTMLButtonElement).style.background = '#b45309'; }}
        onMouseLeave={e => { if (isValid && !isLoading) (e.currentTarget as HTMLButtonElement).style.background = '#d97706'; }}
      >
        {isLoading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Spinner /> Đang tạo phiên thi...
          </span>
        ) : 'Bắt đầu làm bài →'}
      </button>
    </form>
  );
};

export default ScopeModePicker;
