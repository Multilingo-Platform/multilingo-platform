interface SubmitConfirmModalProps {
  open: boolean;
  unansweredCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitConfirmModal({ open, unansweredCount, onConfirm, onCancel }: SubmitConfirmModalProps) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
    >
      <div
        style={{
          background: 'white',
          padding: 32,
          borderRadius: 12,
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 style={{ marginTop: 0, fontSize: '1.25rem', color: '#111827' }}>Xác nhận nộp bài</h3>
        {unansweredCount > 0 && (
          <p style={{ color: '#d97706', fontWeight: '500' }}>
            Bạn còn {unansweredCount} câu chưa trả lời.
          </p>
        )}
        <p style={{ color: '#4b5563', fontSize: '0.95rem' }}>
          Sau khi nộp bài, bạn không thể chỉnh sửa đáp án. Tiếp tục?
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            Nộp bài
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            Tiếp tục làm bài
          </button>
        </div>
      </div>
    </div>
  );
}
