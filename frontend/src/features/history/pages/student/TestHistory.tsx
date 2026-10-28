import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Search,
  Calendar,
  Clock,
  CheckCircle,
  RotateCcw,
  ArrowRight,
  Play,
  FileQuestion,
  Target,
  Percent,
} from 'lucide-react';
import { historyApi } from '../../api/historyApi';
import type {
  HistoryStatsResponse,
  HistoryAttemptItem,
  PageResponse,
} from '../../types/history.types';
import { HistoryKpiCards } from '../../components/HistoryKpiCards';
import { ScoreTrendChart } from '../../components/ScoreTrendChart';
import './TestHistory.css';

const CERT_TABS = [
  { id: 'ALL', label: 'Tất Cả Chứng Chỉ' },
  { id: 'IELTS', label: 'IELTS' },
  { id: 'TOEIC', label: 'TOEIC' },
  { id: 'NLTV', label: 'NLTV' },
];

const MODE_OPTIONS = [
  { id: 'ALL', label: 'Tất cả chế độ' },
  { id: 'MOCK_TEST', label: '📝 Thi thử' },
  { id: 'PRACTICE', label: '🎯 Luyện tập' },
];

const STATUS_OPTIONS = [
  { id: 'ALL', label: 'Tất cả trạng thái' },
  { id: 'COMPLETED', label: '✓ Hoàn thành' },
  { id: 'IN_PROGRESS', label: '⏳ Đang làm dở' },
  { id: 'GRADING_FAILED', label: '⚠️ Lỗi chấm' },
];

