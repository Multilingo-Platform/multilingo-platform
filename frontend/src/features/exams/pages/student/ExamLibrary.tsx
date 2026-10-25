import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Play, 
  Clock, 
  BookOpen, 
  Headphones, 
  PenTool, 
  CheckCircle2, 
  Sparkles, 
  X, 
  ArrowRight, 
  Users, 
  RotateCcw,
  Compass
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axiosClient from '../../../../core/api/axiosClient';
import { onboardingApi } from '../../../onboarding/api/onboardingApi';
import type { OnboardingStatusResponse } from '../../../onboarding/types';
import './ExamLibrary.css';

export interface ExamItem {
  id: number;
  code: string;
  title: string;
  type: string;
  examLanguage?: string;
  level: string;
  durationMinutes: number;
  joins: number;
  tags: string[];
  thumbnailUrl?: string | null;
  isAttempted?: boolean;
  userAttemptsCount?: number;
  userHighestScore?: number | null;
  userLatestScore?: number | null;
}

// 1. Certificate Tabs (No GB/VN, No Luyện Ngôn Ngữ)
const CERT_TABS = [
  { id: 'RECOMMENDED', label: '✨ Dành Cho Bạn' },
  { id: 'ALL', label: 'Tất Cả' },
  { id: 'IELTS', label: 'IELTS' },
  { id: 'TOEIC', label: 'TOEIC' },
  { id: 'NLTV', label: 'NLTV' },
];

// 2. Skill Filter Options
const SKILL_OPTIONS = [
  { id: '', label: 'Tất cả kỹ năng' },
  { id: 'LISTENING', label: 'Nghe hiểu', icon: <Headphones size={13} /> },
  { id: 'READING', label: 'Đọc hiểu', icon: <BookOpen size={13} /> },
  { id: 'WRITING', label: 'Viết', icon: <PenTool size={13} /> },
];

// 3. Attempt Status Chips
const ATTEMPT_STATUS_CHIPS = [
  { id: 'ALL', label: 'Tất cả đề' },
  { id: 'UNATTEMPTED', label: 'Chưa làm' },
  { id: 'ATTEMPTED', label: 'Đã làm' },
];

const CERT_LABELS_MAP: Record<string, string> = {
  IELTS_ACADEMIC: 'IELTS Academic',
  TOEIC_LR: 'TOEIC L&R',
  TOEIC_WRITING: 'TOEIC Writing',
  NLTV: 'Năng Lực Tiếng Việt (NLTV)',
};

