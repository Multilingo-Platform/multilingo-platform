import React from 'react';
import { useTranslation } from 'react-i18next';

interface DashboardTimeFilterProps {
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

export const DashboardTimeFilter: React.FC<DashboardTimeFilterProps> = ({
  timeRange,
  onTimeRangeChange,
}) => {
  const { t } = useTranslation();

  const options = [
    { value: 'THIS_WEEK', label: t('dashboard.time_range.this_week', 'Tuần này') },
    { value: 'THIS_MONTH', label: t('dashboard.time_range.this_month', 'Tháng này') },
    { value: 'ALL', label: t('dashboard.time_range.this_year', 'Cả năm') },
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