const TestHistory: React.FC = () => {
  const navigate = useNavigate();

  // Stats state
  const [stats, setStats] = useState<HistoryStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  // History list state
  const [historyData, setHistoryData] = useState<PageResponse<HistoryAttemptItem> | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);

  // Filters state
  const [cert, setCert] = useState<string>('ALL');
  const [mode, setMode] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sort, setSort] = useState<string>('newest');
  const [page, setPage] = useState<number>(0);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Load KPI stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const res = await historyApi.getStats();
        if (res.code === 200 && res.data) {
          setStats(res.data);
        }
      } catch (err) {
        console.error('Failed to load history stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Load paginated history list
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        const res = await historyApi.getHistory({
          cert: cert !== 'ALL' ? cert : undefined,
          mode: mode !== 'ALL' ? mode : undefined,
          status: status !== 'ALL' ? status : undefined,
          search: debouncedSearch.trim() || undefined,
          sort,
          page,
          size: 10,
        });

        if (res.code === 200 && res.data) {
          setHistoryData(res.data);
        }
      } catch (err) {
        console.error('Failed to load history list:', err);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [cert, mode, status, debouncedSearch, sort, page]);

  // Format date helper
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Resolve score circle styling class
  const getScoreCircleClass = (item: HistoryAttemptItem) => {
    if (item.status === 'GRADING_FAILED') return 'failed';
    if (item.status === 'IN_PROGRESS') return 'in-progress';
    const type = item.examType ? item.examType.toUpperCase() : '';
    if (type.startsWith('IELTS')) return 'ielts';
    if (type.startsWith('TOEIC')) return 'toeic';
    if (type.startsWith('NLTV')) return 'nltv';
    return 'ielts';
  };

  // Render score inside circle
  const renderScoreValue = (item: HistoryAttemptItem) => {
    if (item.status === 'GRADING_FAILED') {
      return (
        <>
          <span className="history-score-number" style={{ fontSize: '1.25rem' }}>⚠️</span>
          <span className="history-score-scale">Lỗi chấm</span>
        </>
      );
    }

    if (item.status === 'IN_PROGRESS') {
      return (
        <>
          <span className="history-score-number" style={{ fontSize: '1.25rem' }}>⏳</span>
          <span className="history-score-scale">Chưa nộp</span>
        </>
      );
    }

    if (item.overallScore === null) {
      return (
        <>
          <span className="history-score-number">—</span>
          <span className="history-score-scale">/ {item.maxScore}</span>
        </>
      );
    }

    const type = item.examType ? item.examType.toUpperCase() : '';
    if (type.startsWith('NLTV')) {
      return (
        <>
          <span className="history-score-number">{item.overallScore}</span>
          <span className="history-score-scale">Bậc / {item.maxScore}</span>
        </>
      );
    }

    return (
      <>
        <span className="history-score-number">{item.overallScore}</span>
        <span className="history-score-scale">/ {item.maxScore}</span>
      </>
    );
  };

  return (
    <div className="history-page-root">
      {/* 1. Hero Banner */}
      <section className="history-hero">
        <div className="history-hero-decor" />
        <div className="history-hero-container">
          <div className="history-hero-badge">
            <BarChart2 size={16} /> Báo Cáo Học Tập & Lịch Sử
          </div>
          <h1 className="history-hero-title">
            Hành Trình Chinh Phục Mục Tiêu
          </h1>
          <p className="history-hero-desc">
            Theo dõi sự tiến bộ, đánh giá điểm mạnh - điểm yếu và duy trì chuỗi học tập đều đặn mỗi ngày.
          </p>
        </div>
      </section>

      {/* 2. Main Container */}
      <main className="history-main-container">
        {/* KPI Cards */}
        <HistoryKpiCards stats={stats} loading={statsLoading} />

        {/* Score Trend Chart */}
        <ScoreTrendChart
          trends={stats?.recentScoreTrends || []}
          loading={statsLoading}
        />

        {/* Filter & Search Panel */}
        <div className="history-filter-panel">
          {/* Certificate Tabs */}
          <div className="history-tabs-bar">
            {CERT_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`history-tab-btn ${cert === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setCert(tab.id);
                  setPage(0);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Controls Row: Mode, Status, Search & Sort */}
          <div className="history-filter-controls-row">
            {/* Mode & Status Chips */}
            <div className="history-chips-group">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={`history-filter-chip ${mode === opt.id ? 'active' : ''}`}
                  onClick={() => {
                    setMode(opt.id);
                    setPage(0);
                  }}
                >
                  {opt.label}
                </button>
              ))}

              <span style={{ color: '#cbd5e1', margin: '0 0.25rem' }}>|</span>

              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={`history-filter-chip status-chip ${status === opt.id ? 'active' : ''}`}
                  onClick={() => {
                    setStatus(opt.id);
                    setPage(0);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Search and Sort */}
            <div className="history-search-sort-group">
              <div className="history-search-wrap">
                <Search size={16} className="history-search-icon" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên đề thi..."
                  className="history-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="history-sort-select"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(0);
                }}
              >
                <option value="newest">Mới nhất</option>
                <option value="highestScore">Điểm cao nhất</option>
                <option value="duration">Thời gian lâu nhất</option>
              </select>
            </div>
          </div>
        </div>

        {/* Attempt Cards List */}
        <div className="history-list-section">
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#64748b' }}>
              <div className="history-kpi-skeleton" style={{ width: '100%', height: '100px', marginBottom: '1rem' }} />
              <div className="history-kpi-skeleton" style={{ width: '100%', height: '100px' }} />
            </div>
          ) : historyData && historyData.items.length > 0 ? (
            historyData.items.map((item) => (
              <div key={item.attemptId} className="history-attempt-card">
                {/* Score Circle */}
                <div className={`history-score-circle ${getScoreCircleClass(item)}`}>
                  {renderScoreValue(item)}
                </div>

                {/* Card Body */}
                <div className="history-card-body">
                  <div className="history-card-meta-row">
                    <span className={`history-badge ${item.testMode === 'MOCK_TEST' ? 'mock' : 'practice'}`}>
                      {item.testMode === 'MOCK_TEST' ? 'Thi thử' : 'Luyện tập'}
                    </span>

                    {item.status === 'COMPLETED' ? (
                      <span className="history-badge completed">✓ Hoàn thành</span>
                    ) : item.status === 'GRADING_FAILED' ? (
                      <span className="history-badge failed">⚠️ Lỗi chấm</span>
                    ) : item.status === 'AI_GRADING' || item.status === 'AI_GRADING_QUEUED' || item.status === 'SUBMITTED' ? (
                      <span className="history-badge grading">🤖 Đang chấm</span>
                    ) : (
                      <span className="history-badge in-progress">⏳ Đang làm dở</span>
                    )}

                    {item.isExamDeleted && (
                      <span className="history-badge deleted-exam" title="Đề thi này không còn trong thư viện đề thi">
                        Đã ngừng phát hành
                      </span>
                    )}

                    {item.targetAchieved && (
                      <span className="history-badge target-met">
                        <Target size={12} /> Đạt mục tiêu
                      </span>
                    )}

                    <span className="history-card-date">
                      <Calendar size={14} /> {formatDate(item.startTime)}
                    </span>
                  </div>

                  <h3 className="history-card-title" title={item.examTitle}>
                    {item.examTitle}
                  </h3>

                  <div className="history-card-details-row">
                    <span className="history-detail-item">
                      <Clock size={15} /> {item.durationMinutes} phút
                    </span>

                    {item.accuracyPercentage !== null && (
                      <span className="history-detail-item">
                        <Percent size={15} /> Chính xác: {item.accuracyPercentage}%
                      </span>
                    )}

                    {item.status === 'COMPLETED' && (
                      <span className="history-detail-item" style={{ color: '#059669' }}>
                        <CheckCircle size={15} /> Đã nộp bài
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="history-card-actions">
                  {!item.isExamDeleted ? (
                    <button
                      className="history-action-btn secondary"
                      onClick={() => navigate(`/student/exam/${item.examId}`)}
                      title="Làm lại đề thi này"
                    >
                      <RotateCcw size={15} /> Làm lại
                    </button>
                  ) : (
                    <button
                      className="history-action-btn secondary disabled"
                      disabled
                      style={{ opacity: 0.5, cursor: 'not-allowed' }}
                      title="Đề thi này đã ngừng phát hành"
                    >
                      <RotateCcw size={15} /> Đã ngừng
                    </button>
                  )}

                  {item.status === 'COMPLETED' || item.status === 'GRADING_FAILED' ? (
                    <button
                      className="history-action-btn primary"
                      onClick={() => navigate(`/attempts/${item.attemptId}/result`)}
                    >
                      Xem chi tiết <ArrowRight size={15} />
                    </button>
                  ) : item.isExamDeleted ? (
                    <button
                      className="history-action-btn primary disabled"
                      disabled
                      style={{ opacity: 0.5, cursor: 'not-allowed', background: '#94a3b8' }}
                      title="Đề thi đã bị gỡ bỏ"
                    >
                      Không khả dụng
                    </button>
                  ) : (
                    <button
                      className="history-action-btn primary"
                      style={{ background: '#d97706' }}
                      onClick={() => navigate(`/attempts/${item.attemptId}/workspace`)}
                    >
                      Tiếp tục <Play size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            /* Empty State */
            <div className="history-empty-card">
              <FileQuestion size={54} className="history-empty-icon" />
              <h3 className="history-empty-title">Chưa tìm thấy lượt thi nào</h3>
              <p className="history-empty-desc">
                {debouncedSearch || cert !== 'ALL' || mode !== 'ALL' || status !== 'ALL'
                  ? 'Không có kết quả nào phù hợp với bộ lọc hiện tại. Bạn hãy thử thay đổi tiêu chí tìm kiếm.'
                  : 'Bạn chưa thực hiện bài thi hay luyện tập nào. Hãy khám phá kho đề thi chuẩn quốc tế và bắt đầu ngay!'}
              </p>
              <button
                className="history-action-btn primary"
                style={{ margin: '0 auto', padding: '0.75rem 2rem' }}
                onClick={() => navigate('/student/library')}
              >
                Khám phá Thư viện Đề thi
              </button>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {historyData && historyData.totalPages > 1 && (
          <div className="history-pagination">
            <button
              className="history-page-btn"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Trang trước
            </button>

            {Array.from({ length: historyData.totalPages }, (_, i) => i).map((p) => (
              <button
                key={p}
                className={`history-page-btn ${page === p ? 'active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p + 1}
              </button>
            ))}

            <button
              className="history-page-btn"
              disabled={page >= historyData.totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau →
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default TestHistory;
