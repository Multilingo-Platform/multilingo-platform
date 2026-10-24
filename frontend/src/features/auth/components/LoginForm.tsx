import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { authApi } from '../api/authApi';
import { setCredentials } from '../store/authSlice';
import type { LoginRequest } from '../types';
import { alertUtil } from '../../../utils/alert';
import { useTranslation } from 'react-i18next';

const LoginForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const googleLoginMutation = useMutation({
    mutationFn: async (idToken: string) => {
      const loginRes = await authApi.loginWithGoogle({ idToken });
      if (loginRes.success) {
        localStorage.setItem('token', loginRes.data.accessToken);
        const userRes = await authApi.getMyInfo();
        return {
          success: true,
          data: {
            accessToken: loginRes.data.accessToken,
            user: userRes.data
          }
        };
      }
      return loginRes;
    },
    onSuccess: (res: any) => {
      if (res.success) {
        alertUtil.toast(t('auth.login_success'), 'success');
        dispatch(setCredentials(res.data));
        
        if (res.data?.user?.role === 'ADMIN') {
          navigate('/admin/dashboard');
        } else if (res.data?.user?.hasCompletedOnboarding === false) {
          navigate('/onboarding');
        } else {
          navigate('/student/dashboard');
        }
      }
    },
    onError: (error: any) => {
      alertUtil.toast(error?.response?.data?.message || t('auth.login_failed'), 'error');
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginRequest) => {
      const loginRes = await authApi.login(data);
      if (loginRes.success) {
        // Tạm thời lưu token để interceptor có thể nhét vào header cho request /users/me
        localStorage.setItem('token', loginRes.data.accessToken);
        const userRes = await authApi.getMyInfo();
        return {
          success: true,
          data: {
            accessToken: loginRes.data.accessToken,
            user: userRes.data
          }
        };
      }
      return loginRes;
    },
    onSuccess: (res: any) => {
      if (res.success) {
        alertUtil.toast(t('auth.login_success'), 'success');
        dispatch(setCredentials(res.data));
        
        // Redirect based on role
        if (res.data?.user?.role === 'ADMIN') {
          navigate('/admin/dashboard');
        } else if (res.data?.user?.hasCompletedOnboarding === false) {
          navigate('/onboarding');
        } else {
          navigate('/student/dashboard');
        }
      }
    },
    onError: (error: any) => {
      alertUtil.toast(error?.response?.data?.message || t('auth.login_failed'), 'error');
    }
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
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
          required
        />
      </div>

      <div>
        <div className="flex-between" style={{ marginBottom: '0.35rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>{t('auth.password_label')}</label>
          <span
            onClick={() => navigate('/forgot-password')}
            style={{ fontSize: '0.825rem', color: '#c25e2e', cursor: 'pointer', fontWeight: 600 }}
          >
            {t('auth.forgot_password')}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input-field"
            style={{ paddingRight: '2.5rem' }}
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
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
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#4b5563'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <button type="submit" className="auth-btn-terracotta" style={{ marginTop: '0.2rem' }} disabled={loginMutation.isPending}>
        {loginMutation.isPending ? t('auth.processing') : t('auth.login_btn')}
      </button>

      <div className="flex-center" style={{ gap: '0.75rem', margin: '0.45rem 0' }}>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>{t('auth.or')}</span>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
      </div>

      <div className="auth-google-btn-container">
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) {
              googleLoginMutation.mutate(credentialResponse.credential);
            }
          }}
          onError={() => {
            alertUtil.toast(t('auth.login_failed'), 'error');
          }}
          text="signin_with"
          shape="rectangular"
          theme="outline"
          size="large"
          width="400"
        />
      </div>
    </form>
  );
};

export default LoginForm;
