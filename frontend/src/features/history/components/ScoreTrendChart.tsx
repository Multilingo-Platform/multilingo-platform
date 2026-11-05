import React, { useState } from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ScoreTrendItem } from '../types/history.types';

interface ScoreTrendChartProps {
  trends: ScoreTrendItem[];
  loading: boolean;
  activeCert?: string;
}

export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({ trends, loading, activeCert }) => {
  const { t } = useTranslation();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedCertFilter, setSelectedCertFilter] = useState<string>('');

  // Biểu đồ chỉ dùng điểm của các bài thi full đề (cả mock test và practice)
  const fullExamTrends = React.useMemo(() => {
    if (!trends) return [];
    return trends.filter((t) => {
      // 1. Phải có điểm hợp lệ
      if (t.score === null || t.score === undefined) return false;

      // 2. Không vẽ các bài luyện tập lẻ câu/part theo scoreUnit raw
      if (t.scoreUnit === 'RAW_OBJECTIVE' || (t.scoreUnit && t.scoreUnit.endsWith('RAW'))) return false;

      // 3. Nếu có trường testScope, bắt buộc phải là FULL_EXAM
      if (t.testScope && t.testScope !== 'FULL_EXAM') return false;

      // 4. Không dùng điểm TOEIC lẻ 1 kỹ năng (thang điểm 450)
      if ((t.certType === 'TOEIC_LR' || t.certType === 'TOEIC') && t.maxScore === 450) return false;

      // 5. Loại bỏ các bài thi lẻ kỹ năng hoặc part qua tiêu đề
      const titleLower = (t.examTitle || '').toLowerCase();
      if (
        titleLower.includes('passage ') ||
        titleLower.includes('part ') ||
        titleLower.includes('phần ') ||
        titleLower.includes(' - listening') ||
        titleLower.includes(' - reading') ||
        titleLower.includes(' - writing') ||
        titleLower.includes(' - nghe') ||
        titleLower.includes(' - đọc') ||
        titleLower.includes(' - viết')
      ) {
        return false;
      }

      return true;
    });
  }, [trends]);

  const availableCerts = React.useMemo(() => {
    if (!fullExamTrends) return [];
    const set = new Set<string>();
    fullExamTrends.forEach((t) => {
      if (t.certType && t.certType !== 'OTHER') {
        set.add(t.certType);
      }
    });
    return Array.from(set);
  }, [fullExamTrends]);

  // Sync with activeCert when provided and valid
  React.useEffect(() => {
    if (activeCert && activeCert !== 'ALL' && availableCerts.includes(activeCert)) {
      setSelectedCertFilter(activeCert);
    }
  }, [activeCert, availableCerts]);

  const effectiveCert = React.useMemo(() => {
    if (selectedCertFilter && availableCerts.includes(selectedCertFilter)) {
      return selectedCertFilter;
    }
    if (activeCert && activeCert !== 'ALL' && availableCerts.includes(activeCert)) {
      return activeCert;
    }
    return availableCerts[0] || '';
  }, [selectedCertFilter, activeCert, availableCerts]);

  const displayedTrends = React.useMemo(() => {
    if (!fullExamTrends || fullExamTrends.length === 0) return [];
    if (availableCerts.length <= 1) return fullExamTrends;
    return fullExamTrends.filter((t) => t.certType === effectiveCert);
  }, [fullExamTrends, availableCerts, effectiveCert]);

  if (loading) {
    return (
      <div className="history-chart-card">
        <div className="history-chart-skeleton" />
      </div>
    );
  }

  if (!fullExamTrends || fullExamTrends.length === 0) {
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
    if (item.scoreUnit === 'IELTS_BAND' || item.certType === 'IELTS') return `Band ${item.score}`;
    if (item.certType === 'TOEIC_WRITING') return `${Math.round(item.score)}/200`;
    if (item.scoreUnit === 'TOEIC_SCALED' || item.certType === 'TOEIC_LR' || item.certType === 'TOEIC') return `${Math.round(item.score)} đ`;
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
              {availableCerts.map((c) => {
                const count = fullExamTrends.filter((t) => t.certType === c).length;
                const label = c === 'TOEIC_LR' ? 'TOEIC L&R' : c === 'TOEIC_WRITING' ? 'TOEIC Writing' : c;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`history-chart-filter-chip ${effectiveCert === c ? 'active' : ''}`}
                    onClick={() => setSelectedCertFilter(c)}
                  >
                    {label} ({count})
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
