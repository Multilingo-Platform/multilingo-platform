interface TimerDisplayProps {
  displayTime: string;
  isExpired: boolean;
  isPractice: boolean;
}

export function TimerDisplay({ displayTime, isExpired, isPractice }: TimerDisplayProps) {
  if (isPractice) return null;
  return (
    <div
      className={`timer-display ${isExpired ? 'timer-expired danger' : ''}`}
      style={{
        color: isExpired ? '#dc2626' : undefined,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 'bold',
        fontSize: '1.25rem',
      }}
    >
      ⏱ {displayTime}
    </div>
  );
}
