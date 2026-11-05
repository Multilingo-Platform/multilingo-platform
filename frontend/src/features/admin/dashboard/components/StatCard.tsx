import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  tooltipContent?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subValue,
  icon,
  trend,
  trendPositive = true,
  tooltipContent,
}) => {
  return (
    <div className="relative group bg-white rounded-xl border border-gray-200 p-5 shadow-xs hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </span>
        <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trendPositive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      {subValue && (
        <p className="text-xs text-gray-500 mt-2 font-normal">{subValue}</p>
      )}

      {tooltipContent && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] hidden group-hover:block z-50 w-72 p-3.5 bg-gray-900/95 backdrop-blur-xs text-white text-xs rounded-xl shadow-2xl pointer-events-none transition-all">
          {tooltipContent}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900/95" />
        </div>
      )}
    </div>
  );
};
