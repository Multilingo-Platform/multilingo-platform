import type { ResultSummary } from '../../types/api.types';
import { writingStatusLabel } from '../../utils/resultPresentation';

export function WritingResultSummary({ writing }: { writing: ResultSummary['writing'] }) {
  if (!writing) return null;
  return (
    <section aria-label="Writing" className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Writing</h2>
      <p className="text-sm text-slate-700">{writingStatusLabel(writing.status)}</p>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        {writing.tasks.map(task => (
          <article key={JSON.stringify([task.partId, task.questionId])} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h3 className="break-words font-semibold [overflow-wrap:anywhere]">{task.label}</h3>
            <p className="mt-1 break-words text-sm text-slate-600 [overflow-wrap:anywhere]">Phần {task.partId} · Câu {task.questionId}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="text-slate-600">Trạng thái</dt><dd>{writingStatusLabel(task.status)}</dd></div>
              <div><dt className="text-slate-600">Số từ</dt><dd className="tabular-nums">{task.wordCount}</dd></div>
              <div><dt className="text-slate-600">Điểm Writing</dt><dd>Chưa có điểm</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
