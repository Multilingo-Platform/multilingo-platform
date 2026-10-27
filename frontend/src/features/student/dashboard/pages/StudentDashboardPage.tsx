import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { studentDashboardApi } from '../api/studentDashboardApi';
import { GreetingHeader } from '../components/GreetingHeader';
import { NewUserWelcomeCard } from '../components/NewUserWelcomeCard';
import { MetricStatCard } from '../components/MetricStatCard';
import { StudyActivityHeatmap } from '../components/StudyActivityHeatmap';
import { ProgressChart } from '../components/ProgressChart';
import { SuggestedActionCard } from '../components/SuggestedActionCard';
import { GoalProgressTrackerCard } from '../components/GoalProgressTrackerCard';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<string>('THIS_WEEK');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const {
    data: dashboardData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['student-dashboard', timeRange, selectedYear],
    queryFn: () => studentDashboardApi.getDashboard(timeRange, selectedYear),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl space-y-5">
        <div className="h-28 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        </div>
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (isError || !dashboardData) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center">
        <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-500 mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">
          Không thể tải dữ liệu bảng điều khiển
        </h2>
        <p className="text-sm text-slate-600 mt-2 mb-6">
          Đã có lỗi xảy ra trong quá trình kết nối tới máy chủ. Vui lòng thử lại.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-all shadow-xs cursor-pointer active:scale-98"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  const { isNewUser, userProfile, streak, examStats, vocabStats, activityHeatmap, progressChart, suggestedActions, goalProgress } = dashboardData;

  const placementAction = suggestedActions.find((a) => a.type === 'PLACEMENT_TEST');
  const regularActions = suggestedActions.filter((a) => a.type !== 'PLACEMENT_TEST');

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      {/* 1. Header & Greeting */}
      <GreetingHeader userProfile={userProfile} />

      {/* 2. New User Welcome Card (Bắt đầu hành trình ngoại ngữ - if Cold Start) */}
      {isNewUser && (
        <NewUserWelcomeCard placementAction={placementAction} />
      )}

      {/* 3. Goal Progress Tracker (Mục tiêu học tập - 5 recent exams vs target score) */}
      {goalProgress && (
        <GoalProgressTrackerCard goalProgress={goalProgress} />
      )}

      {/* 3. Suggested Actions for Active Users */}
      {!isNewUser && regularActions.length > 0 && (
        <SuggestedActionCard actions={regularActions} />
      )}

      {/* 4. Metric Stats Grid */}
      <MetricStatCard streak={streak} examStats={examStats} vocabStats={vocabStats} />

      {/* 5. Study Activity Heatmap (GitHub Style) */}
      <StudyActivityHeatmap
        heatmap={activityHeatmap}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
      />

      {/* 6. Progress Timeline Chart */}
      <ProgressChart
        progressChart={progressChart}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />
    </div>
  );
};

export default StudentDashboardPage;
