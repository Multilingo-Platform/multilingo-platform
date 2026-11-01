import React from 'react';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  const percentage = Math.round((currentStep / totalSteps) * 100);
  const currentTitle = stepTitles[currentStep - 1] || '';
  const isEn = i18n.language === 'en';

  const badgeText = isEn
    ? `Step ${currentStep} of ${totalSteps}: ${currentTitle}`
    : `Bước ${currentStep} / ${totalSteps}: ${currentTitle}`;

  const percentText = isEn
    ? `${percentage}% completed`
    : `${percentage}% hoàn thành`;

  return (
    <div className="onboarding-progress-wrapper" aria-label={isEn ? "Setup Progress" : "Tiến trình thiết lập"}>
      <div className="onboarding-steps-header">
        <span className="onboarding-step-badge">{badgeText}</span>
        <span className="onboarding-step-percent">{percentText}</span>
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