const ExamLibrary: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter States
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [selectedAttemptStatus, setSelectedAttemptStatus] = useState<string>('ALL');
  const [sortParam, setSortParam] = useState('createdAt');
  
  // Pagination
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // User target from onboarding
  const [userTarget, setUserTarget] = useState<OnboardingStatusResponse | null>(null);

  // Check onboarding target on mount
  useEffect(() => {
    let isMounted = true;
    const fetchTarget = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await onboardingApi.getStatus();
          if (isMounted && res.data?.hasCompletedOnboarding) {
            setUserTarget(res.data);
            setActiveTab('RECOMMENDED');
          }
        }
      } catch (e) {
        // Guest user or unauthenticated
      }
    };
    fetchTarget();
    return () => {
      isMounted = false;
    };
  }, []);

  // Determine current active certificate
  const currentCert = useMemo(() => {
    if (activeTab === 'RECOMMENDED' && userTarget) {
      if (userTarget.targetCertificate?.startsWith('IELTS')) return 'IELTS';
      if (userTarget.targetCertificate?.startsWith('TOEIC')) return 'TOEIC';
      if (userTarget.targetCertificate === 'NLTV') return 'NLTV';
      return '';
    }
    if (activeTab !== 'ALL' && activeTab !== 'RECOMMENDED') {
      return activeTab;
    }
    return '';
  }, [activeTab, userTarget]);

  const fetchExams = useCallback(async (currentPage = page) => {
    try {
      setLoading(true);
      const params: any = { page: currentPage, size: 12, sort: sortParam };
      if (searchTerm.trim()) params.search = searchTerm.trim();

      // Language filter if recommended
      if (activeTab === 'RECOMMENDED' && userTarget?.targetLanguage) {
        params.examLanguage = userTarget.targetLanguage;
      }

      let typesToFetch: string[] = [];

      if (currentCert) {
        if (selectedSkill) {
          if (currentCert === 'IELTS') {
            if (selectedSkill === 'LISTENING') {
              typesToFetch = ['IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS_LISTENING', 'IELTS_L1', 'IELTS_L2', 'IELTS_L3', 'IELTS_L4'];
            } else if (selectedSkill === 'READING') {
              typesToFetch = ['IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS_READING', 'IELTS_R1', 'IELTS_R2', 'IELTS_R3'];
            } else if (selectedSkill === 'WRITING') {
              typesToFetch = ['IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS_WRITING', 'IELTS_W1', 'IELTS_W2'];
            }
          } else if (currentCert === 'TOEIC') {
            if (selectedSkill === 'LISTENING') {
              typesToFetch = ['TOEIC_LR', 'TOEIC_LISTENING', 'TOEIC_P1', 'TOEIC_P2', 'TOEIC_P3', 'TOEIC_P4'];
            } else if (selectedSkill === 'READING') {
              typesToFetch = ['TOEIC_LR', 'TOEIC_READING', 'TOEIC_P5', 'TOEIC_P6', 'TOEIC_P7'];
            } else if (selectedSkill === 'WRITING') {
              typesToFetch = ['TOEIC_WRITING', 'TW_P1', 'TW_P2'];
            }
          } else if (currentCert === 'NLTV') {
            if (selectedSkill === 'LISTENING') {
              typesToFetch = ['NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_LISTENING', 'NLTV_L'];
            } else if (selectedSkill === 'READING') {
              typesToFetch = ['NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_READING', 'NLTV_R'];
            } else if (selectedSkill === 'WRITING') {
              typesToFetch = ['NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_WRITING', 'NLTV_W'];
            }
          }
        } else {
          // No skill selected -> show all exams for this cert
          if (currentCert === 'IELTS') {
            typesToFetch = ['IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS', 'IELTS_LISTENING', 'IELTS_READING', 'IELTS_WRITING', 'IELTS_L1', 'IELTS_L2', 'IELTS_L3', 'IELTS_L4', 'IELTS_R1', 'IELTS_R2', 'IELTS_R3', 'IELTS_W1', 'IELTS_W2'];
          } else if (currentCert === 'TOEIC') {
            typesToFetch = ['TOEIC_LR', 'TOEIC_WRITING', 'TOEIC_LISTENING', 'TOEIC_READING', 'TOEIC_P1', 'TOEIC_P2', 'TOEIC_P3', 'TOEIC_P4', 'TOEIC_P5', 'TOEIC_P6', 'TOEIC_P7', 'TW_P1', 'TW_P2'];
          } else if (currentCert === 'NLTV') {
            typesToFetch = ['NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_LISTENING', 'NLTV_READING', 'NLTV_WRITING', 'NLTV_L', 'NLTV_R', 'NLTV_W'];
          }
        }
      } else {
        // All certs: if a skill is selected, fetch all exams containing that skill
        if (selectedSkill) {
          if (selectedSkill === 'LISTENING') {
            typesToFetch = [
              'IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS_LISTENING', 'IELTS_L1', 'IELTS_L2', 'IELTS_L3', 'IELTS_L4',
              'TOEIC_LR', 'TOEIC_LISTENING', 'TOEIC_P1', 'TOEIC_P2', 'TOEIC_P3', 'TOEIC_P4',
              'NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_LISTENING', 'NLTV_L'
            ];
          } else if (selectedSkill === 'READING') {
            typesToFetch = [
              'IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS_READING', 'IELTS_R1', 'IELTS_R2', 'IELTS_R3',
              'TOEIC_LR', 'TOEIC_READING', 'TOEIC_P5', 'TOEIC_P6', 'TOEIC_P7',
              'NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_READING', 'NLTV_R'
            ];
          } else if (selectedSkill === 'WRITING') {
            typesToFetch = [
              'IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS_WRITING', 'IELTS_W1', 'IELTS_W2',
              'TOEIC_WRITING', 'TW_P1', 'TW_P2',
              'NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_WRITING', 'NLTV_W'
            ];
          }
        }
      }

      if (typesToFetch.length > 0) {
        params.types = typesToFetch.join(',');
      }

      const res = await axiosClient.get<any, any>('/v1/student/exams', { params });
      if (res.success && res.data) {
        setExams(res.data.items || []);
        setTotalPages(res.data.totalPages || 0);
        setTotalElements(res.data.totalElements || 0);
      }
    } catch (err) {
      console.error('Lỗi khi tải đề thi:', err);
    } finally {
      setLoading(false);
    }
  }, [page, sortParam, searchTerm, activeTab, userTarget, currentCert, selectedSkill]);

  useEffect(() => {
    fetchExams(0);
  }, [fetchExams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchExams(0);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(0);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setActiveTab(userTarget ? 'RECOMMENDED' : 'ALL');
    setSelectedSkill('');
    setSelectedAttemptStatus('ALL');
    setSortParam('createdAt');
    setPage(0);
  };

  // Filter exams by attempt status client-side
  const displayedExams = useMemo(() => {
    if (selectedAttemptStatus === 'ALL') return exams;
    if (selectedAttemptStatus === 'ATTEMPTED') return exams.filter(e => e.isAttempted === true);
    if (selectedAttemptStatus === 'UNATTEMPTED') return exams.filter(e => !e.isAttempted);
    return exams;
  }, [exams, selectedAttemptStatus]);

  const formatScore = (score: number | null | undefined, type: string) => {
    if (score === null || score === undefined) return '';
    if (type.startsWith('IELTS')) return `Band ${score.toFixed(1)}`;
    if (type.startsWith('TOEIC')) return `${Math.round(score)} Điểm`;
    if (type.startsWith('NLTV')) return `Bậc ${Math.round(score)}`;
    return `${score}`;
  };

  const getThumbnailGradient = (type: string) => {
    if (type.startsWith('IELTS')) return 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)';
    if (type.startsWith('TOEIC')) return 'linear-gradient(135deg, #059669 0%, #0d9488 100%)';
    if (type.startsWith('NLTV')) return 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)';
    return 'linear-gradient(135deg, #475569 0%, #1e293b 100%)';
  };

  const getWatermark = (type: string) => {
    if (type.startsWith('IELTS')) return 'IELTS';
    if (type.startsWith('TOEIC')) return 'TOEIC';
    if (type.startsWith('NLTV')) return 'NLTV';
    return 'EXAM';
  };

  const isMatchUserTarget = (examType: string) => {
    if (!userTarget?.targetCertificate) return false;
    const cert = userTarget.targetCertificate;
    if (cert.startsWith('IELTS') && examType.startsWith('IELTS')) return true;
    if (cert.startsWith('TOEIC') && examType.startsWith('TOEIC')) return true;
    if (cert === 'NLTV' && examType.startsWith('NLTV')) return true;
    return false;
  };

  return (
    <div className="exam-library-container">
      {/* 1. Hero Section - Warm Orange Gradient On-Brand */}
      <header className="exam-library-hero">
        <div className="exam-library-hero-bg-shapes">
          <div className="exam-library-hero-circle-1" />
          <div className="exam-library-hero-circle-2" />
        </div>

        <div className="exam-library-hero-content">
          <div className="exam-library-hero-badge">
            <Compass size={14} />
            <span>Thư Viện Đề Thi Chuẩn Hóa</span>
          </div>

          <h1 className="exam-library-hero-title">
            {t('library.hero.title', 'Thư viện Đề thi')}
          </h1>

          <p className="exam-library-hero-desc">
            {t('library.hero.subtitle', 'Hàng ngàn đề thi chuẩn hóa IELTS, TOEIC và Năng Lực Tiếng Việt (NLTV). Luyện tập ngay hôm nay để đạt mục tiêu của bạn.')}
          </p>

          {/* User Target Banner if completed onboarding */}
          {userTarget?.hasCompletedOnboarding && userTarget.targetCertificate && (
            <div className="exam-library-target-banner">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <Sparkles size={16} color="#fde047" />
                <span>Mục tiêu của bạn: <strong>{CERT_LABELS_MAP[userTarget.targetCertificate] || userTarget.targetCertificate}</strong> {userTarget.targetScore ? `(Band / Điểm: ${userTarget.targetScore})` : ''}</span>
              </span>
              <button
                type="button"
                className="exam-library-target-banner-btn"
                onClick={() => {
                  setActiveTab('RECOMMENDED');
                  setPage(0);
                }}
              >
                Xem đề mục tiêu
              </button>
            </div>
          )}

          {/* Big Search Bar */}
          <form onSubmit={handleSearchSubmit} className="exam-library-search-wrapper">
            <Search className="exam-library-search-icon" size={20} />
            <input
              type="text"
              className="exam-library-search-input"
              placeholder={t('library.filters.searchPlaceholder', 'Nhập tên đề thi...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button type="button" onClick={handleClearSearch} className="exam-library-search-clear">
                <X size={18} />
              </button>
            )}
          </form>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="exam-library-main">
        {/* Certificate Segmented Tabs (Clean: IELTS, TOEIC, NLTV) */}
        <div className="exam-library-tabs-bar" role="tablist">
          {CERT_TABS.map((tab) => {
            if (tab.id === 'RECOMMENDED' && !userTarget?.hasCompletedOnboarding) {
              return null;
            }
            const isActive = activeTab === tab.id;
            const isRec = tab.id === 'RECOMMENDED';
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                className={`exam-library-tab-btn ${isActive ? 'active' : ''} ${isRec ? 'recommended' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedSkill('');
                  setPage(0);
                }}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Panel (Skills, Attempt Status, Sort) */}
        <div className="exam-library-filter-panel">
          {/* Row 1: Chọn Kỹ Năng & Sắp xếp */}
          <div className="exam-library-filter-row">
            <span className="exam-library-filter-label">Kỹ năng:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: 1 }}>
              {SKILL_OPTIONS.map((opt) => {
                const isActive = selectedSkill === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`exam-library-chip ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedSkill(opt.id);
                      setPage(0);
                    }}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sắp xếp */}
            <select
              className="exam-library-sort-select"
              value={sortParam}
              onChange={(e) => {
                setSortParam(e.target.value);
                setPage(0);
              }}
              aria-label="Sắp xếp danh sách đề thi"
            >
              <option value="createdAt">{t('library.sort.newest', 'Mới nhất')}</option>
              <option value="popular">{t('library.sort.popular', 'Thi nhiều nhất')}</option>
            </select>
          </div>

          {/* Row 2: Trạng thái làm bài */}
          <div className="exam-library-filter-row" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
            <span className="exam-library-filter-label">Trạng thái:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {ATTEMPT_STATUS_CHIPS.map((chip) => {
                const isActive = selectedAttemptStatus === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`exam-library-chip status-chip ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedAttemptStatus(chip.id)}
                  >
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Meta Header */}
        <div className="exam-library-meta-header">
          <span className="exam-library-count">
            {t('library.results.showing', 'Hiển thị')} <strong>{displayedExams.length}</strong> {t('library.results.results', 'đề thi')}
          </span>
          {(searchTerm || selectedSkill || selectedAttemptStatus !== 'ALL') && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.85rem',
                color: '#ea580c',
                fontWeight: 600,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={14} />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        {/* Grid or Status View */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5rem 0', color: '#ea580c' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid #ffedd5', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#64748b' }}>Đang tải danh sách đề thi...</span>
            </div>
          </div>
        ) : displayedExams.length === 0 ? (
          <div className="exam-library-empty">
            <div className="exam-library-empty-icon">
              <BookOpen size={30} />
            </div>
            <h3 className="exam-library-empty-title">Không tìm thấy đề thi nào</h3>
            <p className="exam-library-empty-desc">
              Không có đề thi nào khớp với bộ lọc hiện tại của bạn. Hãy thử chọn kỹ năng khác hoặc bấm nút bên dưới để xem lại tất cả đề thi.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleResetFilters}>
              Xem tất cả đề thi
            </button>
          </div>
        ) : (
          <div className="exam-grid">
            {displayedExams.map((exam) => {
              const gradientBg = getThumbnailGradient(exam.type);
              const watermark = getWatermark(exam.type);
              const isMatch = isMatchUserTarget(exam.type);

              return (
                <div
                  key={exam.id}
                  className="exam-card"
                  onClick={() => navigate(`/student/exam/${exam.id}`)}
                >
                  {/* Thumbnail Area */}
                  <div
                    className="exam-card-thumbnail"
                    style={{
                      background: exam.thumbnailUrl ? `url(${exam.thumbnailUrl}) center/cover no-repeat` : gradientBg,
                    }}
                  >
                    {!exam.thumbnailUrl && (
                      <span className="exam-card-watermark">{watermark}</span>
                    )}

                    {/* Top Floating Badges */}
                    <div className="exam-card-badges-top">
                      {exam.isAttempted ? (
                        <span className="exam-card-attempt-badge attempted">
                          <CheckCircle2 size={12} />
                          <span>Đã làm ({exam.userAttemptsCount || 1} lần) {exam.userHighestScore !== null && exam.userHighestScore !== undefined ? `• ${formatScore(exam.userHighestScore, exam.type)}` : ''}</span>
                        </span>
                      ) : (
                        <span className="exam-card-attempt-badge unattempted">
                          <span>Chưa làm</span>
                        </span>
                      )}

                      <span className="exam-card-level-badge">{exam.level}</span>
                    </div>

                    {/* Target Match Badge */}
                    {isMatch && (
                      <span className="exam-card-target-match">
                        🎯 Khớp mục tiêu
                      </span>
                    )}

                    {/* Play Button Overlay */}
                    <div className="exam-card-play-overlay">
                      <div className="exam-card-play-btn">
                        <Play size={24} fill="#ea580c" style={{ marginLeft: '3px' }} />
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="exam-card-body">
                    <h3 className="exam-card-title" title={exam.title}>
                      {exam.title}
                    </h3>

                    {/* Skills Row */}
                    <div className="exam-card-tags-row">
                      {exam.tags?.map((tag) => (
                        <span key={tag} className="exam-card-skill-pill">
                          {tag.toLowerCase().includes('nghe') || tag.toLowerCase().includes('listening') ? <Headphones size={11} /> : null}
                          {tag.toLowerCase().includes('đọc') || tag.toLowerCase().includes('reading') ? <BookOpen size={11} /> : null}
                          {tag.toLowerCase().includes('viết') || tag.toLowerCase().includes('writing') ? <PenTool size={11} /> : null}
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>

                    {/* Footer Meta */}
                    <div className="exam-card-footer">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} color="#94a3b8" />
                          <span>{exam.durationMinutes} phút</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Users size={14} color="#94a3b8" />
                          <span>{exam.joins || 0} lượt thi</span>
                        </span>
                      </div>

                      <span className="exam-card-cta-btn">
                        <span>{exam.isAttempted ? 'Làm lại' : 'Làm bài'}</span>
                        <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="exam-library-pagination">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => {
                setPage((p) => p - 1);
                fetchExams(page - 1);
              }}
              className="exam-library-page-btn"
            >
              {t('library.pagination.prev', 'Trang trước')}
            </button>
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
              {t('library.pagination.page', 'Trang')} {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => {
                setPage((p) => p + 1);
                fetchExams(page + 1);
              }}
              className="exam-library-page-btn"
            >
              {t('library.pagination.next', 'Trang sau')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ExamLibrary;
