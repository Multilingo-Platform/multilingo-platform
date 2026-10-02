import React from 'react';
import { TimeUpOverlay } from './modals/TimeUpOverlay';

export { TimeUpOverlay };

export interface TimeUpModalProps {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  error?: string | null;
  onRetry?: () => void;
}

export const TimeUpModal: React.FC<TimeUpModalProps> = ({
  open,
  isSubmitting,
  onClose,
  error,
  onRetry,
}) => {
  return (
    <TimeUpOverlay
      isExpired={open}
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={() => {}}
      onRetry={onRetry}
      onNavigateToResult={onClose}
    />
  );
};
