import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);

  // SVG cho Google Icon
  const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  return (
    <div className="flex-center slide-up" style={{ minHeight: 'calc(100vh - 70px)', padding: '2rem', background: 'var(--bg-primary)' }}>
      <div className="ed-card" style={{ display: 'flex', width: '100%', maxWidth: '1000px', overflow: 'hidden', minHeight: '600px' }}>
        
        {/* Left: Illustration */}
        <div style={{ flex: 1, background: 'var(--primary)', padding: '3rem', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem', lineHeight: 1.2 }}>Học tập thông minh hơn!</h2>
          <p style={{ fontSize: '1.125rem', opacity: 0.9, lineHeight: 1.6 }}>Mở khóa lộ trình học tập cá nhân hóa, hàng trăm đề thi chứng chỉ và hệ thống phân tích lỗi sai cực kỳ chi tiết bằng AI.</p>
        </div>

        {/* Right: Form */}
        <div style={{ flex: 1.2, padding: '3rem 4rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            {isLogin ? 'Đăng nhập vào hệ thống' : 'Đăng ký Tài khoản mới'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            {isLogin ? 'Chào mừng bạn quay trở lại với nền tảng.' : 'Chỉ mất chưa đầy 1 phút để tạo tài khoản miễn phí.'}
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Form Fields for Register Only */}
            {!isLogin && (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Họ và Tên</label>
                  <input type="text" className="input-field" placeholder="Nguyễn Văn A" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Số điện thoại</label>
                  <input type="tel" className="input-field" placeholder="0912 345 678" />
                </div>
              </div>
            )}

            {/* Common Fields */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Email của bạn</label>
              <input type="email" className="input-field" placeholder="john.doe@example.com" />
            </div>
            
            <div>
              <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Mật khẩu</label>
                {isLogin && <span style={{ fontSize: '0.875rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>Quên mật khẩu?</span>}
              </div>
              <input type="password" className="input-field" placeholder="••••••••" />
            </div>

            {/* Confirm Password for Register Only */}
            {!isLogin && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Xác nhận Mật khẩu</label>
                <input type="password" className="input-field" placeholder="••••••••" />
              </div>
            )}

            {/* Action Buttons */}
            <button className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '1rem' }} onClick={() => navigate(isLogin ? '/student/dashboard' : '/onboarding')}>
              {isLogin ? 'Đăng nhập ngay' : 'Hoàn tất Đăng ký'}
            </button>
            
            {/* Divider */}
            <div className="flex-center" style={{ gap: '1rem', margin: '1rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>HOẶC</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
            </div>

            {/* Social Login */}
            <button className="btn" style={{ padding: '0.875rem', background: 'white', border: '1px solid var(--border-dark)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}>
              <GoogleIcon /> {isLogin ? 'Đăng nhập với Google' : 'Đăng ký bằng Google'}
            </button>
          </div>
          
          {/* Toggle Login/Register */}
          <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, marginLeft: '0.5rem' }} onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
