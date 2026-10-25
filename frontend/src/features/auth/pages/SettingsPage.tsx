import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { 
  User, 
  KeyRound, 
  Award, 
  Crown, 
  Shield, 
  CheckCircle2, 
  Sparkles, 
  ChevronRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { RootState } from '../../../app/store';
import { ProfileForm } from '../components/ProfileForm';
import { PasswordForm } from '../components/PasswordForm';
import { authApi } from '../api/authApi';
import { updateUser } from '../store/authSlice';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<'general' | 'password'>(
    tabParam === 'password' ? 'password' : 'general'
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'password' || tab === 'general') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const { data: myInfoRes, isLoading } = useQuery({
    queryKey: ['myInfo'],
    queryFn: authApi.getMyInfo,
    enabled: !user,
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
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium text-sm">{t('auth.loading')}</p>
      </div>
    );
  }

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'ADMIN';
  const isPremium = currentUser.subscriptionTier === 'PREMIUM';

  return (
    <div className="relative max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      {/* Ambient background glow */}
      <div 
        aria-hidden="true" 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-orange-400/10 via-amber-300/10 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" 
      />

      {/* Page Header */}
      <div className="mb-8 sm:mb-10 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/80 text-orange-700 text-xs font-semibold mb-3 border border-orange-200/60 shadow-xs">
          <Sparkles size={13} className="text-orange-500" />
          <span>Trung tâm tài khoản & bảo mật</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          {t('settings.title')}
        </h1>
        <p className="text-slate-500 text-sm sm:text-base mt-2 max-w-2xl">
          Quản lý thông tin định danh cá nhân, số điện thoại liên hệ và các tùy chọn bảo vệ tài khoản an toàn.
        </p>
      </div>

      {/* Main Bento Card */}
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-[0_12px_45px_-10px_rgba(0,0,0,0.06)] border border-slate-200/80 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          
          {/* Left Sidebar Profile Section */}
          <div className="lg:col-span-4 bg-gradient-to-b from-slate-50/90 via-slate-50/40 to-white border-b lg:border-b-0 lg:border-r border-slate-100 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              {/* Avatar & User Details */}
              <div className="flex flex-col items-center text-center">
                <div className="relative p-1 rounded-full bg-gradient-to-tr from-orange-500 via-amber-400 to-orange-400 shadow-xl shadow-orange-500/20 mb-4 group">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center text-3xl font-extrabold border-4 border-white overflow-hidden shadow-inner">
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      currentUser.fullName?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  {/* Status Indicator Dot */}
                  <span 
                    title="Đang hoạt động"
                    className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow-xs flex items-center justify-center"
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </span>
                </div>

                <h3 className="font-bold text-xl text-slate-900 tracking-tight">
                  {currentUser.fullName}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 break-all">
                  {currentUser.email}
                </p>

                {/* Role & Subscription Badges */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200/80 shadow-xs">
                      <Shield size={13} className="text-indigo-600" />
                      <span>Quản trị viên</span>
                    </span>
                  )}
                  {isPremium ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-800 text-xs font-bold border border-amber-300/80 shadow-xs">
                      <Crown size={13} className="text-amber-500 fill-amber-500" />
                      <span>{t('settings.pro_badge')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-xs">
                      <Award size={13} className="text-slate-500" />
                      <span>{t('settings.free_badge')}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Account Security Quick Card */}
              <div className="mt-6 p-3.5 rounded-2xl bg-white border border-slate-200/70 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <UserCheck size={14} className="text-emerald-500" /> Trạng thái
                  </span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} /> Hoạt động
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <ShieldCheck size={14} className="text-blue-500" /> Bảo mật
                  </span>
                  <span className="text-slate-700 font-semibold">Tiêu chuẩn</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <nav className="mt-6 space-y-2.5">
                <button
                  type="button"
                  onClick={() => { setActiveTab('general'); setSearchParams({ tab: 'general' }); }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-200 cursor-pointer text-left ${
                    activeTab === 'general'
                      ? 'bg-gradient-to-r from-orange-50 via-amber-50/60 to-orange-50 text-orange-700 border border-orange-200/90 shadow-xs'
                      : 'bg-white hover:bg-slate-100/70 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-colors ${activeTab === 'general' ? 'bg-orange-500 text-white shadow-xs' : 'bg-slate-100 text-slate-500'}`}>
                      <User size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold leading-tight">{t('settings.tab_general')}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Tên, email & số điện thoại</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className={`transition-transform duration-200 ${activeTab === 'general' ? 'text-orange-500 translate-x-0.5' : 'text-slate-300'}`} />
                </button>
                
                <button
                  type="button"
                  onClick={() => { setActiveTab('password'); setSearchParams({ tab: 'password' }); }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-200 cursor-pointer text-left ${
                    activeTab === 'password'
                      ? 'bg-gradient-to-r from-orange-50 via-amber-50/60 to-orange-50 text-orange-700 border border-orange-200/90 shadow-xs'
                      : 'bg-white hover:bg-slate-100/70 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-colors ${activeTab === 'password' ? 'bg-orange-500 text-white shadow-xs' : 'bg-slate-100 text-slate-500'}`}>
                      <KeyRound size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold leading-tight">{t('settings.tab_password')}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Cập nhật mã khóa & an toàn</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className={`transition-transform duration-200 ${activeTab === 'password' ? 'text-orange-500 translate-x-0.5' : 'text-slate-300'}`} />
                </button>
              </nav>
            </div>

            {/* Platform watermark */}
            <div className="mt-8 pt-4 border-t border-slate-100 text-center">
              <span className="text-[11px] font-bold tracking-widest text-slate-300 uppercase">
                Multilingo Platform • 2026
              </span>
            </div>
          </div>

          {/* Right Main Content Section */}
          <div className="lg:col-span-8 p-6 sm:p-10 bg-white flex flex-col justify-between">
            <div>
              {/* Section Header */}
              <div className="border-b border-slate-100 pb-5 mb-8">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="p-1.5 rounded-lg bg-orange-100/80 text-orange-600">
                    {activeTab === 'general' ? <User size={20} /> : <KeyRound size={20} />}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {activeTab === 'general' ? t('settings.tab_general') : t('settings.tab_password')}
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500">
                  {activeTab === 'general'
                    ? 'Thông tin cơ bản dùng để hiển thị trên hồ sơ và liên hệ khi cần thiết.'
                    : 'Để đảm bảo an toàn, vui lòng không chia sẻ mật khẩu mới với bất kỳ ai.'}
                </p>
              </div>

              {/* Form Content */}
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
    </div>
  );
};
