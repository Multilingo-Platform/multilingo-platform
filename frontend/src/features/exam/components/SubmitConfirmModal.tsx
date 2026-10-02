interface SubmitConfirmModalProps {
  open: boolean;
  unansweredCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitConfirmModal({ open, unansweredCount, onConfirm, onCancel }: SubmitConfirmModalProps) {
  if (!open) return null;

  const hasUnanswered = unansweredCount > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 999, padding: '1rem',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '1.25rem',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease-out',
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <div style={{
            width: '2.5rem', height: '2.5rem', borderRadius: '50%',
            background: '#fffbeb', border: '1px solid #fde68a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', flexShrink: 0, color: '#d97706',
          }}>
            🚀
          </div>
          <h3
            id="submit-modal-title"
            style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#111827', fontSize: '1.1rem' }}
          >
            Xác nhận nộp bài thi
          </h3>
        </div>

        {/* Modal body */}
        <div style={{ padding: '1.25rem 1.5rem' }}>
          {hasUnanswered && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem',
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: '0.75rem', marginBottom: '1rem',
              animation: 'fadeIn 0.2s ease-out',
            }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#b45309', fontSize: '0.875rem', marginBottom: '0.125rem' }}>
                  Còn {unansweredCount} câu chưa trả lời
                </div>
                <div style={{ color: '#92400e', fontSize: '0.75rem' }}>
                  Các câu bỏ trống sẽ không được tính điểm.
                </div>
              </div>
            </div>
          )}
          <p style={{ color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
            Sau khi nộp bài, hệ thống sẽ kết thúc bài thi và chuyển sang báo cáo chấm điểm. Bạn <strong style={{ color: '#111827' }}>không thể chỉnh sửa lại</strong> các câu trả lời. Tiếp tục nộp bài?
          </p>
        </div>

        {/* Modal footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #f3f4f6',
          display: 'flex', gap: '0.75rem',
          background: '#f9fafb',
        }}>
          <button
            id="btn-confirm-submit"
            onClick={onConfirm}
            style={{
              flex: 1, padding: '0.75rem',
              background: '#d97706', color: '#ffffff',
              border: 'none', borderRadius: '0.75rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#b45309'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#d97706'; }}
          >
            Nộp bài ngay
          </button>
          <button
            id="btn-cancel-submit"
            onClick={onCancel}
            style={{
              flex: 1, padding: '0.75rem',
              background: '#ffffff', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: '0.75rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.875rem',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ffffff'; }}
          >
            Tiếp tục làm bài
          </button>
        </div>
      </div>
    </div>
  );
}
