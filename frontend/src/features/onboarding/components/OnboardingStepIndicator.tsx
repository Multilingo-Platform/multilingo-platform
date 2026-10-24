import React from 'react';

interface OnboardingStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
}

export const OnboardingStepIndicator: React.FC<OnboardingStepIndicatorProps> = ({
  currentStep,
  totalSteps,
  stepTitles,
}) => {
  const percentage = Math.round((currentStep / totalSteps) * 100);
  const currentTitle = stepTitles[currentStep - 1] || '';

  return (
    <div className="onboarding-progress-wrapper" aria-label="Tiến trình thiết lập">
      <div className="onboarding-steps-header">
        <span className="onboarding-step-badge">
          Bước {currentStep} / {totalSteps}: {currentTitle}
        </span>
        <span className="onboarding-step-percent">{percentage}% hoàn thành</span>
      </div>
      <div className="onboarding-progress-bar-bg" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <div 
          className="onboarding-progress-bar-fill" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
