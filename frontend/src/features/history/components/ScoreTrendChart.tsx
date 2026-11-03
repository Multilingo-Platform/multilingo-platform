import React, { useState } from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ScoreTrendItem } from '../types/history.types';

interface ScoreTrendChartProps {
  trends: ScoreTrendItem[];
  loading: boolean;
}

export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({ trends, loading }) => {
  const { t } = useTranslation();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedCertFilter, setSelectedCertFilter] = useState<string>('ALL');

  const availableCerts = React.useMemo(() => {
    if (!trends) return [];
    const set = new Set<string>();
    trends.forEach((t) => {
      if (t.certType && t.certType !== 'OTHER') {
        set.add(t.certType);
      }
    });
    return Array.from(set);
  }, [trends]);

  const displayedTrends = React.useMemo(() => {
    if (!trends) return [];
    if (selectedCertFilter === 'ALL') return trends;
    return trends.filter((t) => t.certType === selectedCertFilter);
  }, [trends, selectedCertFilter]);

  if (loading) {
    return (
      <div className="history-chart-card">
        <div className="history-chart-skeleton" />
      </div>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="history-chart-card empty">
        <div className="history-chart-empty-content">
          <Sparkles className="history-chart-empty-icon" size={36} />
          <h4>{t('history.chart.empty_title', 'Chưa có dữ liệu tiến độ điểm số')}</h4>
          <p>{t('history.chart.empty_desc', 'Hãy hoàn thành bài thi thử hoặc bài luyện tập đầu tiên để kích hoạt biểu đồ theo dõi năng lực.')}</p>
        </div>
      </div>
    );
  }

  // Chart dimensions
  const width = 800;
  const height = 220;
  const paddingX = 60;
  const paddingTop = 35;
  const paddingBottom = 45;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate coordinates
  const n = displayedTrends.length;
  const points = displayedTrends.map((item, idx) => {
    const x = n === 1 ? width / 2 : paddingX + (idx / (n - 1)) * chartWidth;
    const clampedPercentage = item.percentage === null ? null : Math.min(100, Math.max(0, item.percentage));
    const y = clampedPercentage === null ? paddingTop + chartHeight : paddingTop + chartHeight - (clampedPercentage / 100) * chartHeight;
    return { x, y, item };
  });

  // Never connect points with different score units, or bridge raw-only attempts.
  const lineSegments: string[] = [];
  let currentSegment = '';
  let currentUnit: string | null = null;
  for (const point of points) {
    const unit = point.item.scoreUnit ?? 'LEGACY_RAW';
    if (point.item.percentage === null) {
      if (currentSegment) lineSegments.push(currentSegment);
      currentSegment = '';
      currentUnit = null;
      continue;
    }
    if (currentSegment && currentUnit === unit) currentSegment += ` L ${point.x} ${point.y}`;
    else {
      if (currentSegment) lineSegments.push(currentSegment);
      currentSegment = `M ${point.x} ${point.y}`;
      currentUnit = unit;
    }
  }
  if (currentSegment) lineSegments.push(currentSegment);

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const formatScoreBadge = (item: ScoreTrendItem) => {
    if (item.score === null) return '—';
    if (item.scoreUnit === 'IELTS_BAND') return `Band ${item.score}`;
    if (item.scoreUnit === 'TOEIC_SCALED') return `${Math.round(item.score)} đ`;
    if (item.scoreUnit === 'RAW_OBJECTIVE' || item.scoreUnit === 'LEGACY_RAW' || !item.scoreUnit) return `${item.score} raw`;
    if (item.certType === 'NLTV') return `Bậc ${item.score}`;
    return `${item.score} đ`;
  };

  return (
    <div className="history-chart-card">
      <div className="history-chart-header">
        <div className="history-chart-title-wrap">
          <TrendingUp className="history-chart-icon" size={20} />
          <h3 className="history-chart-title">{t('history.chart.title', 'Tiến Độ Điểm Số Gần Đây')}</h3>
        </div>
        <div className="history-chart-actions">
          {availableCerts.length > 1 && (
            <div className="history-chart-cert-filters" role="tablist">
              <button
                type="button"
                className={`history-chart-filter-chip ${selectedCertFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedCertFilter('ALL')}
              >
                {t('history.chart.filter_all', 'Tất cả')} ({trends.length})
              </button>
              {availableCerts.map((c) => {
                const count = trends.filter((t) => t.certType === c).length;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`history-chart-filter-chip ${selectedCertFilter === c ? 'active' : ''}`}
                    onClick={() => setSelectedCertFilter(c)}
                  >
                    {c} ({count})
                  </button>
                );
              })}
            </div>
          )}
          <span className="history-chart-subtitle">
            {t('history.chart.recent_subtitle', { count: displayedTrends.length, defaultValue: `${displayedTrends.length} lần làm bài gần nhất` })}
          </span>
        </div>
      </div>

      <div className="history-chart-svg-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="history-chart-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="historyTrendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ea580c" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = paddingTop + chartHeight - (pct / 100) * chartHeight;
            return (
              <g key={pct}>
                <line
                  x1={paddingX - 10}
                  y1={y}
                  x2={width - paddingX + 10}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 18}
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="end"
                  fontWeight="600"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Curve Stroke Line */}
          {lineSegments.map((path, idx) => <path key={idx} d={path} fill="none" stroke="#ea580c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />)}

          {/* Point Circles and Labels */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g key={idx}>
                {pt.item.percentage !== null && <>
                {/* Score badge above circle */}
                <rect
                  x={pt.x - 28}
                  y={pt.y - 26}
                  width="56"
                  height="18"
                  rx="6"
                  fill={isHovered ? '#ea580c' : '#ffffff'}
                  stroke={isHovered ? '#ea580c' : '#fdba74'}
                  strokeWidth="1.5"
                />
                <text
                  x={pt.x}
                  y={pt.y - 13}
                  textAnchor="middle"
                  fill={isHovered ? '#ffffff' : '#ea580c'}
                  fontSize="10"
                  fontWeight="700"
                >
                  {formatScoreBadge(pt.item)}
                </text>

                {/* Point circle */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 7 : 5}
                  fill="#ffffff"
                  stroke="#ea580c"
                  strokeWidth={isHovered ? 3.5 : 2.5}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
                </>}

                {/* Date label at bottom */}
                <text
                  x={pt.x}
                  y={height - 14}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="11"
                  fontWeight="600"
                >
                  {formatDate(pt.item.completedAt)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="history-chart-tooltip"
            style={{
              left: `${(points[hoveredIdx].x / width) * 100}%`,
              top: `${(points[hoveredIdx].y / height) * 100}%`,
            }}
          >
            <div className="history-tooltip-cert">
              {points[hoveredIdx].item.certType}
            </div>
            <div className="history-tooltip-title">
              {points[hoveredIdx].item.examTitle}
            </div>
            <div className="history-tooltip-score">
              {t('history.chart.tooltip_score', 'Điểm:')} <strong>{points[hoveredIdx].item.score} {points[hoveredIdx].item.scoreUnit === 'IELTS_BAND' ? 'IELTS band' : points[hoveredIdx].item.scoreUnit === 'TOEIC_SCALED' ? 'TOEIC estimate' : 'raw'}</strong>
              {points[hoveredIdx].item.percentage !== null && <span className="history-tooltip-pct">({points[hoveredIdx].item.percentage}%)</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
