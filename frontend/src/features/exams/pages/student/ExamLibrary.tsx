import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search,
  History as HistoryIcon, 
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
  Compass,
  Layers,
  Target,
  Puzzle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../../../core/api/axiosClient';
import { onboardingApi } from '../../../onboarding/api/onboardingApi';
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



const CERT_LABELS_MAP: Record<string, string> = {
  IELTS_ACADEMIC: 'IELTS Academic',
  TOEIC_LR: 'TOEIC L&R',
  TOEIC_WRITING: 'TOEIC Writing',
  NLTV: 'Năng Lực Tiếng Việt (NLTV)',
};

export const getTargetCertCategory = (targetCert?: string | null): 'IELTS' | 'TOEIC_LR' | 'TOEIC_WRITING' | 'NLTV' | '' => {
  if (!targetCert) return '';
  const upper = targetCert.toUpperCase();
  if (upper.startsWith('IELTS')) return 'IELTS';
  if (upper === 'TOEIC_WRITING' || upper === 'TW') return 'TOEIC_WRITING';
  if (upper.startsWith('TOEIC')) return 'TOEIC_LR';
  if (upper.startsWith('NLTV')) return 'NLTV';
  return '';
};

export const isExamMatchingTargetCert = (examType: string, targetCert?: string | null): boolean => {
  if (!examType || !targetCert) return false;
  const category = getTargetCertCategory(targetCert);
  const typeUpper = examType.toUpperCase();

  if (category === 'IELTS') {
    return typeUpper.startsWith('IELTS');
  }
  if (category === 'TOEIC_LR') {
    return (typeUpper.startsWith('TOEIC') && !typeUpper.includes('WRITING')) || typeUpper.startsWith('TOEIC_P');
  }
  if (category === 'TOEIC_WRITING') {
    return typeUpper.includes('TOEIC_WRITING') || typeUpper.startsWith('TW');
  }
  if (category === 'NLTV') {
    return typeUpper.startsWith('NLTV');
  }
  return false;
};

export const isSameLanguage = (examLang?: string | null, targetLang?: string | null): boolean => {
  if (!examLang || !targetLang) return true;
  const cleanExam = examLang.trim().toLowerCase();
  const cleanTarget = targetLang.trim().toLowerCase();

  const normExam = (cleanExam === 'english' || cleanExam.startsWith('en')) ? 'en'
    : (cleanExam === 'vietnamese' || cleanExam.startsWith('vi')) ? 'vi'
    : cleanExam.split('-')[0];

  const normTarget = (cleanTarget === 'english' || cleanTarget.startsWith('en')) ? 'en'
    : (cleanTarget === 'vietnamese' || cleanTarget.startsWith('vi')) ? 'vi'
    : cleanTarget.split('-')[0];

  return normExam === normTarget;
};

export type ExamScope = 'ALL' | 'FULL_EXAM' | 'SINGLE_SKILL' | 'SINGLE_PART';

export const getExamScope = (
  rawType: string,
  title?: string,
  parts?: number
): 'FULL_EXAM' | 'SINGLE_SKILL' | 'SINGLE_PART' => {
  const type = (rawType || '').trim().toUpperCase();
  const titleLower = (title || '').toLowerCase();

  // 1. Single Part / Passage
  const isPartCode =
    /^(IELTS_L[1-4]|IELTS_R[1-3]|IELTS_W[1-2])$/.test(type) ||
    /^TOEIC_P[1-7]$/.test(type) ||
    /^(TW_P[1-3]|TOEIC_W[1-3])$/.test(type) ||
    /^NLTV_(L[1-4]|R[1-2]|W[1-3])$/.test(type);

  const hasPartTitle =
    titleLower.includes('passage ') ||
    titleLower.includes('phần ') ||
    titleLower.includes('part ');

  if (isPartCode || (hasPartTitle && (parts === 1 || parts === undefined))) {
    return 'SINGLE_PART';
  }

  // 2. Single Skill
  const isSkillCode =
    type === 'IELTS_LISTENING' || type === 'IELTS_READING' || type === 'IELTS_WRITING' ||
    type === 'TOEIC_LISTENING' || type === 'TOEIC_READING' || type === 'TOEIC_WRITING' ||
    type === 'TW' || type === 'TOEIC_W' ||
    type === 'NLTV_READING' || type === 'NLTV_LISTENING' || type === 'NLTV_WRITING' ||
    type === 'NLTV_R' || type === 'NLTV_L' || type === 'NLTV_W';

  const isLegacyNltvSingleSkill =
    type.startsWith('NLTV') && (
      titleLower.includes('kỹ năng đọc') ||
      titleLower.includes('kỹ năng nghe') ||
      titleLower.includes('kỹ năng viết') ||
      (parts !== undefined && parts > 0 && parts < 9)
    );

  if (isSkillCode || isLegacyNltvSingleSkill) {
    return 'SINGLE_SKILL';
  }

  // 3. Full Exam
  return 'FULL_EXAM';
};

