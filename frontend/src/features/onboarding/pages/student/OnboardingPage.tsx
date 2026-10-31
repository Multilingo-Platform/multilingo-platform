import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { OnboardingStepIndicator } from '../../components/OnboardingStepIndicator';
import { Step1LanguageSelect } from '../../components/Step1LanguageSelect';
import { Step2CertificateGoal } from '../../components/Step2CertificateGoal';
import { Step4RoadmapSummary } from '../../components/Step4RoadmapSummary';
import { onboardingApi } from '../../api/onboardingApi';
import type { OnboardingData, TargetCertificate, LearnerLevel } from '../../types';
import { alertUtil } from '../../../../utils/alert';
import { updateUser } from '../../../auth/store/authSlice';
import LanguageSwitcher from '../../../../components/common/LanguageSwitcher';
import '../../components/Onboarding.css';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';

  const isEnInterface = i18n.language === 'en';

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);

  const [formData, setFormData] = useState<OnboardingData>(() => ({
    nativeLanguage: isEnInterface ? 'en' : 'vi',
    targetLanguage: isEnInterface ? 'vi' : 'en',
    targetCertificate: isEnInterface ? 'NLTV' : 'IELTS_ACADEMIC',
    targetScore: isEnInterface ? 4.0 : 7.0,
    dailyMinutes: 30,
    currentLevel: 'INTERMEDIATE',
  }));

  const stepTitles = [
    t('onboarding.steps.language', 'Chọn Ngôn Ngữ'),
    t('onboarding.steps.certificate', 'Mục Tiêu Chứng Chỉ'),
    t('onboarding.steps.roadmap', 'Lộ Trình Cá Nhân'),
  ];

  // Đồng bộ với ngôn ngữ giao diện đã chọn ở Header khi chưa đăng nhập / vừa chuyển ngôn ngữ ở Bước 1
  useEffect(() => {
    if (!isEditMode && currentStep === 1) {
      const isEn = i18n.language === 'en';
      setFormData((prev) => ({
        ...prev,
        nativeLanguage: isEn ? 'en' : 'vi',
        targetLanguage: isEn ? 'vi' : 'en',
        targetCertificate: isEn ? 'NLTV' : 'IELTS_ACADEMIC',
        targetScore: isEn ? 4.0 : 7.0,
      }));
    }
  }, [i18n.language, isEditMode, currentStep]);

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
            if (res.data.hasCompletedOnboarding) {
              setFormData({
                nativeLanguage: res.data.nativeLanguage || (isEnInterface ? 'en' : 'vi'),
                targetLanguage: res.data.targetLanguage || (isEnInterface ? 'vi' : 'en'),
                targetCertificate: (res.data.targetCertificate as TargetCertificate) || (isEnInterface ? 'NLTV' : 'IELTS_ACADEMIC'),
                targetScore: res.data.targetScore ?? (isEnInterface ? 4.0 : 7.0),
                dailyMinutes: res.data.dailyMinutes ?? 30,
                currentLevel: (res.data.currentLevel as LearnerLevel) || 'INTERMEDIATE',
              });
              if (!isEditMode) {
                navigate('/student/dashboard');
                return;
              }
            } else {
              // Người dùng chưa hoàn thành onboarding: ưu tiên ngôn ngữ đã chọn trên header
              const isEn = i18n.language === 'en';
              setFormData((prev) => ({
                ...prev,
                nativeLanguage: res.data?.targetLanguage ? (res.data.nativeLanguage || (isEn ? 'en' : 'vi')) : (isEn ? 'en' : 'vi'),
                targetLanguage: res.data?.targetLanguage ? res.data.targetLanguage : (isEn ? 'vi' : 'en'),
                targetCertificate: (res.data?.targetCertificate as TargetCertificate) || (isEn ? 'NLTV' : 'IELTS_ACADEMIC'),
                targetScore: res.data?.targetScore ?? (isEn ? 4.0 : 7.0),
                dailyMinutes: res.data?.dailyMinutes ?? prev.dailyMinutes,
                currentLevel: (res.data?.currentLevel as LearnerLevel) || prev.currentLevel,
              }));
            }
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
  }, [navigate, isEditMode, isEnInterface, i18n.language]);

  const handleNext = () => {
    if (currentStep === 1) {
      if (formData.nativeLanguage === formData.targetLanguage) {
        alertUtil.toast(t('onboarding.toasts.same_lang', 'Ngôn ngữ mẹ đẻ và ngôn ngữ muốn học không được trùng nhau!'), 'warning');
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
          isEditMode
            ? t('onboarding.toasts.success_update', 'Cập nhật mục tiêu học tập thành công!')
            : t('onboarding.toasts.success_create', 'Thiết lập mục tiêu học tập thành công!'),
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
        alertUtil.toast(res.message || t('onboarding.toasts.failed', 'Thiết lập không thành công'), 'error');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || t('onboarding.toasts.error_default', 'Có lỗi xảy ra khi lưu mục tiêu');
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
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('onboarding.loading', 'Đang tải thiết lập mục tiêu...')}</span>
        </div>
      </div>
    );
  }

  const isSameLanguage = formData.nativeLanguage === formData.targetLanguage;

  return (
    <div className="onboarding-page-wrapper" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', zIndex: 30 }}>
        <LanguageSwitcher />
      </div>

      <main className="onboarding-card">
        <OnboardingStepIndicator
          currentStep={currentStep}
          totalSteps={3}
          stepTitles={stepTitles}
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
              <span>{t('onboarding.actions.back', 'Quay lại')}</span>
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
              <span>{t('onboarding.actions.continue', 'Tiếp tục')}</span>
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
                  <span>{isEditMode ? t('onboarding.actions.submitting_update', 'Đang cập nhật...') : t('onboarding.actions.submitting_start', 'Đang khởi tạo...')}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>{isEditMode ? t('onboarding.actions.update_goal', 'Cập nhật mục tiêu') : t('onboarding.actions.start_journey', 'Bắt đầu hành trình học')}</span>
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
