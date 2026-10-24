import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { authApi } from '../api/authApi';
import { setCredentials } from '../store/authSlice';
import type { RegisterRequest } from '../types';
import { alertUtil } from '../../../utils/alert';
import { useTranslation } from 'react-i18next';

const RegisterForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
        } else {
          navigate('/student/dashboard');
        }
      }
    },
    onError: (error: any) => {
      alertUtil.toast(error?.response?.data?.message || t('auth.login_failed'), 'error');
    }
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
    onSuccess: (res: any) => {
      if (res.success) {
        alertUtil.popup(t('auth.register_success'), 'success');
        navigate('/login');
      }
    },
    onError: (error: any) => {
      alertUtil.toast(error?.response?.data?.message || t('auth.register_failed'), 'error');
    }
  });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alertUtil.toast(t('auth.password_mismatch'), 'warning');
      return;
    }
    registerMutation.mutate({ fullName, phone, email, passwordHash: password });
  };

  return (
    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
            {t('auth.fullname_label')}
          </label>
          <input 
            type="text" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="auth-input-field" 
            placeholder="Nguyễn Văn A" 
            required 
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
            {t('auth.phone_label')}
          </label>
          <input 
            type="tel" 
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="auth-input-field" 
            placeholder="0912 345 678" 
          />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
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
      
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
            {t('auth.password_label')}
          </label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input-field" 
              style={{ paddingRight: '2.4rem' }}
              placeholder="••••••••" 
              required 
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '0.65rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: '0.2rem',
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
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
            {t('auth.confirm_password_label')}
          </label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showConfirmPassword ? 'text' : 'password'} 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="auth-input-field" 
              style={{ paddingRight: '2.4rem' }}
              placeholder="••••••••" 
              required 
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: 'absolute',
                right: '0.65rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                cursor: 'pointer',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#4b5563'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
              aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
      </div>

      <button type="submit" className="auth-btn-terracotta" style={{ marginTop: '0.2rem' }} disabled={registerMutation.isPending}>
        {registerMutation.isPending ? t('auth.processing') : t('auth.register_btn')}
      </button>
      
      <div className="flex-center" style={{ gap: '0.75rem', margin: '0.45rem 0' }}>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
        <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600 }}>{t('auth.or')}</span>
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
          text="signup_with"
          shape="rectangular"
          theme="outline"
          size="large"
          width="400"
        />
      </div>
    </form>
  );
};

export default RegisterForm;
