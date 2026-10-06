import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import RegisterForm from '../components/RegisterForm';
import { useTranslation } from 'react-i18next';

const RegisterPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <AuthLayout 
      title={t('auth.register_title')} 
      subtitle={t('auth.register_subtitle')} 
      isLogin={false} 
      onToggleMode={() => navigate('/login')}
    >
      <RegisterForm />
    </AuthLayout>
  );
};

export default RegisterPage;
