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
