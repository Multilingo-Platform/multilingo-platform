import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  FileText,
  Search,
  Clock,
  Award,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import type { UserTrackingItem, ExamTrackingItem } from '../../types/adminTypes';

export const TrackingAnalyticsPage = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'exams'>('users');
  const [userKeyword, setUserKeyword] = useState('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userPage, setUserPage] = useState(0);

  // Tab 1: User Tracking
  const {
    data: userTrackingData,
    isLoading: isUserLoading,
  } = useQuery({
    queryKey: ['adminUserTracking', userKeyword, userPage],
    queryFn: () =>
      adminApi.getUserTracking({
        keyword: userKeyword || undefined,
        page: userPage,
        size: 10,
      }),
    enabled: activeTab === 'users',
  });

  // Tab 2: Exam Tracking
  const {
    data: examTrackingData,
    isLoading: isExamLoading,
  } = useQuery({
    queryKey: ['adminExamTracking'],
    queryFn: () => adminApi.getExamTracking(),
    enabled: activeTab === 'exams',
  });

  const handleUserSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserKeyword(userSearchInput.trim());
    setUserPage(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Theo Dõi & Giám Sát Tiến Trình
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Báo cáo thống kê: &quot;Đề này có bao nhiêu người làm&quot; (lượt thi, điểm TB, tỷ lệ hoàn tất) và &quot;Người này làm bao nhiêu đề&quot; (giờ học, điểm số học viên).
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users size={18} />
          <span>Tiến Trình Học Viên</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('exams')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'exams'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileText size={18} />
          <span>Hiệu Quả & Lượt Thi Theo Đề</span>
        </button>
      </div>

      {/* Tab 1: User Tracking Content */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
            <form onSubmit={handleUserSearchSubmit} className="flex gap-3">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={userSearchInput}
                  onChange={(e) => setUserSearchInput(e.target.value)}
                  placeholder="Tìm học viên theo họ tên, email..."
                  className="w-full pl-10 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs"
              >
                Tra cứu
              </button>
            </form>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Học Viên</th>
                    <th className="py-3 px-4">Gói Cước</th>
                    <th className="py-3 px-4">Số Đề Đã Làm</th>
                    <th className="py-3 px-4">Điểm Trung Bình</th>
                    <th className="py-3 px-4">Tổng Giờ Học</th>
                    <th className="py-3 px-4">IP & Đăng Nhập Gần Nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isUserLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400">
                        Đang tải dữ liệu tiến trình học viên...
                      </td>
                    </tr>
                  ) : userTrackingData?.items?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400">
                        Không tìm thấy học viên nào.
                      </td>
                    </tr>
                  ) : (
                    userTrackingData?.items?.map((item: UserTrackingItem) => (
                      <tr key={item.userId} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900">
                            {item.fullName || 'Chưa đặt tên'}
                          </div>
                          <div className="text-[11px] text-gray-500">{item.email}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.subscriptionTier === 'VIP'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {item.subscriptionTier}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-bold text-gray-900">
                          {item.totalAttempts} bài thi
                        </td>

                        <td className="py-3 px-4">
                          {item.averageScore !== null && item.averageScore !== undefined ? (
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              {item.averageScore} đ
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Chưa có</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-gray-700">
                          {Math.round((item.totalLearningMinutes / 60) * 10) / 10} giờ ({item.totalLearningMinutes} phút)
                        </td>

                        <td className="py-3 px-4 text-gray-500">
                          <div>{item.lastLoginIp || '127.0.0.1'}</div>
                          <div className="text-[10px] text-gray-400">
                            {item.lastLoginAt
                              ? new Date(item.lastLoginAt).toLocaleDateString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Chưa đăng nhập'}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {userTrackingData && userTrackingData.totalPages > 1 && (
              <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Trang {userTrackingData.page + 1} / {userTrackingData.totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setUserPage((p) => Math.max(0, p - 1))}
                    disabled={userTrackingData.page === 0}
                    className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserPage((p) => p + 1)}
                    disabled={userTrackingData.last}
                    className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Exam Tracking Content */}
      {activeTab === 'exams' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Mã Đề</th>
                  <th className="py-3 px-4">Tên Đề Thi</th>
                  <th className="py-3 px-4">Lượt Bắt Đầu</th>
                  <th className="py-3 px-4">Lượt Nộp Bài</th>
                  <th className="py-3 px-4">Tỷ Lệ Hoàn Thành</th>
                  <th className="py-3 px-4">Điểm Trung Bình</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isExamLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400">
                      Đang tải số liệu thống kê đề thi...
                    </td>
                  </tr>
                ) : examTrackingData?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400">
                      Chưa có đề thi nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  examTrackingData?.map((exam: ExamTrackingItem) => (
                    <tr key={exam.examId} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-gray-700">
                        {exam.code}
                      </td>

                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {exam.title}
                      </td>

                      <td className="py-3 px-4 text-gray-700 font-medium">
                        {exam.totalAttempts.toLocaleString()} lượt
                      </td>

                      <td className="py-3 px-4 text-emerald-700 font-semibold">
                        {exam.completedAttempts.toLocaleString()} lượt
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden max-w-[120px]">
                            <div
                              style={{ width: `${Math.min(exam.completionRate, 100)}%` }}
                              className="bg-amber-500 h-full rounded-full"
                            />
                          </div>
                          <span className="font-bold text-gray-800">
                            {exam.completionRate}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {exam.averageScore !== null && exam.averageScore !== undefined ? (
                          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {exam.averageScore} đ
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Chưa có</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default TrackingAnalyticsPage;
