import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Layers,
  Award,
  Filter,
  Loader2,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import type { ExamAttemptUser } from '../../types/adminTypes';

interface ExamAttemptsTrackingDrawerProps {
  examId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return '0 giây';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} giây`;
  if (s === 0) return `${m} phút`;
  return `${m} phút ${s} giây`;
};

const getStatusBadge = (status?: string) => {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
          <CheckCircle2 size={12} />
          Đã nộp bài
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-full">
          <Clock size={12} />
          Đang làm bài
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/70 px-2 py-0.5 rounded-full">
          <AlertTriangle size={12} />
          Quá hạn / Hết giờ
        </span>
      );
    default:
      return (
        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {status || 'Chưa xác định'}
        </span>
      );
  }
};

export const ExamAttemptsTrackingDrawer: React.FC<ExamAttemptsTrackingDrawerProps> = ({
  examId,
  isOpen,
  onClose,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'EXPIRED'>('ALL');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['adminExamTrackingDetail', examId],
    queryFn: () => (examId ? adminApi.getExamTrackingDetail(examId) : null),
    enabled: !!examId && isOpen,
  });

  const filteredAttempts = useMemo(() => {
    if (!data?.attempts) return [];
    if (statusFilter === 'ALL') return data.attempts;
    return data.attempts.filter((a) => a.status === statusFilter);
  }, [data?.attempts, statusFilter]);

  if (!isOpen || !examId) return null;

  return (
    <div
      className="fixed inset-0 z-[1050] overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-amber-50/70 to-white">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                {data?.code || 'MÃ ĐỀ'}
              </span>
              {data?.type && (
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {data.type}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-gray-900 mt-1">
              {data?.title || 'Chi tiết hiệu quả đề thi'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Thời lượng quy chuẩn: {data?.durationMinutes ? `${data.durationMinutes} phút` : 'Tự do'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Overview Stats Bar */}
        <div className="p-4 bg-gray-50/75 border-b border-gray-200 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-2xs">
            <span className="text-[11px] text-gray-500 font-medium">Lượt Bắt Đầu</span>
            <div className="text-lg font-bold text-gray-900 mt-0.5">
              {data?.totalAttempts ?? 0} lượt
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-2xs">
            <span className="text-[11px] text-gray-500 font-medium">Đã Nộp Bài</span>
            <div className="text-lg font-bold text-emerald-600 mt-0.5">
              {data?.completedAttempts ?? 0} lượt{' '}
              <span className="text-xs font-normal text-gray-500">
                ({data?.completionRate ?? 0}%)
              </span>
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-2xs">
            <span className="text-[11px] text-gray-500 font-medium">Điểm Trung Bình</span>
            <div className="text-lg font-bold text-blue-600 mt-0.5">
              {data?.averageScore !== null && data?.averageScore !== undefined
                ? `${data.averageScore} đ`
                : 'Chưa có'}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-600">Trạng thái:</span>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-white text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Tất cả ({data?.totalAttempts ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'COMPLETED'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Đã nộp ({data?.completedAttempts ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'IN_PROGRESS'
                  ? 'bg-white text-amber-700 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Đang làm
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EXPIRED')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'EXPIRED'
                  ? 'bg-white text-rose-700 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Quá hạn
            </button>
          </div>
        </div>

        {/* Drawer Body - List of Student Attempts */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 size={24} className="animate-spin text-amber-500" />
              <span className="text-xs">Đang tải danh sách học viên tham gia thi...</span>
            </div>
          ) : isError ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              Không thể tải danh sách thí sinh làm đề này. Vui lòng thử lại.
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              Không có lượt làm bài nào thỏa mãn bộ lọc hiện tại.
            </div>
          ) : (
            filteredAttempts.map((item: ExamAttemptUser) => (
              <div
                key={item.attemptId}
                className="p-4 rounded-xl border border-gray-200 bg-white hover:border-amber-300 hover:shadow-xs transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {(item.fullName || 'HV')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-xs">
                          {item.fullName || `Học viên #${item.userId}`}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                            item.subscriptionTier === 'VIP'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.subscriptionTier || 'FREE'}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                          Lần {item.attemptNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500">{item.email}</div>
                    </div>
                  </div>

                  <div className="shrink-0">{getStatusBadge(item.status)}</div>
                </div>

                {/* Timestamps & Score Details */}
                <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-gray-100 gap-2">
                  <div className="flex items-center gap-4 text-gray-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className="text-gray-400" />
                      {item.startTime
                        ? new Date(item.startTime).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </span>

                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-gray-400" />
                      {formatDuration(item.timeSpentSeconds)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-gray-500 mr-1.5">Điểm số:</span>
                    <span className="text-xs font-bold text-gray-900">
                      {item.overallScore !== null && item.overallScore !== undefined ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                          {item.overallScore} {item.scoreUnit || 'đ'}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Chưa nộp bài</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>Danh sách theo thứ tự thời gian thi</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

