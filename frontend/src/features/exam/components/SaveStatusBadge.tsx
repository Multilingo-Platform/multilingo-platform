import { useSelector } from 'react-redux';
import { selectSaveStatus } from '../store/answerSlice';
import type { RootState } from '../../../store/store';

const Spinner = () => (
  <svg style={{ animation: 'spin 1s linear infinite', height: '0.75rem', width: '0.75rem', display: 'inline' }} viewBox="0 0 24 24" fill="none">
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export function SaveStatusBadge() {
  const { saveStatus } = useSelector((state: RootState) => selectSaveStatus(state));

  if (saveStatus === 'idle') return null;

  if (saveStatus === 'saving') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        fontSize: '0.75rem', color: '#F59E0B',
        padding: '0.25rem 0.5rem',
        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: '9999px',
      }}>
        <Spinner /> Đang lưu...
      </span>
    );
  }

  if (saveStatus === 'saved') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        fontSize: '0.75rem', color: '#10B981',
        padding: '0.25rem 0.5rem',
        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: '9999px',
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
        Đã lưu
      </span>
    );
  }

  if (saveStatus === 'error') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        fontSize: '0.75rem', color: '#F59E0B',
        padding: '0.25rem 0.5rem',
        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: '9999px',
      }}>
        ⚠️ Đang thử lại...
      </span>
    );
  }

  return null;
}
