import { examErrorMessage as ee } from '../i18n/examMessages';
import { examMessage as em, useExamLocale } from '../i18n/examMessages';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import LanguageSwitcher from '../../../components/common/LanguageSwitcher';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import useWorkspace from '../hooks/useWorkspace';
import { useExamTimer } from '../hooks/useExamTimer';
import { useAutosave } from '../hooks/useAutosave';
import { useAttemptSubmission } from '../hooks/useAttemptSubmission';
import { TimerDisplay } from '../components/TimerDisplay';
import { SaveStatusBadge } from '../components/SaveStatusBadge';
import { SubmitOverlay } from '../components/SubmitOverlay';
import { SubmitConfirmModal } from '../components/SubmitConfirmModal';
import { TimeUpModal } from '../components/TimeUpModal';
import { QuestionPalette } from '../components/QuestionPalette';
import QuestionRenderer from '../components/renderers/QuestionRenderer';
import AudioPlayer from '../components/AudioPlayer';
import HtmlContent from '../components/content/HtmlContent';
import MediaDisplay from '../components/content/MediaDisplay';
import { lockSection } from '../api/attemptApi';
import { setAnswer, lockAnswers, toggleFlag, addHighlightRecord, removeHighlightRecord } from '../store/answerSlice';
import { useTextSelection, type SelectionState } from '../hooks/useTextSelection';
import { SelectionToolbar } from '../components/content/SelectionToolbar';
import { useReadingHighlights } from '../hooks/useReadingHighlights';
import { isAnswered } from '../utils/answerUtils';
import { extractMinWords, getPartHeaderInfo } from '../utils/examPartUtils';
import { usePracticeFeedback } from '../hooks/usePracticeFeedback';
import { usePracticeRetry } from '../hooks/usePracticeRetry';
import { PracticeQuestionFeedback } from '../components/practice/PracticeQuestionFeedback';
import { PracticeRetryToolbar } from '../components/practice/PracticeRetryToolbar';
import { useWritingHints } from '../hooks/useWritingHints';
import { WritingHintsPanel } from '../components/practice/WritingHintsPanel';
import { PracticeDictionaryPopover } from '../components/practice/PracticeDictionaryPopover';
import { usePracticeDictionary } from '../hooks/usePracticeDictionary';
import { selectRetryQuestionIds, filterRetryGroups } from '../utils/practiceRetry';
import { isToeicExamSnapshot, buildToeicWorkspaceModel } from '../utils/toeicWorkspaceModel';
import ToeicWorkspace from '../components/workspace/ToeicWorkspace';
import ReferencePane, { type ReferenceDoc } from '../components/workspace/ReferencePane';
import ReadingPartContent, {
  readReferenceDocs,
  type ReadingGroupView,
  type ReadingQuestionView,
} from '../components/workspace/ReadingPartContent';
import { WritingPromptContent } from '../components/workspace/WritingPromptContent';
import { canonicalizeLearningLanguage } from '../../../core/i18n/learningLanguages';
import { AlertCircle } from 'lucide-react';
import { useStore } from 'react-redux';
import type { AppDispatch, RootState } from '../../../app/store';
import type { Question, ExamOption } from '../types/exam.types';

interface DictTooltip {
  word: string;
  x: number;
  y: number;
  selection: SelectionState;
}

function isRecordedId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}

/** Stable content hash used to scope highlights to the document version they were made on. */
const TOEIC_READING_SPLIT_MIN = 30;
const TOEIC_READING_SPLIT_MAX = 70;
const TOEIC_READING_SPLIT_STEP = 5;
const WRITING_SPLIT_MIN = 35;
const WRITING_SPLIT_MAX = 65;
const DEFAULT_SPLIT_BOUNDS = { min: 25, max: 75 };

/**
 * The AI dictionary lookup stays Practice-only (AC-04/AC-09): Mock must never offer an
 * answer-derived lookup affordance next to the reading text.
 */
export function shouldShowAiLookup(
  selection: SelectionState | null,
  isPractice: boolean,
  learningLanguage: string | null = 'en',
): boolean {
  if (!isPractice || !selection) return false;
  const language = canonicalizeLearningLanguage(learningLanguage);
  if (!language) return false;
  const selected = selection.text.trim();
  const length = Array.from(selected).length;
  const base = language.split('-')[0];
  const wordCount = selected.split(/\s+/u).filter(Boolean).length;
  return length >= 1 && length <= 80 && ((base === 'zh' || base === 'ja') || wordCount <= 5) &&
    /[\p{L}\p{M}]/u.test(selected) && /^[\p{L}\p{M}'’\-\s]+$/u.test(selected);
}

interface ToeicReadingDividerProps {
  ratio: number;
  dragging: boolean;
  onMouseDown: () => void;
  onReset: () => void;
  onStep: (delta: number) => void;
}

/**
 * Accessible reading split handle: draggable, focusable separator with arrow/Home/End support, plus
 * explicit narrower/wider/reset buttons and a visible focus ring (AC-07).
 */
const ToeicReadingDivider: React.FC<ToeicReadingDividerProps> = ({
  ratio,
  dragging,
  onMouseDown,
  onReset,
  onStep,
}) => (
  <div
    data-testid="toeic-reading-divider-shell"
    className="hidden lg:flex flex-col items-center gap-1 w-6 shrink-0 z-20 py-2"
  >
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={em("Điều chỉnh tỉ lệ khung đọc")}
      aria-valuenow={Math.round(ratio)}
      aria-valuemin={TOEIC_READING_SPLIT_MIN}
      aria-valuemax={TOEIC_READING_SPLIT_MAX}
      tabIndex={0}
      data-testid="toeic-reading-divider"
      title={em("Kéo hoặc dùng phím mũi tên để chỉnh tỉ lệ 2 khung (30–70%)")}
      onMouseDown={onMouseDown}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onStep(-TOEIC_READING_SPLIT_STEP);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          onStep(TOEIC_READING_SPLIT_STEP);
        } else if (event.key === 'Home') {
          event.preventDefault();
          onStep(TOEIC_READING_SPLIT_MIN - ratio);
        } else if (event.key === 'End') {
          event.preventDefault();
          onStep(TOEIC_READING_SPLIT_MAX - ratio);
        }
      }}
      className={`flex-1 w-2.5 cursor-col-resize bg-slate-200 border-x border-slate-300 flex items-center justify-center group transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
        dragging ? 'bg-amber-500' : 'hover:bg-amber-400'
      }`}
    >
      <div className="w-0.5 h-8 rounded-full bg-slate-400 group-hover:bg-amber-800 transition-colors" />
    </div>

    <div className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-xs shrink-0">
      <button
        type="button"
        aria-label={em("Thu hẹp khung đọc")}
        onClick={() => onStep(-TOEIC_READING_SPLIT_STEP)}
        className="w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label={em("Đặt lại tỉ lệ 50/50")}
        onClick={onReset}
        className="w-5 h-5 flex items-center justify-center rounded text-[8px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
      >
        50
      </button>
      <button
        type="button"
        aria-label={em("Mở rộng khung đọc")}
        onClick={() => onStep(TOEIC_READING_SPLIT_STEP)}
        className="w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
      >
        ›
      </button>
    </div>
  </div>
);

