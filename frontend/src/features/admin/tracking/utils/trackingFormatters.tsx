import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck2,
  Cpu,
  ListOrdered,
} from 'lucide-react';

export const formatAttemptStatusBadge = (status?: string): React.ReactNode => {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
          <CheckCircle2 size={12} className="shrink-0" />
          Đã hoàn thành
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-full">
          <Clock size={12} className="shrink-0" />
          Đang làm bài
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/70 px-2 py-0.5 rounded-full">
          <Clock size={12} className="shrink-0" />
          Quá hạn / Hết giờ
        </span>
      );
    case 'SUBMITTED':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-full">
          <FileCheck2 size={12} className="shrink-0" />
          Đã nộp bài
        </span>
      );
    case 'AI_GRADING':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/70 px-2 py-0.5 rounded-full">
          <Cpu size={12} className="shrink-0" />
          AI đang chấm
        </span>
      );
    case 'AI_GRADING_QUEUED':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full">
          <ListOrdered size={12} className="shrink-0" />
          Chờ chấm AI
        </span>
      );
    case 'GRADING_FAILED':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
          <AlertTriangle size={12} className="shrink-0 text-red-600" />
          Lỗi chấm điểm
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

export const getAttemptScoreText = (
  score?: number | null,
  unit?: string | null,
  examType?: string | null
): string => {
  if (score === null || score === undefined) return 'Chưa có';

  const normalizedUnit = (unit || '').toUpperCase();
  const normalizedType = (examType || '').toUpperCase();

  if (normalizedUnit === 'RAW_OBJECTIVE' || normalizedUnit === 'LEGACY_RAW') {
    return `${score} câu đúng`;
  }
  if (normalizedUnit === 'IELTS_BAND' || normalizedType.startsWith('IELTS')) {
    return `Band ${score}`;
  }
  if (normalizedUnit === 'TOEIC_SCALED' || normalizedType.startsWith('TOEIC')) {
    return `${Math.round(score)} điểm`;
  }
  if (normalizedUnit === 'ĐIỂM' || normalizedUnit === 'DIEM') {
    return `${score} điểm`;
  }
  if (normalizedUnit === 'BAND') {
    return `Band ${score}`;
  }
  if (normalizedUnit === 'CÂU' || normalizedUnit === 'CAU') {
    return `${score} câu`;
  }
  return `${score} đ`;
};

export const formatAttemptScore = (
  score?: number | null,
  unit?: string | null,
  examType?: string | null,
  customClassName?: string
): React.ReactNode => {
  if (score === null || score === undefined) {
    return <span className="text-gray-400 italic">Chưa nộp / Chưa có</span>;
  }

  const displayText = getAttemptScoreText(score, unit, examType);

  return (
    <span
      className={
        customClassName ||
        'text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold'
      }
    >
      {displayText}
    </span>
  );
};

export const formatTestModeBadge = (mode?: string): React.ReactNode => {
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

export const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return '0 giây';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} giây`;
  if (s === 0) return `${m} phút`;
  return `${m} phút ${s} giây`;
};
