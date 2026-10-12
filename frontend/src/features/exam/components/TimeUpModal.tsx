import React from 'react';
import { TimeUpOverlay } from './modals/TimeUpOverlay';

export { TimeUpOverlay };

export interface TimeUpModalProps {
  open: boolean;
  isSubmitting: boolean;
  onClose?: () => void;
  error?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  draftWarning?: string | null;
}

export const TimeUpModal: React.FC<TimeUpModalProps> = ({
  open,
  isSubmitting,
  onClose,
  error,
  onRetry,
  retryLabel,
  draftWarning,
}) => {
  return (
    <TimeUpOverlay
      isExpired={open}
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={() => {}}
      onRetry={onRetry}
      retryLabel={retryLabel}
      draftWarning={draftWarning}
      onNavigateToResult={onClose}
    />
  );
};
