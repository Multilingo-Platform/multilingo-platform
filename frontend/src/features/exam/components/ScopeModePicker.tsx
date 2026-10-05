import React, { useState } from 'react';
import type { CreateAttemptRequest, TestMode, TestScope } from '../types/api.types';

interface ScopeModePickerProps {
  examId: number;
  initialMode?: TestMode | '';
  initialScope?: TestScope | '';
  onSubmit: (req: CreateAttemptRequest) => void;
  isLoading: boolean;
  error: string | null;
}

const SCOPE_OPTIONS: { value: TestScope; label: string; desc: string }[] = [
  { value: 'FULL_EXAM', label: 'Toàn bộ đề', desc: 'Đầy đủ tất cả các phần và câu hỏi' },
  { value: 'SINGLE_SKILL', label: 'Một kỹ năng', desc: 'Chọn 1 kỹ năng trọng tâm' },
  { value: 'SINGLE_PART', label: 'Một phần', desc: 'Luyện riêng từng Part' },
];

const MODE_OPTIONS: { value: TestMode; label: string; desc: string; activeColor: string }[] = [
  { value: 'MOCK_TEST', label: 'Mock Test', desc: 'Đồng hồ đếm ngược, tự động nộp bài', activeColor: '#d97706' },
  { value: 'PRACTICE', label: 'Practice', desc: 'Không giới hạn thời gian, tự do tra từ AI', activeColor: '#059669' },
];

const SECTION_OPTIONS = [
  { value: '1', label: 'Reading' },
  { value: '2', label: 'Listening' },
  { value: '3', label: 'Writing' },
];

const PART_OPTIONS = [
  { value: '1', label: 'Part 1' },
  { value: '2', label: 'Part 2' },
  { value: '3', label: 'Part 3' },
];

// --- Styles ---
const scopeButtonBase: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.6rem 0.875rem',
  borderRadius: '0.625rem',
  border: '1.5px solid #e5e7eb',
  background: '#ffffff',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
  width: '100%',
  color: 'inherit',
};

const scopeButtonActive: React.CSSProperties = {
  ...scopeButtonBase,
  border: '1.5px solid #d97706',
  background: '#fffbeb',
  boxShadow: '0 2px 8px rgba(217,119,6,0.1)',
};

const modeButtonBase: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.625rem 0.875rem',
  borderRadius: '0.625rem',
  border: '1.5px solid #e5e7eb',
  background: '#ffffff',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
  width: '100%',
  color: 'inherit',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
};

const modeButtonAmber: React.CSSProperties = {
  ...modeButtonBase,
  border: '1.5px solid #d97706',
  background: '#fffbeb',
};

const modeButtonGreen: React.CSSProperties = {
  ...modeButtonBase,
  border: '1.5px solid #059669',
  background: '#ecfdf5',
};

const pillBase: React.CSSProperties = {
  padding: '0.3rem 0.875rem',
  borderRadius: '0.375rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  border: '1.5px solid #d1d5db',
  background: '#ffffff',
  color: '#4b5563',
  cursor: 'pointer',
  transition: 'all 0.15s',
  fontFamily: 'var(--font-heading)',
};

const pillActive: React.CSSProperties = {
  ...pillBase,
  background: '#d97706',
  border: '1.5px solid #d97706',
  color: '#ffffff',
};

// --- Step header ---
const StepHeader = ({ num, label }: { num: number; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
    <span style={{
      width: '1.25rem', height: '1.25rem', borderRadius: '50%',
      background: '#d97706', color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.7rem', fontWeight: 800, flexShrink: 0,
    }}>{num}</span>
    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151' }}>
      {label}
    </span>
  </div>
);

// --- Spinner ---
const Spinner = () => (
  <svg style={{ animation: 'spin 1s linear infinite', height: '1rem', width: '1rem', display: 'inline' }} viewBox="0 0 24 24" fill="none">
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const ScopeModePicker: React.FC<ScopeModePickerProps> = ({
  examId,
  initialMode,
  initialScope,
  onSubmit,
  isLoading,
  error,
}) => {
  const [scope, setScope] = useState<TestScope | ''>(initialScope || '');
  const [mode, setMode] = useState<TestMode | ''>(initialMode || '');
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
    <form onSubmit={handleSubmit} aria-label="Thiết lập phiên thi" style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minHeight: 0 }}>
      {/* Scrollable area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Step 1: Scope */}
        <div>
          <StepHeader num={1} label="Chọn phạm vi bài thi" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setScope(opt.value); setSectionId(''); setPartId(''); }}
                style={scope === opt.value ? scopeButtonActive : scopeButtonBase}
              >
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.8rem', color: '#111827', marginBottom: '0.125rem' }}>{opt.label}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', lineHeight: 1.4 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Section sub-picker */}
        {needsSection && (
          <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Kỹ năng:
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {SECTION_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => { setSectionId(opt.value); setPartId(''); }}
                  style={sectionId === opt.value ? pillActive : pillBase}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Part sub-picker */}
        {needsPart && sectionId && (
          <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Phần:
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
          <StepHeader num={2} label="Chọn chế độ làm bài" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
            {MODE_OPTIONS.map((opt) => {
              const isActive = mode === opt.value;
              const activeStyle = opt.activeColor === '#059669' ? modeButtonGreen : modeButtonAmber;
              return (
                <button key={opt.value} type="button" onClick={() => setMode(opt.value)}
                  style={isActive ? activeStyle : modeButtonBase}>
                  {/* Color indicator dot */}
                  <span style={{
                    width: '0.5rem', height: '0.5rem', borderRadius: '50%', flexShrink: 0,
                    background: isActive ? opt.activeColor : '#d1d5db',
                    transition: 'background 0.15s',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.82rem', color: '#111827' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', lineHeight: 1.4, marginTop: '0.0625rem' }}>{opt.desc}</div>
                  </div>
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
            background: '#fee2e2', border: '1px solid #fca5a5',
            borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.8rem', fontWeight: 500,
          }}>
            ⚠ {error}
          </div>
        )}

      </div>

      {/* Sticky Submit */}
      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#fff', flexShrink: 0 }}>
        <button
          type="submit"
          id="btn-start-exam"
          disabled={!isValid || isLoading}
          style={{
            width: '100%', padding: '0.875rem',
            borderRadius: '0.75rem',
            fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem',
            border: 'none', cursor: isValid && !isLoading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            ...(isValid && !isLoading
              ? { background: '#d97706', color: '#ffffff', boxShadow: '0 4px 14px rgba(217,119,6,0.3)' }
              : { background: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb' }),
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
      </div>
    </form>
  );
};

export default ScopeModePicker;
