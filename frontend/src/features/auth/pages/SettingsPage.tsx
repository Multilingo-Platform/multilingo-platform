import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';
import { ProfileForm } from '../components/ProfileForm';
import { PasswordForm } from '../components/PasswordForm';
import { User, KeyRound, Award } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { useDispatch } from 'react-redux';
import { updateUser } from '../store/authSlice';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<'general' | 'password'>('general');

  const { data: myInfoRes, isLoading } = useQuery({
    queryKey: ['myInfo'],
    queryFn: authApi.getMyInfo,
    enabled: !user, // Only fetch if we don't have it in redux
  });

  // Effect to sync fetched data to redux if it was missing
  React.useEffect(() => {
    if (myInfoRes?.data && !user) {
      dispatch(updateUser(myInfoRes.data));
    }
  }, [myInfoRes, user, dispatch]);

  const currentUser = user || myInfoRes?.data;

  if (isLoading && !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <p className="text-gray-500">{t('auth.loading')}</p>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-gray-500 mt-2">Quản lý thông tin tài khoản và tùy chọn bảo mật của bạn.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
        <div className="flex flex-col md:flex-row h-full min-h-[600px]">
          {/* Sidebar */}
          <div className="w-full md:w-72 bg-gray-50/50 border-r border-gray-100 p-6">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-orange-400 to-orange-500 text-white flex items-center justify-center text-4xl font-bold mb-4 shadow-lg shadow-orange-500/20">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover border-4 border-white" />
                ) : (
                  currentUser.fullName?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <h3 className="font-semibold text-lg text-gray-900">{currentUser.fullName}</h3>
              <p className="text-sm text-gray-500 mt-1">{currentUser.email}</p>
              
              <div className="mt-4 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-100/80 text-orange-700 text-xs font-bold uppercase tracking-wider">
                <Award size={14} />
                {currentUser.subscriptionTier === 'PREMIUM' ? t('settings.pro_badge') : t('settings.free_badge')}
              </div>
            </div>

            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('general')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === 'general'
                    ? 'bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-500/10'
                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                }`}
              >
                <User size={18} className={activeTab === 'general' ? 'text-orange-500' : 'text-gray-400'} />
                {t('settings.tab_general')}
              </button>
              
              <button
                onClick={() => setActiveTab('password')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === 'password'
                    ? 'bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-500/10'
                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                }`}
              >
                <KeyRound size={18} className={activeTab === 'password' ? 'text-orange-500' : 'text-gray-400'} />
                {t('settings.tab_password')}
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-8 md:p-10 bg-white">
            <h2 className="text-xl font-semibold text-gray-900 mb-8 border-b border-gray-100 pb-4">
              {activeTab === 'general' ? t('settings.tab_general') : t('settings.tab_password')}
            </h2>
            
            <div className="max-w-xl">
              {activeTab === 'general' ? (
                <ProfileForm 
                  initialData={{
                    fullName: currentUser.fullName,
                    email: currentUser.email,
                    phone: currentUser.phone
                  }} 
                />
              ) : (
                <PasswordForm />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
