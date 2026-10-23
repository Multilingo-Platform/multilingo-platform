import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  ShieldAlert,
  Flame,
  Award,
  Clock,
  Laptop,
  Calendar,
  AlertTriangle,
  Smartphone,
  Globe,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import { parseUserAgent, formatIpAddress } from '../utils/sessionFormatters';

interface UserDetailDrawerProps {
  userId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleStatus: (userId: number, currentStatus: boolean) => void;
}

export const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({
  userId,
  isOpen,
  onClose,
  onToggleStatus,
}) => {
  const { data: user, isLoading } = useQuery({
    queryKey: ['adminUserDetail', userId],
    queryFn: () => (userId ? adminApi.getUserDetail(userId) : null),
    enabled: !!userId && isOpen,
  });

  if (!isOpen || !userId) return null;

  return (
    <div className="fixed inset-0 z-[1050] overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Hồ Sơ Học Viên & Nhật Ký Phiên
            </h3>
            <span className="text-xs text-gray-500">ID: #{userId}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="text-center py-12 text-sm text-gray-400">
              Đang tải dữ liệu hồ sơ học viên...
            </div>
          ) : user ? (
            <>
              {/* Fraud Risk Alert */}
              {user.isFraudRisk && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                  <ShieldAlert size={18} className="shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Cảnh báo rủi ro chia sẻ tài khoản:</strong>
                    <p className="mt-0.5">
                      Phát hiện đăng nhập từ nhiều địa chỉ IP / thiết bị khác nhau trong các phiên gần nhất.
                    </p>
                  </div>
                </div>
              )}

              {/* User Overview */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 font-bold text-xl flex items-center justify-center shrink-0 border-2 border-white shadow-xs">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-bold text-gray-900 truncate">
                    {user.fullName || 'Chưa đặt tên'}
                  </h4>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        user.subscriptionTier === 'VIP'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {user.subscriptionTier}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        user.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.isActive ? 'Đang hoạt động' : 'Đã bị khóa'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Study Stats Grid */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Tiến Trình Học Tập
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <Clock size={14} className="text-amber-500" />
                      <span>Tổng giờ học</span>
                    </div>
                    <span className="text-base font-bold text-gray-900">
                      {Math.round((user.totalLearningMinutes / 60) * 10) / 10} giờ
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <Flame size={14} className="text-red-500" />
                      <span>Streak hiện tại</span>
                    </div>
                    <span className="text-base font-bold text-gray-900">
                      {user.currentStreak} ngày
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <Award size={14} className="text-emerald-500" />
                      <span>Tổng điểm XP</span>
                    </div>
                    <span className="text-base font-bold text-gray-900">
                      {user.totalXp.toLocaleString()} XP
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <Laptop size={14} className="text-blue-500" />
                      <span>Điểm thi TB</span>
                    </div>
                    <span className="text-base font-bold text-gray-900">
                      {user.averageExamScore !== null && user.averageExamScore !== undefined
                        ? `${user.averageExamScore} đ`
                        : 'Chưa có'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Login History */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Lịch Sử 10 Phiên Đăng Nhập Gần Nhất
                </h5>
                {user.recentLoginHistory?.length > 0 ? (
                  <div className="space-y-2 text-xs">
                    {user.recentLoginHistory.map((item) => {
                      const device = parseUserAgent(item.deviceInfo);
                      const ip = formatIpAddress(item.ipAddress);
                      const isSuccess = item.status === 'SUCCESS';

                      return (
                        <div
                          key={item.id}
                          title={`Địa chỉ IP: ${item.ipAddress || 'Không rõ'}\nUser-Agent: ${item.deviceInfo || 'Không rõ'}`}
                          className="p-3 bg-white hover:bg-gray-50/80 transition-all border border-gray-200/80 rounded-xl flex items-center justify-between gap-3 shadow-2xs group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                device.deviceType === 'mobile'
                                  ? 'bg-purple-50 text-purple-600'
                                  : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              {device.deviceType === 'mobile' ? (
                                <Smartphone size={16} />
                              ) : (
                                <Laptop size={16} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate text-xs">
                                {device.friendlyName}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                                <Globe size={11} className="text-gray-400 shrink-0" />
                                <span className="truncate">{ip.displayIp}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                isSuccess
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                  : 'bg-rose-50 text-rose-700 border-rose-200/60'
                              }`}
                            >
                              {isSuccess ? (
                                <>
                                  <CheckCircle2 size={10} className="text-emerald-600" />
                                  <span>Thành công</span>
                                </>
                              ) : (
                                <>
                                  <XCircle size={10} className="text-rose-600" />
                                  <span>Thất bại</span>
                                </>
                              )}
                            </span>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(item.loginTime).toLocaleDateString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Chưa có lịch sử đăng nhập được ghi nhận.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Action */}
        {user && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Ngày tạo: {new Date(user.createdAt).toLocaleDateString('vi-VN')}
            </span>
            <button
              type="button"
              onClick={() => onToggleStatus(user.id, user.isActive)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors shadow-xs ${
                user.isActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {user.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
