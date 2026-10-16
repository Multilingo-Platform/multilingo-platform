import { Link, useParams } from 'react-router-dom';
import { Clock, RefreshCw, BookOpen, History, Library } from 'lucide-react';
import { parseResultAttemptId } from '../api/resultContract';
import { useAttemptResult } from '../hooks/useAttemptResult';
import { ObjectiveResultSummary } from '../components/result/ObjectiveResultSummary';
import { WritingResultSummary } from '../components/result/WritingResultSummary';
import { attemptStatusLabel, formatResultDuration, formatResultTimestamp, resultScopeLabel } from '../utils/resultPresentation';

const btnBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 active:scale-[0.98]';

const btnPrimary =
  `${btnBase} bg-amber-600 text-white shadow-sm shadow-amber-600/30 hover:bg-amber-700 hover:shadow-md border border-amber-600 hover:border-amber-700`;

const btnLight =
  `${btnBase} bg-amber-50 text-amber-900 border border-amber-300/80 shadow-2xs hover:bg-amber-100 hover:border-amber-400 hover:text-amber-950 disabled:cursor-wait disabled:opacity-60 disabled:hover:bg-amber-50`;

const btnOutline =
  `${btnBase} bg-white text-slate-700 border border-slate-300 shadow-2xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 hover:shadow-xs`;

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
      <header className="space-y-4">
        <h1 className="break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{heading}</h1>
        {data && <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200/80 px-3 py-1 text-xs font-semibold text-amber-800">{resultScopeLabel(data.testScope)}</span>
          <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">{attemptStatusLabel(data.status)}</span>
        </div>}
        <nav aria-label="Thao tác kết quả" className="flex flex-wrap items-center gap-3 pt-1">
          {data && data.reviewParts && data.reviewParts.length > 0 && (
            <Link
              className={btnPrimary}
              to={`/attempts/${data.attemptId}/review?partId=${data.reviewParts[0].id}`}
            >
              <BookOpen size={18} aria-hidden="true" className="shrink-0" />
              <span>Xem bài làm và lời giải</span>
            </Link>
          )}
          {canUpdate && <button type="button" className={btnLight}
            disabled={busy} onClick={() => { void reload(); }}>
            <RefreshCw size={16} aria-hidden="true" className={busy ? 'motion-safe:animate-spin shrink-0 text-amber-700' : 'shrink-0 text-amber-700'} />
            <span>Cập nhật kết quả</span>
          </button>}
          <Link className={btnOutline} to="/student/history">
            <History size={16} aria-hidden="true" className="shrink-0 text-slate-500" />
            <span>Lịch sử làm bài</span>
          </Link>
          <Link className={btnOutline} to="/student/library">
            <Library size={16} aria-hidden="true" className="shrink-0 text-slate-500" />
            <span>Tới trang đề thi</span>
          </Link>
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
          <WritingResultSummary key={data.attemptId} writing={data.resultSummary.writing} attemptId={data.attemptId} />
        </> : <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
          Chưa có bản tổng hợp kết quả cho bài làm này. Có thể cập nhật lại để kiểm tra; dữ liệu cũ có thể không có bản tổng hợp.
        </p>}
      </>}
    </div>
  );
};

export default ExamResultPage;
