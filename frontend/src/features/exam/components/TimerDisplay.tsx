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
        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: '0.5rem', color: '#10B981', fontSize: '0.75rem', fontWeight: 500,
        fontFamily: 'var(--font-heading)',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981',
          display: 'inline-block', animation: 'pulse 2s infinite',
        }} />
        Practice Mode
      </div>
    );
  }

  const seconds = parseToSeconds(displayTime);
  const isWarning = !isExpired && seconds <= 300; // 5 min
  const isDanger = isExpired || seconds <= 60;    // 1 min

  const bgColor = isDanger ? 'rgba(239,68,68,0.1)' : isWarning ? 'rgba(245,158,11,0.1)' : 'rgba(30,41,59,0.8)';
  const borderColor = isDanger ? 'rgba(239,68,68,0.4)' : isWarning ? 'rgba(245,158,11,0.4)' : '#334155';
  const textColor = isDanger ? '#EF4444' : isWarning ? '#F59E0B' : '#cbd5e1';
  const icon = isDanger ? '🔴' : isWarning ? '⚠️' : '⏱';

  return (
    <div
      className={isDanger ? 'timer-display timer-expired danger' : 'timer-display'}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        background: bgColor, border: `1px solid ${borderColor}`,
        borderRadius: '0.5rem', color: textColor,
        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem',
        fontVariantNumeric: 'tabular-nums',
        animation: isDanger ? 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        transition: 'all 0.3s',
      }}
      aria-live="polite"
      aria-label={`Thời gian còn lại: ${displayTime}`}
    >
      <span>{icon}</span>
      {displayTime}
    </div>
  );
}
