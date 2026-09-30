interface SubmitOverlayProps {
  visible: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}

const SpinnerSvg = () => (
  <svg style={{ animation: 'spin 1s linear infinite', height: '2.5rem', width: '2.5rem' }} viewBox="0 0 24 24" fill="none">
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
    <path style={{ opacity: 0.75 }} fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export function SubmitOverlay({ visible, isRetrying, onRetry }: SubmitOverlayProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, gap: '1.5rem', padding: '2rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {isRetrying ? (
        <>
          <SpinnerSvg />
          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.5rem', color: '#F8FAFC', margin: '0 0 0.5rem',
            }}>
              Đang nộp bài...
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Vui lòng không đóng trình duyệt.</p>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '4rem', textAlign: 'center', lineHeight: 1 }}>⏰</div>
          <div style={{ textAlign: 'center', maxWidth: '320px' }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.5rem', color: '#F8FAFC', margin: '0 0 0.5rem',
            }}>
              Hết thời gian!
            </h2>
            <p style={{ color: '#fca5a5', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Nộp bài thất bại — kiểm tra kết nối mạng và thử lại.
            </p>
            <button
              id="btn-retry-submit"
              onClick={onRetry}
              style={{
                padding: '0.75rem 2rem',
                borderRadius: '0.75rem', border: 'none',
                background: '#2151DA', color: 'white',
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem',
                boxShadow: '0 4px 16px rgba(33,81,218,0.4)',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1a3fb5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2151DA'; }}
            >
              🔄 Thử nộp lại
            </button>
          </div>
        </>
      )}
    </div>
  );
}
