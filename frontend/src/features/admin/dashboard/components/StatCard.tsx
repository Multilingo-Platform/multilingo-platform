import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  onClick?: () => void;
  clickableHint?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subValue,
  icon,
  trend,
  trendPositive = true,
  onClick,
  clickableHint,
}) => {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`relative bg-white rounded-xl border border-gray-200 p-5 shadow-xs transition-all ${
        isClickable
          ? 'cursor-pointer hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus:outline-hidden focus:ring-2 focus:ring-amber-500/20'
          : 'hover:shadow-md'
      }`}
    >
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
      <div className="flex items-center justify-between mt-2">
        {subValue && (
          <p className="text-xs text-gray-500 font-normal">{subValue}</p>
        )}
        {clickableHint && (
          <span className="text-[11px] font-semibold text-amber-600 hover:text-amber-700 inline-flex items-center gap-0.5 ml-auto">
            {clickableHint}
          </span>
        )}
      </div>
    </div>
  );
};
