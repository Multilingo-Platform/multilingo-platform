interface TimerDisplayProps {
  displayTime: string;
  isExpired: boolean;
  isPractice: boolean;
}

function parseToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export function TimerDisplay({ displayTime, isExpired, isPractice }: TimerDisplayProps) {
  if (isPractice) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.375rem 0.75rem',
        background: '#ecfdf5', border: '1px solid #a7f3d0',
        borderRadius: '9999px', color: '#065f46', fontSize: '0.75rem', fontWeight: 600,
        fontFamily: 'var(--font-heading)',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981',
          display: 'inline-block', animation: 'pulse 2s infinite',
        }} />
        Practice Mode
      </div>
    );
  }

  const seconds = parseToSeconds(displayTime);
  const isWarning = !isExpired && seconds <= 300; // 5 min
  const isDanger = isExpired || seconds <= 60;    // 1 min

  const bgColor = isDanger ? '#fee2e2' : isWarning ? '#fef3c7' : '#fffbeb';
  const borderColor = isDanger ? '#f87171' : isWarning ? '#f59e0b' : '#fde68a';
  const textColor = isDanger ? '#b91c1c' : isWarning ? '#92400e' : '#b45309';
  const icon = isDanger ? '🔴' : isWarning ? '⚠️' : '⏱️';

  return (
    <div
      className={isDanger ? 'timer-display timer-expired danger' : 'timer-display'}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.375rem',
        padding: '0.375rem 0.875rem',
        background: bgColor, border: `1px solid ${borderColor}`,
        borderRadius: '9999px', color: textColor,
        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem',
        fontVariantNumeric: 'tabular-nums',
        animation: isDanger ? 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        transition: 'all 0.3s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
      aria-live="polite"
      aria-label={`Thời gian còn lại: ${displayTime}`}
    >
      <span>{icon}</span>
      {displayTime}
    </div>
  );
}
