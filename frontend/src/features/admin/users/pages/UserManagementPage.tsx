import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Lock,
  Unlock,
  Eye,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import type { AdminUser } from '../../types/adminTypes';
import { LockUserModal } from '../components/LockUserModal';
import { UserDetailDrawer } from '../components/UserDetailDrawer';
import { alertUtil } from '../../../../utils/alert';

export const UserManagementPage = () => {
  const queryClient = useQueryClient();

  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [page, setPage] = useState(0);

  // Modal / Drawer state
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [drawerUserId, setDrawerUserId] = useState<number | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['adminUsers', keyword, isActiveFilter, tierFilter, page],
    queryFn: () =>
      adminApi.getUsers({
        keyword: keyword || undefined,
        isActive:
          isActiveFilter === 'ALL'
            ? undefined
            : isActiveFilter === 'ACTIVE',
        subscriptionTier: tierFilter === 'ALL' ? undefined : tierFilter,
        page,
        size: 10,
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      userId,
      isActive,
      reason,
    }: {
      userId: number;
      isActive: boolean;
      reason: string;
    }) => adminApi.updateUserStatus(userId, { isActive, reason }),
    onSuccess: (_, variables) => {
      alertUtil.toast(
        variables.isActive
          ? 'Đã mở khóa tài khoản thành công'
          : 'Đã khóa tài khoản và thu hồi các phiên làm việc',
        'success'
      );
      setIsLockModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      if (drawerUserId) {
        queryClient.invalidateQueries({ queryKey: ['adminUserDetail', drawerUserId] });
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái học viên';
      alertUtil.popup(msg, 'error', 'Lỗi thao tác');
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(searchInput.trim());
    setPage(0);
  };

  const openLockModal = (user: AdminUser) => {
    setSelectedUser(user);
    setIsLockModalOpen(true);
  };

  const handleConfirmLock = (userId: number, isActive: boolean, reason: string) => {
    updateStatusMutation.mutate({ userId, isActive, reason });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Quản Trị Người Dùng & Học Viên
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tra cứu thông tin học viên, xem lịch sử phiên đăng nhập IP/thiết bị, khóa hoặc mở khóa tài khoản an toàn.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3"
        >
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm kiếm theo họ tên, email học viên..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              Trạng thái:
            </span>
            <select
              value={isActiveFilter}
              onChange={(e) => {
                setIsActiveFilter(e.target.value);
                setPage(0);
              }}
              className="text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="LOCKED">Đã bị khóa</option>
            </select>
          </div>

          {/* Tier Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              Gói cước:
            </span>
            <select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value);
                setPage(0);
              }}
              className="text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">Tất cả gói</option>
              <option value="FREE">FREE</option>
              <option value="VIP">VIP</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs"
          >
            Tìm kiếm
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Học Viên</th>
                <th className="py-3 px-4">Vai Trò</th>
                <th className="py-3 px-4">Gói Cước</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4">Đăng Nhập Gần Nhất</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    Không tìm thấy học viên nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                data?.items?.map((u: AdminUser) => (
                  <tr key={u.id} className="hover:bg-amber-50/30 transition-colors">
                    {/* User Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0">
                          {u.fullName ? u.fullName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {u.fullName || 'Chưa đặt tên'}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4 font-medium text-gray-700">
                      {u.role}
                    </td>

                    {/* Tier */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.subscriptionTier === 'VIP'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {u.subscriptionTier}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {u.isActive ? (
                          <>
                            <UserCheck size={12} />
                            <span>Hoạt động</span>
                          </>
                        ) : (
                          <>
                            <UserX size={12} />
                            <span>Đã khóa</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Last Login */}
                    <td className="py-3 px-4 text-gray-500">
                      <div>
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Chưa đăng nhập'}
                      </div>
                      {u.lastLoginIp && (
                        <div className="text-[10px] text-gray-400">
                          IP: {u.lastLoginIp}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDrawerUserId(u.id)}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Xem chi tiết hồ sơ & session"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openLockModal(u)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.isActive
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                        >
                          {u.isActive ? <Lock size={16} /> : <Unlock size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {data && data.totalPages > 1 && (
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Trang {data.page + 1} / {data.totalPages} (Tổng {data.totalElements} tài khoản)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={data.page === 0}
                className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={data.last}
                className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Detail & Sessions Drawer (z-[1050]) */}
      <UserDetailDrawer
        userId={drawerUserId}
        isOpen={!!drawerUserId}
        onClose={() => setDrawerUserId(null)}
        onToggleStatus={(_, currentStatus) => {
          if (drawerUserId) {
            const found = data?.items?.find((x) => x.id === drawerUserId);
            if (found) {
              openLockModal(found);
            }
          }
        }}
      />

      {/* Lock/Unlock Modal (z-[1100] - Rendered after Drawer so it is always on top) */}
      <LockUserModal
        user={selectedUser}
        isOpen={isLockModalOpen}
        onClose={() => setIsLockModalOpen(false)}
        onConfirm={handleConfirmLock}
        isLoading={updateStatusMutation.isPending}
      />
    </div>
  );
};
export default UserManagementPage;
