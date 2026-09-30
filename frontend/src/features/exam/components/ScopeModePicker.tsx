import React, { useState } from 'react';
import type { CreateAttemptRequest, TestMode, TestScope } from '../types/api.types';

interface ScopeModePickerProps {
  examId: number;
  onSubmit: (req: CreateAttemptRequest) => void;
  isLoading: boolean;
  error: string | null;
}

const SCOPE_OPTIONS: { value: TestScope; label: string; desc: string; icon: string }[] = [
  { value: 'FULL_EXAM', label: 'Toàn bộ đề', desc: '4 kỹ năng: Reading, Listening, Writing, Speaking', icon: '📋' },
  { value: 'SINGLE_SKILL', label: 'Một kỹ năng', desc: 'Chọn 1 trong 4 kỹ năng để luyện tập', icon: '🎯' },
  { value: 'SINGLE_PART', label: 'Một phần', desc: 'Luyện riêng từng Part trong kỹ năng', icon: '📌' },
];

const MODE_OPTIONS: { value: TestMode; label: string; desc: string; icon: string; activeColor: string }[] = [
  { value: 'MOCK_TEST', label: 'Mock Test', desc: 'Đồng hồ đếm ngược, tự động nộp khi hết giờ', icon: '⏱️', activeColor: '#2151DA' },
  { value: 'PRACTICE', label: 'Practice', desc: 'Không giới hạn thời gian, không áp lực', icon: '📖', activeColor: '#10B981' },
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
  padding: '1rem',
  borderRadius: '0.75rem',
  border: '1px solid #334155',
  background: 'rgba(30,41,59,0.5)',
  cursor: 'pointer',
  transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
  width: '100%',
  color: 'inherit',
};

const cardActive: React.CSSProperties = {
  ...cardBase,
  border: '1px solid #2151DA',
  background: 'rgba(33,81,218,0.1)',
  boxShadow: '0 0 0 1px #2151DA',
};

const cardActiveGreen: React.CSSProperties = {
  ...cardBase,
  border: '1px solid #10B981',
  background: 'rgba(16,185,129,0.1)',
  boxShadow: '0 0 0 1px #10B981',
};

const pillBase: React.CSSProperties = {
  padding: '0.375rem 1rem',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  border: '1px solid #334155',
  background: '#1E293B',
  color: '#94A3B8',
  cursor: 'pointer',
  transition: 'all 0.2s',
  fontFamily: 'var(--font-heading)',
};

const pillActive: React.CSSProperties = {
  ...pillBase,
  background: '#2151DA',
  border: '1px solid #2151DA',
  color: '#fff',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span style={{
            width: '1.25rem', height: '1.25rem', borderRadius: '50%',
            background: '#2151DA', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
          }}>1</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1' }}>
            Chọn phạm vi thi
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setScope(opt.value); setSectionId(''); setPartId(''); }}
              style={scope === opt.value ? cardActive : cardBase}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{opt.icon}</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>{opt.label}</div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.5 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Section picker */}
      {needsSection && (
        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.75rem' }}>
            ↳ Chọn kỹ năng
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
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.75rem' }}>
            ↳ Chọn phần
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span style={{
            width: '1.25rem', height: '1.25rem', borderRadius: '50%',
            background: '#2151DA', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
          }}>2</span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1' }}>
            Chọn chế độ
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {MODE_OPTIONS.map((opt) => {
            const isActive = mode === opt.value;
            const style: React.CSSProperties = isActive
              ? (opt.activeColor === '#10B981' ? cardActiveGreen : cardActive)
              : cardBase;
            return (
              <button key={opt.value} type="button" onClick={() => setMode(opt.value)} style={style}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{opt.icon}</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>{opt.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.5 }}>{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '0.75rem', color: '#EF4444', fontSize: '0.875rem',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        id="btn-start-exam"
        disabled={!isValid || isLoading}
        style={{
          width: '100%', padding: '1rem',
          borderRadius: '0.75rem',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem',
          border: 'none', cursor: isValid && !isLoading ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          ...(isValid && !isLoading
            ? {
                background: '#2151DA', color: '#fff',
                boxShadow: '0 4px 16px rgba(33,81,218,0.35)',
              }
            : {
                background: '#1E293B', color: '#94A3B8',
                border: '1px solid #334155',
              }),
        }}
        onMouseEnter={e => { if (isValid && !isLoading) (e.currentTarget as HTMLButtonElement).style.background = '#1a3fb5'; }}
        onMouseLeave={e => { if (isValid && !isLoading) (e.currentTarget as HTMLButtonElement).style.background = '#2151DA'; }}
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