const WorkspacePage: React.FC = () => {
  useExamLocale();
  const { attemptId: attemptIdStr } = useParams<{ attemptId: string }>();
  const parsedAttemptId = Number(attemptIdStr);
  const isValidAttemptId = Number.isSafeInteger(parsedAttemptId) && parsedAttemptId >= 1 && parsedAttemptId <= 2147483647;
  const attemptId = isValidAttemptId ? parsedAttemptId : 0;
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();

  const { workspace, loading, error, ready, retry, refreshError, refreshMetadata } = useWorkspace(attemptId);
  const activeWorkspace = ready && !loading && !error && workspace?.attempt_id === attemptId ? workspace : null;

  const { displayTime, isExpired, isPractice } = useExamTimer(
    activeWorkspace?.deadline ?? null,
    activeWorkspace?.serverTimeOffset ?? 0
  );
  const autosave = useAutosave(activeWorkspace && activeWorkspace.status === 'IN_PROGRESS' ? attemptId : null, activeWorkspace ?? undefined);
  const [feedbackLanguage, setFeedbackLanguage] = useState<string | null>(null);
  useEffect(() => setFeedbackLanguage(null), [attemptId]);
  const submission = useAttemptSubmission(activeWorkspace, autosave,
    feedbackLanguage ?? activeWorkspace?.languageContext?.defaultExplanationLanguage ?? null);
  const isSubmitting = submission.phase === 'waiting' || submission.phase === 'submitting';
  const draftWarning = submission.draftWarning ?? autosave.draftWarning;

  const answersState = useSelector((state: RootState) => state.answers);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showTimeUp, setShowTimeUp] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [hasLocalDraft, setHasLocalDraft] = useState<boolean>(false);
  const [confirmedLocks, setConfirmedLocks] = useState<{ attemptId: number; sectionIds: number[] }>({
    attemptId,
    sectionIds: [],
  });
  const [pendingTargetPartId, setPendingTargetPartId] = useState<number | null>(null);
  const [pendingLockError, setPendingLockError] = useState<string | null>(null);
  const [requestedQuestionId, setRequestedQuestionId] = useState<string | null>(null);
  // The question the TOEIC workspace currently shows; feeds the palette's aria-current marker.
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const currentAttemptIdRef = useRef<number>(attemptId);
  const activeAttemptIdRef = useRef<number | null>(attemptId);
  const routeLifecycleGenRef = useRef<number>(0);
  const lockOperationGenRef = useRef<number>(0);
  const unmountedRef = useRef<boolean>(false);

  // Synchronously sync route change ref and bump lifecycle and lock generations
  if (!Object.is(currentAttemptIdRef.current, attemptId)) {
    currentAttemptIdRef.current = attemptId;
    activeAttemptIdRef.current = attemptId;
    routeLifecycleGenRef.current += 1;
    lockOperationGenRef.current += 1;
  }

  // Component lifecycle: track unmount and invalidate in-flight operations
  useEffect(() => {
    unmountedRef.current = false;
    activeAttemptIdRef.current = attemptId;
    return () => {
      unmountedRef.current = true;
      activeAttemptIdRef.current = null;
      routeLifecycleGenRef.current += 1;
      lockOperationGenRef.current += 1;
    };
  }, [attemptId]);

  // Sync draft check & reset selection and locks when attemptId changes
  useEffect(() => {
    setSelectedPartId(null);
    setConfirmedLocks({ attemptId, sectionIds: [] });
    setPendingTargetPartId(null);
    setPendingLockError(null);
    activeAttemptIdRef.current = attemptId;
    routeLifecycleGenRef.current += 1;
    lockOperationGenRef.current += 1;
    if (isValidAttemptId) {
      try {
        setHasLocalDraft(localStorage.getItem(`exam_draft_${attemptId}`) !== null);
      } catch {
        setHasLocalDraft(false);
      }
    } else {
      setHasLocalDraft(false);
    }
  }, [attemptId, isValidAttemptId]);

  // Terminal state redirect effect
  useEffect(() => {
    if (ready && activeWorkspace && activeWorkspace.status !== 'IN_PROGRESS') {
      navigate(`/attempts/${attemptId}/result`);
    }
  }, [ready, activeWorkspace, attemptId, navigate]);

  // Resizable split pane state (default 50/50; IELTS 25%-75%, TOEIC Reading 30%-70%)
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitBoundsRef = useRef(DEFAULT_SPLIT_BOUNDS);
  const workspaceContainerRef = useRef<HTMLDivElement>(null);

  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [isDesktopReadingViewport, setIsDesktopReadingViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
      setIsDesktopReadingViewport(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isDraggingSplit) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!workspaceContainerRef.current) return;
      const rect = workspaceContainerRef.current.getBoundingClientRect();
      if (!rect.width) return;
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      if (!Number.isFinite(newWidth)) return;
      const { min, max } = splitBoundsRef.current;
      setSplitRatio(Math.min(max, Math.max(min, newWidth)));
    };
    const onMouseUp = () => {
      setIsDraggingSplit(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingSplit]);

  // Practice-only dictionary result; lookup state is owned by its request controller.
  const [dictTooltip, setDictTooltip] = useState<DictTooltip | null>(null);
  const readingContainerRef = workspaceContainerRef;

  const sections = useMemo(() => {
    return activeWorkspace?.exam_snapshot?.sections ?? [];
  }, [activeWorkspace]);

  // Reconcile confirmedLocks when server lockedSections arrive
  useEffect(() => {
    if (
      activeWorkspace?.lockedSections &&
      confirmedLocks.attemptId === attemptId &&
      !unmountedRef.current &&
      Object.is(currentAttemptIdRef.current, attemptId) &&
      confirmedLocks.sectionIds.length > 0
    ) {
      const serverSet = new Set(activeWorkspace.lockedSections);
      const remaining = confirmedLocks.sectionIds.filter(id => !serverSet.has(id));
      if (remaining.length !== confirmedLocks.sectionIds.length) {
        setConfirmedLocks({ attemptId, sectionIds: remaining });
      }
    }
  }, [activeWorkspace?.lockedSections, attemptId, confirmedLocks]);

  const lockedSections = useMemo(() => {
    const serverLocks = activeWorkspace?.lockedSections ?? [];
    const localLocks = confirmedLocks.attemptId === attemptId ? confirmedLocks.sectionIds : [];
    if (localLocks.length === 0) return serverLocks;
    const combined = new Set<number>([...serverLocks, ...localLocks]);
    return Array.from(combined);
  }, [activeWorkspace?.lockedSections, confirmedLocks, attemptId]);

  // Flatten all parts for quick selection
  const allParts = useMemo(() => {
    return sections.flatMap(s => s.parts ?? []);
  }, [sections]);

  const lockedPartIds = useMemo(() => {
    if (activeWorkspace?.test_mode !== 'MOCK_TEST' || lockedSections.length === 0) {
      return new Set<number>();
    }
    const lockedSet = new Set<number>(lockedSections);
    const result = new Set<number>();
    sections.forEach(s => {
      const sId = (s as any).section_id ?? s.id;
      if (sId != null && lockedSet.has(sId)) {
        s.parts?.forEach(p => {
          const pId = (p as any).part_id ?? (p as any).id;
          if (pId != null) result.add(pId);
        });
      }
    });
    return result;
  }, [activeWorkspace, lockedSections, sections]);

  const firstUnlockedSection = useMemo(() => {
    return sections.find(s => {
      const sId = (s as any).section_id ?? s.id;
      return sId != null && !lockedSections.includes(sId);
    });
  }, [sections, lockedSections]);

  // Active part: selected part or first part of first unlocked section
  const currentPart = useMemo(() => {
    if (allParts.length === 0) return null;
    if (selectedPartId !== null) {
      const found = allParts.find(p => (p as any).id === selectedPartId || (p as any).part_id === selectedPartId);
      if (found) return found;
    }
    if (firstUnlockedSection && firstUnlockedSection.parts && firstUnlockedSection.parts.length > 0) {
      return firstUnlockedSection.parts[0];
    }
    if (sections[0]?.parts && sections[0].parts.length > 0) {
      return sections[0].parts[0];
    }
    return allParts[0] ?? null;
  }, [allParts, selectedPartId, firstUnlockedSection, sections]);

  // Keep selectedPartId in sync once initial active part resolves
  useEffect(() => {
    if (
      selectedPartId === null &&
      currentPart &&
      !unmountedRef.current &&
      Object.is(currentAttemptIdRef.current, attemptId)
    ) {
      const pId = (currentPart as any).id ?? (currentPart as any).part_id;
      if (pId != null) {
        setSelectedPartId(pId);
      }
    }
  }, [selectedPartId, currentPart, attemptId]);

  const currentSection = useMemo(() => {
    if (!currentPart) return sections[0] ?? null;
    const currentPId = (currentPart as any).id ?? (currentPart as any).part_id;
    return sections.find(s =>
      s.parts?.some(p => ((p as any).id === currentPId || (p as any).part_id === currentPId))
    ) ?? sections[0] ?? null;
  }, [sections, currentPart]);

  const currentSkill = currentSection?.skill_type || ((currentSection as any)?.name?.toUpperCase() as any) || 'READING';

  const partHeaderInfo = useMemo(() => {
    return getPartHeaderInfo(currentSkill, currentPart, currentSection?.parts, allParts);
  }, [currentSkill, currentPart, currentSection, allParts]);

  const currentPartQuestionGroups = useMemo(() => {
    if (!currentPart) return [];
    const backendGroups = (currentPart as any).questionGroups;
    if (Array.isArray(backendGroups) && backendGroups.length > 0) {
      return backendGroups;
    }
    const nestedGroups = currentPart.content?.question_groups;
    if (Array.isArray(nestedGroups) && nestedGroups.length > 0) {
      return nestedGroups;
    }
    const contentDataGroups = (currentPart as any).contentData?.question_groups;
    if (Array.isArray(contentDataGroups) && contentDataGroups.length > 0) {
      return contentDataGroups;
    }
    const directGroups = (currentPart as any).question_groups;
    if (Array.isArray(directGroups) && directGroups.length > 0) {
      return directGroups;
    }
    return [];
  }, [currentPart]);

  // Prefer grouped canonical data; PartFixture.questions is a flat compatibility view.
  const currentPartQuestions = useMemo(() => {
    if (!currentPart) return [];
    if (currentPartQuestionGroups.length > 0) {
      return currentPartQuestionGroups.flatMap((group: any) => group.questions ?? []);
    }
    if (Array.isArray((currentPart as any).questions) && (currentPart as any).questions.length > 0) {
      return (currentPart as any).questions;
    }
    return [];
  }, [currentPart, currentPartQuestionGroups]);

  const partId = (currentPart as any)?.id ?? (currentPart as any)?.part_id ?? 1;

  const normalizeOptionsList = (rawOptions: any): ExamOption[] | null => {
    if (!rawOptions) return null;
    if (!Array.isArray(rawOptions)) return null;
    if (rawOptions.length === 0) return [];

    return rawOptions.map((opt: any, idx: number) => {
      const defaultLetter = String.fromCharCode(65 + idx);
      if (typeof opt === 'string') {
        const text = opt.trim();
        const prefixRegex = new RegExp(`^${defaultLetter}[.)]\\s*`, 'i');
        const cleanedText = text.replace(prefixRegex, '').trim();
        return {
          id: defaultLetter,
          text: cleanedText || text,
        };
      }
      if (typeof opt === 'object' && opt !== null) {
        const id = String(opt.id ?? opt.value ?? opt.key ?? opt.label ?? defaultLetter);
        const rawText = String(opt.text ?? opt.content ?? opt.label ?? opt.title ?? opt.name ?? '');
        const prefixRegex = new RegExp(`^${id}[.)]\\s*`, 'i');
        const cleanedText = rawText.replace(prefixRegex, '').trim();
        return {
          id,
          text: cleanedText || rawText,
        };
      }
      return { id: defaultLetter, text: String(opt) };
    });
  };

  const normalizeQuestion = (q: any, fallbackQuestionNumber: number, group?: any): Question => {
    const rawOptions =
      q.options ??
      q.metadata?.options ??
      q.choices ??
      group?.options ??
      group?.shared_options ??
      group?.metadata?.options ??
      group?.metadata?.shared_options ??
      (currentPart as any)?.options ??
      (currentPart as any)?.shared_options ??
      (currentPart as any)?.content?.shared_options ??
      null;

    const normalizedOptions = normalizeOptionsList(rawOptions);

    return {
      ...q,
      question_id: q.question_id ?? q.questionId ?? String(q.id),
      question_number: q.question_number ?? q.questionNumber ?? q.id ?? fallbackQuestionNumber,
      type: q.type === 'MCQ' ? 'SINGLE_CHOICE' : q.type === 'FILL_IN' ? 'FILL_IN_THE_BLANK' : q.type,
      question_text: q.question_text || q.prompt || q.text || q.content || '',
      options: normalizedOptions,
      answer_group: q.answer_group,
    };
  };

  const partQuestionGroups = useMemo(() => {
    const groups = currentPartQuestionGroups.length > 0
      ? currentPartQuestionGroups
      : [{ group_id: `legacy-part-${partId}`, instruction: null, questions: currentPartQuestions }];
    let nextQuestionNumber = 1;

    return groups.map((group: any) => ({
      ...group,
      questions: (group.questions ?? []).map((question: any) =>
        normalizeQuestion(question, nextQuestionNumber++, group)
      ),
    }));
  }, [currentPartQuestionGroups, currentPartQuestions, partId, currentPart]);

  const partQuestions: Question[] = useMemo(
    () => partQuestionGroups.flatMap((group: any) => group.questions),
    [partQuestionGroups],
  );

  const isPracticeMode = activeWorkspace?.test_mode === 'PRACTICE';

  // Hints use recorded canonical IDs, never the answer editor's compatibility fallback.
  const writingPartId = currentPart?.id ?? null;
  const ownerId = useSelector((state: RootState) => state.auth?.user?.id ?? null);
  const dictionaryOwnerId = isRecordedId(Number(ownerId)) ? Number(ownerId) : null;
  const writingSection = currentPart ? (sections.find(section => section.parts?.some(p => ((p as any).id === writingPartId || (p as any).part_id === writingPartId))) ?? sections.find(section => section.parts?.includes(currentPart))) : undefined;
  const writingQuestionIds: (string | null)[] = currentPartQuestions.map((question: any) => {
    const id = question.question_id ?? question.questionId ?? question.id;
    return typeof id === 'string' && id.length > 0 ? id : isRecordedId(id) ? String(id) : null;
  });
  const isWritingHintsPart = Boolean(
    isPracticeMode && activeWorkspace?.status === 'IN_PROGRESS'
      && isRecordedId(writingPartId)
      && sections.flatMap(section => section.parts ?? []).filter(part => part.id === writingPartId).length === 1
      && writingSection != null && (writingSection.skill_type === 'WRITING' || (writingSection as any).name?.toUpperCase() === 'WRITING')
      && isRecordedId(writingSection.id)
      && sections.filter(section => section.id === writingSection.id).length === 1
      && writingQuestionIds.every(id => id !== null)
      && new Set(writingQuestionIds).size === writingQuestionIds.length
  );
  const isWritingSectionLocked = writingSection != null && lockedSections.includes(writingSection.id);
  const writingHints = useWritingHints({
    workspace: activeWorkspace,
    partId: writingPartId,
    questions: partQuestions,
    isLocked: submission.isLocked,
    ownerId: dictionaryOwnerId,
  });

  const practiceFeedback = usePracticeFeedback({
    workspace: isPracticeMode ? activeWorkspace : null,
    partId: isPracticeMode ? partId : null,
    questions: isPracticeMode ? partQuestions : [],
    isLocked: submission.isLocked(),
  });

  const retryContextKey = isPracticeMode && activeWorkspace?.attempt_id != null
    ? `${activeWorkspace.attempt_id}:${answersState.contextRevision}`
    : null;

  const practiceRetry = usePracticeRetry(
    retryContextKey,
    isPracticeMode ? partId : null
  );

  const isFeedbackBlocked = Boolean(practiceFeedback.blockedMessage);

  const handleStartRetry = () => {
    if (isFeedbackBlocked || submission.isLocked() || isCurrentSectionLocked) return;
    const retryIds = selectRetryQuestionIds(partQuestions, practiceFeedback.wrongQuestionIds);
    if (retryIds.length > 0) {
      practiceFeedback.hideFeedback(retryIds);
      practiceRetry.start(retryIds);
    }
  };

  const displayQuestionGroups = useMemo(() => {
    if (isPracticeMode && practiceRetry.active) {
      return filterRetryGroups(partQuestionGroups, new Set(practiceRetry.questionIds));
    }
    return partQuestionGroups;
  }, [isPracticeMode, practiceRetry.active, practiceRetry.questionIds, partQuestionGroups]);

  // Compute unanswered questions across the entire exam
  const allQuestions = useMemo(() => {
    return allParts.flatMap((p: any) => {
      if (Array.isArray(p.questions) && p.questions.length > 0) {
        return p.questions;
      }
      return p.content?.question_groups?.flatMap((g: any) => g.questions ?? []) ?? [];
    });
  }, [allParts]);

  const unansweredCount = useMemo(() => {
    let answered = 0;
    for (const partMap of Object.values(answersState.answers ?? {})) {
      for (const val of Object.values(partMap ?? {})) {
        if (isAnswered(val)) {
          answered++;
        }
      }
    }
    return Math.max(0, allQuestions.length - answered);
  }, [allQuestions, answersState.answers]);

  const handleSubmit = (isTimeout = false) => {
    writingHints.suspend();
    if (isPracticeMode) {
      practiceFeedback.suspend();
      practiceRetry.stop();
    }
    return submission.submit(isTimeout ? 'TIMEOUT_CLIENT' : 'MANUAL');
  };

  useEffect(() => {
    if (!submission.result || submission.result.attempt_id !== attemptId) return;
    if (!showTimeUp && !isExpired) navigate(submission.result.redirect_url);
  }, [submission.result, attemptId, showTimeUp, isExpired, navigate, store]);

  useEffect(() => {
    setShowConfirm(false);
    setShowOverlay(false);
    setShowTimeUp(false);
  }, [attemptId, answersState.contextRevision]);

  // Auto-submit when time expires
  useEffect(() => {
    if (
      isExpired &&
      !showTimeUp &&
      activeWorkspace &&
      activeWorkspace.status === 'IN_PROGRESS' &&
      activeWorkspace.deadline !== null
    ) {
      dispatch(lockAnswers({ attemptId: activeWorkspace.attempt_id, contextRevision: answersState.contextRevision }));
      setShowTimeUp(true);
      handleSubmit(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpired, showTimeUp, showOverlay, isSubmitting, activeWorkspace, answersState.contextRevision, dispatch]);

  // Passage and Highlight state
  const passageHtml = (currentPart as any)?.contentHtml
    || (currentPart as any)?.content_html
    || currentPart?.content?.content_html
    || (currentPart?.content as any)?.shared_content_html
    || (Array.isArray((currentPart?.content as any)?.question_groups) && (currentPart?.content as any).question_groups.length > 0
        ? (currentPart?.content as any).question_groups
            .map((g: any) => {
              let html = '';
              const imgs = g.shared_images || (g.shared_media?.url ? [g.shared_media.url] : []);
              if (imgs.length > 0) {
                html += imgs.map((img: string) => `<p style="text-align: center; margin: 12px 0;"><img src="${img}" alt="Illustration" style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);" /></p>`).join('');
              }
              if (g.content_html) {
                html += g.content_html;
              }
              return html;
            })
            .filter(Boolean)
            .join('<hr style="margin: 24px 0; border: none; border-top: 1px dashed #cbd5e1;" />')
        : '') || '';
  const partSharedAudio = (currentPart as any)?.sharedAudio
    || (currentPart as any)?.shared_audio
    || currentPart?.content?.shared_audio;
  const partSharedMedia = (currentPart as any)?.sharedMedia
    || (currentPart as any)?.shared_media
    || currentPart?.content?.shared_media;
  const currentSectionId = (currentSection as any)?.section_id ?? currentSection?.id;
  const isCurrentSectionLocked = Boolean(
    activeWorkspace?.test_mode === 'MOCK_TEST' &&
    currentSectionId != null &&
    lockedSections.includes(currentSectionId)
  );
  const dictionary = usePracticeDictionary({
    workspace: activeWorkspace,
    partId: isPracticeMode && currentSkill === 'READING' ? partId : null,
    ownerId: dictionaryOwnerId,
    isLocked: () => submission.isLocked() || isCurrentSectionLocked,
  });
  const isToeicExam = isToeicExamSnapshot((activeWorkspace as any)?.exam_snapshot);
  const isToeicReading = currentSkill === 'READING' && isToeicExam;
  const highlightEnabled = currentSkill === 'READING' &&
    (activeWorkspace?.test_mode === 'PRACTICE' || activeWorkspace?.test_mode === 'MOCK_TEST');

  // TOEIC reference panes and IELTS passages share one prepared-document/highlight pipeline.
  const referenceDocs = useMemo<ReferenceDoc[]>(
    () => (currentSkill === 'READING' ? readReferenceDocs(currentPart, partQuestionGroups) : []),
    [currentSkill, currentPart, partQuestionGroups]
  );
  const useReferenceDocuments = currentSkill === 'READING' && referenceDocs.length > 0;
  const readingHighlights = useReadingHighlights({
    ownerId,
    attemptId,
    partId,
    contextRevision: answersState.contextRevision,
    enabled: !!highlightEnabled && !!activeWorkspace && !loading && !error,
    partHtml: passageHtml,
    referenceDocs,
    useReferenceDocs: useReferenceDocuments,
  });
  const highlightContextKey = `${ownerId ?? 'anonymous'}:${attemptId}:${partId}:${answersState.contextRevision}`;
  const { selection, setSelection } = useTextSelection(
    readingContainerRef,
    !!highlightEnabled && !submission.isLocked() && !isCurrentSectionLocked,
    answersState.contextRevision,
    highlightContextKey
  );
  const [deleteTooltip, setDeleteTooltip] = useState<{
    highlightId: string; top: number; left: number; namespace: string;
  } | null>(null);
  useEffect(() => {
    if (!highlightEnabled || submission.isLocked() || isCurrentSectionLocked) {
      setDeleteTooltip(null);
      setSelection(null);
    }
  }, [highlightEnabled, submission, isCurrentSectionLocked, setSelection]);

  useEffect(() => {
    setDeleteTooltip(null);
  }, [partId, answersState.contextRevision, ownerId, attemptId]);

  useEffect(() => {
    if (!deleteTooltip) return;
    const close = () => setDeleteTooltip(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [deleteTooltip]);

  const toeicNumberByQuestion = useMemo(() => {
    const map = new Map<string, number>();
    if (!isToeicReading) return map;
    const model = buildToeicWorkspaceModel((activeWorkspace as any)?.exam_snapshot);
    for (const question of model.questions) {
      if (question.partId === partId && question.questionNumber !== null) {
        map.set(question.questionId, question.questionNumber);
      }
    }
    return map;
  }, [isToeicReading, activeWorkspace, partId]);

  // Layout follows the content shape: a Part with reference documents splits, Part 5 stays one column.
  const showToeicReference = isToeicReading && referenceDocs.length > 0;
  splitBoundsRef.current = showToeicReference
    ? { min: TOEIC_READING_SPLIT_MIN, max: TOEIC_READING_SPLIT_MAX }
    : currentSkill === 'WRITING'
    ? { min: WRITING_SPLIT_MIN, max: WRITING_SPLIT_MAX }
    : DEFAULT_SPLIT_BOUNDS;

  const referenceDocsRendered = readingHighlights.renderedReferences;

  const adjustSplitRatio = (delta: number) => {
    setSplitRatio(prev => Math.min(TOEIC_READING_SPLIT_MAX, Math.max(TOEIC_READING_SPLIT_MIN, prev + delta)));
  };

  const handleDividerKeyDown = (e: React.KeyboardEvent) => {
    const { min, max } = splitBoundsRef.current;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSplitRatio(prev => Math.max(min, prev - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSplitRatio(prev => Math.min(max, prev + 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSplitRatio(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSplitRatio(max);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSplitRatio(50);
    }
  };

  // Question views for the reading column, with canonical whole-exam numbers from the snapshot.
  const readingGroups = useMemo<ReadingGroupView[]>(
    () =>
      displayQuestionGroups.map((group: any) => ({
        groupId: String(group.group_id ?? group.groupId ?? ''),
        instruction: group.instruction ?? null,
        questions: (group.questions ?? []).map((question: Question): ReadingQuestionView => ({
          question,
          number: toeicNumberByQuestion.get(question.question_id) ?? null,
          value: (answersState.answers?.[partId] ?? {})[question.question_id] ?? null,
          flagged: Boolean(answersState.flags?.[partId]?.[question.question_id]),
        })),
      })),
    [displayQuestionGroups, toeicNumberByQuestion, answersState.answers, answersState.flags, partId]
  );

  const handleHighlight = () => {
    if (submission.isLocked() || isCurrentSectionLocked || !selection) return;
    if (selection.contextRevision !== answersState.contextRevision || selection.contextKey !== highlightContextKey) {
      return setSelection(null);
    }
    const doc = readingHighlights.documents.find((item) =>
      item.partId === partId && item.documentId === selection.documentId &&
      item.contentHash === selection.contentHash
    );
    const namespace = readingHighlights.namespaceFor(selection.documentId, selection.contentHash);
    if (!doc || !namespace || selection.start >= selection.end) return setSelection(null);
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dispatch(addHighlightRecord({
      attemptId,
      contextRevision: answersState.contextRevision,
      passageId: namespace,
      contentHash: doc.contentHash,
      documentText: doc.text,
      highlight: { id, start: selection.start, end: selection.end, text: selection.text.slice(0, 50) },
    }));
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  const handleAiLookup = () => {
    const examLanguage = activeWorkspace?.languageContext?.examLanguage ?? null;
    if (!selection || !shouldShowAiLookup(selection, isPracticeMode, examLanguage) || submission.isLocked() || isCurrentSectionLocked) return;
    dictionary.cancel();
    setDictTooltip({
      word: selection.text,
      x: Math.max(16, selection.rect.left + selection.rect.width / 2 - 140),
      y: Math.max(70, selection.rect.bottom + 8),
      selection,
    });
    setSelection(null);
  };

  const closeDictionary = () => {
    dictionary.cancel();
    setDictTooltip(null);
  };

  const handlePassageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const mark = target.closest('mark[data-hl-id]');

    if (mark && window.getSelection()?.isCollapsed) {
      const scopeEl = mark.closest('[data-highlight-scope]') as HTMLElement | null;
      const documentId = scopeEl?.getAttribute('data-highlight-scope') ?? 'part';
      const contentHash = scopeEl?.getAttribute('data-highlight-hash') ?? null;
      const namespace = readingHighlights.namespaceFor(documentId, contentHash);
      const highlightId = mark.getAttribute('data-hl-id');
      if (namespace && highlightId) {
        setSelection(null);
        setDeleteTooltip({ highlightId, top: e.clientY + 8, left: e.clientX, namespace });
        return;
      }
    }
    setDeleteTooltip(null);
  };

  const handleDeleteHighlight = () => {
    if (submission.isLocked() || isCurrentSectionLocked) return;
    if (deleteTooltip) {
      dispatch(removeHighlightRecord({
        attemptId, contextRevision: answersState.contextRevision,
        passageId: deleteTooltip.namespace, highlightId: deleteTooltip.highlightId,
      }));
      setDeleteTooltip(null);
    }
  };

  const selectionNamespace = selection
    ? readingHighlights.namespaceFor(selection.documentId, selection.contentHash)
    : null;
  const selectionHighlightRecord = selectionNamespace
    ? answersState.highlights[selectionNamespace]
    : undefined;
  const showHighlightAction = !selection || !selectionHighlightRecord?.items.some((item) =>
    item.start <= selection.start && item.end >= selection.end
  );

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <svg className="animate-spin h-7 w-7 text-amber-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-slate-600 font-medium text-sm">{em("Đang tải phiên thi Multilingo...")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full ed-card p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl font-bold">
            ⚠️
          </div>
          <p className="text-slate-700 text-sm leading-relaxed">{ee(error)}</p>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={retry} className="btn-primary text-sm">
              {em("Thử lại")}</button>
            <button onClick={() => navigate('/')} className="btn-outline text-sm">
              {em("Về trang chủ")}</button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeWorkspace) return null;

  if (activeWorkspace.status !== 'IN_PROGRESS') {
    return null;
  }

  const partInstruction = (currentPart as any)?.instruction || currentPart?.content?.instruction;
  const partTitle = currentPart?.title
    || (currentPart as any)?.partTitle
    || currentPart?.content?.part_title
    || `${partHeaderInfo.unitLabel} ${partHeaderInfo.currentNumber}`;
  const isMockFull = activeWorkspace.test_mode === 'MOCK_TEST' && activeWorkspace.test_scope === 'FULL_EXAM';

  const handleReload = () => {
    if (isSubmitting || store.getState().answers.saveStatus === 'saving') return;
    const currentState = store.getState().answers;
    if (currentState.isDirty) {
      const ok = window.confirm(em("Bạn có các câu trả lời chưa được lưu lên máy chủ. Bạn có chắc muốn tải lại bản mới nhất từ máy chủ?"));
      if (!ok) return;
      try {
        localStorage.setItem(`exam_draft_${attemptId}`, JSON.stringify(currentState.answers));
        setHasLocalDraft(true);
      } catch {
        alert(em("Không thể giữ bản nháp trên thiết bị. Hãy sao chép bài làm trước khi tải lại."));
        return;
      }
    }
    retry();
  };

  const handlePartClick = async (targetPartId: number) => {
    if (submission.isLocked()) return;
    if (!isMockFull) {
      setSelectedPartId(targetPartId);
      return;
    }

    const currentSId = (currentSection as any)?.section_id ?? currentSection?.id;
    const targetSection = sections.find(s =>
      (s.parts || []).some((p: any) => (p.part_id ?? p.id) === targetPartId)
    );
    const targetSId = (targetSection as any)?.section_id ?? targetSection?.id;

    // Same section, allow jumping
    if (currentSId === targetSId) {
      setSelectedPartId(targetPartId);
      return;
    }

    // Locked section check
    if (lockedSections.includes(targetSId)) {
      alert(em("Phần này đã bị khóa và không thể truy cập lại."));
      return;
    }

    // Different section, confirm and lock current
    if (currentSId && !lockedSections.includes(currentSId)) {
      // Calculate unanswered count in current section
      let sectionUnanswered = 0;
      const parts = currentSection?.parts || [];
      for (const p of parts) {
        const pId = (p as any).part_id ?? p.id;
        const savedAnswers = activeWorkspace.saved_answers?.find(a => (a as any).partId === pId || (a as any).part_id === pId)?.answers || [];
        const reduxAnswers = answersState.answers[pId] || {};
        const mergedAnswers: Record<string | number, any> = {
          ...savedAnswers.reduce((acc, curr) => ({ ...acc, [(curr as any).questionId ?? (curr as any).question_id]: curr.answer }), {}),
          ...reduxAnswers
        };

        const qs = Array.isArray(p.questions) ? p.questions : (p.content?.question_groups?.flatMap((g: any) => g.questions ?? []) || []);
        for (const q of qs) {
          const qId = q.question_id ?? q.id;
          if (!isAnswered(q, mergedAnswers[qId])) {
            sectionUnanswered++;
          }
        }
      }

      const confirmMessage = em("Sau khi tiếp tục bạn KHÔNG THỂ quay lại {{v0}}. Bạn còn {{v1}} câu chưa làm của phần này. Bạn có chắc chắn muốn chuyển sang {{v2}}?", { v0: currentSection?.title || 'phần này', v1: sectionUnanswered, v2: targetSection?.title || 'phần khác' });
      if (window.confirm(confirmMessage)) {
        lockOperationGenRef.current += 1;
        const opAttemptId = attemptId;
        const opRouteGen = routeLifecycleGenRef.current;
        const opGen = lockOperationGenRef.current;

        const isRouteActive = () => (
          !unmountedRef.current &&
          Object.is(currentAttemptIdRef.current, opAttemptId) &&
          routeLifecycleGenRef.current === opRouteGen
        );

        const isOperationActive = () => (
          isRouteActive() &&
          lockOperationGenRef.current === opGen &&
          !submission.isLocked()
        );

        try {
          await lockSection(opAttemptId, currentSId);
          if (!isRouteActive()) return;

          setConfirmedLocks(prev => {
            if (!isRouteActive()) return prev;
            if (prev.attemptId !== opAttemptId) return prev;
            const currentIds = prev.sectionIds;
            return currentIds.includes(currentSId)
              ? prev
              : { attemptId: opAttemptId, sectionIds: [...currentIds, currentSId] };
          });

          if (!isOperationActive()) return;

          setPendingTargetPartId(targetPartId);
          setPendingLockError(null);
          try {
            const ok = await refreshMetadata();
            if (!isOperationActive()) return;

            if (ok) {
              setSelectedPartId(targetPartId);
              setPendingTargetPartId(null);
            } else {
              setPendingLockError("Không thể làm mới thông tin phần thi sau khi khóa.");
            }
          } catch (refreshErr: any) {
            if (!isOperationActive()) return;
            setPendingLockError(refreshErr instanceof Error ? refreshErr.message : em("Lỗi khi làm mới thông tin phần thi"));
          }
        } catch (e: any) {
          if (!isOperationActive()) return;
          alert(em("Lỗi khi khóa phần thi:") + e.message);
        }
      }
    } else {
      setSelectedPartId(targetPartId);
      setPendingTargetPartId(null);
    }
  };

  const handleRetryMetadata = async () => {
    if (submission.isLocked()) return;
    lockOperationGenRef.current += 1;
    const retryAttemptId = attemptId;
    const retryRouteGen = routeLifecycleGenRef.current;
    const retryGen = lockOperationGenRef.current;
    const isRetryActive = () => (
      !unmountedRef.current &&
      Object.is(currentAttemptIdRef.current, retryAttemptId) &&
      routeLifecycleGenRef.current === retryRouteGen &&
      lockOperationGenRef.current === retryGen &&
      !submission.isLocked()
    );

    setPendingLockError(null);
    try {
      const ok = await refreshMetadata();
      if (!isRetryActive()) return;

      if (ok && pendingTargetPartId !== null) {
        setSelectedPartId(pendingTargetPartId);
        setPendingTargetPartId(null);
      }
    } catch (err: any) {
      if (!isRetryActive()) return;
      setPendingLockError(err instanceof Error ? err.message : em("Lỗi khi làm mới thông tin phần thi"));
    }
  };

  const isToeicListening = currentSkill === 'LISTENING' && isToeicExam;

  // Generic IELTS/general left pane (Writing prompt or reading passage). TOEIC Reading replaces it
  // with the reference pane when the Part carries reference documents.
  const showGenericLeftPane = !isToeicReading && currentSkill !== 'LISTENING' && allParts.length > 0;
  const showLeftPane = showGenericLeftPane || showToeicReference;

  // Practice controls are shared between the IELTS/general renderer and the TOEIC workspace so the
  // same feedback/retry controller drives both.
  const practiceTools = isPracticeMode ? (
    <>
      {practiceFeedback.blockedMessage && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-900 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
            <span className="font-medium">{ee(practiceFeedback.blockedMessage)}</span>
          </div>
          {practiceFeedback.blockedMessage.includes('tải lại trang') && (
            <button
              type="button"
              onClick={handleReload}
              className="px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {em("Tải lại trang")}</button>
          )}
        </div>
      )}

      <PracticeRetryToolbar
        wrongCount={practiceFeedback.wrongQuestionIds.length}
        retryActive={practiceRetry.active}
        onStartRetry={handleStartRetry}
        onStopRetry={practiceRetry.stop}
        disabled={submission.isLocked() || isCurrentSectionLocked || isFeedbackBlocked}
      />
    </>
  ) : null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-800 select-text" onClick={(event) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-dictionary-popover], [role="toolbar"]')) return;
      if (dictTooltip) closeDictionary();
    }}>
      {/* 1. STICKY TOP HEADER */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-xs z-30">
        {/* Left: Brand Identity & Exam Title */}
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <span className="font-heading font-bold text-amber-700 hidden sm:inline text-base">Multilingo</span>
          </div>

          <div className="h-5 w-px bg-slate-200 shrink-0 hidden sm:block" />

          <div className="flex items-center gap-2 overflow-hidden">
            <h1 className="font-heading font-bold text-slate-900 text-sm sm:text-base truncate">
              {activeWorkspace.exam_snapshot?.title || em("Bài thi")}
            </h1>
            {allParts.length > 0 && (
              <span
                data-testid="header-part-badge"
                className="badge-orange shrink-0 hidden md:inline-flex"
              >
                {partHeaderInfo.displayText}
              </span>
            )}
          </div>
        </div>

        {/* Right: Save Status & Live Timer */}
        <div className="flex items-center gap-3 shrink-0">
          <LanguageSwitcher />
          <SaveStatusBadge onReload={handleReload} />
          <TimerDisplay displayTime={displayTime} isExpired={isExpired} isPractice={isPractice} />
        </div>
      </header>

      {/* Notice Banners */}
      {draftWarning && <div role="alert" className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">{ee(draftWarning)}</div>}
      {readingHighlights.warning && highlightEnabled && (
        <div role="alert" data-testid="highlight-storage-warning" className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">
          {ee(readingHighlights.warning)}
        </div>
      )}
      {(refreshError || pendingLockError) && (
        <div role="alert" className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between text-xs text-red-800 shrink-0">
          <span>{ee(refreshError || pendingLockError)}</span>
          <button
            type="button"
            onClick={handleRetryMetadata}
            className="px-2.5 py-1 rounded border border-red-300 bg-white hover:bg-red-100 font-semibold text-red-800"
          >
            {em("Thử lại")}</button>
        </div>
      )}
      {hasLocalDraft && (
        <div data-testid="local-draft-notice" className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-800 flex items-center gap-2 shrink-0">
          <span>{em("ℹ️ Đang dùng bản đã lưu trên máy chủ; bản nháp trên thiết bị chưa được khôi phục.")}</span>
        </div>
      )}

      {/* 2. MAIN BODY: SPLIT-PANE WORKSPACE */}
      <div
        className={`flex flex-1 overflow-hidden relative ${
          isPracticeMode ? 'flex-col md:flex-row' : ''
        }`}
      >
        {/* Content area: Left Pane + Divider + Main */}
        <div
          ref={workspaceContainerRef}
          className="flex flex-1 min-w-0 overflow-hidden relative"
        >
          {/* LEFT PANE: Reading Passage or Writing Prompt Workspace */}
          {showLeftPane && (
            <section
              style={{ width: `${splitRatio}%` }}
              className={`hidden lg:flex flex-col bg-white border-r border-slate-200 h-full overflow-hidden ${
                isDraggingSplit ? 'transition-none select-none' : 'transition-[width] duration-200 ease-in-out'
              }`}
            >
              {/* Toolbar */}
              <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider bg-white px-2.5 py-1 rounded border border-slate-200">
                    {partTitle}
                  </span>
                  <span className="text-xs text-slate-500">
                    {(() => {
                      const snapType = (activeWorkspace?.exam_snapshot?.type || '').toUpperCase();
                      let certLabel = 'IELTS Academic';
                      if (snapType === 'LANGUAGE_PRACTICE') {
                        certLabel = em('Luyện ngôn ngữ');
                      } else if (snapType.includes('TOEIC')) {
                        certLabel = snapType.includes('WRITING') ? 'TOEIC Writing' : 'TOEIC L&R';
                      } else if (snapType.includes('NLTV') || snapType.includes('VSTEP')) {
                        certLabel = 'NLTV';
                      }
                      const skillLabel = (currentSkill as string) === 'WRITING' ? 'Writing' : 'Reading';
                      return `${certLabel} ${skillLabel}`;
                    })()}
                  </span>
                </div>
                {isPracticeMode && currentSkill === 'READING' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {em("Bôi đen từ để tra từ điển AI")}</span>
                  </div>
                )}
              </div>

              {/* Passage / Prompt Text Content */}
              <div
                lang={activeWorkspace.languageContext?.examLanguage ?? undefined}
                className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 text-slate-800 leading-relaxed font-sans text-[15px]"
              >
                {showToeicReference ? (
                  isDesktopReadingViewport ? <div onClick={handlePassageClick}>
                    <ReferencePane docs={referenceDocsRendered} />
                  </div> : null
                ) : currentSkill === 'READING' && useReferenceDocuments ? (
                  isDesktopReadingViewport ? <div onClick={handlePassageClick} data-testid="reading-reference-pane">
                    {partInstruction && <div className="mb-4 p-3.5 bg-amber-50/70 border-l-4 border-amber-500 rounded-r-xl text-sm text-slate-700">{partInstruction}</div>}
                    <ReferencePane docs={referenceDocsRendered} testId="reading-reference-documents" />
                  </div> : null
                ) : currentSkill === 'WRITING' ? (
                  <div data-testid="desktop-writing-prompt">
                    <WritingPromptContent
                      partTitle={partTitle}
                      partInstruction={partInstruction}
                      partSharedAudio={partSharedAudio}
                      partSharedMedia={partSharedMedia}
                      groups={displayQuestionGroups}
                      questions={partQuestions}
                    />
                  </div>
                ) : (
                <div className="space-y-4">
                  {partSharedAudio?.url && <AudioPlayer url={partSharedAudio.url} isActive={true} />}
                  {partSharedMedia && <MediaDisplay media={partSharedMedia} alt={`${partTitle} media`} />}
                  {passageHtml ? (
                    <div
                      onClick={handlePassageClick}
                      data-highlight-scope="part"
                      data-highlight-hash={readingHighlights.preparedPart?.contentHash}
                    >
                      <HtmlContent
                        html={readingHighlights.renderedPartHtml}
                        prepared
                        className="prose prose-slate max-w-none [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mb-3 [&_p]:mb-4 [&_p]:leading-relaxed [&_strong]:text-amber-700"
                      />
                    </div>
                  ) : partInstruction ? (
                    <div>
                      <h2 className="font-heading text-lg font-bold text-slate-900">
                        {partTitle}
                      </h2>
                      <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 text-slate-700 text-sm">
                        {partInstruction}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 italic">
                      {em("Không có nội dung bài đọc cho phần thi này.")}</div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* RESIZABLE DIVIDER GUTTER */}
        {showGenericLeftPane && (
          <div
            data-testid="pane-divider"
            role="separator"
            aria-orientation="vertical"
            aria-label={currentSkill === 'WRITING' ? em("Thanh điều chỉnh độ rộng đề bài và bài làm") : em("Thanh điều chỉnh độ rộng")}
            aria-valuenow={Math.round(splitRatio)}
            aria-valuemin={splitBoundsRef.current.min}
            aria-valuemax={splitBoundsRef.current.max}
            tabIndex={0}
            onKeyDown={handleDividerKeyDown}
            onMouseDown={() => setIsDraggingSplit(true)}
            onDoubleClick={() => setSplitRatio(50)}
            title={em("Kéo để chỉnh độ rộng 2 bên (Nhấp đúp để đặt lại 50/50)")}
            className={`hidden lg:flex w-2.5 hover:w-3.5 bg-slate-200 hover:bg-amber-400 cursor-col-resize items-center justify-center border-x border-slate-300 transition-colors group select-none shrink-0 z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              isDraggingSplit ? 'bg-amber-500 w-3.5' : ''
            }`}
          >
            <div className="w-0.5 h-8 rounded-full bg-slate-400 group-hover:bg-amber-800 transition-colors" />
          </div>
        )}

        {/* TOEIC READING DIVIDER GUTTER (accessible resize controls) */}
        {showToeicReference && (
          <ToeicReadingDivider
            ratio={splitRatio}
            dragging={isDraggingSplit}
            onMouseDown={() => setIsDraggingSplit(true)}
            onReset={() => setSplitRatio(50)}
            onStep={adjustSplitRatio}
          />
        )}

        {/* RIGHT PANE: Questions & Interaction */}
        <main
          style={
            (!isPracticeMode || !isMobileViewport) && showLeftPane
              ? { width: `${100 - splitRatio}%` }
              : undefined
          }
          className={`flex-1 flex flex-col bg-slate-50 overflow-hidden ${
            isPracticeMode ? 'w-full md:w-auto min-h-0' : 'h-full'
          } ${currentSkill === 'LISTENING' ? 'items-center' : ''} ${
            isDraggingSplit ? 'transition-none select-none' : 'transition-[width] duration-200 ease-in-out'
          }`}
        >
          {/* Scrollable Questions Container */}
          <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 w-full ${currentSkill === 'LISTENING' ? 'max-w-4xl' : ''}`}>
            {showToeicReference && !isDesktopReadingViewport && (
              <div data-testid="mobile-reading-reference" onClick={handlePassageClick}>
                <ReferencePane docs={referenceDocsRendered} />
              </div>
            )}
            {!isToeicReading && currentSkill === 'READING' && useReferenceDocuments && !isDesktopReadingViewport && (
              <div data-testid="mobile-reading-reference" onClick={handlePassageClick}>
                {partInstruction && <div className="mb-4 p-3.5 bg-amber-50/70 border-l-4 border-amber-500 rounded-r-xl text-sm text-slate-700">{partInstruction}</div>}
                <ReferencePane docs={referenceDocsRendered} testId="reading-reference-documents" />
              </div>
            )}
            {isPracticeMode && writingHints.blockedError && (
              <div role="alert" className="flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-950">
                <span>{ee(writingHints.blockedError.message)}</span>
                {writingHints.blockedError.action === 'reload' && (
                  <button type="button" onClick={handleReload} disabled={isSubmitting || answersState.saveStatus === 'saving'}
                    className="rounded-lg border border-amber-300 px-3 py-1.5 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:opacity-50">
                    {em("Tải lại trang")}</button>
                )}
              </div>
            )}
            {isToeicListening ? (
              <ToeicWorkspace
                attemptId={attemptId}
                part={currentPart}
                partId={partId}
                partTitle={partTitle}
                partInstruction={partInstruction}
                partSharedAudio={partSharedAudio}
                partSharedMedia={partSharedMedia}
                snapshot={(activeWorkspace as any)?.exam_snapshot}
                groups={displayQuestionGroups}
                questions={partQuestions}
                answers={answersState.answers?.[partId] ?? {}}
                flags={answersState.flags?.[partId] ?? {}}
                disabled={isCurrentSectionLocked || submission.isLocked()}
                practice={isPracticeMode}
                testMode={activeWorkspace.test_mode}
                listeningPlayback={activeWorkspace.listeningPlayback}
                practiceFeedback={practiceFeedback}
                practiceTools={practiceTools}
                requestedQuestionId={requestedQuestionId}
                onActiveQuestionChange={setActiveQuestionId}
                onAnswer={(questionId, value) => {
                  if (!isCurrentSectionLocked && !submission.isLocked()) {
                    dispatch(setAnswer({ partId, questionId, value }));
                  }
                }}
                onToggleFlag={(questionId) => {
                  if (!isCurrentSectionLocked && !submission.isLocked()) {
                    dispatch(toggleFlag({ partId, questionId }));
                  }
                }}
              />
            ) : isToeicReading ? (
              <ReadingPartContent
                partId={partId}
                groups={readingGroups}
                partInstruction={partInstruction}
                referenceInPane={showToeicReference}
                disabled={isCurrentSectionLocked || submission.isLocked()}
                practice={isPracticeMode}
                feedbackBusy={practiceFeedback.busy}
                getFeedback={practiceFeedback.getFeedback}
                onCheck={practiceFeedback.check}
                toolbar={practiceTools}
                onAnswer={(questionId, value) => {
                  if (!isCurrentSectionLocked && !submission.isLocked()) {
                    dispatch(setAnswer({ partId, questionId, value }));
                  }
                }}
                onToggleFlag={(questionId) => {
                  if (!isCurrentSectionLocked && !submission.isLocked()) {
                    dispatch(toggleFlag({ partId, questionId }));
                  }
                }}
              />
            ) : partQuestions.length > 0 ? (
              <div className={`flex flex-col gap-4 ${currentSkill === 'WRITING' ? 'w-full' : 'max-w-3xl'}`}>
                {/* Mobile Writing Prompt: render once above question cards when on mobile */}
                {currentSkill === 'WRITING' && (
                  <div data-testid="mobile-writing-prompt" className="lg:hidden mb-2">
                    <WritingPromptContent
                      partTitle={partTitle}
                      partInstruction={partInstruction}
                      partSharedAudio={partSharedAudio}
                      partSharedMedia={partSharedMedia}
                      groups={displayQuestionGroups}
                      questions={partQuestions}
                    />
                  </div>
                )}

                {/* Part Instruction Callout */}
                {currentSkill !== 'WRITING' && partInstruction && (
                  <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-r-xl p-3.5 text-sm text-slate-700">
                    <span className="font-bold text-amber-800 block mb-0.5">{em("Hướng dẫn làm bài:")}</span>
                    {partInstruction}
                  </div>
                )}

                {currentSkill === 'LISTENING' && (
                  <>
                    {partSharedAudio?.url && <AudioPlayer url={partSharedAudio.url} isActive={true} />}
                    {partSharedMedia && <MediaDisplay media={partSharedMedia} alt={`${partTitle} media`} />}
                    {passageHtml && <HtmlContent html={passageHtml} className="prose prose-slate max-w-none" />}
                  </>
                )}

                {practiceTools}

                {displayQuestionGroups.map((group: any) => (
                  <div
                    key={group.group_id}
                    data-testid={`question-group-${group.group_id}`}
                    data-group-id={group.group_id}
                    className="space-y-4"
                  >
                    {currentSkill !== 'WRITING' && group.instruction && group.instruction.trim() !== (partInstruction || '').trim() && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
                        {group.instruction}
                      </div>
                    )}
                    {currentSkill !== 'WRITING' && currentSkill !== 'READING' && group.shared_audio?.url && <AudioPlayer url={group.shared_audio.url} isActive={true} />}
                    {currentSkill !== 'WRITING' && currentSkill !== 'READING' && group.shared_media && <MediaDisplay media={group.shared_media} alt={`${group.group_id} media`} />}
                    {currentSkill !== 'WRITING' && currentSkill !== 'READING' && (group.content_html || group.context_html) && (
                      <HtmlContent
                        html={group.content_html || group.context_html}
                        className="prose prose-slate max-w-none"
                      />
                    )}
                    {group.questions.map((q: Question, qIdx: number) => {
                      const isSecondaryMulti = qIdx > 0 &&
                        q.type === 'MULTIPLE_CHOICE_MULTI' &&
                        group.questions[qIdx - 1]?.type === 'MULTIPLE_CHOICE_MULTI';

                      if (isSecondaryMulti) {
                        return null; // Combined with primary question above
                      }

                      const isPrimaryMulti = q.type === 'MULTIPLE_CHOICE_MULTI' &&
                        group.questions[qIdx + 1]?.type === 'MULTIPLE_CHOICE_MULTI';
                      const nextQ = isPrimaryMulti ? group.questions[qIdx + 1] : null;
                      const nextQId = nextQ?.question_id;

                      const qId = q.question_id;
                      let currentVal = answersState.answers?.[partId]?.[qId] ?? null;

                      if (isPrimaryMulti && nextQId) {
                        const v1 = answersState.answers?.[partId]?.[qId];
                        const v2 = answersState.answers?.[partId]?.[nextQId];
                        const combined: string[] = [];
                        if (Array.isArray(v1)) combined.push(...v1);
                        else if (typeof v1 === 'string' && v1) combined.push(v1);
                        if (Array.isArray(v2)) {
                          v2.forEach((item: string) => { if (!combined.includes(item)) combined.push(item); });
                        } else if (typeof v2 === 'string' && v2 && !combined.includes(v2)) {
                          combined.push(v2);
                        }
                        currentVal = combined;
                      }

                      const isQuestionAnswered = isPrimaryMulti
                        ? Array.isArray(currentVal) && currentVal.length === 2
                        : isAnswered(currentVal, q.type);

                      const isFlagged = isPrimaryMulti && nextQId
                        ? !!answersState.flags?.[partId]?.[qId] || !!answersState.flags?.[partId]?.[nextQId]
                        : !!answersState.flags?.[partId]?.[qId];

                      // Calculate dynamic minWords based on question text/metadata or skill standards
                      const examLanguage = activeWorkspace?.exam_snapshot?.examLanguage ?? null;
                      const minWords = extractMinWords(q, currentPart, activeWorkspace?.exam_snapshot?.type);

                      return (
                        <div
                          key={qId}
                          id={`q-${qId}`}
                          className={`ed-card p-5 scroll-mt-4 transition-all duration-200 ${
                            isQuestionAnswered ? 'border-amber-200/80 bg-white' : 'border-slate-200 bg-white'
                          }`}
                        >
                          {nextQId && <div id={`q-${nextQId}`} style={{ position: 'relative', top: '-10px' }} />}
                          <div className="flex items-start justify-between gap-3 mb-3.5">
                            <div className="flex items-start gap-3 flex-1">
                              <span className={`h-7 px-2.5 rounded-lg flex items-center justify-center font-heading font-bold text-xs shrink-0 mt-0.5 transition-colors ${
                                isQuestionAnswered ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                {isPrimaryMulti && nextQ ? `${q.question_number} - ${nextQ.question_number}` : q.question_number}
                              </span>
                              <div className={`font-heading font-semibold text-slate-900 text-sm sm:text-[15px] leading-relaxed flex-1 ${currentSkill === 'WRITING' ? 'hidden' : ''}`}>
                                {q.question_text}
                              </div>
                            </div>

                            {/* Flag toggle button */}
                            <button
                              type="button"
                              data-testid={`flag-btn-${qId}`}
                              disabled={isCurrentSectionLocked || submission.isLocked()}
                              onClick={() => {
                                if (!isCurrentSectionLocked && !submission.isLocked()) {
                                  dispatch(toggleFlag({ partId, questionId: qId }));
                                  if (nextQId) {
                                    dispatch(toggleFlag({ partId, questionId: nextQId }));
                                  }
                                }
                              }}
                              title={isFlagged ? em("Bỏ đánh dấu xem lại") : em("Đánh dấu câu hỏi này để xem lại sau")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 shadow-2xs ${
                                isFlagged
                                  ? 'bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-400/30'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                              }`}
                            >
                              <span>{isFlagged ? '🚩' : '🏳️'}</span>
                              <span>{isFlagged ? em("Đã xem lại") : em("Xem lại")}</span>
                            </button>
                          </div>

                          <div className="pl-10">
                            {q.media && q.type !== 'ESSAY' && q.type !== 'MAP_LABELING' && (
                              <MediaDisplay media={q.media} alt={`Question ${q.question_number} media`} />
                            )}
                            <fieldset disabled={isCurrentSectionLocked || submission.isLocked()} className="m-0 min-w-0 border-0 p-0">
                              <QuestionRenderer
                                question={q}
                                partId={partId}
                                currentAnswer={currentVal}
                                minWords={minWords}
                                learningLanguage={examLanguage}
                                showPrompt={currentSkill !== 'WRITING'}
                                onChange={(val) => {
                                  if (!isCurrentSectionLocked && !submission.isLocked()) {
                                    if (isPrimaryMulti && nextQId) {
                                      const selected = Array.isArray(val) ? val : (val ? [String(val)] : []);
                                      dispatch(setAnswer({ partId, questionId: qId, value: selected[0] ? [selected[0]] : [] }));
                                      dispatch(setAnswer({ partId, questionId: nextQId, value: selected[1] ? [selected[1]] : [] }));
                                    } else {
                                      dispatch(setAnswer({ partId, questionId: qId, value: val }));
                                    }
                                  }
                                }}
                              />
                            </fieldset>
                            {isWritingHintsPart && q.type === 'ESSAY' ? (
                              <WritingHintsPanel
                                key={JSON.stringify([attemptId, answersState.contextRevision, writingPartId, qId])}
                                questionId={qId}
                                taskNumber={q.question_number}
                                state={writingHints.blockedError
                                  ? { ...writingHints.getHints(qId), error: null }
                                  : writingHints.getHints(qId)}
                                busy={writingHints.busy}
                                disabled={isWritingSectionLocked || submission.isLocked() || Boolean(writingHints.blockedError)}
                                retryAfterSeconds={writingHints.retryAfterSeconds}
                                learningLanguage={activeWorkspace?.languageContext?.examLanguage ?? null}
                                defaultExplanationLanguage={activeWorkspace?.languageContext?.defaultExplanationLanguage ?? null}
                                supportedExplanationLanguages={activeWorkspace?.languageContext?.supportedExplanationLanguages ?? []}
                                onGenerate={(selection) => writingHints.generate(qId, selection)}
                                onRetry={() => writingHints.retry(qId)}
                                onLanguageChange={() => writingHints.suspend()}
                              />
                            ) : isPracticeMode && (
                              <PracticeQuestionFeedback
                                questionId={qId}
                                questionNumber={q.question_number}
                                questionType={q.type}
                                feedback={practiceFeedback.getFeedback(qId)}
                                onCheck={practiceFeedback.check}
                                onReload={handleReload}
                                busy={practiceFeedback.busy}
                                disabled={isCurrentSectionLocked || submission.isLocked() || isFeedbackBlocked}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <svg className="w-16 h-16 mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>{em("Không có dữ liệu phần thi.")}</p>
              </div>
            )}

            {/* Next Section Button if Mock Full and at the end of current section */}
            {isMockFull && currentSection && (
              (() => {
                const partsInSection = currentSection.parts || [];
                if (partsInSection.length === 0) return null;
                const lastPartId = (partsInSection[partsInSection.length - 1] as any).part_id ?? partsInSection[partsInSection.length - 1].id;

                if (partId === lastPartId) {
                  // Find next section's first part
                  const sIdx = sections.findIndex(s => ((s as any).section_id ?? s.id) === ((currentSection as any).section_id ?? currentSection.id));
                  const nextSection = sIdx !== -1 && sIdx + 1 < sections.length ? sections[sIdx + 1] : null;

                  if (nextSection && nextSection.parts?.length > 0) {
                    const firstPartOfNext = (nextSection.parts[0] as any).part_id ?? nextSection.parts[0].id;
                    return (
                      <div className="mt-8 mb-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handlePartClick(firstPartOfNext)}
                          disabled={submission.isLocked()}
                          className={`px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-heading font-bold shadow-md transition-all flex items-center gap-2 ${
                            submission.isLocked() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          {em("Chuyển sang phần tiếp theo (")}{nextSection.title}) <span>→</span>
                        </button>
                      </div>
                    );
                  }
                }
                return null;
              })()
            )}
          </div>
        </main>
      </div>

        {/* 3. RIGHT SIDEBAR: QUESTION PALETTE DOCK */}
        <aside
          className={`${
            isPracticeMode
              ? 'w-full md:w-64 md:sm:w-72 h-auto max-h-72 md:h-full md:max-h-none border-t md:border-t-0 md:border-l'
              : 'w-64 sm:w-72 h-full border-l'
          } shrink-0 bg-white border-slate-200 flex flex-col overflow-hidden shadow-xs`}
        >
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Part Switcher in Sidebar */}
            {allParts.length > 1 && (
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 shrink-0">
                <div className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500 mb-3">
                  {em("Chọn phần thi")}</div>
                <div className="grid grid-cols-2 gap-2">
                  {allParts.map((p: any) => {
                    const pId = (p as any).part_id ?? p.id;
                    const isActive = pId === partId;
                    const pIndex = allParts.findIndex(item => ((item as any).part_id ?? item.id) === pId) + 1;
                    const qCount = Array.isArray(p.questions)
                      ? p.questions.length
                      : p.content?.question_groups?.flatMap((g: any) => g.questions ?? []).length ?? 0;
                    const targetSection = sections.find(s => (s.parts || []).some((part: any) => (part.part_id ?? part.id) === pId));
                    const targetSId = (targetSection as any)?.section_id ?? targetSection?.id;
                    const isSectionLocked = isMockFull && lockedSections.includes(targetSId);
                    const isLocked = isSectionLocked || submission.isLocked();

                    return (
                      <button
                        key={pId}
                        type="button"
                        onClick={() => handlePartClick(pId)}
                        disabled={isLocked}
                        className={`py-2 px-2 rounded-lg text-xs font-heading font-semibold flex flex-col items-center justify-center transition-all border ${
                          isLocked
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                            : isActive
                              ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm cursor-pointer'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                        }`}
                        title={p.title || p.content?.part_title || `Part ${pIndex}`}
                      >
                        <span className="truncate w-full text-center flex items-center justify-center gap-1">
                          {isLocked && <span>🔒</span>}
                          {p.title || p.content?.part_title || `Part ${pIndex}`}
                        </span>
                        {qCount > 0 && (
                          <span className="text-[10px] font-normal opacity-75 mt-0.5">
                            {qCount} {em("câu")}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-4 flex-1">
              <div className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                <span>{em("Bảng câu hỏi")}</span>
                <span className="badge-orange text-[11px]">
                  {allQuestions.length} {em("câu")}</span>
              </div>
              <QuestionPalette
                allParts={allParts}
                activePartId={partId}
                activeQuestionId={activeQuestionId}
                isToeicExam={isToeicExam}
                lockedPartIds={submission.isLocked() ? allParts.map(p => (p as any).part_id ?? p.id) : lockedPartIds}
                visibleQuestionIds={isPracticeMode && practiceRetry.active ? practiceRetry.questionIds : undefined}
                onNavigate={(targetPartId, qId) => {
                  if (submission.isLocked()) return;
                  // Lets the TOEIC workspace switch the active question (Part 2 shows one question).
                  setRequestedQuestionId(qId);
                  if (targetPartId !== partId) {
                    setSelectedPartId(targetPartId);
                    // Wait for React to render the new part's questions before scrolling
                    setTimeout(() => {
                      const el = document.getElementById(`q-${qId}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  } else {
                    const el = document.getElementById(`q-${qId}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              />
            </div>
          </div>

          {/* Sticky Bottom Action: Submit Button */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/50">
            <button
              id="btn-submit-exam"
              disabled={submission.isLocked()}
              onClick={() => { if (!submission.isLocked()) setShowConfirm(true); }}
              className={`w-full py-3 px-4 rounded-xl font-heading font-bold text-sm border-none transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                isSubmitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-amber-500/20 active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>{em("Đang nộp...")}</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>{em("Nộp bài")}</span>
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* 4. FLOATING AI DICTIONARY POPUP */}
      {dictTooltip && (
        <PracticeDictionaryPopover
          {...dictTooltip}
          ownerId={dictionaryOwnerId}
          learningLanguage={activeWorkspace?.languageContext?.examLanguage ?? null}
          defaultExplanationLanguage={activeWorkspace?.languageContext?.defaultExplanationLanguage ?? null}
          supportedExplanationLanguages={activeWorkspace?.languageContext?.supportedExplanationLanguages ?? []}
          phase={dictionary.phase}
          data={dictionary.data}
          error={dictionary.error}
          onClose={closeDictionary}
          onRetry={() => void dictionary.retry()}
          onLookup={(language) => { if (dictTooltip) void dictionary.lookup(dictTooltip.selection, language); }}
        />
      )}

      {/* 4b. SELECTION TOOLBAR & DELETE TOOLTIP */}
      <SelectionToolbar
        selection={selection}
        showAi={shouldShowAiLookup(
          selection,
          isPracticeMode,
          activeWorkspace?.languageContext?.examLanguage ?? null,
        )}
        showHighlight={showHighlightAction}
        onHighlight={handleHighlight}
        onAiLookup={handleAiLookup}
      />

      {deleteTooltip && createPortal(
        <button
          type="button"
          aria-label={em("Xóa highlight")}
          className="fixed z-50 min-h-11 flex items-center bg-white border border-gray-200 shadow-lg rounded-md px-3 py-1 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          style={{
            top: Math.max(8, Math.min(window.innerHeight - 52, deleteTooltip.top)),
            left: Math.max(8, Math.min(window.innerWidth - 180, deleteTooltip.left)),
          }}
          onClick={handleDeleteHighlight}
        >
          <span className="text-sm font-medium text-red-600">{em("Xóa highlight")}</span>
        </button>,
        document.body
      )}

      {/* 5. MODALS & SUBMIT OVERLAYS */}
      <SubmitConfirmModal
        open={showConfirm}
        total={allQuestions.length}
        answered={allQuestions.length - unansweredCount}
        unansweredCount={unansweredCount}
        isLoading={isSubmitting}
        feedbackLanguage={activeWorkspace?.languageContext ? {
          value: feedbackLanguage,
          defaultLanguage: activeWorkspace.languageContext.defaultExplanationLanguage,
          supportedLanguages: activeWorkspace.languageContext.supportedExplanationLanguages,
          onChange: setFeedbackLanguage,
        } : undefined}
        onConfirm={() => {
          setShowConfirm(false);
          setShowOverlay(true);
          handleSubmit(false);
        }}
        onCancel={() => setShowConfirm(false)}
      />

      <TimeUpModal
        open={showTimeUp}
        isSubmitting={isSubmitting}
        error={submission.error}
        onRetry={submission.phase === 'conflict' ? handleReload : () => { writingHints.suspend(); void submission.retry(); }}
        retryLabel={submission.phase === 'conflict' ? em("Tải lại bản mới nhất") : undefined}
        draftWarning={ee(draftWarning)}
        onClose={submission.result ? () => navigate(submission.result!.redirect_url) : undefined}
      />

      <SubmitOverlay
        visible={showOverlay && !showTimeUp && submission.phase !== 'conflict' && submission.phase !== 'succeeded'}
        isRetrying={isSubmitting}
        error={submission.error}
        draftWarning={ee(draftWarning)}
        onRetry={() => { writingHints.suspend(); void submission.retry(); }}
        onClose={() => setShowOverlay(false)}
      />
    </div>
  );
};

export default WorkspacePage;
