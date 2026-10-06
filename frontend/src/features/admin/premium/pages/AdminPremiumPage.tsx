import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Play, Pause, AlertCircle, Clock, CircleDollarSign, Check } from 'lucide-react';
import { premiumApi } from '../api/premiumApi';
import type { SubscriptionPlan } from '../types';
import { alertUtil } from '../../../../utils/alert';
import PackageFormModal from '../components/PackageFormModal';

const AdminPremiumPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  // Fetch data
  const { data: response, isLoading } = useQuery({
    queryKey: ['adminPlans'],
    queryFn: () => premiumApi.getAllPlans()
  });

  const plans = response?.data || [];

  // Mutations
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      premiumApi.changeStatus(id, isActive),
    onSuccess: (res) => {
      alertUtil.toast(res.message, 'success');
      queryClient.invalidateQueries({ queryKey: ['adminPlans'] });
    },
    onError: (err: any) => {
      alertUtil.toast(err.response?.data?.message || 'Có lỗi xảy ra', 'error');
    }
  });

  const handleToggleStatus = async (plan: SubscriptionPlan) => {
    const isConfirmed = await alertUtil.confirm(
      plan.isActive 
        ? `Bạn có chắc muốn ngừng bán gói "${plan.name}"?` 
        : `Kích hoạt lại gói "${plan.name}" trên hệ thống?`,
      'Xác nhận',
      'Hủy'
    );
    
    if (isConfirmed) {
      toggleStatusMutation.mutate({ id: plan.id, isActive: !plan.isActive });
    }
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-orange-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Gói cước</h1>
          <p className="text-slate-500 mt-1">Cấu hình các gói Premium dành cho người dùng</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center space-x-2 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Thêm Gói Mới</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-orange-100 text-orange-500 rounded-xl">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Đang hoạt động</p>
            <p className="text-2xl font-bold text-slate-800">
              {plans.filter(p => p.isActive).length} <span className="text-sm font-normal text-slate-500">gói</span>
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-slate-100 text-slate-500 rounded-xl">
            <Pause className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Đã ngừng bán</p>
            <p className="text-2xl font-bold text-slate-800">
              {plans.filter(p => !p.isActive).length} <span className="text-sm font-normal text-slate-500">gói</span>
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl">
            <CircleDollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Tổng số gói</p>
            <p className="text-2xl font-bold text-slate-800">
              {plans.length} <span className="text-sm font-normal text-slate-500">gói</span>
            </p>
          </div>
        </div>
      </div>

      {/* Table section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>
        ) : plans.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 text-lg">Chưa có gói cước nào</p>
            <p className="text-slate-400 text-sm mt-1">Hãy bấm "Thêm Gói Mới" để tạo gói cước đầu tiên.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                  <th className="px-6 py-4 font-semibold">Mã Gói</th>
                  <th className="px-6 py-4 font-semibold">Tên Gói</th>
                  <th className="px-6 py-4 font-semibold">Giá Tiền</th>
                  <th className="px-6 py-4 font-semibold">Thời Hạn</th>
                  <th className="px-6 py-4 font-semibold">Trạng Thái</th>
                  <th className="px-6 py-4 font-semibold text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                        {plan.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{plan.name}</td>
                    <td className="px-6 py-4 font-semibold text-orange-600">{formatVND(plan.price)}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{plan.durationDays} ngày</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {plan.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                          Đang bán
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mr-1.5"></span>
                          Đã ngừng bán
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(plan)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(plan)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                          plan.isActive 
                            ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                        title={plan.isActive ? 'Ngừng bán' : 'Kích hoạt lại'}
                      >
                        {plan.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <PackageFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={editingPlan}
        />
      )}
    </div>
  );
};

export default AdminPremiumPage;
