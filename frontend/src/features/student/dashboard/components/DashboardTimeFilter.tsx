import React from 'react';

interface DashboardTimeFilterProps {
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

export const DashboardTimeFilter: React.FC<DashboardTimeFilterProps> = ({
  timeRange,
  onTimeRangeChange,
}) => {
  const options = [
    { value: 'THIS_WEEK', label: 'Tuần này' },
    { value: 'THIS_MONTH', label: 'Tháng này' },
    { value: 'ALL', label: 'Cả năm' },
  ];

  return (
    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-medium self-start sm:self-auto">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onTimeRangeChange(opt.value)}
          className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
            timeRange === opt.value
              ? 'bg-white text-amber-700 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

