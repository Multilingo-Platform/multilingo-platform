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
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { historyApi } from '../../api/historyApi';
import { onboardingApi } from '../../../onboarding/api/onboardingApi';
import type {
  HistoryStatsResponse,
  HistoryAttemptItem,
  PageResponse,
} from '../../types/history.types';
import { HistoryKpiCards } from '../../components/HistoryKpiCards';
import { ScoreTrendChart } from '../../components/ScoreTrendChart';
import './TestHistory.css';

const TestHistory: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const certTabs = React.useMemo(() => [
    { id: 'ALL', label: t('history.filters.all_certs', 'Tất Cả Chứng Chỉ') },
    { id: 'IELTS', label: 'IELTS' },
    { id: 'TOEIC', label: 'TOEIC' },
    { id: 'NLTV', label: 'NLTV' },
  ], [t]);

  const modeOptions = React.useMemo(() => [
    { id: 'ALL', label: t('history.filters.mode_all', 'Tất cả chế độ') },
    { id: 'MOCK_TEST', label: t('history.filters.mode_mock', '📝 Thi thử') },
    { id: 'PRACTICE', label: t('history.filters.mode_practice', '🎯 Luyện tập') },
  ], [t]);

  const statusOptions = React.useMemo(() => [
    { id: 'ALL', label: t('history.filters.status_all', 'Tất cả trạng thái') },
    { id: 'COMPLETED', label: t('history.filters.status_completed', '✓ Hoàn thành') },
    { id: 'IN_PROGRESS', label: t('history.filters.status_in_progress', '⏳ Đang làm dở') },
    { id: 'GRADING_FAILED', label: t('history.filters.status_failed', '⚠️ Lỗi chấm') },
  ], [t]);

  // User target from onboarding via React Query (shared cache with ExamLibrary and StudentDashboard)
  const { data: onboardingRes, isLoading: isOnboardingLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: onboardingApi.getStatus,
    staleTime: 60 * 1000,
  });
  const userTarget = onboardingRes?.data;

  // Target certificate category
  const targetCategory = React.useMemo(() => {
    if (!userTarget?.targetCertificate) return '';
    const upper = userTarget.targetCertificate.toUpperCase();
    if (upper.startsWith('IELTS')) return 'IELTS';
    if (upper.startsWith('TOEIC')) return 'TOEIC';
    if (upper.startsWith('NLTV')) return 'NLTV';
    return '';
  }, [userTarget]);

  // Target language derived synchronously from userTarget
  const userTargetLanguage = React.useMemo(() => {
    if (userTarget?.targetLanguage) return userTarget.targetLanguage.toLowerCase();
    if (targetCategory === 'NLTV') return 'vi';
    if (targetCategory === 'IELTS' || targetCategory === 'TOEIC') return 'en';
    return '';
  }, [userTarget, targetCategory]);

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

  // Dynamic tabs filtered by target language
  const visibleTabs = React.useMemo(() => {
    if (!userTargetLanguage) return certTabs;
    const isVi = userTargetLanguage === 'vi' || userTargetLanguage === 'vietnamese';
    const isEn = userTargetLanguage === 'en' || userTargetLanguage === 'english';
    return certTabs.filter((tab) => {
      if (tab.id === 'ALL') return true;
      if (tab.id === 'NLTV') return isVi;
      if (tab.id === 'IELTS' || tab.id === 'TOEIC') return isEn;
      return true;
    });
  }, [userTargetLanguage, certTabs]);

  // Reset cert to ALL if not in visible tabs
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === cert)) {
      setCert('ALL');
      setPage(0);
    }
  }, [visibleTabs, cert]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Load KPI stats on mount or when cert/language changes
  useEffect(() => {
    if (isOnboardingLoading) return;
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const res = await historyApi.getStats({
          cert: cert !== 'ALL' ? cert : undefined,
          targetLanguage: userTargetLanguage || undefined,
        });
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
  }, [cert, userTargetLanguage, isOnboardingLoading]);

  // Load paginated history list
  useEffect(() => {
    if (isOnboardingLoading) return;
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        const res = await historyApi.getHistory({
          cert: cert !== 'ALL' ? cert : undefined,
          mode: mode !== 'ALL' ? mode : undefined,
          status: status !== 'ALL' ? status : undefined,
          search: debouncedSearch.trim() || undefined,
          targetLanguage: userTargetLanguage || undefined,
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
  }, [cert, mode, status, debouncedSearch, userTargetLanguage, sort, page, isOnboardingLoading]);

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
    if (item.scoreUnit === 'IELTS_BAND') return 'ielts';
    if (item.scoreUnit === 'TOEIC_SCALED') return 'toeic';
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
          <span className="history-score-scale">{t('history.card.grading_failed', 'Lỗi chấm')}</span>
        </>
      );
    }

    if (item.status === 'IN_PROGRESS') {
      return (
        <>
          <span className="history-score-number" style={{ fontSize: '1.25rem' }}>⏳</span>
          <span className="history-score-scale">{t('history.card.unsubmitted', 'Chưa nộp')}</span>
        </>
      );
    }

    if (item.overallScore === null) {
      return (
        <>
          <span className="history-score-number">—</span>
          <span className="history-score-scale">{item.scoreUnit === 'TOEIC_SCALED' ? 'Chưa đủ dữ liệu TOEIC' : item.scoreUnit === 'IELTS_BAND' ? 'Chưa đủ dữ liệu IELTS' : 'Chưa có điểm'}</span>
        </>
      );
    }

    if (item.scoreUnit === 'RAW_OBJECTIVE' || item.scoreUnit === 'LEGACY_RAW' || !item.scoreUnit) {
      return (
        <>
          <span className="history-score-number">{item.overallScore}</span>
          <span className="history-score-scale">Điểm raw</span>
        </>
      );
    }

    if (item.scoreUnit === 'IELTS_BAND') {
      return <><span className="history-score-number">{item.overallScore}</span><span className="history-score-scale">IELTS band / 9</span></>;
    }
    if (item.scoreUnit === 'TOEIC_SCALED') {
      return <><span className="history-score-number">{item.overallScore}</span><span className="history-score-scale">Điểm TOEIC ước lượng / 990</span></>;
    }

    const type = item.examType ? item.examType.toUpperCase() : '';
    if (type.startsWith('NLTV')) {
      return (
        <>
          <span className="history-score-number">{item.overallScore}</span>
          <span className="history-score-scale">{t('history.card.scale_nltv', { max: item.maxScore, defaultValue: `Bậc / ${item.maxScore}` })}</span>
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
            <BarChart2 size={16} /> {t('history.hero.badge', 'Báo Cáo Học Tập & Lịch Sử')}
          </div>
          <h1 className="history-hero-title">
            {t('history.hero.title', 'Hành Trình Chinh Phục Mục Tiêu')}
          </h1>
          <p className="history-hero-desc">
            {t('history.hero.desc', 'Theo dõi sự tiến bộ, đánh giá điểm mạnh - điểm yếu và duy trì chuỗi học tập đều đặn mỗi ngày.')}
          </p>
        </div>
      </section>

      {/* 2. Main Container */}
      <main className="history-main-container">
        {/* KPI Cards */}
        <HistoryKpiCards stats={stats} loading={statsLoading} activeCert={cert} />

        {/* Score Trend Chart */}
        <ScoreTrendChart
          trends={stats?.recentScoreTrends || []}
          loading={statsLoading}
        />

        {/* Filter & Search Panel */}
        <div className="history-filter-panel">
          {/* Certificate Tabs */}
          <div className="history-tabs-bar">
            {visibleTabs.map((tab) => (
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
              {modeOptions.map((opt) => (
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

              {statusOptions.map((opt) => (
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
                  placeholder={t('history.filters.search_placeholder', 'Tìm kiếm theo tên đề thi...')}
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
                <option value="newest">{t('history.filters.sort_newest', 'Mới nhất')}</option>
                <option value="highestScore">{t('history.filters.sort_highest_score', 'Điểm cao nhất')}</option>
                <option value="duration">{t('history.filters.sort_duration', 'Thời gian lâu nhất')}</option>
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
                      {item.testMode === 'MOCK_TEST' ? t('history.filters.mode_mock', 'Thi thử') : t('history.filters.mode_practice', 'Luyện tập')}
                    </span>

                    {item.status === 'COMPLETED' ? (
                      <span className="history-badge completed">{t('history.filters.status_completed', '✓ Hoàn thành')}</span>
                    ) : item.status === 'GRADING_FAILED' ? (
                      <span className="history-badge failed">{t('history.filters.status_failed', '⚠️ Lỗi chấm')}</span>
                    ) : item.status === 'AI_GRADING' || item.status === 'AI_GRADING_QUEUED' || item.status === 'SUBMITTED' ? (
                      <span className="history-badge grading">🤖 {t('history.card.grading', 'Đang chấm')}</span>
                    ) : (
                      <span className="history-badge in-progress">{t('history.filters.status_in_progress', '⏳ Đang làm dở')}</span>
                    )}

                    {item.isExamDeleted && (
                      <span className="history-badge deleted-exam" title="Đề thi này không còn trong thư viện đề thi">
                        {t('history.card.discontinued_badge', 'Đã ngừng phát hành')}
                      </span>
                    )}

                    {item.targetAchieved && (
                      <span className="history-badge target-met">
                        <Target size={12} /> {t('history.card.target_met', 'Đạt mục tiêu')}
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
                      <Clock size={15} /> {t('history.card.minutes', { count: item.durationMinutes, defaultValue: `${item.durationMinutes} phút` })}
                    </span>

                    {item.accuracyPercentage !== null && (
                      <span className="history-detail-item">
                        <Percent size={15} /> {t('history.card.accuracy', { percent: item.accuracyPercentage, defaultValue: `Chính xác: ${item.accuracyPercentage}%` })}
                      </span>
                    )}

                    {item.status === 'COMPLETED' && (
                      <span className="history-detail-item" style={{ color: '#059669' }}>
                        <CheckCircle size={15} /> {t('history.card.submitted', 'Đã nộp bài')}
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
                      <RotateCcw size={15} /> {t('history.card.retake', 'Làm lại')}
                    </button>
                  ) : (
                    <button
                      className="history-action-btn secondary disabled"
                      disabled
                      style={{ opacity: 0.5, cursor: 'not-allowed' }}
                      title="Đề thi này đã ngừng phát hành"
                    >
                      <RotateCcw size={15} /> {t('history.card.discontinued', 'Đã ngừng')}
                    </button>
                  )}

                  {item.status === 'COMPLETED' || item.status === 'GRADING_FAILED' ? (
                    <button
                      className="history-action-btn primary"
                      onClick={() => navigate(`/attempts/${item.attemptId}/result`)}
                    >
                      {t('history.card.details', 'Xem chi tiết')} <ArrowRight size={15} />
                    </button>
                  ) : item.isExamDeleted ? (
                    <button
                      className="history-action-btn primary disabled"
                      disabled
                      style={{ opacity: 0.5, cursor: 'not-allowed', background: '#94a3b8' }}
                      title="Đề thi đã bị gỡ bỏ"
                    >
                      {t('history.card.unavailable', 'Không khả dụng')}
                    </button>
                  ) : (
                    <button
                      className="history-action-btn primary"
                      style={{ background: '#d97706' }}
                      onClick={() => navigate(`/attempts/${item.attemptId}/workspace`)}
                    >
                      {t('history.card.continue', 'Tiếp tục')} <Play size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            /* Empty State */
            <div className="history-empty-card">
              <FileQuestion size={54} className="history-empty-icon" />
              <h3 className="history-empty-title">{t('history.card.empty_title', 'Chưa tìm thấy lượt thi nào')}</h3>
              <p className="history-empty-desc">
                {debouncedSearch || cert !== 'ALL' || mode !== 'ALL' || status !== 'ALL'
                  ? t('history.card.empty_filter', 'Không có kết quả nào phù hợp với bộ lọc hiện tại. Bạn hãy thử thay đổi tiêu chí tìm kiếm.')
                  : t('history.card.empty_no_tests', 'Bạn chưa thực hiện bài thi hay luyện tập nào. Hãy khám phá kho đề thi chuẩn quốc tế và bắt đầu ngay!')}
              </p>
              <button
                className="history-action-btn primary"
                style={{ margin: '0 auto', padding: '0.75rem 2rem' }}
                onClick={() => navigate('/student/library')}
              >
                {t('history.card.explore_library', 'Khám phá Thư viện Đề thi')}
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
              {t('history.pagination.prev', '← Trang trước')}
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
              {t('history.pagination.next', 'Trang sau →')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default TestHistory;
