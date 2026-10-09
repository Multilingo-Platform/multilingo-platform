import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { authApi } from '../api/authApi';
import { setCredentials } from '../store/authSlice';
import type { LoginRequest } from '../types';
import { alertUtil } from '../../../utils/alert';
import { useTranslation } from 'react-i18next';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const LoginForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
          <span style={{ fontSize: '0.825rem', color: '#c25e2e', cursor: 'pointer', fontWeight: 600 }}>{t('auth.forgot_password')}</span>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input-field"
          placeholder="••••••••"
          required
        />
      </div>

      <button type="submit" className="auth-btn-terracotta" style={{ marginTop: '0.2rem' }} disabled={loginMutation.isPending}>
        {loginMutation.isPending ? t('auth.processing') : t('auth.login_btn')}
      </button>

      <div className="flex-center" style={{ gap: '0.75rem', margin: '0.45rem 0' }}>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>{t('auth.or')}</span>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
      </div>

      <button type="button" className="auth-btn-google">
        <GoogleIcon /> {t('auth.login_google')}
      </button>
    </form>
  );
};

export default LoginForm;
