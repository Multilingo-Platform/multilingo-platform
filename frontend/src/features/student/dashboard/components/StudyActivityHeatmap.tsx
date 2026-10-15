import React, { useMemo, useState, useRef } from 'react';
import type { ActivityHeatmap, HeatmapDataPoint } from '../types/dashboard.types';

interface StudyActivityHeatmapProps {
  heatmap: ActivityHeatmap;
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export const StudyActivityHeatmap: React.FC<StudyActivityHeatmapProps> = ({
  heatmap,
  selectedYear,
  onYearChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Pre-index dataPoints by date string 'YYYY-MM-DD'
  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapDataPoint>();
    if (heatmap?.dataPoints) {
      heatmap.dataPoints.forEach((pt) => {
        map.set(pt.date, pt);
      });
    }
    return map;
  }, [heatmap]);

  // Generate 52/53 weeks of the selected year
  const { weeks, monthLabels } = useMemo(() => {
    const startDate = new Date(selectedYear, 0, 1);
    // Align to the start of the week (Sunday = 0)
    const dayOfWeek = startDate.getDay();
    const calendarStart = new Date(startDate);
    calendarStart.setDate(startDate.getDate() - dayOfWeek);

    const endDate = new Date(selectedYear, 11, 31);
    const calendarEnd = new Date(endDate);
    const endDayOfWeek = calendarEnd.getDay();
    calendarEnd.setDate(endDate.getDate() + (6 - endDayOfWeek));

    const weeksArray: { date: Date; dateStr: string; inYear: boolean }[][] = [];
    const monthsHeader: { month: string; colIndex: number }[] = [];

    let currentWeek: { date: Date; dateStr: string; inYear: boolean }[] = [];
    let cur = new Date(calendarStart);
    let lastMonth = -1;
    let colIdx = 0;

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    while (cur <= calendarEnd) {
      const year = cur.getFullYear();
      const month = cur.getMonth();
      const day = cur.getDate();
      const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
      const inYear = year === selectedYear;

      if (inYear && month !== lastMonth && cur.getDay() <= 3) {
        const monthNames = [
          'Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6',
          'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12',
        ];
        monthsHeader.push({ month: monthNames[month], colIndex: colIdx });
        lastMonth = month;
      }

      currentWeek.push({ date: new Date(cur), dateStr, inYear });

      if (currentWeek.length === 7) {
        weeksArray.push(currentWeek);
        currentWeek = [];
        colIdx++;
      }

      cur.setDate(cur.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeksArray.push(currentWeek);
    }

    return { weeks: weeksArray, monthLabels: monthsHeader };
  }, [selectedYear]);

  const getCellColor = (level: number, inYear: boolean) => {
    if (!inYear) return 'bg-transparent';
    switch (level) {
      case 1:
        return 'bg-[#9be9a8] border border-[#8ce199]';
      case 2:
        return 'bg-[#40c463] border border-[#34b255]';
      case 3:
        return 'bg-[#30a14e] border border-[#278e42]';
      case 4:
        return 'bg-[#216e39] border border-[#1b5e30] shadow-xs';
      default:
        return 'bg-[#ebedf0] border border-[#d0d7de]';
    }
  };

  const handleCellMouseEnter = (e: React.MouseEvent<HTMLDivElement>, tooltipText: string) => {
    if (!tooltipText || !containerRef.current) return;
    const cellRect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    setHoveredCell({
      x: cellRect.left - containerRect.left + containerRef.current.scrollLeft + cellRect.width / 2,
      y: cellRect.top - containerRect.top - 6,
      text: tooltipText,
    });
  };

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear - 1];

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 md:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Bản đồ nhiệt hoạt động học tập</span>
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Mỗi ô vuông thể hiện mức độ học tập thực tế trong ngày của bạn
          </p>
        </div>

        {/* Year Selector */}
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs md:text-sm font-medium self-start sm:self-auto">
          {availableYears.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => onYearChange(yr)}
              className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
                selectedYear === yr
                  ? 'bg-white text-emerald-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Container with horizontal scrolling */}
      <div className="relative overflow-x-auto pb-3 pt-6" ref={containerRef}>
        <div className="min-w-[760px] inline-block relative">
          {/* Months header */}
          <div className="flex text-xs md:text-sm text-slate-600 font-semibold mb-2 pl-8">
            {monthLabels.map((lbl, idx) => (
              <span
                key={lbl.month + idx}
                style={{ marginLeft: idx === 0 ? `${lbl.colIndex * 14}px` : `${Math.max(0, (lbl.colIndex - (monthLabels[idx - 1]?.colIndex || 0)) * 14 - 24)}px` }}
              >
                {lbl.month}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            {/* Day of week labels */}
            <div className="flex flex-col justify-between text-xs md:text-sm text-slate-500 font-semibold py-0.5 pr-2 select-none">
              <span className="h-[12px] leading-[12px]">T2</span>
              <span className="h-[12px] leading-[12px]">T4</span>
              <span className="h-[12px] leading-[12px]">T6</span>
            </div>

            {/* Grid of Weeks */}
            <div className="flex gap-[3.5px]">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3.5px]">
                  {week.map((day, dIdx) => {
                    const data = dataMap.get(day.dateStr);
                    const level = data?.level || 0;
                    const minutes = data?.learningMinutes || 0;
                    const dateFormatted = new Intl.DateTimeFormat('vi-VN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                    }).format(day.date);

                    const tooltipText = day.inYear
                      ? `${dateFormatted}: ${minutes} phút học tập • ${data?.flashcardsReviewed || 0} từ đã ôn • ${data?.xpEarned || 0} XP`
                      : '';

                    return (
                      <div
                        key={dIdx}
                        onMouseEnter={(e) => handleCellMouseEnter(e, tooltipText)}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`w-[12px] h-[12px] rounded-[3px] transition-transform hover:scale-130 cursor-pointer ${getCellColor(
                          level,
                          day.inYear
                        )}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Floating Tooltip outside week columns */}
          {hoveredCell && (
            <div
              className="absolute z-50 pointer-events-none -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-xs md:text-sm px-3.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap transition-all"
              style={{
                left: `${hoveredCell.x}px`,
                top: `${hoveredCell.y}px`,
              }}
            >
              {hoveredCell.text}
            </div>
          )}
        </div>
      </div>

      {/* Footer / Legend */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-sm md:text-base text-slate-600 gap-3">
        <div>
          <span>
            <strong className="text-slate-900 font-bold">
              {heatmap.totalActiveDays} ngày học tập
            </strong>{' '}
            trong năm {selectedYear}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs md:text-sm font-medium text-slate-500">Ít hơn</span>
          <div className="w-[12px] h-[12px] rounded-[3px] bg-[#ebedf0] border border-[#d0d7de]" title="0 phút" />
          <div className="w-[12px] h-[12px] rounded-[3px] bg-[#9be9a8] border border-[#8ce199]" title="1-15 phút" />
          <div className="w-[12px] h-[12px] rounded-[3px] bg-[#40c463] border border-[#34b255]" title="16-30 phút" />
          <div className="w-[12px] h-[12px] rounded-[3px] bg-[#30a14e] border border-[#278e42]" title="31-60 phút" />
          <div className="w-[12px] h-[12px] rounded-[3px] bg-[#216e39] border border-[#1b5e30]" title="> 60 phút" />
          <span className="text-xs md:text-sm font-medium text-slate-500">Nhiều hơn</span>
        </div>
      </div>
    </div>
  );
};

