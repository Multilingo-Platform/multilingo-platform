import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import LoginForm from '../components/LoginForm';

const LoginPage = () => {
  const navigate = useNavigate();

  return (
    <AuthLayout 
      title="Đăng nhập vào hệ thống" 
      subtitle="Chào mừng bạn quay trở lại với nền tảng." 
      isLogin={true} 
      onToggleMode={() => navigate('/register')}
    >
      <LoginForm />
    </AuthLayout>
  );
};

export default LoginPage;
