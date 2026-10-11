import { Link, useParams } from 'react-router-dom';
import { Clock, RefreshCw } from 'lucide-react';
import { parseResultAttemptId } from '../api/resultContract';
import { useAttemptResult } from '../hooks/useAttemptResult';
import { ObjectiveResultSummary } from '../components/result/ObjectiveResultSummary';
import { WritingResultSummary } from '../components/result/WritingResultSummary';
import { attemptStatusLabel, formatResultDuration, formatResultTimestamp, resultScopeLabel } from '../utils/resultPresentation';

const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600';

export const ExamResultPage = () => {
  const params = useParams<{ attemptId: string }>();
  const attemptId = parseResultAttemptId(params.attemptId);
  const { data, loading, refreshing, error, refreshError, reload } = useAttemptResult(attemptId);
  const busy = loading || refreshing;
  const heading = data
    ? `Kết quả ${data.testMode === 'MOCK_TEST' ? 'thi thử' : 'luyện tập'} #${data.attemptId}`
    : attemptId === null ? 'Kết quả bài làm' : `Kết quả bài làm #${attemptId}`;
  const canUpdate = attemptId !== null && (!error || error.retryable);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 px-4 py-8 text-slate-800">
      <header className="space-y-3">
        <h1 className="break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{heading}</h1>
        {data && <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-amber-100 px-3 py-1 font-semibold text-amber-900">{resultScopeLabel(data.testScope)}</span>
          <span className="rounded bg-slate-100 px-3 py-1 text-slate-700">{attemptStatusLabel(data.status)}</span>
        </div>}
        <nav aria-label="Thao tác kết quả" className="flex flex-wrap gap-3">
          {canUpdate && <button type="button" className={`${actionClass} disabled:cursor-wait disabled:opacity-60`}
            disabled={busy} onClick={() => { void reload(); }}>
            <RefreshCw size={16} aria-hidden="true" className={busy ? 'motion-safe:animate-spin' : ''} />
            Cập nhật kết quả
          </button>}
          <Link className={actionClass} to="/student/history">Lịch sử làm bài</Link>
          <Link className={actionClass} to="/student/library">Tới trang đề thi</Link>
        </nav>
      </header>

      <p role="status" aria-live="polite" aria-atomic="true" className={busy ? 'text-sm text-slate-600' : 'sr-only'}>
        {loading ? 'Đang tải kết quả…' : refreshing ? 'Đang cập nhật kết quả…' : data ? 'Đã tải kết quả.' : ''}
      </p>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error.message}</p>}
      {refreshError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{refreshError.message}</p>}

      {data && <>
        <section aria-label="Thông tin bài làm" className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Clock size={18} aria-hidden="true" />Thông tin bài làm</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-slate-600">Thời gian làm bài</dt><dd className="mt-1 font-semibold tabular-nums">{formatResultDuration(data.timeSpentSeconds)}</dd></div>
            <div><dt className="text-slate-600">Bắt đầu (giờ Việt Nam)</dt><dd className="mt-1">{formatResultTimestamp(data.startTime)}</dd></div>
            <div><dt className="text-slate-600">Kết thúc (giờ Việt Nam)</dt><dd className="mt-1">{formatResultTimestamp(data.endTime)}</dd></div>
          </dl>
        </section>
        {data.summaryAvailable && data.resultSummary ? <>
          <ObjectiveResultSummary objective={data.resultSummary.objective} />
          <WritingResultSummary writing={data.resultSummary.writing} />
        </> : <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
          Chưa có bản tổng hợp kết quả cho bài làm này. Có thể cập nhật lại để kiểm tra; dữ liệu cũ có thể không có bản tổng hợp.
        </p>}
      </>}
    </div>
  );
};

export default ExamResultPage;
