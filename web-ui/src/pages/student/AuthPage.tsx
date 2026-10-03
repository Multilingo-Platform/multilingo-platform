import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);

  // SVG cho Google Icon
  const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  return (
    <div className="flex-center" style={{ minHeight: 'calc(100vh - 70px)', padding: '2rem 1.5rem', background: '#f8fafc' }}>
      <div style={{ display: 'flex', width: '100%', maxWidth: '920px', overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 6, background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        
        {/* Left: Traditional Education Banner */}
        <div style={{ flex: 1, background: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, borderRadius: 4, width: 'fit-content', marginBottom: '1.25rem' }}>
            NỀN TẢNG LUYỆN THI MULTILINGO
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 700, marginBottom: '0.85rem', lineHeight: 1.35, color: '#111827' }}>
            Học Tập & Luyện Thi Tiếng Anh Chuẩn Hóa
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.55, marginBottom: '1.5rem' }}>
            Hệ thống ngân hàng đề thi bám sát cấu trúc đề thi thật IELTS & TOEIC, tích hợp phân tích lỗi và trợ lý sửa bài thông minh.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.84rem', color: '#334155' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#d97706', fontWeight: 700 }}>✓</span> Đề thi bám sát đề thi thật mới nhất ETS & Cambridge
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#d97706', fontWeight: 700 }}>✓</span> Chấm điểm và phân tích giải thích chi tiết từng câu
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#d97706', fontWeight: 700 }}>✓</span> Sổ tay Flashcard ghi nhớ từ vựng ngắt quãng SRS
            </li>
          </ul>
        </div>

        {/* Right: Traditional Form */}
        <div style={{ flex: 1.15, padding: '2.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#ffffff' }}>
          <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem' }}>
            <button 
              onClick={() => setIsLogin(true)}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: 'transparent',
                fontWeight: isLogin ? 700 : 500,
                fontSize: '0.92rem',
                color: isLogin ? '#111827' : '#64748b',
                borderBottom: isLogin ? '3px solid #f59e0b' : '3px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer'
              }}
            >
              Đăng nhập
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: 'transparent',
                fontWeight: !isLogin ? 700 : 500,
                fontSize: '0.92rem',
                color: !isLogin ? '#111827' : '#64748b',
                borderBottom: !isLogin ? '3px solid #f59e0b' : '3px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer'
              }}
            >
              Đăng ký tài khoản
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Form Fields for Register Only */}
            {!isLogin && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>Họ và tên</label>
                  <input type="text" placeholder="Nguyễn Văn A" style={{ width: '100%', borderRadius: 5, border: '1px solid #cbd5e1', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>Số điện thoại</label>
                  <input type="tel" placeholder="0912 345 678" style={{ width: '100%', borderRadius: 5, border: '1px solid #cbd5e1', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Common Fields */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>Địa chỉ Email</label>
              <input type="email" placeholder="email@vi-du.com" style={{ width: '100%', borderRadius: 5, border: '1px solid #cbd5e1', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>Mật khẩu</label>
                {isLogin && (
                  <span 
                    style={{ fontSize: '0.8rem', color: '#d97706', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => navigate('/forgot-password')}
                  >
                    Quên mật khẩu?
                  </span>
                )}
              </div>
              <input type="password" placeholder="••••••••" style={{ width: '100%', borderRadius: 5, border: '1px solid #cbd5e1', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Confirm Password for Register Only */}
            {!isLogin && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>Xác nhận mật khẩu</label>
                <input type="password" placeholder="••••••••" style={{ width: '100%', borderRadius: 5, border: '1px solid #cbd5e1', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {/* Action Buttons */}
            <button 
              style={{ marginTop: '0.35rem', padding: '0.6rem', borderRadius: 5, fontSize: '0.88rem', fontWeight: 600, background: '#f59e0b', color: '#111827', border: '1px solid #d97706', cursor: 'pointer', transition: 'all 0.15s ease' }} 
              onClick={() => navigate(isLogin ? '/student/dashboard' : '/onboarding')}
              onMouseEnter={(e) => e.currentTarget.style.background = '#eab308'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f59e0b'}
            >
              {isLogin ? 'Đăng nhập' : 'Tạo tài khoản học viên'}
            </button>
            
            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.35rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
              <span style={{ fontSize: '0.75rem', color: '#94a3af', fontWeight: 600 }}>HOẶC</span>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
            </div>

            {/* Social Login */}
            <button style={{ padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: 5, background: '#ffffff', color: '#374151', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
              <GoogleIcon /> {isLogin ? 'Đăng nhập bằng Google' : 'Đăng ký bằng Google'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
