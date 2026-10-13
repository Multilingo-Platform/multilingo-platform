import React from 'react';

interface RevenueChartProps {
  labels: string[];
  data: number[];
  totalPeriodRevenue: number;
  period: string;
  onPeriodChange: (p: string) => void;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  labels,
  data,
  totalPeriodRevenue,
  period,
  onPeriodChange,
}) => {
  const maxVal = Math.max(...data, 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold text-gray-900">
            Biểu Đồ Doanh Thu Giao Dịch
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Tổng doanh thu kỳ:{' '}
            <span className="font-semibold text-amber-600">
              {new Intl.NumberFormat('vi-VN', {
                style: 'currency',
                currency: 'VND',
              }).format(totalPeriodRevenue)}
            </span>
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50 text-xs">
          <button
            type="button"
            onClick={() => onPeriodChange('7d')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              period === '7d'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            7 ngày gần nhất
          </button>
          <button
            type="button"
            onClick={() => onPeriodChange('30d')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              period === '30d'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            30 ngày gần nhất
          </button>
        </div>
      </div>

      {/* Bar Chart Visualization */}
      <div className="h-56 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-gray-100">
        {data.map((val, idx) => {
          const heightPercent = Math.max(Math.round((val / maxVal) * 100), 4);
          return (
            <div
              key={labels[idx] || idx}
              className="flex-1 flex flex-col items-center h-full justify-end group relative"
            >
              {/* Tooltip */}
              <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10 shadow-sm">
                {new Intl.NumberFormat('vi-VN', {
                  style: 'currency',
                  currency: 'VND',
                }).format(val)}
              </div>

              {/* Bar */}
              <div
                style={{ height: `${heightPercent}%` }}
                className="w-full max-w-[32px] rounded-t-md bg-amber-500 hover:bg-amber-600 transition-all duration-300 shadow-xs"
              />
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex gap-2 px-2 mt-2">
        {labels.map((lbl, idx) => (
          <div
            key={lbl + idx}
            className="flex-1 text-center text-[10px] text-gray-400 font-medium truncate"
          >
            {lbl}
          </div>
        ))}
      </div>
    </div>
  );
};
