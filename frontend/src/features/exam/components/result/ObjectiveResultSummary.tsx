import { Check, Minus, Target, X } from 'lucide-react';
import type { ObjectiveResultStats, ResultSummary } from '../../types/api.types';
import { formatResultAccuracy, formatResultScore } from '../../utils/resultPresentation';

type StatsRow = ObjectiveResultStats & { key: string | number; label: string; skill: string };

function StatsTable({ title, rows }: { title: string; rows: StatsRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div role="region" aria-label={title} tabIndex={0}
      className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs focus-visible:outline-2 focus-visible:outline-amber-600">
      <table className="w-full min-w-[600px] text-sm text-left">
        <caption className="p-4 text-left font-semibold text-slate-900">{title}</caption>
        <thead className="bg-slate-50 text-slate-700"><tr>
          {['Tên', 'Kỹ năng', 'Điểm raw', 'Đúng', 'Sai', 'Bỏ trống', 'Tổng', 'Độ chính xác'].map(label => (
            <th key={label} scope="col" className="px-3 py-3">{label}</th>
          ))}
        </tr></thead>
        <tbody>{rows.map(row => (
          <tr key={row.key} className="border-t border-slate-200">
            <th scope="row" className="max-w-64 break-words [overflow-wrap:anywhere] px-3 py-3 font-medium">{row.label}</th>
            <td className="max-w-40 break-words [overflow-wrap:anywhere] px-3 py-3">{row.skill}</td>
            <td className="px-3 py-3 tabular-nums">{formatResultScore(row.rawScore)}</td>
            <td className="px-3 py-3 tabular-nums">{row.correct}</td>
            <td className="px-3 py-3 tabular-nums">{row.incorrect}</td>
            <td className="px-3 py-3 tabular-nums">{row.unanswered}</td>
            <td className="px-3 py-3 tabular-nums">{row.total}</td>
            <td className="px-3 py-3 tabular-nums">{formatResultAccuracy(row.accuracy)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function ObjectiveResultSummary({ objective }: { objective: ResultSummary['objective'] }) {
  if (objective.total === 0) return <p className="rounded-xl border border-slate-200 bg-white p-5">Không có câu khách quan trong phạm vi bài làm này.</p>;
  const cards = [
    { label: 'Điểm khách quan (raw)', value: formatResultScore(objective.rawScore), icon: Target },
    { label: 'Câu đúng / tổng số câu', value: `${objective.correct}/${objective.total}`, icon: Check },
    { label: 'Câu sai', value: objective.incorrect, icon: X },
    { label: 'Câu bỏ trống', value: objective.unanswered, icon: Minus },
  ];
  return (
    <section aria-label="Kết quả khách quan" className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Kết quả khách quan</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <p className="flex items-center gap-2 text-sm text-slate-600"><Icon size={16} aria-hidden="true" />{label}</p>
            <p className="mt-3 break-words text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-700">Độ chính xác: <strong>{formatResultAccuracy(objective.accuracy)}</strong></p>
      <StatsTable title="Kết quả theo kỹ năng" rows={objective.bySkill.map((row, index) => ({ ...row, key: index, label: row.skill }))} />
      <StatsTable title="Kết quả theo phần thi" rows={objective.byPart.map(row => ({ ...row, key: row.partId }))} />
    </section>
  );
}
