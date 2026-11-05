import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  DollarSign,
  TrendingUp,
  FileCheck2,
  ShieldCheck,
  Bot,
  Receipt,
  Activity,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import { StatCard } from '../components/StatCard';
import { RevenueChart } from '../components/RevenueChart';

const ATTEMPT_STATUS_CONFIG: Record<
  string,
  { label: string; dotColor: string }
> = {
  COMPLETED: { label: 'Đã hoàn thành', dotColor: 'bg-emerald-400' },
  IN_PROGRESS: { label: 'Đang làm bài', dotColor: 'bg-amber-400' },
  EXPIRED: { label: 'Quá hạn / Hết giờ', dotColor: 'bg-rose-400' },
  SUBMITTED: { label: 'Đã nộp bài', dotColor: 'bg-blue-400' },
  AI_GRADING: { label: 'AI đang chấm điểm', dotColor: 'bg-purple-400' },
  AI_GRADING_QUEUED: { label: 'Chờ hàng đợi AI', dotColor: 'bg-indigo-400' },
  GRADING_FAILED: { label: 'Lỗi chấm điểm', dotColor: 'bg-red-400' },
};

export const AdminDashboardPage = () => {
  const [period, setPeriod] = useState<string>('7d');

  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
  } = useQuery({
    queryKey: ['adminDashboardStats'],
    queryFn: () => adminApi.getDashboardStats(),
  });

  const {
    data: chartData,
    isLoading: isChartLoading,
  } = useQuery({
    queryKey: ['adminRevenueChart', period],
    queryFn: () => adminApi.getRevenueChart(period),
  });

  const renderAttemptsTooltip = () => {
    const statusMap = stats?.attemptsByStatus || {};
    const totalValid = stats?.totalExamsAttempted ?? 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-gray-750 pb-1.5 font-semibold text-gray-200">
          <span>Chi tiết trạng thái bài làm</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/70 border border-emerald-800/40 px-1.5 py-0.5 rounded font-normal">
            Đề chưa xóa
          </span>
        </div>
        <div className="space-y-1">
          {Object.entries(ATTEMPT_STATUS_CONFIG).map(([key, config]) => {
            const count = statusMap[key] ?? 0;
            return (
              <div key={key} className="flex items-center justify-between text-[11px] py-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                  <span className="text-gray-300">{config.label}</span>
                </div>
                <span className="font-semibold text-white">{count.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
        <div className="border-t border-gray-750 pt-1.5 flex items-center justify-between text-[11px] text-gray-400">
          <span>Tổng số lượt hợp lệ:</span>
          <span className="font-bold text-amber-400">{totalValid.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bảng Điều Khiển Quản Trị & Giám Sát
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tổng hợp dữ liệu vận hành, doanh thu thanh toán VNPAY và hoạt động học viên theo thời gian thực.
          </p>
        </div>
      </div>

      {isStatsError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3 text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span>Không thể tải dữ liệu thống kê bảng điều khiển. Vui lòng thử lại sau.</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Người Dùng Tích Cực (DAU/MAU)"
          value={
            isStatsLoading
              ? '...'
              : `${stats?.dau ?? 0} / ${stats?.mau ?? 0}`
          }
          subValue={`Tổng ${stats?.totalUsers ?? 0} tài khoản học viên`}
          icon={<Users size={20} />}
          trend="Hoạt động"
          trendPositive={true}
        />

        <StatCard
          title="Tổng Doanh Thu (VNPAY)"
          value={
            isStatsLoading
              ? '...'
              : new Intl.NumberFormat('vi-VN', {
                  style: 'currency',
                  currency: 'VND',
                }).format(stats?.totalRevenue ?? 0)
          }
          subValue={`30 ngày: ${new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
          }).format(stats?.monthlyRevenue ?? 0)}`}
          icon={<DollarSign size={20} />}
          trend="Đã xác thực"
          trendPositive={true}
        />

        <StatCard
          title="Chuyển Đổi Gói VIP / Premium"
          value={
            isStatsLoading
              ? '...'
              : `${stats?.vipUsers ?? 0} VIP`
          }
          subValue={`Tỷ lệ chuyển đổi: ${stats?.vipConversionRate ?? 0}%`}
          icon={<TrendingUp size={20} />}
          trend={`${stats?.vipConversionRate ?? 0}%`}
          trendPositive={(stats?.vipConversionRate ?? 0) > 0}
        />

        <StatCard
          title="Lượt Nộp Bài Thi & Luyện Tập"
          value={isStatsLoading ? '...' : (stats?.totalExamsAttempted ?? 0).toLocaleString()}
          subValue="Bài thi đã hoàn tất trên hệ thống"
          icon={<FileCheck2 size={20} />}
          trend="Hệ thống CBT"
          trendPositive={true}
          tooltipContent={renderAttemptsTooltip()}
        />
      </div>

      {/* Revenue Chart Section */}
      {isChartLoading ? (
        <div className="h-64 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 text-sm">
          Đang tải dữ liệu biểu đồ doanh thu...
        </div>
      ) : chartData ? (
        <RevenueChart
          labels={chartData.labels}
          data={chartData.data}
          totalPeriodRevenue={chartData.totalPeriodRevenue}
          period={period}
          onPeriodChange={setPeriod}
        />
      ) : null}

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/admin/users"
          className="group p-5 bg-white rounded-xl border border-gray-200 hover:border-amber-400 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 group-hover:text-amber-600 transition-colors">
                Quản Trị Người Dùng
              </h4>
              <p className="text-xs text-gray-500">Tra cứu, khóa & mở tài khoản</p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition-transform">
            <span>Chi tiết danh sách</span>
            <ArrowRight size={14} className="ml-1" />
          </div>
        </Link>

        <Link
          to="/admin/tracking"
          className="group p-5 bg-white rounded-xl border border-gray-200 hover:border-amber-400 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 group-hover:text-amber-600 transition-colors">
                Theo Dõi & Giám Sát
              </h4>
              <p className="text-xs text-gray-500">Học viên, tỷ lệ nộp bài & đề thi</p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform">
            <span>Xem tiến trình</span>
            <ArrowRight size={14} className="ml-1" />
          </div>
        </Link>

        <Link
          to="/admin/transactions"
          className="group p-5 bg-white rounded-xl border border-gray-200 hover:border-amber-400 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Receipt size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 group-hover:text-amber-600 transition-colors">
                Đối Soát VNPAY
              </h4>
              <p className="text-xs text-gray-500">Tra cứu mã đơn & xuất file Excel</p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-purple-600 group-hover:translate-x-1 transition-transform">
            <span>Đối soát giao dịch</span>
            <ArrowRight size={14} className="ml-1" />
          </div>
        </Link>

        <Link
          to="/admin/quotas"
          className="group p-5 bg-white rounded-xl border border-gray-200 hover:border-amber-400 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bot size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 group-hover:text-amber-600 transition-colors">
                Hạn Mức Quota AI
              </h4>
              <p className="text-xs text-gray-500">Cấu hình Writing, Dict & Tutor</p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-amber-600 group-hover:translate-x-1 transition-transform">
            <span>Cấu hình hạn mức</span>
            <ArrowRight size={14} className="ml-1" />
          </div>
        </Link>
      </div>
    </div>
  );
};
export default AdminDashboardPage;
