import React, { useState, useMemo } from 'react';
import type { ProgressChart as ProgressChartType } from '../types/dashboard.types';
import { DashboardTimeFilter } from './DashboardTimeFilter';
import { TrendingUp, Clock, Award } from 'lucide-react';

interface ProgressChartProps {
  progressChart: ProgressChartType;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

export const ProgressChart: React.FC<ProgressChartProps> = ({
  progressChart,
  timeRange,
  onTimeRangeChange,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const rawDataPoints = progressChart?.dataPoints || [];

  // Robust Normalization: If backend returns daily points for THIS_MONTH or ALL, aggregate on client side
  const dataPoints = useMemo(() => {
    if (!rawDataPoints || rawDataPoints.length === 0) return [];

    if (timeRange === 'THIS_MONTH') {
      // If already aggregated into 4 weeks by backend
      if (rawDataPoints.length <= 4 && rawDataPoints[0]?.label?.startsWith('Tuần')) {
        return rawDataPoints;
      }
      // Group daily points into 4 weeks: 1-7, 8-14, 15-21, 22-end
      const weeks = [
        { label: 'Tuần 1', minutes: 0, questions: 0, date: '' },
        { label: 'Tuần 2', minutes: 0, questions: 0, date: '' },
        { label: 'Tuần 3', minutes: 0, questions: 0, date: '' },
        { label: 'Tuần 4', minutes: 0, questions: 0, date: '' },
      ];

      rawDataPoints.forEach((pt) => {
        const parts = pt.date ? pt.date.split('-') : [];
        const dayOfMonth = parts.length === 3 ? parseInt(parts[2], 10) : 1;
        const weekIdx = dayOfMonth <= 7 ? 0 : dayOfMonth <= 14 ? 1 : dayOfMonth <= 21 ? 2 : 3;
        weeks[weekIdx].minutes += pt.learningMinutes || 0;
        weeks[weekIdx].questions += pt.questionsAnswered || 0;
        if (!weeks[weekIdx].date) weeks[weekIdx].date = pt.date;
      });

      return weeks.map((w, idx) => ({
        date: w.date || `Tuần ${idx + 1}`,
        label: w.label,
        learningMinutes: w.minutes,
        questionsAnswered: w.questions,
      }));
    }

    if (timeRange === 'ALL') {
      // If already aggregated into 12 months by backend
      if (rawDataPoints.length <= 12 && rawDataPoints[0]?.label?.startsWith('Th')) {
        return rawDataPoints;
      }
      // Group daily points into 12 months
      const months = Array.from({ length: 12 }, (_, i) => ({
        label: `Th${i + 1}`,
        minutes: 0,
        questions: 0,
        date: `Tháng ${i + 1}`,
      }));

      rawDataPoints.forEach((pt) => {
        const parts = pt.date ? pt.date.split('-') : [];
        const monthNum = parts.length >= 2 ? parseInt(parts[1], 10) : 1;
        const monthIdx = Math.max(0, Math.min(11, monthNum - 1));
        months[monthIdx].minutes += pt.learningMinutes || 0;
        months[monthIdx].questions += pt.questionsAnswered || 0;
      });

      return months.map((m) => ({
        date: m.date,
        label: m.label,
        learningMinutes: m.minutes,
        questionsAnswered: m.questions,
      }));
    }

    // Default THIS_WEEK: Exactly 7 days
    return rawDataPoints;
  }, [rawDataPoints, timeRange]);

  const totalPeriodMinutes = dataPoints.reduce((sum, d) => sum + d.learningMinutes, 0);
  const averageMinutes = dataPoints.length > 0 ? Math.round(totalPeriodMinutes / dataPoints.length) : 0;

  const averageUnit = useMemo(() => {
    if (timeRange === 'THIS_MONTH') return 'phút/tuần';
    if (timeRange === 'ALL') return 'phút/tháng';
    return 'phút/ngày';
  }, [timeRange]);
  
  // Find peak learning period
  const peakDay = useMemo(() => {
    if (dataPoints.length === 0) return null;
    return [...dataPoints].sort((a, b) => b.learningMinutes - a.learningMinutes)[0];
  }, [dataPoints]);

  // Chart dimensions in SVG coordinate space
  const viewBoxWidth = 800;
  const viewBoxHeight = 230;
  const chartLeft = 52;
  const chartRight = 760;
  const chartTop = 24;
  const chartBottom = 180;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  // Calculate maximum for scaling with some headroom
  const rawMax = Math.max(...dataPoints.map((d) => d.learningMinutes), 0);
  const maxMinutes = Math.max(Math.ceil((rawMax || 45) / 15) * 15, 45);

  // Map data to SVG coordinates
  const points = useMemo(() => {
    if (dataPoints.length === 0) return [];
    return dataPoints.map((pt, i) => {
      const x = dataPoints.length === 1
        ? chartLeft + chartWidth / 2
        : chartLeft + (i / (dataPoints.length - 1)) * chartWidth;
      const y = chartBottom - (pt.learningMinutes / maxMinutes) * chartHeight;
      return { x, y, pt };
    });
  }, [dataPoints, maxMinutes, chartLeft, chartWidth, chartBottom, chartHeight]);

  // Build Catmull-Rom to Cubic Bézier spline curve with zero-floor clamping
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      return {
        linePath: `M ${points[0].x} ${points[0].y}`,
        areaPath: `M ${points[0].x - 20} ${chartBottom} L ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y} L ${points[0].x + 20} ${chartBottom} Z`,
      };
    }

    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

      const tension = 0.2; // Smooth curve factor
      let cp1x = p1.x + (p2.x - p0.x) * tension;
      let cp1y = p1.y + (p2.y - p0.y) * tension;
      let cp2x = p2.x - (p3.x - p1.x) * tension;
      let cp2y = p2.y - (p3.y - p1.y) * tension;

      // Prevent curve from dipping below 0p (chartBottom) or overshooting
      if (p1.pt.learningMinutes === 0 && p2.pt.learningMinutes === 0) {
        cp1y = chartBottom;
        cp2y = chartBottom;
      } else {
        cp1y = Math.min(chartBottom, Math.max(chartTop, cp1y));
        cp2y = Math.min(chartBottom, Math.max(chartTop, cp2y));
      }

      path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    const area = `${path} L ${points[points.length - 1].x.toFixed(2)} ${chartBottom} L ${points[0].x.toFixed(2)} ${chartBottom} Z`;

    return { linePath: path, areaPath: area };
  }, [points, chartBottom, chartTop]);

  // Y-axis grid ticks (0%, 50%, 100%)
  const yTicks = [
    { value: maxMinutes, y: chartTop },
    { value: Math.round(maxMinutes / 2), y: chartTop + chartHeight / 2 },
    { value: 0, y: chartBottom },
  ];

  const activePoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 md:p-6 shadow-xs">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-900">
              Tiến độ học tập trong kỳ
            </h3>
          </div>
          <div className="flex items-center flex-wrap gap-2 md:gap-3 mt-1.5 text-xs md:text-sm text-slate-600">
            <span>
              Tổng thời gian:{' '}
              <strong className="text-amber-600 font-bold">
                {totalPeriodMinutes} phút
              </strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Trung bình:{' '}
              <strong className="text-slate-800 font-semibold">
                {averageMinutes} {averageUnit}
              </strong>
            </span>
            {peakDay && peakDay.learningMinutes > 0 && (
              <>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  Cao nhất:{' '}
                  <strong className="text-slate-800 font-semibold">
                    {peakDay.label} ({peakDay.learningMinutes}p)
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>

        <DashboardTimeFilter
          timeRange={timeRange}
          onTimeRangeChange={onTimeRangeChange}
        />
      </div>

      {/* Smooth Gradient Area Chart Container */}
      <div className="relative select-none pt-2">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            {/* Elegant soft amber gradient for area fill */}
            <linearGradient id="progressAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.22" />
              <stop offset="60%" stopColor="#FBBF24" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#FEF3C7" stopOpacity="0.0" />
            </linearGradient>

            {/* Vibrant gradient for thin, sleek stroke line */}
            <linearGradient id="progressLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>

            {/* Subtle line shadow for modern depth without thickness */}
            <filter id="progressLineGlow" x="-10%" y="-20%" width="120%" height="150%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#EA580C" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* Horizontal dashed reference lines */}
          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={chartLeft}
                y1={tick.y}
                x2={chartRight}
                y2={tick.y}
                stroke="#E2E8F0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={chartLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="text-[11px] fill-slate-400 font-medium"
              >
                {tick.value}p
              </text>
            </g>
          ))}

          {/* Area Fill */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#progressAreaGradient)"
              className="transition-all duration-300"
            />
          )}

          {/* Thin, sleek curve line (strokeWidth="1.8") */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#progressLineGradient)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#progressLineGlow)"
              className="transition-all duration-300"
            />
          )}

          {/* Active hover vertical guide line */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={chartTop}
              x2={activePoint.x}
              y2={chartBottom}
              stroke="#D97706"
              strokeDasharray="3 3"
              strokeWidth="1"
              opacity="0.65"
            />
          )}

          {/* Perfectly-aligned SVG X-Axis Labels */}
          {points.map((p, i) => (
            <text
              key={p.pt.date + i}
              x={p.x}
              y={chartBottom + 22}
              textAnchor="middle"
              className={`text-[11px] sm:text-[12px] select-none transition-colors duration-150 ${
                hoveredIndex === i ? 'fill-amber-600 font-bold' : 'fill-slate-500 font-medium'
              }`}
            >
              {p.pt.label}
            </text>
          ))}

          {/* Interactive Data Points & Hover Targets */}
          {points.map((p, i) => {
            const isHovered = hoveredIndex === i;
            const hasActivity = p.pt.learningMinutes > 0;

            return (
              <g
                key={p.pt.date + i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                {/* Invisible large touch/hover area */}
                <circle cx={p.x} cy={p.y} r="18" fill="transparent" />

                {/* Visible sleek point circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 4.5 : hasActivity ? 3 : 1.8}
                  fill={isHovered ? '#EA580C' : hasActivity ? '#EA580C' : '#CBD5E1'}
                  stroke="#FFFFFF"
                  strokeWidth={isHovered ? 2 : 1}
                  className="transition-all duration-200"
                />

                {/* Glowing ring when hovered */}
                {isHovered && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="8"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    opacity="0.5"
                    className="animate-ping"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Dynamic Tooltip on Hover */}
        {activePoint && (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 bg-slate-900/95 text-white text-xs md:text-sm py-2 px-3.5 rounded-lg shadow-xl backdrop-blur-xs whitespace-nowrap transition-all duration-150 animate-fade-in"
            style={{
              left: `${(activePoint.x / viewBoxWidth) * 100}%`,
              top: `${(activePoint.y / viewBoxHeight) * 100}%`,
            }}
          >
            <div className="font-bold text-slate-100 flex items-center gap-1.5">
              <span>{activePoint.pt.label}</span>
              {timeRange === 'THIS_WEEK' && (
                <span className="text-slate-400 font-normal">({activePoint.pt.date})</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-amber-300 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>{activePoint.pt.learningMinutes} phút học</span>
            </div>
            {activePoint.pt.questionsAnswered > 0 && (
              <div className="mt-0.5 flex items-center gap-1.5 text-emerald-400 text-xs font-normal">
                <Award className="w-3.5 h-3.5" />
                <span>{activePoint.pt.questionsAnswered} câu hỏi hoàn thành</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default ProgressChart;
