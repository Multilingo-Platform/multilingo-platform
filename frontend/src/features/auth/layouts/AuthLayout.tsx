import React from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  isLogin: boolean;
  onToggleMode: () => void;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children, isLogin, onToggleMode }) => {
  return (
    <div className="flex-center slide-up" style={{ minHeight: 'calc(100vh - 70px)', padding: '1rem', background: 'var(--bg-primary)' }}>
      <div className="ed-card" style={{ display: 'flex', width: '100%', maxWidth: '900px', overflow: 'hidden', minHeight: '480px' }}>

        {/* Left: Illustration */}
        <div style={{ flex: 1, background: 'var(--primary)', padding: '2.5rem', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.2 }}>Học tập thông minh hơn!</h2>
          <p style={{ fontSize: '1rem', opacity: 0.9, lineHeight: 1.5 }}>Mở khóa lộ trình học tập cá nhân hóa, hàng trăm đề thi chứng chỉ và hệ thống phân tích lỗi sai cực kỳ chi tiết bằng AI.</p>
        </div>

        {/* Right: Form */}
        <div style={{ flex: 1.2, padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            {subtitle}
          </p>

          {children}

          {/* Toggle Login/Register */}
          <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, marginLeft: '0.5rem' }} onClick={onToggleMode}>
              {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
