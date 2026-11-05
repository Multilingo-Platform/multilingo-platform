import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  BookOpen,
  History,
  Award,
  Clock,
  Calendar,
  Layers,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import type { UserExamSummary, UserAttemptDetail } from '../../types/adminTypes';

interface UserExamTrackingDrawerProps {
  userId: number | null;
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
          Đã hoàn thành
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
    case 'SUBMITTED':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-full">
          Đã nộp bài
        </span>
      );
    case 'AI_GRADING':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/70 px-2 py-0.5 rounded-full">
          AI đang chấm
        </span>
      );
    case 'AI_GRADING_QUEUED':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full">
          Chờ chấm AI
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

const getTestModeBadge = (mode?: string) => {
  if (mode === 'MOCK_TEST') {
    return (
      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded">
        Thi thử
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded">
      Luyện tập
    </span>
  );
};

export const UserExamTrackingDrawer: React.FC<UserExamTrackingDrawerProps> = ({
  userId,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'attempts'>('exams');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['adminUserExamTrackingDetail', userId],
    queryFn: () => (userId ? adminApi.getUserExamTrackingDetail(userId) : null),
    enabled: !!userId && isOpen,
  });

  if (!isOpen || !userId) return null;

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
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">
                Chi Tiết Tiến Trình & Lịch Sử Bài Làm
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  data?.subscriptionTier === 'VIP'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {data?.subscriptionTier || 'FREE'}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              <span className="font-semibold text-gray-900">{data?.fullName || 'Học viên'}</span>
              <span className="mx-1.5">•</span>
              <span>{data?.email}</span>
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
            <span className="text-[11px] text-gray-500 font-medium">Số Đề Đã Làm</span>
            <div className="text-lg font-bold text-gray-900 mt-0.5">
              {data?.examSummaries?.length ?? 0} đề
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-2xs">
            <span className="text-[11px] text-gray-500 font-medium">Tổng Lượt Thi</span>
            <div className="text-lg font-bold text-amber-600 mt-0.5">
              {data?.totalExamsAttempted ?? 0} lượt
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-150 shadow-2xs">
            <span className="text-[11px] text-gray-500 font-medium">Điểm Trung Bình</span>
            <div className="text-lg font-bold text-emerald-600 mt-0.5">
              {data?.averageScore !== null && data?.averageScore !== undefined
                ? `${data.averageScore} đ`
                : 'Chưa có'}
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-gray-200 px-5 gap-6 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`flex items-center gap-2 py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'exams'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <BookOpen size={15} />
            <span>Đề Thi Đã Làm ({data?.examSummaries?.length ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attempts')}
            className={`flex items-center gap-2 py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'attempts'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <History size={15} />
            <span>Lịch Sử Chi Tiết Từng Lần ({data?.attempts?.length ?? 0})</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 size={24} className="animate-spin text-amber-500" />
              <span className="text-xs">Đang tải chi tiết các lượt làm bài...</span>
            </div>
          ) : isError ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              Không thể tải chi tiết tiến trình học viên. Vui lòng thử lại.
            </div>
          ) : (
            <>
              {/* Tab 1: Grouped Exam Summaries */}
              {activeTab === 'exams' && (
                <div className="space-y-3">
                  {data?.examSummaries?.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-xs">
                      Học viên chưa thực hiện đề thi nào.
                    </div>
                  ) : (
                    data?.examSummaries?.map((exam: UserExamSummary) => (
                      <div
                        key={exam.examId}
                        className="p-4 rounded-xl border border-gray-200 bg-white hover:border-amber-300 hover:shadow-xs transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                                {exam.examCode}
                              </span>
                              {exam.examType && (
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  {exam.examType}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 mt-1 truncate">
                              {exam.examTitle}
                            </h4>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                              {exam.attemptCount} lượt làm
                            </span>
                          </div>
                        </div>

                        {/* Scores Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-xs">
                          <div className="bg-gray-50/70 p-2 rounded-lg">
                            <span className="text-[10px] text-gray-500 block">Điểm cao nhất</span>
                            <span className="font-bold text-emerald-700 text-sm">
                              {exam.highestScore !== null && exam.highestScore !== undefined
                                ? `${exam.highestScore} đ`
                                : 'Chưa có'}
                            </span>
                          </div>

                          <div className="bg-gray-50/70 p-2 rounded-lg">
                            <span className="text-[10px] text-gray-500 block">Điểm gần nhất</span>
                            <span className="font-bold text-blue-700 text-sm">
                              {exam.latestScore !== null && exam.latestScore !== undefined
                                ? `${exam.latestScore} đ`
                                : 'Chưa có'}
                            </span>
                          </div>

                          <div className="bg-gray-50/70 p-2 rounded-lg col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-gray-500 block">Lần làm gần nhất</span>
                            <span className="text-gray-700 font-medium text-[11px]">
                              {exam.latestAttemptAt
                                ? new Date(exam.latestAttemptAt).toLocaleDateString('vi-VN', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Chưa ghi nhận'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: Detailed Attempt History */}
              {activeTab === 'attempts' && (
                <div className="space-y-3">
                  {data?.attempts?.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-xs">
                      Chưa có lịch sử làm bài nào.
                    </div>
                  ) : (
                    data?.attempts?.map((att: UserAttemptDetail, idx: number) => {
                      const attemptNumberDesc = `Lượt #${data.attempts.length - idx}`;
                      return (
                        <div
                          key={att.attemptId}
                          className="p-4 rounded-xl border border-gray-200 bg-white hover:border-amber-300 hover:shadow-xs transition-all space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  {attemptNumberDesc}
                                </span>
                                <span className="font-mono text-xs font-semibold text-gray-700">
                                  {att.examCode}
                                </span>
                                {getTestModeBadge(att.testMode)}
                              </div>
                              <h5 className="text-xs font-semibold text-gray-900 mt-1 line-clamp-1">
                                {att.examTitle}
                              </h5>
                            </div>

                            <div className="shrink-0">{getStatusBadge(att.status)}</div>
                          </div>

                          {/* Attempt Metrics */}
                          <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-gray-100 gap-2">
                            <div className="flex items-center gap-4 text-gray-500 text-[11px]">
                              <span className="flex items-center gap-1">
                                <Calendar size={13} className="text-gray-400" />
                                {att.startTime
                                  ? new Date(att.startTime).toLocaleDateString('vi-VN', {
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
                                {formatDuration(att.timeSpentSeconds)}
                              </span>
                            </div>

                            <div>
                              <span className="text-[11px] text-gray-500 mr-1.5">Kết quả:</span>
                              <span className="text-xs font-bold text-gray-900">
                                {att.overallScore !== null && att.overallScore !== undefined ? (
                                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                                    {att.overallScore} {att.scoreUnit || 'đ'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic">Chưa nộp / Chưa có</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>Hệ thống chấm điểm CBT tự động</span>
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

