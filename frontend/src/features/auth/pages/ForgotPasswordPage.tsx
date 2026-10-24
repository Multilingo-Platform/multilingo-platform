import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react';
import { authApi } from '../api/authApi';
import AuthLayout from '../layouts/AuthLayout';
import { alertUtil } from '../../../utils/alert';
import { useTranslation } from 'react-i18next';

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Wizard state: 1 = Enter Email, 2 = Enter OTP, 3 = Reset Password
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 60-second cooldown timer
  const [countdown, setCountdown] = useState(60);
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isCounting && countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    } else if (countdown === 0) {
      setIsCounting(false);
    }
    return () => clearTimeout(timer);
  }, [isCounting, countdown]);

  const forgotMutation = useMutation({
    mutationFn: async (targetEmail: string) => {
      const res = await authApi.forgotPassword({ email: targetEmail.trim() });
      return res;
    },
    onSuccess: (res: any) => {
      if (res.success) {
        alertUtil.toast(t('auth.otp_sent_success'), 'success');
        setStep(2);
        setCountdown(60);
        setIsCounting(true);
      }
    },
    onError: (error: any) => {
      alertUtil.toast(error?.response?.data?.message || t('auth.login_failed'), 'error');
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await authApi.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });
      return res;
    },
    onSuccess: (res: any) => {
      if (res.success) {
        alertUtil.toast(t('auth.reset_password_success'), 'success');
        navigate('/login');
      }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('auth.login_failed');
      alertUtil.toast(msg, 'error');
      // If OTP failed or expired, return back to OTP step
      if (error?.response?.data?.code === 921 || error?.response?.data?.code === 922 || error?.response?.data?.code === 924) {
        setStep(2);
      }
    },
  });

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    forgotMutation.mutate(email);
  };

  const handleResendOtp = () => {
    if (countdown === 0) {
      forgotMutation.mutate(email);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      alertUtil.toast(t('auth.otp_required'), 'error');
      return;
    }
    setStep(3);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      alertUtil.toast(t('auth.password_min_length'), 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      alertUtil.toast(t('auth.password_mismatch'), 'error');
      return;
    }
    resetMutation.mutate();
  };

  const getSubtitle = () => {
    if (step === 1) return t('auth.forgot_password_desc_step1');
    if (step === 2) return t('auth.forgot_password_desc_step2');
    return t('auth.forgot_password_desc_step3');
  };

  return (
    <AuthLayout
      title={t('auth.forgot_password_title')}
      subtitle={getSubtitle()}
      isLogin={true}
      onToggleMode={() => navigate('/login')}
    >
      {/* Step 1: Nhập email */}
      {step === 1 && (
        <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              {t('auth.email_label')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input-field"
              placeholder="john.doe@example.com"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="auth-btn-terracotta"
            disabled={forgotMutation.isPending || !email.trim()}
            style={{ marginTop: '0.35rem' }}
          >
            {forgotMutation.isPending ? t('auth.processing') : t('auth.send_otp_btn')}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#1f2937')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
            >
              ← {t('auth.back_to_login')}
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Nhập mã OTP */}
      {step === 2 && (
        <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Card hiển thị email sang trọng */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '0.75rem 0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#fef3eb',
                  color: '#c25e2e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Mail size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                  {t('auth.otp_sent_to')}
                </div>
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#0f172a',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={email}
                >
                  {email}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#475569',
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#c25e2e';
                e.currentTarget.style.color = '#c25e2e';
                e.currentTarget.style.background = '#fef3eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.color = '#475569';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              {t('auth.change_email')}
            </button>
          </div>

          {/* Ô nhập OTP 6 chữ số */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              {t('auth.otp_label')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="auth-input-field"
              placeholder="------"
              style={{
                letterSpacing: '14px',
                textAlign: 'center',
                fontSize: '1.5rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                color: '#0f172a',
              }}
              autoFocus
              required
            />
          </div>

          {/* Cooldown / Gửi lại OTP */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {countdown > 0 ? (
              <span style={{ fontSize: '0.825rem', color: '#94a3b8', fontWeight: 500 }}>
                {t('auth.resend_otp_countdown', { count: countdown })}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={forgotMutation.isPending}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#c25e2e',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                {t('auth.resend_otp_now')}
              </button>
            )}
          </div>

          <button
            type="submit"
            className="auth-btn-terracotta"
            disabled={otp.length !== 6}
            style={{ marginTop: '0.25rem' }}
          >
            {t('auth.continue_btn')}
          </button>
        </form>
      )}

      {/* Step 3: Nhập mật khẩu mới & xác nhận */}
      {step === 3 && (
        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          {/* Mật khẩu mới */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              {t('auth.new_password_label')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="auth-input-field"
                style={{ paddingRight: '2.5rem' }}
                placeholder="••••••••"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9ca3af',
                  cursor: 'pointer',
                }}
                aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu mới */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              {t('auth.confirm_new_password_label')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="auth-input-field"
                style={{ paddingRight: '2.5rem' }}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9ca3af',
                  cursor: 'pointer',
                }}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.3rem', fontWeight: 500 }}>
                {t('auth.password_mismatch')}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="auth-btn-terracotta"
            disabled={
              resetMutation.isPending ||
              newPassword.length < 6 ||
              newPassword !== confirmPassword
            }
            style={{ marginTop: '0.35rem' }}
          >
            {resetMutation.isPending ? t('auth.processing') : t('auth.save_new_password_btn')}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0f172a')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
            >
              <ArrowLeft size={14} /> {t('auth.back_to_otp')}
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordPage;

