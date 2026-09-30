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
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 999, padding: '1rem',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        style={{
          background: '#1E293B',
          border: '1px solid #334155',
          borderRadius: '1.25rem',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease-out',
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <div style={{
            width: '2.5rem', height: '2.5rem', borderRadius: '50%',
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', flexShrink: 0,
          }}>
            🚀
          </div>
          <h3
            id="submit-modal-title"
            style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#F8FAFC', fontSize: '1rem' }}
          >
            Xác nhận nộp bài
          </h3>
        </div>

        {/* Modal body */}
        <div style={{ padding: '1.25rem 1.5rem' }}>
          {hasUnanswered && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '0.75rem', marginBottom: '1rem',
              animation: 'fadeIn 0.2s ease-out',
            }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: '#F59E0B', fontSize: '0.875rem', marginBottom: '0.125rem' }}>
                  Còn {unansweredCount} câu chưa trả lời
                </div>
                <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>
                  Câu bỏ trống sẽ tính là 0 điểm.
                </div>
              </div>
            </div>
          )}
          <p style={{ color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
            Sau khi nộp bài, bạn <strong style={{ color: '#F8FAFC' }}>không thể chỉnh sửa</strong> đáp án. Tiếp tục nộp bài?
          </p>
        </div>

        {/* Modal footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #334155',
          display: 'flex', gap: '0.75rem',
        }}>
          <button
            id="btn-confirm-submit"
            onClick={onConfirm}
            style={{
              flex: 1, padding: '0.75rem',
              background: '#EF4444', color: 'white',
              border: 'none', borderRadius: '0.75rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem',
              boxShadow: '0 4px 16px rgba(239,68,68,0.25)',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#dc2626'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#EF4444'; }}
          >
            Nộp bài ngay
          </button>
          <button
            id="btn-cancel-submit"
            onClick={onCancel}
            style={{
              flex: 1, padding: '0.75rem',
              background: '#263549', color: '#cbd5e1',
              border: '1px solid #334155', borderRadius: '0.75rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.875rem',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2d3f55'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#263549'; }}
          >
            Tiếp tục làm bài
          </button>
        </div>
      </div>
    </div>
  );
}
