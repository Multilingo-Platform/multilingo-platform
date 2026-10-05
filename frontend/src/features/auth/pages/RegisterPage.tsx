import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import RegisterForm from '../components/RegisterForm';

const RegisterPage = () => {
  const navigate = useNavigate();

  return (
    <AuthLayout 
      title="Đăng ký Tài khoản mới" 
      subtitle="Chỉ mất chưa đầy 1 phút để tạo tài khoản miễn phí." 
      isLogin={false} 
      onToggleMode={() => navigate('/login')}
    >
      <RegisterForm />
    </AuthLayout>
  );
};

export default RegisterPage;
