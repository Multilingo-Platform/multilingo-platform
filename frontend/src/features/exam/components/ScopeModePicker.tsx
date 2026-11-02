import { examErrorMessage as ee } from '../i18n/examMessages';
import { examMessage as em, useExamLocale } from '../i18n/examMessages';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CreateAttemptRequest,
  LearnerExamStructureSection,
  TestMode,
  TestScope,
} from '../types/api.types';

interface ScopeModePickerProps {
  examId: number;
  sections?: LearnerExamStructureSection[];
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
  { value: 'MULTI_PART', label: 'Nhiều phần', desc: 'Chọn nhiều Part từ một hoặc nhiều kỹ năng' },
];

const MODE_OPTIONS: { value: TestMode; label: string; desc: string; activeColor: string }[] = [
  { value: 'MOCK_TEST', label: 'Mock Test', desc: 'Đồng hồ đếm ngược, tự động nộp bài', activeColor: '#d97706' },
  { value: 'PRACTICE', label: 'Practice', desc: 'Không giới hạn thời gian, tự do tra từ AI', activeColor: '#059669' },
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
      {em(label)}
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
  sections = [],
  initialMode,
  initialScope,
  onSubmit,
  isLoading,
  error,
}) => {
  useExamLocale();
  const { t } = useTranslation('exam');
  const singlePartLabel = t('scope.singlePart');
  const [scope, setScope] = useState<TestScope | ''>(initialScope || '');
  const [mode, setMode] = useState<TestMode | ''>(initialMode || '');
  const [sectionId, setSectionId] = useState('');
  const [partId, setPartId] = useState('');
  const [selectedPartIds, setSelectedPartIds] = useState<number[]>([]);
  const [activeSkillType, setActiveSkillType] = useState(sections.find(section => section.parts?.length)?.skillType ?? '');

  const needsSection = scope === 'SINGLE_SKILL' || scope === 'SINGLE_PART';
  const needsPart = scope === 'SINGLE_PART';
  const selectedSection = sections.find((s) => String(s.id) === sectionId);
  const skillGroups = sections.reduce<{ skillType: string; label: string }[]>((groups, section) => {
    const skillType = section.skillType || section.title || String(section.id);
    if (!groups.some(group => group.skillType === skillType)) groups.push({ skillType, label: section.title || skillType });
    return groups;
  }, []);
  const visibleSkillType = skillGroups.some(group => group.skillType === activeSkillType)
    ? activeSkillType : (skillGroups[0]?.skillType ?? '');
  const multiPartSectionIds = new Set(sections.filter(section =>
    section.parts?.some(part => selectedPartIds.includes(part.id))
  ).map(section => section.id));
  const selectedMultiSections = sections.filter(section => multiPartSectionIds.has(section.id));
  const multiPartDuration = selectedMultiSections.length > 0
    && selectedMultiSections.every(section => Number.isSafeInteger(section.durationMinutes) && !!section.durationMinutes && section.durationMinutes > 0)
    ? selectedMultiSections.reduce((total, section) => total + (section.durationMinutes ?? 0), 0)
    : null;
  const orderedSelectedPartIds = sections.flatMap(section =>
    (section.parts ?? []).filter(part => selectedPartIds.includes(part.id)).map(part => part.id)
  );

  const isValid =
    scope !== '' &&
    mode !== '' &&
    (!needsSection || sectionId !== '') &&
    (!needsPart || (partId !== '' && !!selectedSection && selectedSection.parts.length > 0)) &&
    (scope !== 'MULTI_PART' || (orderedSelectedPartIds.length >= 2 && (mode !== 'MOCK_TEST' || (multiPartDuration !== null && multiPartDuration > 0))));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !scope || !mode) return;
    onSubmit({
      exam_id: examId,
      test_scope: scope as TestScope,
      test_mode: mode as TestMode,
      section_id: needsSection && sectionId ? parseInt(sectionId, 10) : null,
      part_id: needsPart && partId ? parseInt(partId, 10) : null,
      ...(scope === 'MULTI_PART' ? { part_ids: orderedSelectedPartIds } : {}),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={em("Thiết lập phiên thi")}
      aria-busy={isLoading ? 'true' : 'false'}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minHeight: 0 }}
    >
      {/* Scrollable area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Step 1: Scope */}
        <div>
          <StepHeader num={1} label={em("Chọn phạm vi bài thi")} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={scope === opt.value ? 'true' : 'false'}
                onClick={() => { setScope(opt.value); setSectionId(''); setPartId(''); }}
                style={scope === opt.value ? scopeButtonActive : scopeButtonBase}
              >
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.8rem', color: '#111827', marginBottom: '0.125rem' }}>
                  {opt.value === 'SINGLE_PART' ? singlePartLabel : opt.value === 'MULTI_PART' ? t('scope.multiPart', 'Nhiều phần') : em(opt.label)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', lineHeight: 1.4 }}>{em(opt.desc)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Section sub-picker */}
        {needsSection && (
          <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {em("Kỹ năng:")}</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  aria-pressed={sectionId === String(sec.id) ? 'true' : 'false'}
                  onClick={() => { setSectionId(String(sec.id)); setPartId(''); }}
                  style={sectionId === String(sec.id) ? pillActive : pillBase}
                >
                  {sec.title || sec.skillType}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Part sub-picker */}
        {needsPart && sectionId && (
          <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {em("Phần:")}</div>
            {(!selectedSection || selectedSection.parts.length === 0) ? (
              <div role="status" style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic', padding: '0.25rem 0' }}>
                {em("Kỹ năng này chưa có phần thi nào")}</div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {selectedSection.parts.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    aria-pressed={partId === String(part.id) ? 'true' : 'false'}
                    onClick={() => setPartId(String(part.id))}
                    style={partId === String(part.id) ? pillActive : pillBase}
                  >
                    {part.title || `Part ${part.partNumber}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {scope === 'MULTI_PART' && (
          <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {em('Chọn kỹ năng và Part:')}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {skillGroups.map(group => (
                <button key={group.skillType} type="button" aria-pressed={visibleSkillType === group.skillType ? 'true' : 'false'}
                  onClick={() => setActiveSkillType(group.skillType)} style={visibleSkillType === group.skillType ? pillActive : pillBase}>
                  {group.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
              {sections.filter(section => (section.skillType || section.title || String(section.id)) === visibleSkillType)
                .flatMap(section => (section.parts ?? []).map(part => ({ section, part })))
                .map(({ part }) => {
                  const partLabel = part.title || `Part ${part.partNumber}`;
                  return (
                    <label key={part.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.65rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', background: selectedPartIds.includes(part.id) ? '#fffbeb' : '#fff', cursor: 'pointer', fontSize: '0.78rem' }}>
                      <input type="checkbox" aria-label={partLabel} checked={selectedPartIds.includes(part.id)}
                        onChange={event => setSelectedPartIds(current => event.target.checked
                          ? current.includes(part.id) ? current : [...current, part.id]
                          : current.filter(id => id !== part.id))} />
                      <span>{partLabel}</span>
                    </label>
                  );
                })}
            </div>
            <div role="status" style={{ marginTop: '0.65rem', padding: '0.65rem', background: '#f9fafb', borderRadius: '0.5rem', color: '#4b5563', fontSize: '0.78rem' }}>
              {em('Đã chọn {{v0}} phần', { v0: orderedSelectedPartIds.length })}
              {mode === 'MOCK_TEST' && (multiPartDuration === null || multiPartDuration <= 0
                ? ` · ${em(orderedSelectedPartIds.length < 2 ? 'Chọn ít nhất hai Part để bắt đầu.' : 'Thiếu thời lượng hợp lệ ở một kỹ năng đã chọn.')}`
                : ` · ${em('Tổng thời lượng Mock: {{v0}} phút', { v0: multiPartDuration })}`)}
              {mode === 'PRACTICE' && ` · ${em('Practice không giới hạn thời gian.')}`}
            </div>
          </div>
        )}

        {/* Step 2: Mode */}
        <div>
          <StepHeader num={2} label={em("Chọn chế độ làm bài")} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
            {MODE_OPTIONS.map((opt) => {
              const isActive = mode === opt.value;
              const activeStyle = opt.activeColor === '#059669' ? modeButtonGreen : modeButtonAmber;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={isActive ? 'true' : 'false'}
                  onClick={() => setMode(opt.value)}
                  style={isActive ? activeStyle : modeButtonBase}
                >
                  {/* Color indicator dot */}
                  <span style={{
                    width: '0.5rem', height: '0.5rem', borderRadius: '50%', flexShrink: 0,
                    background: isActive ? opt.activeColor : '#d1d5db',
                    transition: 'background 0.15s',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.82rem', color: '#111827' }}>{em(opt.label)}</div>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', lineHeight: 1.4, marginTop: '0.0625rem' }}>{em(opt.desc)}</div>
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
            ⚠ {ee(error)}
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
              <Spinner /> {em("Đang tạo phiên thi...")}</span>
          ) : em("Bắt đầu làm bài →")}
        </button>
      </div>
    </form>
  );
};

export default ScopeModePicker;
