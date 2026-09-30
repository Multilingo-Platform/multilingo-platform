import { useSelector } from 'react-redux';
import { selectSaveStatus } from '../store/answerSlice';
import type { RootState } from '../../../store/store';

export function SaveStatusBadge() {
  const { saveStatus } = useSelector((state: RootState) => selectSaveStatus(state));

  if (saveStatus === 'idle') return null;
  const map = {
    saving: { icon: '⟳', text: 'Đang lưu...', color: '#6b7280' },
    saved:  { icon: '✓', text: 'Đã lưu', color: '#16a34a' },
    error:  { icon: '⚠', text: 'Đang thử lại...', color: '#d97706' },
  } as const;
  const { icon, text, color } = map[saveStatus];
  return (
    <span style={{ fontSize: '0.8rem', color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {icon} {text}
    </span>
  );
}
