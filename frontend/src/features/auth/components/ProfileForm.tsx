import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Mail, User, Phone, Lock, CheckCircle2, ShieldCheck, Save, Loader2, Sparkles } from 'lucide-react';
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
  
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<UpdateProfileRequest>({
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
      {/* Email Field (Read-only credential) */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          {t('settings.email')}
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail size={18} />
          </div>
          <input 
            type="email" 
            value={initialData.email} 
            disabled
            className="w-full pl-11 pr-28 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-medium cursor-not-allowed shadow-inner transition-colors"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/80 shadow-xs">
              <CheckCircle2 size={13} className="text-emerald-500" />
              Đã xác thực
            </span>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5 ml-0.5">
          <Lock size={12} className="text-slate-400" />
          <span>Email định danh dùng để đăng nhập và nhận thông báo bảo mật từ hệ thống.</span>
        </p>
      </div>
      
      {/* Full Name Field */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          {t('settings.fullname')} <span className="text-rose-500">*</span>
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
            <User size={18} />
          </div>
          <input 
            type="text" 
            {...register('fullName', { required: t('auth.fullname_label') + ' không được để trống' })}
            className={`w-full pl-11 pr-4 py-3 bg-white border rounded-xl font-medium text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all shadow-xs ${errors.fullName ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 hover:border-slate-300'}`}
            placeholder="Nhập họ và tên..."
          />
        </div>
        {errors.fullName && (
          <p className="text-rose-500 text-xs font-medium mt-1.5 ml-1 flex items-center gap-1">
            <span>•</span> {errors.fullName.message}
          </p>
        )}
      </div>

      {/* Phone Field */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          {t('settings.phone')}
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
            <Phone size={18} />
          </div>
          <input 
            type="text" 
            {...register('phone', { 
              pattern: {
                value: /^(03|05|07|08|09)\d{8}$/,
                message: 'Số điện thoại không đúng định dạng (VD: 0912345678)'
              }
            })}
            className={`w-full pl-11 pr-4 py-3 bg-white border rounded-xl font-medium text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all shadow-xs ${errors.phone ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 hover:border-slate-300'}`}
            placeholder="Nhập số điện thoại (VD: 0987654321)..."
          />
        </div>
        {errors.phone ? (
          <p className="text-rose-500 text-xs font-medium mt-1.5 ml-1 flex items-center gap-1">
            <span>•</span> {errors.phone.message}
          </p>
        ) : (
          <p className="text-xs text-slate-400 mt-1.5 ml-0.5">
            Số điện thoại dùng để nhận hỗ trợ kỹ thuật và thông báo ưu đãi gói học.
          </p>
        )}
      </div>

      {/* Privacy Notice Box */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50/70 via-amber-50/50 to-orange-50/70 border border-orange-100 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-orange-100 text-orange-600 flex-shrink-0 mt-0.5 shadow-xs">
          <ShieldCheck size={18} />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
            <span>Bảo vệ quyền riêng tư</span>
            <Sparkles size={13} className="text-orange-500" />
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Dữ liệu cá nhân của bạn được mã hóa an toàn theo tiêu chuẩn quốc tế và chỉ được dùng cho mục đích hỗ trợ học tập và quản trị tài khoản trên nền tảng Multilingo.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-3">
        <button 
          type="submit" 
          disabled={updateMutation.isPending}
          className="px-7 py-3 bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/35 transition-all duration-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2.5 active:scale-[0.98] cursor-pointer"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{t('auth.processing')}</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>{t('settings.save_changes')}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
