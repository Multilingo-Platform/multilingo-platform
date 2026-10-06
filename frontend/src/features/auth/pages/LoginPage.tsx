import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import LoginForm from '../components/LoginForm';
import { useTranslation } from 'react-i18next';

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <AuthLayout 
      title={t('auth.login_title')} 
      subtitle={t('auth.login_subtitle')} 
      isLogin={true} 
      onToggleMode={() => navigate('/register')}
    >
      <LoginForm />
    </AuthLayout>
  );
};

export default LoginPage;
