import React, { useEffect } from 'react';
// Wait, react-hook-form is used in the project
import { useForm as useHookForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save } from 'lucide-react';
import { premiumApi } from '../api/premiumApi';
import type { SubscriptionPlan, SubscriptionPlanRequest } from '../types';
import { alertUtil } from '../../../../utils/alert';

interface PackageFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: SubscriptionPlan | null;
}

const PackageFormModal: React.FC<PackageFormModalProps> = ({ isOpen, onClose, initialData }) => {
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useHookForm<SubscriptionPlanRequest>({
    defaultValues: {
      code: '',
      name: '',
      price: 0,
      durationDays: 30
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        name: initialData.name,
        price: initialData.price,
        durationDays: initialData.durationDays
      });
    } else {
      reset({
        code: '',
        name: '',
        price: 0,
        durationDays: 30
      });
    }
  }, [initialData, reset]);

  const mutation = useMutation({
    mutationFn: (data: SubscriptionPlanRequest) => 
      isEdit 
        ? premiumApi.updatePlan(initialData.id, data)
        : premiumApi.createPlan(data),
    onSuccess: (res) => {
      alertUtil.toast(res.message, 'success');
      queryClient.invalidateQueries({ queryKey: ['adminPlans'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu dữ liệu';
      alertUtil.toast(msg, 'error');
    }
  });

  const onSubmit = (data: SubscriptionPlanRequest) => {
    mutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">
            {isEdit ? 'Chỉnh sửa gói cước' : 'Thêm gói cước mới'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Mã Gói <span className="text-red-500">*</span></label>
            <input 
              {...register('code', { required: 'Mã gói không được để trống' })}
              disabled={isEdit}
              placeholder="Ví dụ: PREMIUM_1M"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all uppercase disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {errors.code && <p className="text-sm text-red-500">{errors.code.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Tên Gói <span className="text-red-500">*</span></label>
            <input 
              {...register('name', { required: 'Tên gói không được để trống' })}
              placeholder="Ví dụ: Gói Premium 1 Tháng"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Giá Tiền (VND) <span className="text-red-500">*</span></label>
              <input 
                type="number"
                {...register('price', { 
                  required: 'Không được để trống',
                  min: { value: 1, message: 'Giá phải > 0' }
                })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
              {errors.price && <p className="text-sm text-red-500">{errors.price.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Số Ngày <span className="text-red-500">*</span></label>
              <input 
                type="number"
                {...register('durationDays', { 
                  required: 'Không được để trống',
                  min: { value: 1, message: 'Số ngày > 0' }
                })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
              {errors.durationDays && <p className="text-sm text-red-500">{errors.durationDays.message}</p>}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="flex items-center space-x-2 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:active:scale-100"
            >
              {isSubmitting || mutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>Lưu lại</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PackageFormModal;
