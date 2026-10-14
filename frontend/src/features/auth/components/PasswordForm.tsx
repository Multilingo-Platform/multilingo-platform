import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api/authApi';
import type { ChangePasswordRequest } from '../types';
import { alertUtil } from '../../../utils/alert';

export const PasswordForm: React.FC = () => {
  const { t } = useTranslation();
  
  const { register, handleSubmit, formState: { errors }, watch, reset } = useForm<ChangePasswordRequest>();
  const newPassword = useRef({});
  newPassword.current = watch("newPassword", "");

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const changePwdMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      alertUtil.toast(t('settings.password_success'), 'success');
      reset();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || t('settings.password_failed');
      alertUtil.toast(message, 'error');
    }
  });

  const onSubmit = (data: ChangePasswordRequest) => {
    changePwdMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">{t('settings.old_password')}</label>
        <div className="relative">
          <input 
            type={showOldPassword ? "text" : "password"} 
            {...register('oldPassword', { required: t('settings.old_password') + ' không được để trống' })}
            className={`w-full px-4 py-2.5 pr-11 bg-white border rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all shadow-sm ${errors.oldPassword ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowOldPassword(!showOldPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label={showOldPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.oldPassword && <p className="text-red-500 text-sm mt-1.5 ml-1">{errors.oldPassword.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">{t('settings.new_password')}</label>
        <div className="relative">
          <input 
            type={showNewPassword ? "text" : "password"} 
            {...register('newPassword', { 
              required: t('settings.new_password') + ' không được để trống',
              minLength: {
                value: 6,
                message: 'Mật khẩu phải từ 6 ký tự'
              }
            })}
            className={`w-full px-4 py-2.5 pr-11 bg-white border rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all shadow-sm ${errors.newPassword ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.newPassword && <p className="text-red-500 text-sm mt-1.5 ml-1">{errors.newPassword.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">{t('settings.confirm_password')}</label>
        <div className="relative">
          <input 
            type={showConfirmPassword ? "text" : "password"} 
            {...register('confirmPassword', { 
              required: t('settings.confirm_password') + ' không được để trống',
              validate: value => value === newPassword.current || t('auth.password_mismatch')
            })}
            className={`w-full px-4 py-2.5 pr-11 bg-white border rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all shadow-sm ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.confirmPassword && <p className="text-red-500 text-sm mt-1.5 ml-1">{errors.confirmPassword.message}</p>}
      </div>

      <div className="pt-4">
        <button 
          type="submit" 
          disabled={changePwdMutation.isPending}
          className="px-6 py-2.5 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-medium rounded-xl shadow-lg shadow-orange-500/30 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
        >
          {changePwdMutation.isPending ? t('auth.processing') : t('settings.change_password_btn')}
        </button>
      </div>
    </form>
  );
};
