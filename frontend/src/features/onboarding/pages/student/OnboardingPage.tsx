import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { OnboardingStepIndicator } from '../../components/OnboardingStepIndicator';
import { Step1LanguageSelect } from '../../components/Step1LanguageSelect';
import { Step2CertificateGoal } from '../../components/Step2CertificateGoal';
import { Step4RoadmapSummary } from '../../components/Step4RoadmapSummary';
import { onboardingApi } from '../../api/onboardingApi';
import type { OnboardingData, TargetCertificate, LearnerLevel } from '../../types';
import { alertUtil } from '../../../../utils/alert';
import { updateUser } from '../../../auth/store/authSlice';
import '../../components/Onboarding.css';

const STEP_TITLES = [
  'Chọn Ngôn Ngữ',
  'Mục Tiêu Chứng Chỉ',
  'Lộ Trình Cá Nhân',
];

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);

  const [formData, setFormData] = useState<OnboardingData>({
    nativeLanguage: 'vi',
    targetLanguage: 'en',
    targetCertificate: 'IELTS_ACADEMIC',
    targetScore: 7.0,
    dailyMinutes: 30,
    currentLevel: 'INTERMEDIATE',
  });

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const res = await onboardingApi.getStatus();
        if (isMounted) {
          if (res.data) {
            setFormData((prev) => ({
              nativeLanguage: res.data.nativeLanguage || prev.nativeLanguage,
              targetLanguage: res.data.targetLanguage || prev.targetLanguage,
              targetCertificate: (res.data.targetCertificate as TargetCertificate) || prev.targetCertificate,
              targetScore: res.data.targetScore ?? prev.targetScore,
              dailyMinutes: res.data.dailyMinutes ?? prev.dailyMinutes,
              currentLevel: (res.data.currentLevel as LearnerLevel) || prev.currentLevel,
            }));
          }

          if (res.data?.hasCompletedOnboarding && !isEditMode) {
            navigate('/student/dashboard');
          }
        }
      } catch (err) {
        // If unauthenticated or token expired, redirect to login
        console.warn('Lỗi kiểm tra trạng thái onboarding:', err);
      } finally {
        if (isMounted) {
          setCheckingStatus(false);
        }
      }
    };

    checkStatus();
    return () => {
      isMounted = false;
    };
  }, [navigate, isEditMode]);

  const handleNext = () => {
    if (currentStep === 1) {
      if (formData.nativeLanguage === formData.targetLanguage) {
        alertUtil.toast('Ngôn ngữ mẹ đẻ và ngôn ngữ muốn học không được trùng nhau!', 'warning');
        return;
      }
    }
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await onboardingApi.submitOnboarding(formData);
      if (res.code === 200 || res.data) {
        alertUtil.toast(
          isEditMode ? 'Cập nhật mục tiêu học tập thành công!' : 'Thiết lập mục tiêu học tập thành công!',
          'success'
        );

        // Invalidate react-query caches so dashboard and exam library refresh immediately
        await queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
        await queryClient.invalidateQueries({ queryKey: ['student-dashboard-streak'] });
        await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
        await queryClient.invalidateQueries({ queryKey: ['myInfo'] });

        // Synchronize Redux auth state
        const currentUserStr = localStorage.getItem('user');
        if (currentUserStr && res.data) {
          try {
            const parsed = JSON.parse(currentUserStr);
            const updated = {
              ...parsed,
              hasCompletedOnboarding: true,
              nativeLanguage: res.data.nativeLanguage,
              targetLanguage: res.data.targetLanguage,
            };
            dispatch(updateUser(updated));
          } catch (e) {
            // ignore JSON parse error
          }
        }

        navigate('/student/dashboard');
      } else {
        alertUtil.toast(res.message || 'Thiết lập không thành công', 'error');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Có lỗi xảy ra khi lưu mục tiêu';
      alertUtil.toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="onboarding-page-wrapper">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: '#6366f1' }}>
          <Loader2 className="animate-spin" size={40} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Đang tải thiết lập mục tiêu...</span>
        </div>
      </div>
    );
  }

  const isSameLanguage = formData.nativeLanguage === formData.targetLanguage;

  return (
    <div className="onboarding-page-wrapper">
      <main className="onboarding-card">
        <OnboardingStepIndicator
          currentStep={currentStep}
          totalSteps={3}
          stepTitles={STEP_TITLES}
        />

        {currentStep === 1 && (
          <Step1LanguageSelect
            nativeLanguage={formData.nativeLanguage}
            targetLanguage={formData.targetLanguage}
            onNativeChange={(lang) => setFormData((prev) => ({ ...prev, nativeLanguage: lang }))}
            onTargetChange={(lang) => setFormData((prev) => ({ ...prev, targetLanguage: lang }))}
          />
        )}

        {currentStep === 2 && (
          <Step2CertificateGoal
            targetLanguage={formData.targetLanguage}
            targetCertificate={formData.targetCertificate}
            targetScore={formData.targetScore}
            onCertChange={(cert: TargetCertificate) => setFormData((prev) => ({ ...prev, targetCertificate: cert }))}
            onScoreChange={(score: number) => setFormData((prev) => ({ ...prev, targetScore: score }))}
          />
        )}

        {currentStep === 3 && <Step4RoadmapSummary data={formData} />}

        <div className="onboarding-actions">
          {currentStep > 1 ? (
            <button
              type="button"
              className="onboarding-btn onboarding-btn-outline"
              onClick={handleBack}
              disabled={submitting}
            >
              <ArrowLeft size={18} />
              <span>Quay lại</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              className="onboarding-btn onboarding-btn-primary"
              onClick={handleNext}
              disabled={currentStep === 1 && isSameLanguage}
            >
              <span>Tiếp tục</span>
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              className="onboarding-btn onboarding-btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>{isEditMode ? 'Đang cập nhật...' : 'Đang khởi tạo...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>{isEditMode ? 'Cập nhật mục tiêu' : 'Bắt đầu hành trình học'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default OnboardingPage;
