import { examMessage as em, examUiLocale } from '../i18n/examMessages';
import type { ExamResultResponse, ResultWritingStatus, TestScope } from '../types/api.types';

const scoreFormatter = () => new Intl.NumberFormat(examUiLocale(), { maximumFractionDigits: 2 });
const accuracyFormatter = () => new Intl.NumberFormat(examUiLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormatter = () => new Intl.DateTimeFormat(examUiLocale(), {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
export function formatResultScore(value: number): string { return scoreFormatter().format(value); }
export function formatResultAccuracy(value: number): string { return `${accuracyFormatter().format(value)}%`; }
export function formatResultDuration(value: number | null): string {
  if (value === null) return em("Chưa có dữ liệu");
  return `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function formatResultTimestamp(value: string | null): string {
  return value === null ? em("Chưa có dữ liệu") : dateFormatter().format(new Date(value));
}
export function writingStatusLabel(status: ResultWritingStatus): string {
  return { PENDING: em("Đang chờ chấm"), QUEUED: em("Đang chờ xử lý"), DONE: em("Đã có kết quả Writing"), FAILED: em("Chấm Writing thất bại"),
    UNAVAILABLE: em("Chưa có kết quả chấm Writing") }[status];
}
export function attemptStatusLabel(status: ExamResultResponse['status']): string {
  return { SUBMITTED: em("Đã nộp bài"), AI_GRADING: em("Đang xử lý chấm Writing"),
    AI_GRADING_QUEUED: em("Writing đang chờ xử lý"), GRADING_FAILED: em("Chấm bài thất bại"),
    COMPLETED: em("Bài làm đã hoàn tất"), EXPIRED: em("Bài làm đã hết hạn") }[status];
}
export function resultScopeLabel(scope: TestScope): string {
  return { FULL_EXAM: em("Toàn bộ bài thi"), SINGLE_SKILL: em("Một kỹ năng"), SINGLE_PART: em("Một phần thi") }[scope];
}
