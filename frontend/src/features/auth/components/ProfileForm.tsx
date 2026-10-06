import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { authApi } from '../api/authApi';
import type { UpdateProfileRequest } from '../types';
import { alertUtil } from '../../../utils/alert';
import { updateUser } from '../store/authSlice';

interface ProfileFormProps {
  initialData: {
    fullName: string;
    phone?: string;
    email: string;
  };
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ initialData }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  
  const { register, handleSubmit, formState: { errors } } = useForm<UpdateProfileRequest>({
    defaultValues: {
      fullName: initialData.fullName,
      phone: initialData.phone || ''
    }
  });

  const updateMutation = useMutation({
    mutationFn: authApi.updateMyInfo,
    onSuccess: (res) => {
      alertUtil.toast(t('settings.update_success'), 'success');
      if (res.data) {
        dispatch(updateUser(res.data));
      }
      queryClient.invalidateQueries({ queryKey: ['myInfo'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || t('settings.update_failed');
      alertUtil.toast(message, 'error');
    }
  });

  const onSubmit = (data: UpdateProfileRequest) => {
    updateMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">{t('settings.email')}</label>
        <input 
          type="email" 
          value={initialData.email} 
          disabled
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed shadow-sm"
        />
        <p className="text-xs text-gray-400 mt-1.5 ml-1">Email không thể thay đổi</p>
      </div>
      
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">{t('settings.fullname')}</label>
        <input 
          type="text" 
          {...register('fullName', { required: t('auth.fullname_label') + ' không được để trống' })}
          className={`w-full px-4 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all shadow-sm ${errors.fullName ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="Nhập họ và tên..."
        />
        {errors.fullName && <p className="text-red-500 text-sm mt-1.5 ml-1">{errors.fullName.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">{t('settings.phone')}</label>
        <input 
          type="text" 
          {...register('phone', { 
            pattern: {
              value: /^(03|05|07|08|09)\d{8}$/,
              message: 'Số điện thoại không đúng định dạng'
            }
          })}
          className={`w-full px-4 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all shadow-sm ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="Nhập số điện thoại..."
        />
        {errors.phone && <p className="text-red-500 text-sm mt-1.5 ml-1">{errors.phone.message}</p>}
      </div>

      <div className="pt-4">
        <button 
          type="submit" 
          disabled={updateMutation.isPending}
          className="px-6 py-2.5 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-medium rounded-xl shadow-lg shadow-orange-500/30 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
        >
          {updateMutation.isPending ? t('auth.processing') : t('settings.save_changes')}
        </button>
      </div>
    </form>
  );
};