const ExamLibrary: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // User target from onboarding via React Query
  const { data: onboardingRes } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: onboardingApi.getStatus,
    staleTime: 60 * 1000,
  });
  const userTarget = onboardingRes?.data;
  const hasOnboarded = Boolean(userTarget?.hasCompletedOnboarding && userTarget?.targetCertificate);

  // Filter States
  const [activeTab, setActiveTab] = useState<string>('RECOMMENDED');
  const [selectedScope, setSelectedScope] = useState<ExamScope>('ALL');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [selectedAttemptStatus, setSelectedAttemptStatus] = useState<string>('ALL');
  const [sortParam, setSortParam] = useState('createdAt');
  
  // Pagination
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Target certificate category
  const targetCategory = useMemo(() => {
    return getTargetCertCategory(userTarget?.targetCertificate);
  }, [userTarget]);

  // Target language from onboarding or derived from certificate
  const userTargetLanguage = useMemo(() => {
    if (userTarget?.targetLanguage) return userTarget.targetLanguage.toLowerCase();
    if (targetCategory === 'NLTV') return 'vi';
    if (targetCategory === 'IELTS' || targetCategory === 'TOEIC_LR' || targetCategory === 'TOEIC_WRITING') return 'en';
    return '';
  }, [userTarget, targetCategory]);

  const certTabs = useMemo(() => [
    { id: 'RECOMMENDED', label: t('library.tabs.recommended', '✨ Dành Cho Bạn') },
    { id: 'ALL', label: t('library.tabs.all', 'Tất Cả') },
    { id: 'IELTS', label: 'IELTS' },
    { id: 'TOEIC', label: 'TOEIC' },
    { id: 'NLTV', label: 'NLTV' },
  ], [t]);

  const skillOptions = useMemo(() => [
    { id: '', label: t('library.filters.skill_all', 'Tất cả kỹ năng') },
    { id: 'LISTENING', label: t('library.filters.skill_listening', 'Nghe hiểu'), icon: <Headphones size={13} /> },
    { id: 'READING', label: t('library.filters.skill_reading', 'Đọc hiểu'), icon: <BookOpen size={13} /> },
    { id: 'WRITING', label: t('library.filters.skill_writing', 'Viết'), icon: <PenTool size={13} /> },
  ], [t]);

  const scopeOptions = useMemo(() => [
    { id: 'ALL' as ExamScope, label: t('library.filters.scope_all', 'Tất cả hình thức') },
    { id: 'FULL_EXAM' as ExamScope, label: t('library.filters.scope_full', 'Làm Full đề'), icon: <Layers size={13} /> },
    { id: 'SINGLE_SKILL' as ExamScope, label: t('library.filters.scope_skill', '1 Kỹ năng'), icon: <Target size={13} /> },
    { id: 'SINGLE_PART' as ExamScope, label: t('library.filters.scope_part', '1 Phần (Part / Passage)'), icon: <Puzzle size={13} /> },
  ], [t]);

  const attemptStatusChips = useMemo(() => [
    { id: 'ALL', label: t('library.filters.attempt_all', 'Tất cả đề') },
    { id: 'UNATTEMPTED', label: t('library.filters.attempt_unattempted', 'Chưa làm') },
    { id: 'ATTEMPTED', label: t('library.filters.attempt_attempted', 'Đã làm') },
  ], [t]);

  // Dynamic tabs filtered by user's target language
  const visibleTabs = useMemo(() => {
    if (!userTargetLanguage) return certTabs;
    const isEn = isSameLanguage(userTargetLanguage, 'en');
    const isVi = isSameLanguage(userTargetLanguage, 'vi');
    return certTabs.filter(tab => {
      if (tab.id === 'RECOMMENDED' || tab.id === 'ALL') return true;
      if (tab.id === 'NLTV') return isVi;
      if (tab.id === 'IELTS' || tab.id === 'TOEIC') return isEn;
      return true;
    });
  }, [userTargetLanguage, certTabs]);

  // Sync activeTab if user has not completed onboarding or tab not visible
  useEffect(() => {
    if (onboardingRes !== undefined && !hasOnboarded && activeTab === 'RECOMMENDED') {
      setActiveTab('ALL');
    } else if (visibleTabs.length > 0 && !visibleTabs.some(t => t.id === activeTab)) {
      setActiveTab('RECOMMENDED');
    }
  }, [onboardingRes, hasOnboarded, visibleTabs, activeTab]);

  // Determine current active certificate
  const currentCert = useMemo(() => {
    if (activeTab === 'RECOMMENDED') {
      if (targetCategory === 'IELTS') return 'IELTS';
      if (targetCategory === 'TOEIC_LR') return 'TOEIC_LR';
      if (targetCategory === 'TOEIC_WRITING') return 'TOEIC_WRITING';
      if (targetCategory === 'NLTV') return 'NLTV';
      return '';
    }
    if (activeTab !== 'ALL' && activeTab !== 'RECOMMENDED') {
      return activeTab;
    }
    return '';
  }, [activeTab, targetCategory]);

  const fetchExams = useCallback(async (targetPage: number) => {
    try {
      setLoading(true);
      const params: any = { page: targetPage, size: 12, sort: sortParam };
      if (searchTerm.trim()) params.search = searchTerm.trim();

      // Luôn lọc theo ngôn ngữ mục tiêu của người dùng để loại bỏ các đề không cùng ngôn ngữ
      if (userTargetLanguage) {
        params.examLanguage = userTargetLanguage;
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
          } else if (currentCert === 'TOEIC_LR') {
            if (selectedSkill === 'LISTENING') {
              typesToFetch = ['TOEIC_LR', 'TOEIC', 'TOEIC_LISTENING_READING', 'TOEIC_LISTENING', 'TOEIC_P1', 'TOEIC_P2', 'TOEIC_P3', 'TOEIC_P4'];
            } else if (selectedSkill === 'READING') {
              typesToFetch = ['TOEIC_LR', 'TOEIC', 'TOEIC_LISTENING_READING', 'TOEIC_READING', 'TOEIC_P5', 'TOEIC_P6', 'TOEIC_P7'];
            } else if (selectedSkill === 'WRITING') {
              typesToFetch = ['TOEIC_WRITING', 'TW', 'TOEIC_W', 'TW_P1', 'TW_P2', 'TW_P3'];
            }
          } else if (currentCert === 'TOEIC_WRITING') {
            if (selectedSkill === 'WRITING') {
              typesToFetch = ['TOEIC_WRITING', 'TW', 'TOEIC_W', 'TW_P1', 'TW_P2', 'TW_P3'];
            } else {
              typesToFetch = ['__NONE__'];
            }
          } else if (currentCert === 'TOEIC') {
            if (selectedSkill === 'LISTENING') {
              typesToFetch = ['TOEIC_LR', 'TOEIC', 'TOEIC_LISTENING_READING', 'TOEIC_LISTENING', 'TOEIC_P1', 'TOEIC_P2', 'TOEIC_P3', 'TOEIC_P4'];
            } else if (selectedSkill === 'READING') {
              typesToFetch = ['TOEIC_LR', 'TOEIC', 'TOEIC_LISTENING_READING', 'TOEIC_READING', 'TOEIC_P5', 'TOEIC_P6', 'TOEIC_P7'];
            } else if (selectedSkill === 'WRITING') {
              typesToFetch = ['TOEIC_WRITING', 'TW', 'TOEIC_W', 'TW_P1', 'TW_P2', 'TW_P3'];
            }
          } else if (currentCert === 'NLTV') {
            if (selectedSkill === 'LISTENING') {
              typesToFetch = ['NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_LISTENING', 'NLTV_L', 'NLTV_L1', 'NLTV_L2', 'NLTV_L3', 'NLTV_L4'];
            } else if (selectedSkill === 'READING') {
              typesToFetch = ['NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_READING', 'NLTV_R', 'NLTV_R1', 'NLTV_R2'];
            } else if (selectedSkill === 'WRITING') {
              typesToFetch = ['NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_WRITING', 'NLTV_W', 'NLTV_W1', 'NLTV_W2', 'NLTV_W3'];
            }
          }
        } else {
          // No skill selected -> show all exams for this cert
          if (currentCert === 'IELTS') {
            typesToFetch = ['IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS', 'IELTS_LISTENING', 'IELTS_READING', 'IELTS_WRITING', 'IELTS_L1', 'IELTS_L2', 'IELTS_L3', 'IELTS_L4', 'IELTS_R1', 'IELTS_R2', 'IELTS_R3', 'IELTS_W1', 'IELTS_W2'];
          } else if (currentCert === 'TOEIC_LR') {
            typesToFetch = ['TOEIC_LR', 'TOEIC', 'TOEIC_LISTENING', 'TOEIC_READING', 'TOEIC_P1', 'TOEIC_P2', 'TOEIC_P3', 'TOEIC_P4', 'TOEIC_P5', 'TOEIC_P6', 'TOEIC_P7'];
          } else if (currentCert === 'TOEIC_WRITING') {
            typesToFetch = ['TOEIC_WRITING', 'TW_P1', 'TW_P2', 'TW_P3'];
          } else if (currentCert === 'TOEIC') {
            typesToFetch = ['TOEIC_LR', 'TOEIC', 'TOEIC_LISTENING_READING', 'TOEIC_WRITING', 'TOEIC_LISTENING', 'TOEIC_READING', 'TOEIC_P1', 'TOEIC_P2', 'TOEIC_P3', 'TOEIC_P4', 'TOEIC_P5', 'TOEIC_P6', 'TOEIC_P7', 'TW_P1', 'TW_P2', 'TW_P3'];
          } else if (currentCert === 'NLTV') {
            typesToFetch = ['NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_LISTENING', 'NLTV_READING', 'NLTV_WRITING', 'NLTV_L', 'NLTV_R', 'NLTV_W', 'NLTV_L1', 'NLTV_L2', 'NLTV_L3', 'NLTV_L4', 'NLTV_R1', 'NLTV_R2', 'NLTV_W1', 'NLTV_W2', 'NLTV_W3'];
          }
        }
      } else {
        // All certs: if a skill is selected, fetch all exams containing that skill
        if (selectedSkill) {
          if (selectedSkill === 'LISTENING') {
            typesToFetch = [
              'IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS_LISTENING', 'IELTS_L1', 'IELTS_L2', 'IELTS_L3', 'IELTS_L4',
              'TOEIC_LR', 'TOEIC_LISTENING', 'TOEIC_P1', 'TOEIC_P2', 'TOEIC_P3', 'TOEIC_P4',
              'NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_LISTENING', 'NLTV_L', 'NLTV_L1', 'NLTV_L2', 'NLTV_L3', 'NLTV_L4'
            ];
          } else if (selectedSkill === 'READING') {
            typesToFetch = [
              'IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS_READING', 'IELTS_R1', 'IELTS_R2', 'IELTS_R3',
              'TOEIC_LR', 'TOEIC_READING', 'TOEIC_P5', 'TOEIC_P6', 'TOEIC_P7',
              'NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_READING', 'NLTV_R', 'NLTV_R1', 'NLTV_R2'
            ];
          } else if (selectedSkill === 'WRITING') {
            typesToFetch = [
              'IELTS_ACADEMIC', 'IELTS_GENERAL', 'IELTS_WRITING', 'IELTS_W1', 'IELTS_W2',
              'TOEIC_WRITING', 'TW', 'TOEIC_W', 'TW_P1', 'TW_P2', 'TW_P3',
              'NLTV', 'NLTV_A1_A2', 'NLTV_B1_C1', 'NLTV_WRITING', 'NLTV_W', 'NLTV_W1', 'NLTV_W2', 'NLTV_W3'
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
  }, [sortParam, searchTerm, activeTab, userTarget, currentCert, selectedSkill, userTargetLanguage]);

  useEffect(() => {
    setPage(0);
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
    setActiveTab(hasOnboarded ? 'RECOMMENDED' : 'ALL');
    setSelectedScope('ALL');
    setSelectedSkill('');
    setSelectedAttemptStatus('ALL');
    setSortParam('createdAt');
    setPage(0);
  };

  // Filter exams client-side: enforce target language, target certificate, scope, and attempt status
  const displayedExams = useMemo(() => {
    let list = exams;

    // 1. Loại bỏ các đề không cùng ngôn ngữ mục tiêu của học viên
    if (userTargetLanguage) {
      list = list.filter(e => isSameLanguage(e.examLanguage, userTargetLanguage));
    }

    // 2. Nếu ở tab Dành Cho Bạn: lọc chặt chẽ chỉ lấy đề khớp chính xác loại chứng chỉ mục tiêu
    if (activeTab === 'RECOMMENDED' && userTarget?.targetCertificate) {
      list = list.filter(e => isExamMatchingTargetCert(e.type, userTarget.targetCertificate));
    }

    // 3. Lọc theo hình thức thi (Scope: Full đề / 1 Kỹ năng / 1 Phần)
    if (selectedScope !== 'ALL') {
      list = list.filter(e => getExamScope(e.type, e.title) === selectedScope);
    }

    // 4. Lọc theo trạng thái làm bài (đã làm / chưa làm)
    if (selectedAttemptStatus === 'ATTEMPTED') {
      list = list.filter(e => e.isAttempted === true);
    } else if (selectedAttemptStatus === 'UNATTEMPTED') {
      list = list.filter(e => !e.isAttempted);
    }

    return list;
  }, [exams, userTargetLanguage, activeTab, userTarget, selectedScope, selectedAttemptStatus]);

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

  const isMatchUserTarget = useCallback((exam: ExamItem) => {
    const isTargetCert = isExamMatchingTargetCert(exam.type, userTarget?.targetCertificate);
    if (!isTargetCert) return false;
    if (userTargetLanguage && exam.examLanguage) {
      return isSameLanguage(exam.examLanguage, userTargetLanguage);
    }
    return true;
  }, [userTarget, userTargetLanguage]);

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
            <span>{t('library.hero.badge', 'Thư Viện Đề Thi Chuẩn Hóa')}</span>
          </div>

          <h1 className="exam-library-hero-title">
            {t('library.hero.title', 'Thư viện Đề thi')}
          </h1>

          <p className="exam-library-hero-desc">
            {t('library.hero.subtitle', 'Hàng ngàn đề thi chuẩn hóa IELTS, TOEIC và Năng Lực Tiếng Việt (NLTV). Luyện tập ngay hôm nay để đạt mục tiêu của bạn.')}
          </p>

          {/* User Target Banner if completed onboarding */}
          {hasOnboarded && userTarget?.targetCertificate && (
            <div className="exam-library-target-banner">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <Sparkles size={16} color="#fde047" />
                <span>{t('library.target_banner.your_goal', 'Mục tiêu của bạn:')} <strong>{CERT_LABELS_MAP[userTarget.targetCertificate] || userTarget.targetCertificate}</strong> {userTarget.targetScore ? `(Band / Điểm: ${userTarget.targetScore})` : ''}</span>
              </span>
              <button
                type="button"
                className="exam-library-target-banner-btn"
                onClick={() => {
                  setActiveTab('RECOMMENDED');
                  setSelectedSkill('');
                  setPage(0);
                }}
              >
                {t('library.target_banner.view_goal_tests', 'Xem đề mục tiêu')}
              </button>
              <button
                type="button"
                className="exam-library-target-banner-btn"
                style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.35)', marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => navigate('/student/history')}
                title="Xem các bài thi đã làm trong Lịch sử làm bài"
              >
                <HistoryIcon size={14} />
                <span>{t('library.target_banner.view_history', 'Lịch sử làm bài')}</span>
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
        {/* Certificate Segmented Tabs (Clean: IELTS, TOEIC, NLTV filtered by target language) */}
        <div className="exam-library-tabs-bar" role="tablist">
          {visibleTabs.map((tab) => {
            if (tab.id === 'RECOMMENDED' && !hasOnboarded) {
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
            <span className="exam-library-filter-label">{t('library.filters.skill_label', 'Kỹ năng:')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: 1 }}>
              {skillOptions.map((opt) => {
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

          {/* Row 2: Hình thức làm bài (Scope Filter) */}
          <div className="exam-library-filter-row" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
            <span className="exam-library-filter-label">{t('library.filters.scope_label', 'Hình thức:')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {scopeOptions.map((opt) => {
                const isActive = selectedScope === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`exam-library-chip ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedScope(opt.id);
                      setPage(0);
                    }}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Trạng thái làm bài */}
          <div className="exam-library-filter-row" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
            <span className="exam-library-filter-label">{t('library.filters.status_label', 'Trạng thái:')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {attemptStatusChips.map((chip) => {
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
          {(searchTerm || selectedSkill || selectedScope !== 'ALL' || selectedAttemptStatus !== 'ALL') && (
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
              <span>{t('library.filters.clear_filters', 'Xóa bộ lọc')}</span>
            </button>
          )}
        </div>

        {/* Grid or Status View */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5rem 0', color: '#ea580c' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid #ffedd5', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#64748b' }}>{t('library.status.loading', 'Đang tải danh sách đề thi...')}</span>
            </div>
          </div>
        ) : displayedExams.length === 0 ? (
          <div className="exam-library-empty">
            <div className="exam-library-empty-icon">
              <BookOpen size={30} />
            </div>
            <h3 className="exam-library-empty-title">{t('library.status.empty_title', 'Không tìm thấy đề thi nào')}</h3>
            <p className="exam-library-empty-desc">
              {t('library.status.empty_desc', 'Không có đề thi nào khớp với bộ lọc hiện tại của bạn. Hãy thử chọn kỹ năng khác hoặc bấm nút bên dưới để xem lại tất cả đề thi.')}
            </p>
            <button type="button" className="btn btn-primary" onClick={handleResetFilters}>
              {t('library.status.view_all', 'Xem tất cả đề thi')}
            </button>
          </div>
        ) : (
          <div className="exam-grid">
            {displayedExams.map((exam) => {
              const gradientBg = getThumbnailGradient(exam.type);
              const watermark = getWatermark(exam.type);
              const isMatch = isMatchUserTarget(exam);

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
                        <span
                          className="exam-card-attempt-badge attempted"
                          title="Bấm để xem lịch sử làm đề này"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/student/history?search=${encodeURIComponent(exam.title)}`);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <CheckCircle2 size={12} />
                          <span>{t('library.card.attempted_count', { count: exam.userAttemptsCount || 1, defaultValue: `Đã làm (${exam.userAttemptsCount || 1} lần)` })} {exam.userHighestScore !== null && exam.userHighestScore !== undefined ? `• ${formatScore(exam.userHighestScore, exam.type)}` : ''}</span>
                        </span>
                      ) : (
                        <span className="exam-card-attempt-badge unattempted">
                          <span>{t('library.card.unattempted', 'Chưa làm')}</span>
                        </span>
                      )}

                      <span className="exam-card-level-badge">{exam.level}</span>
                    </div>

                    {/* Target Match Badge */}
                    {isMatch && (
                      <span className="exam-card-target-match">
                        {t('library.card.target_match', '🎯 Khớp mục tiêu')}
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
                          <span>{t('library.card.duration', { count: exam.durationMinutes, defaultValue: `${exam.durationMinutes} phút` })}</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Users size={14} color="#94a3b8" />
                          <span>{t('library.card.joins', { count: exam.joins || 0, defaultValue: `${exam.joins || 0} lượt thi` })}</span>
                        </span>
                      </div>

                      <span className="exam-card-cta-btn">
                        <span>{exam.isAttempted ? t('library.card.retake', 'Làm lại') : t('library.card.takeExam', 'Làm bài')}</span>
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
                const prev = page - 1;
                setPage(prev);
                fetchExams(prev);
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
                const next = page + 1;
                setPage(next);
                fetchExams(next);
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
