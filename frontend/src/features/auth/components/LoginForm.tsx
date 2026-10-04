import React from 'react';
import { useNavigate } from 'react-router-dom';

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const LoginForm = () => {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Gắn logic gọi API đăng nhập vào đây
    navigate('/student/dashboard');
  };

  return (
    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Email của bạn</label>
        <input type="email" className="input-field" placeholder="john.doe@example.com" />
      </div>
      
      <div>
        <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Mật khẩu</label>
          <span style={{ fontSize: '0.875rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>Quên mật khẩu?</span>
        </div>
        <input type="password" className="input-field" placeholder="••••••••" />
      </div>

      <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '1rem' }}>
        Đăng nhập ngay
      </button>
      
      <div className="flex-center" style={{ gap: '1rem', margin: '1rem 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>HOẶC</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
      </div>

      <button type="button" className="btn" style={{ padding: '0.875rem', background: 'white', border: '1px solid var(--border-dark)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}>
        <GoogleIcon /> Đăng nhập với Google
      </button>
    </form>
  );
};

export default LoginForm;
