interface SubmitOverlayProps {
  visible: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}

export function SubmitOverlay({ visible, isRetrying, onRetry }: SubmitOverlayProps) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        color: 'white',
        gap: 16,
      }}
    >
      <h2>⏰ Hết thời gian!</h2>
      {isRetrying ? (
        <p>Đang nộp bài...</p>
      ) : (
        <>
          <p style={{ color: '#fca5a5' }}>Nộp bài thất bại — kiểm tra kết nối mạng.</p>
          <button
            onClick={onRetry}
            style={{
              padding: '8px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Thử nộp lại
          </button>
        </>
      )}
    </div>
  );
}
