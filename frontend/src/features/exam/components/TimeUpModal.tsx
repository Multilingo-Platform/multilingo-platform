interface TimeUpModalProps {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
}

export function TimeUpModal({ open, isSubmitting, onClose }: TimeUpModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: '1rem',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '1.25rem',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease-out',
          textAlign: 'center',
        }}
      >
        <div style={{ padding: '2rem 1.5rem 1.5rem' }}>
          <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: '1rem', animation: 'bounce 1s infinite alternate' }}>
            <style>{`@keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-8px); } }`}</style>
            ⏰
          </div>
          <h3 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#111827', fontSize: '1.25rem' }}>
            Thời gian làm bài đã hết!
          </h3>
          <p style={{ color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
            Hệ thống đã tự động thu bài của bạn. Vui lòng chuyển sang trang kết quả để xem điểm chi tiết.
          </p>
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #f3f4f6',
          background: '#f9fafb',
        }}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              width: '100%', padding: '0.75rem',
              background: isSubmitting ? '#94a3b8' : '#d97706', color: '#ffffff',
              border: 'none', borderRadius: '0.75rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem',
              transition: 'background 0.15s ease',
            }}
          >
            {isSubmitting ? 'Đang nộp bài...' : 'Xem kết quả'}
          </button>
        </div>
      </div>
    </div>
  );
}
