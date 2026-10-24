import { examMessage as em, useExamLocale } from '../i18n/examMessages';
import { useSelector } from 'react-redux';
import { selectSaveStatus } from '../store/answerSlice';
import type { RootState } from '../../../app/store';

const Spinner = () => (
  <svg style={{ animation: 'spin 1s linear infinite', height: '0.75rem', width: '0.75rem', display: 'inline' }} viewBox="0 0 24 24" fill="none">
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export interface SaveStatusBadgeProps {
  onReload?: () => void;
}

export function SaveStatusBadge({ onReload }: SaveStatusBadgeProps = {}) {
  useExamLocale();
  const { saveStatus } = useSelector((state: RootState) => selectSaveStatus(state));

  if (saveStatus === 'idle') return null;

  if (saveStatus === 'saving') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        fontSize: '0.75rem', fontWeight: 600, color: '#b45309',
        padding: '0.25rem 0.625rem',
        background: '#fffbeb', border: '1px solid #fde68a',
        borderRadius: '9999px',
      }}>
        <Spinner /> {em("Đang lưu...")}</span>
    );
  }

  if (saveStatus === 'saved') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        fontSize: '0.75rem', fontWeight: 600, color: '#065f46',
        padding: '0.25rem 0.625rem',
        background: '#ecfdf5', border: '1px solid #a7f3d0',
        borderRadius: '9999px',
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
        {em("Đã lưu")}</span>
    );
  }

  if (saveStatus === 'error') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c',
        padding: '0.25rem 0.625rem',
        background: '#fee2e2', border: '1px solid #fca5a5',
        borderRadius: '9999px',
      }}>
        {em("⚠️ Đang thử lại...")}</span>
    );
  }

  if (saveStatus === 'conflict') {
    return (
      <span
        role="alert"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#991b1b',
          padding: '0.25rem 0.625rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '9999px',
        }}
      >
        <span>{em("⚠️ Phiên làm bài đã thay đổi")}</span>
        {onReload && (
          <button
            type="button"
            onClick={onReload}
            style={{
              background: '#b91c1c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.125rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {em("Tải lại bản mới nhất")}</button>
        )}
      </span>
    );
  }

  if (saveStatus === 'stopped') {
    return (
      <span
        role="alert"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#991b1b',
          padding: '0.25rem 0.625rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '9999px',
        }}
      >
        <span>{em("⚠️ Không thể tự động lưu")}</span>
        {onReload && (
          <button
            type="button"
            onClick={onReload}
            style={{
              background: '#b91c1c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.125rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {em("Tải lại bản mới nhất")}</button>
        )}
      </span>
    );
  }

  return null;
}
