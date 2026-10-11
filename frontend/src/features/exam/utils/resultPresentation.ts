import type { ExamResultResponse, ResultWritingStatus, TestScope } from '../types/api.types';

const scoreFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const accuracyFormatter = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
export function formatResultScore(value: number): string { return scoreFormatter.format(value); }
export function formatResultAccuracy(value: number): string { return `${accuracyFormatter.format(value)}%`; }
export function formatResultDuration(value: number | null): string {
  if (value === null) return 'Chưa có dữ liệu';
  return `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function formatResultTimestamp(value: string | null): string {
  return value === null ? 'Chưa có dữ liệu' : dateFormatter.format(new Date(value));
}
export function writingStatusLabel(status: ResultWritingStatus): string {
  return { PENDING: 'Đang chờ chấm', QUEUED: 'Đang chờ xử lý', FAILED: 'Chấm Writing thất bại',
    UNAVAILABLE: 'Chưa có kết quả chấm Writing' }[status];
}
export function attemptStatusLabel(status: ExamResultResponse['status']): string {
  return { SUBMITTED: 'Đã nộp bài', AI_GRADING: 'Đang xử lý chấm Writing',
    AI_GRADING_QUEUED: 'Writing đang chờ xử lý', GRADING_FAILED: 'Chấm bài thất bại',
    COMPLETED: 'Bài làm đã hoàn tất', EXPIRED: 'Bài làm đã hết hạn' }[status];
}
export function resultScopeLabel(scope: TestScope): string {
  return { FULL_EXAM: 'Toàn bộ bài thi', SINGLE_SKILL: 'Một kỹ năng', SINGLE_PART: 'Một phần thi' }[scope];
}
