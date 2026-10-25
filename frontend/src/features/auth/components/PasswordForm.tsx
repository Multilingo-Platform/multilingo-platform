import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { authApi } from '../api/authApi';
import type { ChangePasswordRequest } from '../types';
import { alertUtil } from '../../../utils/alert';

export const PasswordForm: React.FC = () => {
  const { t } = useTranslation();
  
  const { register, handleSubmit, formState: { errors }, watch, reset } = useForm<ChangePasswordRequest>();
  const newPasswordRef = useRef({});
  const watchedNewPassword = watch("newPassword", "") || "";
  const watchedConfirmPassword = watch("confirmPassword", "") || "";
  newPasswordRef.current = watchedNewPassword;

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password requirements calculation
  const hasMinLength = watchedNewPassword.length >= 6;
  const hasLetterAndNumber = /[a-zA-Z]/.test(watchedNewPassword) && /\d/.test(watchedNewPassword);
  const hasSpecialOrLong = /[^a-zA-Z0-9]/.test(watchedNewPassword) || watchedNewPassword.length >= 10;
  const isMatch = Boolean(watchedNewPassword && watchedConfirmPassword && watchedNewPassword === watchedConfirmPassword);

  let strengthScore = 0;
  if (watchedNewPassword.length > 0) {
    if (hasMinLength) strengthScore += 1;
    if (hasLetterAndNumber) strengthScore += 1;
    if (hasSpecialOrLong) strengthScore += 1;
  }

  const getStrengthLabel = () => {
    if (strengthScore === 0) return null;
    if (strengthScore === 1) return { text: 'Mức độ: Yếu', color: 'text-rose-500' };
    if (strengthScore === 2) return { text: 'Mức độ: Trung bình', color: 'text-amber-500' };
    return { text: 'Mức độ: Mạnh & An toàn', color: 'text-emerald-600' };
  };

  const strengthInfo = getStrengthLabel();

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
      {/* Old Password */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          {t('settings.old_password')} <span className="text-rose-500">*</span>
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
            <Lock size={18} />
          </div>
          <input 
            type={showOldPassword ? "text" : "password"} 
            {...register('oldPassword', { required: t('settings.old_password') + ' không được để trống' })}
            className={`w-full pl-11 pr-11 py-3 bg-white border rounded-xl font-medium text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all shadow-xs ${errors.oldPassword ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 hover:border-slate-300'}`}
            placeholder="Nhập mật khẩu hiện tại..."
          />
          <button
            type="button"
            onClick={() => setShowOldPassword(!showOldPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label={showOldPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.oldPassword && (
          <p className="text-rose-500 text-xs font-medium mt-1.5 ml-1 flex items-center gap-1">
            <span>•</span> {errors.oldPassword.message}
          </p>
        )}
      </div>

      {/* New Password */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          {t('settings.new_password')} <span className="text-rose-500">*</span>
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
            <KeyRound size={18} />
          </div>
          <input 
            type={showNewPassword ? "text" : "password"} 
            {...register('newPassword', { 
              required: t('settings.new_password') + ' không được để trống',
              minLength: {
                value: 6,
                message: 'Mật khẩu phải từ 6 ký tự'
              }
            })}
            className={`w-full pl-11 pr-11 py-3 bg-white border rounded-xl font-medium text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all shadow-xs ${errors.newPassword ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 hover:border-slate-300'}`}
            placeholder="Nhập mật khẩu mới..."
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.newPassword && (
          <p className="text-rose-500 text-xs font-medium mt-1.5 ml-1 flex items-center gap-1">
            <span>•</span> {errors.newPassword.message}
          </p>
        )}

        {/* Live Password Strength Meter */}
        {watchedNewPassword.length > 0 && (
          <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">Độ phức tạp mật khẩu</span>
              {strengthInfo && (
                <span className={`font-bold ${strengthInfo.color}`}>{strengthInfo.text}</span>
              )}
            </div>

            {/* 3-segment progress bar */}
            <div className="grid grid-cols-3 gap-2">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  strengthScore >= 1 
                    ? strengthScore === 1 ? 'bg-rose-500' : strengthScore === 2 ? 'bg-amber-400' : 'bg-emerald-500' 
                    : 'bg-slate-200'
                }`} 
              />
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  strengthScore >= 2 
                    ? strengthScore === 2 ? 'bg-amber-400' : 'bg-emerald-500' 
                    : 'bg-slate-200'
                }`} 
              />
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  strengthScore >= 3 ? 'bg-emerald-500' : 'bg-slate-200'
                }`} 
              />
            </div>

            {/* Requirements checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                {hasMinLength ? (
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle size={14} className="text-slate-300 flex-shrink-0" />
                )}
                <span className={hasMinLength ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                  Tối thiểu 6 ký tự
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {hasLetterAndNumber ? (
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle size={14} className="text-slate-300 flex-shrink-0" />
                )}
                <span className={hasLetterAndNumber ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                  Cả chữ cái & chữ số
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          {t('settings.confirm_password')} <span className="text-rose-500">*</span>
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-500 transition-colors">
            <ShieldCheck size={18} />
          </div>
          <input 
            type={showConfirmPassword ? "text" : "password"} 
            {...register('confirmPassword', { 
              required: t('settings.confirm_password') + ' không được để trống',
              validate: value => value === newPasswordRef.current || t('auth.password_mismatch')
            })}
            className={`w-full pl-11 pr-11 py-3 bg-white border rounded-xl font-medium text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all shadow-xs ${errors.confirmPassword ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200 hover:border-slate-300'}`}
            placeholder="Nhập lại mật khẩu mới..."
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-rose-500 text-xs font-medium mt-1.5 ml-1 flex items-center gap-1">
            <span>•</span> {errors.confirmPassword.message}
          </p>
        )}
        {isMatch && !errors.confirmPassword && (
          <p className="text-emerald-600 text-xs font-semibold mt-1 ml-1 flex items-center gap-1.5">
            <CheckCircle2 size={13} /> Mật khẩu xác nhận đã trùng khớp!
          </p>
        )}
      </div>

      {/* Security Best Practices Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-blue-50/70 border border-blue-100 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-blue-100 text-blue-600 flex-shrink-0 mt-0.5 shadow-xs">
          <AlertCircle size={18} />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
            <span>Lời khuyên an toàn</span>
            <Sparkles size={13} className="text-blue-500" />
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Sử dụng mật khẩu độc nhất không dùng chung với tài khoản ngân hàng hoặc mạng xã hội. Tuyệt đối không chia sẻ mật khẩu hoặc mã OTP với bất kỳ ai.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-3">
        <button 
          type="submit" 
          disabled={changePwdMutation.isPending}
          className="px-7 py-3 bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/35 transition-all duration-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2.5 active:scale-[0.98] cursor-pointer"
        >
          {changePwdMutation.isPending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{t('auth.processing')}</span>
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              <span>{t('settings.change_password_btn')}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
