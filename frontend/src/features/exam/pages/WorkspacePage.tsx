import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import useWorkspace from '../hooks/useWorkspace';
import { useExamTimer } from '../hooks/useExamTimer';
import { useAutosave } from '../hooks/useAutosave';
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
import { autosaveAnswers, submitAttempt, lockSection } from '../api/attemptApi';
import { setAnswer, toggleFlag, addHighlightRecord, removeHighlightRecord, selectHighlights, markSaveSuccess, markSavePending, markSaveConflict, markSaveError } from '../store/answerSlice';
import { useTextSelection } from '../hooks/useTextSelection';
import { SelectionToolbar } from '../components/content/SelectionToolbar';
import { rangeToOffsets, trimOffsets } from '../utils/domOffsetUtils';
import { applyHighlights } from '../utils/htmlHighlight';
import { isAnswered } from '../utils/answerUtils';
import { extractMinWords, getPartHeaderInfo } from '../utils/examPartUtils';
import { useStore } from 'react-redux';
import type { AppDispatch, RootState } from '../../../app/store';
import type { Question } from '../types/exam.types';

interface DictTooltip {
  word: string;
  x: number;
  y: number;
}

const WorkspacePage: React.FC = () => {
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
  useAutosave(activeWorkspace && activeWorkspace.status === 'IN_PROGRESS' ? attemptId : null);

  const answersState = useSelector((state: RootState) => state.answers);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showTimeUp, setShowTimeUp] = useState(false);
  const [submitResultUrl, setSubmitResultUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [hasLocalDraft, setHasLocalDraft] = useState<boolean>(false);
  const [confirmedLocks, setConfirmedLocks] = useState<{ attemptId: number; sectionIds: number[] }>({
    attemptId,
    sectionIds: [],
  });
  const [pendingTargetPartId, setPendingTargetPartId] = useState<number | null>(null);
  const [pendingLockError, setPendingLockError] = useState<string | null>(null);

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

  // Resizable split pane state (default 50/50, bounds 25% - 75%)
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const workspaceContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDraggingSplit) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!workspaceContainerRef.current) return;
      const rect = workspaceContainerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      if (newWidth >= 25 && newWidth <= 75) {
        setSplitRatio(newWidth);
      }
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

  // Floating AI Dictionary Tooltip state
  const [dictTooltip, setDictTooltip] = useState<DictTooltip | null>(null);
  const [savedFlashcard, setSavedFlashcard] = useState(false);
  const readingContainerRef = useRef<HTMLDivElement>(null);

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
    return Array.isArray(nestedGroups) ? nestedGroups : [];
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

  const normalizeQuestion = (q: any, fallbackQuestionNumber: number): Question => ({
      ...q,
      question_id: q.question_id ?? q.questionId ?? String(q.id),
      question_number: q.question_number ?? q.questionNumber ?? q.id ?? fallbackQuestionNumber,
      type: q.type === 'MCQ' ? 'SINGLE_CHOICE' : q.type === 'FILL_IN' ? 'FILL_IN_THE_BLANK' : q.type,
      question_text: q.question_text || q.prompt || '',
      options: q.options ?? null,
    });

  const partQuestionGroups = useMemo(() => {
    const groups = currentPartQuestionGroups.length > 0
      ? currentPartQuestionGroups
      : [{ group_id: `legacy-part-${partId}`, instruction: null, questions: currentPartQuestions }];
    let nextQuestionNumber = 1;

    return groups.map((group: any) => ({
      ...group,
      questions: (group.questions ?? []).map((question: any) =>
        normalizeQuestion(question, nextQuestionNumber++)
      ),
    }));
  }, [currentPartQuestionGroups, currentPartQuestions, partId]);

  const partQuestions: Question[] = useMemo(
    () => partQuestionGroups.flatMap((group: any) => group.questions),
    [partQuestionGroups],
  );

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


  const handleSubmit = async (isTimeout = false) => {
    if (isSubmitting) return;
    if (!ready || !activeWorkspace || activeWorkspace.status !== 'IN_PROGRESS' || store.getState().answers.attemptId !== attemptId) {
      return;
    }
    const currentSubmitAttemptId = attemptId;
    setIsSubmitting(true);
    try {
      // 1. Wait for any pending background save to prevent overlap
      while (store.getState().answers.saveStatus === 'saving') {
        await new Promise(resolve => setTimeout(resolve, 100));
        // Check if unmounted or attempt changed while waiting
        if (activeAttemptIdRef.current !== currentSubmitAttemptId) return;
      }

      // Pre-submit flush: push unsaved answers to server before closing attempt
      // Fetch latest state from store since waiting might have changed it
      const currentState = store.getState().answers;
      let submitVersion = currentState.version;

      if (currentState.isDirty) {
        const capturedPendingVersion = currentState.pendingVersion;
        // Lock other hook from saving
        dispatch(markSavePending(capturedPendingVersion));

        const answers = Object.entries(currentState.answers).map(([pId, qMap]) => ({
          part_id: Number(pId),
          answers: Object.entries(qMap as any).map(([question_id, answer]) => ({ question_id, answer: answer as any })),
        }));

        // Let errors propagate to catch block
        const saveRes = await autosaveAnswers(currentSubmitAttemptId, { version: currentState.version, answers });

        // Guard: Check if the user navigated to a different attempt while waiting
        if (activeAttemptIdRef.current !== currentSubmitAttemptId) return;

        submitVersion = saveRes.version;
        dispatch(
          markSaveSuccess({
            savedAt: Date.now(),
            pendingVersion: capturedPendingVersion,
            serverVersion: saveRes.version,
          })
        );
        try {
          localStorage.setItem(`exam_highlights_${currentSubmitAttemptId}`, JSON.stringify(currentState.highlights));
          localStorage.removeItem(`exam_draft_${currentSubmitAttemptId}`);
        } catch { /* ignore */ }
      }

      // 2. Execute submit
      const result = await submitAttempt(currentSubmitAttemptId, {
        version: submitVersion,
        baseVersion: submitVersion,
        answers: [],
        reason: isTimeout ? 'TIMEOUT_CLIENT' : 'MANUAL',
      });

      // Guard against page change during submit
      if (activeAttemptIdRef.current !== currentSubmitAttemptId) return;

      // Always clean up localStorage draft after successful submit
      try {
        localStorage.setItem(`exam_highlights_${currentSubmitAttemptId}`, JSON.stringify(store.getState().answers.highlights));
        localStorage.removeItem(`exam_draft_${currentSubmitAttemptId}`);
      } catch { /* ignore */ }
      if (isTimeout) {
        setSubmitResultUrl(result.redirect_url);
      } else {
        navigate(result.redirect_url);
      }
    } catch (err: any) {
      if (activeAttemptIdRef.current !== currentSubmitAttemptId) return;

      // Distinguish between Version Conflict (code 1601) and finalization/network error
      const isVersionConflict = err?.response?.data?.code === 1601 || err?.code === 1601;

      if (isVersionConflict) {
        // Stop submission, close overlay, mark conflict
        setShowOverlay(false);
        dispatch(markSaveConflict());
        return; // Stop submit chain
      }

      // If direct autosave failed (or status is still saving), release lock to error so retry is possible
      if (store.getState().answers.saveStatus === 'saving') {
        dispatch(markSaveError());
        try {
          localStorage.setItem(
            `exam_draft_${currentSubmitAttemptId}`,
            JSON.stringify(store.getState().answers.answers)
          );
        } catch { /* ignore */ }
      }

      // Other 409 errors (like attempt already submitted, timeout) -> go to result
      const is409 = err?.response?.status === 409 || err?.message?.includes('409') || err?.code === 409;

      try {
        localStorage.setItem(`exam_highlights_${currentSubmitAttemptId}`, JSON.stringify(store.getState().answers.highlights));
        if (is409) {
          localStorage.removeItem(`exam_draft_${currentSubmitAttemptId}`);
        }
      } catch { /* ignore */ }

      const resultUrl = `/attempts/${currentSubmitAttemptId}/result`;
      if (isTimeout) {
        setSubmitResultUrl(resultUrl);
      } else if (is409) {
        navigate(resultUrl);
      }
    } finally {
      if (activeAttemptIdRef.current === currentSubmitAttemptId) {
        setIsSubmitting(false);
      }
    }
  };

  // Auto-submit when time expires
  useEffect(() => {
    if (
      isExpired &&
      !showTimeUp &&
      !showOverlay &&
      !isSubmitting &&
      activeWorkspace &&
      activeWorkspace.status === 'IN_PROGRESS' &&
      activeWorkspace.deadline !== null
    ) {
      setShowTimeUp(true);
      handleSubmit(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpired, showTimeUp, showOverlay, isSubmitting, activeWorkspace]);

  // Passage and Highlight state
  const passageHtml = (currentPart as any)?.contentHtml || (currentPart as any)?.content_html || currentPart?.content?.content_html || '';
  const partSharedAudio = (currentPart as any)?.sharedAudio
    || (currentPart as any)?.shared_audio
    || currentPart?.content?.shared_audio;
  const partSharedMedia = (currentPart as any)?.sharedMedia
    || (currentPart as any)?.shared_media
    || currentPart?.content?.shared_media;
  const passageId = String((currentPart as any)?.id ?? (currentPart as any)?.part_id ?? 1);
  const passageHash = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < passageHtml.length; i++) {
      hash = ((hash << 5) - hash) + passageHtml.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }, [passageHtml]);

  const highlightsData = useSelector((state: RootState) => selectHighlights(state, passageId));
  const highlights = highlightsData?.contentHash === passageHash ? highlightsData.items : [];

  const highlightEnabled = currentSkill === 'READING' && (activeWorkspace?.test_mode === 'PRACTICE' || activeWorkspace?.test_mode === 'MOCK_TEST');
  const { selection, setSelection } = useTextSelection(readingContainerRef, !!highlightEnabled);
  const [deleteTooltip, setDeleteTooltip] = useState<{ offset: number; top: number; left: number } | null>(null);

  const handleHighlight = () => {
    if (!selection || !readingContainerRef.current) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const rawText = sel.toString();
      const rawOffsets = rangeToOffsets(readingContainerRef.current, range);
      const { start, end } = trimOffsets(rawText, rawOffsets);
      if (start < end) {
        dispatch(addHighlightRecord({
          passageId,
          contentHash: passageHash,
          highlight: { id: Date.now().toString(), start, end, text: selection.text.substring(0, 50) }
        }));
      }
      sel.removeAllRanges();
      setSelection(null);
    }
  };

  const handleAiLookup = () => {
    if (!selection) return;
    setDictTooltip({
      word: selection.text,
      x: Math.max(16, selection.rect.left + selection.rect.width / 2 - 140),
      y: Math.max(70, selection.rect.bottom + 8),
    });
    setSavedFlashcard(false);
    setSelection(null);
  };

  const handlePassageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const mark = target.closest('mark[data-hl-id]');

    if (mark && window.getSelection()?.isCollapsed) {
      let range: Range | null = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if ((document as any).caretPositionFromPoint) {
        const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.setEnd(pos.offsetNode, pos.offset);
        }
      }
      if (range && readingContainerRef.current) {
        const { start } = rangeToOffsets(readingContainerRef.current, range);
        setDeleteTooltip({
          offset: start,
          top: e.clientY + window.scrollY + 8,
          left: e.clientX + window.scrollX,
        });
        return;
      }
    }
    setDeleteTooltip(null);
  };

  const handleDeleteHighlight = () => {
    if (deleteTooltip) {
      dispatch(removeHighlightRecord({ passageId, offset: deleteTooltip.offset }));
      setDeleteTooltip(null);
    }
  };

  const finalHtml = useMemo(() => applyHighlights(passageHtml, highlights), [passageHtml, highlights]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <svg className="animate-spin h-7 w-7 text-amber-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-slate-600 font-medium text-sm">Đang tải phiên thi Multilingo...</p>
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
          <p className="text-slate-700 text-sm leading-relaxed">{error}</p>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={retry} className="btn-primary text-sm">
              Thử lại
            </button>
            <button onClick={() => navigate('/')} className="btn-outline text-sm">
              Về trang chủ
            </button>
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
  const currentSectionId = (currentSection as any)?.section_id ?? currentSection?.id;
  const isCurrentSectionLocked = Boolean(
    activeWorkspace.test_mode === 'MOCK_TEST'
      && currentSectionId != null
      && lockedSections.includes(currentSectionId)
  );

  const handleReload = () => {
    if (isSubmitting || store.getState().answers.saveStatus === 'saving') return;
    const currentState = store.getState().answers;
    if (currentState.isDirty) {
      const ok = window.confirm("Bạn có các câu trả lời chưa được lưu lên máy chủ. Bạn có chắc muốn tải lại bản mới nhất từ máy chủ?");
      if (!ok) return;
      try {
        localStorage.setItem(`exam_draft_${attemptId}`, JSON.stringify(currentState.answers));
        setHasLocalDraft(true);
      } catch {
        alert("Không thể giữ bản nháp trên thiết bị. Hãy sao chép bài làm trước khi tải lại.");
        return;
      }
    }
    retry();
  };

  const handlePartClick = async (targetPartId: number) => {
    if (isSubmitting) return;
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
      alert("Phần này đã bị khóa và không thể truy cập lại.");
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

      const confirmMessage = `Sau khi tiếp tục bạn KHÔNG THỂ quay lại ${currentSection?.title || 'phần này'}.\nBạn còn ${sectionUnanswered} câu chưa làm của phần này.\nBạn có chắc chắn muốn chuyển sang ${targetSection?.title || 'phần khác'}?`;
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
          lockOperationGenRef.current === opGen
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
            setPendingLockError(refreshErr instanceof Error ? refreshErr.message : "Lỗi khi làm mới thông tin phần thi");
          }
        } catch (e: any) {
          if (!isOperationActive()) return;
          alert("Lỗi khi khóa phần thi: " + e.message);
        }
      }
    } else {
      setSelectedPartId(targetPartId);
      setPendingTargetPartId(null);
    }
  };

  const handleRetryMetadata = async () => {
    lockOperationGenRef.current += 1;
    const retryAttemptId = attemptId;
    const retryRouteGen = routeLifecycleGenRef.current;
    const retryGen = lockOperationGenRef.current;
    const isRetryActive = () => (
      !unmountedRef.current &&
      Object.is(currentAttemptIdRef.current, retryAttemptId) &&
      routeLifecycleGenRef.current === retryRouteGen &&
      lockOperationGenRef.current === retryGen
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
      setPendingLockError(err instanceof Error ? err.message : "Lỗi khi làm mới thông tin phần thi");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-800 select-text" onClick={() => {
      // Dismiss tooltip when clicking away without active selection
      const selection = window.getSelection();
      if (!selection || !selection.toString().trim()) {
        setDictTooltip(null);
      }
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
              {activeWorkspace.exam_snapshot?.title || 'Bài thi'}
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
          <SaveStatusBadge onReload={handleReload} />
          <TimerDisplay displayTime={displayTime} isExpired={isExpired} isPractice={isPractice} />
        </div>
      </header>

      {/* Notice Banners */}
      {(refreshError || pendingLockError) && (
        <div role="alert" className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between text-xs text-red-800 shrink-0">
          <span>{refreshError || pendingLockError}</span>
          <button
            type="button"
            onClick={handleRetryMetadata}
            className="px-2.5 py-1 rounded border border-red-300 bg-white hover:bg-red-100 font-semibold text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}
      {hasLocalDraft && (
        <div data-testid="local-draft-notice" className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-800 flex items-center gap-2 shrink-0">
          <span>ℹ️ Đang dùng bản đã lưu trên máy chủ; bản nháp trên thiết bị chưa được khôi phục.</span>
        </div>
      )}

      {/* 2. MAIN BODY: SPLIT-PANE WORKSPACE */}
      <div ref={workspaceContainerRef} className="flex flex-1 overflow-hidden relative">
        {/* LEFT PANE: Reading Passage or Writing Prompt Workspace */}
        {currentSkill !== 'LISTENING' && allParts.length > 0 && (
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
                  IELTS Academic {currentSkill === 'WRITING' ? 'Writing' : 'Reading'}
                </span>
              </div>
              {isPractice && currentSkill === 'READING' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Bôi đen từ để tra từ điển AI
                  </span>
                </div>
              )}
            </div>

            {/* Passage / Prompt Text Content */}
            <div
              ref={readingContainerRef}
              className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 text-slate-800 leading-relaxed font-sans text-[15px]"
            >
              {currentSkill === 'WRITING' ? (
                <div className="space-y-6">
                  <h2 className="font-heading text-xl font-bold text-slate-900">
                    {partTitle}
                  </h2>
                  {partInstruction && (
                    <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 text-slate-700 text-sm">
                      {partInstruction}
                    </div>
                  )}
                  {partSharedAudio?.url && <AudioPlayer url={partSharedAudio.url} isActive={true} />}
                  {partSharedMedia && partSharedMedia.url !== partQuestions[0]?.media?.url && (
                    <MediaDisplay media={partSharedMedia} alt={`${partTitle} media`} />
                  )}
                  {partQuestions[0] && (
                    <div className="space-y-4">
                      <div className="prose prose-slate max-w-none text-slate-800 font-medium whitespace-pre-wrap">
                        {partQuestions[0].question_text}
                      </div>
                      {partQuestions[0].media && (
                        <div className="mt-4 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex justify-center p-2">
                          <MediaDisplay media={partQuestions[0].media} alt="Writing Prompt Graph" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {partSharedAudio?.url && <AudioPlayer url={partSharedAudio.url} isActive={true} />}
                  {partSharedMedia && <MediaDisplay media={partSharedMedia} alt={`${partTitle} media`} />}
                  {passageHtml ? (
                    <div onClick={handlePassageClick}>
                      <HtmlContent
                        html={finalHtml}
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
                      Không có nội dung bài đọc cho phần thi này.
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* RESIZABLE DIVIDER GUTTER */}
        {currentSkill !== 'LISTENING' && allParts.length > 0 && (
          <div
            data-testid="pane-divider"
            onMouseDown={() => setIsDraggingSplit(true)}
            onDoubleClick={() => setSplitRatio(50)}
            title="Kéo để chỉnh độ rộng 2 bên (Nhấp đúp để đặt lại 50/50)"
            className={`hidden lg:flex w-2.5 hover:w-3.5 bg-slate-200 hover:bg-amber-400 cursor-col-resize items-center justify-center border-x border-slate-300 transition-colors group select-none shrink-0 z-20 ${
              isDraggingSplit ? 'bg-amber-500 w-3.5' : ''
            }`}
          >
            <div className="w-0.5 h-8 rounded-full bg-slate-400 group-hover:bg-amber-800 transition-colors" />
          </div>
        )}

        {/* RIGHT PANE: Questions & Interaction */}
        <main
          style={currentSkill !== 'LISTENING' && allParts.length > 0 ? { width: `${100 - splitRatio}%` } : undefined}
          className={`flex-1 flex flex-col bg-slate-50 h-full overflow-hidden ${
            currentSkill === 'LISTENING' ? 'items-center' : ''
          } ${isDraggingSplit ? 'transition-none select-none' : 'transition-[width] duration-200 ease-in-out'}`}
        >
          {/* Scrollable Questions Container */}
          <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 w-full ${currentSkill === 'LISTENING' ? 'max-w-4xl' : ''}`}>
            {partQuestions.length > 0 ? (
              <div className="flex flex-col gap-4 max-w-3xl">
                {/* Part Instruction Callout */}
                {partInstruction && (
                  <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-r-xl p-3.5 text-sm text-slate-700">
                    <span className="font-bold text-amber-800 block mb-0.5">Hướng dẫn làm bài:</span>
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

                {partQuestionGroups.map((group: any) => (
                  <div
                    key={group.group_id}
                    data-testid={`question-group-${group.group_id}`}
                    data-group-id={group.group_id}
                    className="space-y-4"
                  >
                    {group.instruction && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
                        {group.instruction}
                      </div>
                    )}
                    {group.shared_audio?.url && <AudioPlayer url={group.shared_audio.url} isActive={true} />}
                    {group.shared_media && <MediaDisplay media={group.shared_media} alt={`${group.group_id} media`} />}
                    {(group.content_html || group.context_html) && (
                      <HtmlContent
                        html={group.content_html || group.context_html}
                        className="prose prose-slate max-w-none"
                      />
                    )}
                    {group.questions.map((q: Question) => {
                      const qId = q.question_id;
                      const currentVal = answersState.answers?.[partId]?.[qId] ?? null;
                      const isQuestionAnswered = isAnswered(currentVal, q.type);
                      const isFlagged = !!answersState.flags?.[partId]?.[qId];

                      // Calculate dynamic minWords based on question text/metadata or skill standards
                      const minWords = extractMinWords(q, currentPart);

                      return (
                        <div
                          key={qId}
                          id={`q-${qId}`}
                          className={`ed-card p-5 scroll-mt-4 transition-all duration-200 ${
                            isQuestionAnswered ? 'border-amber-200/80 bg-white' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3.5">
                            <div className="flex items-start gap-3 flex-1">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-heading font-bold text-xs shrink-0 mt-0.5 transition-colors ${
                                isQuestionAnswered ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                {q.question_number}
                              </span>
                              <div className={`font-heading font-semibold text-slate-900 text-sm sm:text-[15px] leading-relaxed flex-1 ${currentSkill === 'WRITING' ? 'lg:hidden' : ''}`}>
                                {q.question_text}
                              </div>
                            </div>

                            {/* Flag toggle button */}
                            <button
                              type="button"
                              data-testid={`flag-btn-${qId}`}
                              disabled={isCurrentSectionLocked}
                              onClick={() => {
                                if (!isCurrentSectionLocked) {
                                  dispatch(toggleFlag({ partId, questionId: qId }));
                                }
                              }}
                              title={isFlagged ? 'Bỏ đánh dấu xem lại' : 'Đánh dấu câu hỏi này để xem lại sau'}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 shadow-2xs ${
                                isFlagged
                                  ? 'bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-400/30'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                              }`}
                            >
                              <span>{isFlagged ? '🚩' : '🏳️'}</span>
                              <span>{isFlagged ? 'Đã xem lại' : 'Xem lại'}</span>
                            </button>
                          </div>

                          <div className="pl-10">
                            {q.media && q.type !== 'ESSAY' && q.type !== 'MAP_LABELING' && (
                              <MediaDisplay media={q.media} alt={`Question ${q.question_number} media`} />
                            )}
                            <fieldset disabled={isCurrentSectionLocked} className="m-0 min-w-0 border-0 p-0">
                              <QuestionRenderer
                                question={q}
                                partId={partId}
                                currentAnswer={currentVal}
                                minWords={minWords}
                                onChange={(val) => {
                                  if (!isCurrentSectionLocked) {
                                    dispatch(setAnswer({ partId, questionId: qId, value: val }));
                                  }
                                }}
                              />
                            </fieldset>
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
                <p>Không có dữ liệu phần thi.</p>
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
                          className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-heading font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
                        >
                          Chuyển sang phần tiếp theo ({nextSection.title}) <span>→</span>
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

        {/* 3. RIGHT SIDEBAR: QUESTION PALETTE DOCK */}
        <aside className="w-64 sm:w-72 shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-xs">
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Part Switcher in Sidebar */}
            {allParts.length > 1 && (
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 shrink-0">
                <div className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500 mb-3">
                  Chọn phần thi
                </div>
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
                    const isLocked = isMockFull && lockedSections.includes(targetSId);

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
                            {qCount} câu
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-4 flex-1">
              <div className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                <span>Bảng câu hỏi</span>
                <span className="badge-orange text-[11px]">
                  {allQuestions.length} câu
                </span>
              </div>
              <QuestionPalette
                allParts={allParts}
                activePartId={partId}
                lockedPartIds={lockedPartIds}
                onNavigate={(targetPartId, qId) => {
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
              disabled={isSubmitting}
              onClick={() => setShowConfirm(true)}
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
                  <span>Đang nộp...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Nộp bài</span>
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* 4. FLOATING AI DICTIONARY POPUP */}
      {dictTooltip && (
        <div
          style={{ top: `${dictTooltip.y}px`, left: `${dictTooltip.x}px` }}
          className="fixed z-50 w-72 bg-white rounded-xl shadow-xl border border-amber-300 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-slate-900 text-base">{dictTooltip.word}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                AI Vocab
              </span>
            </div>
            <button
              onClick={() => setDictTooltip(null)}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-mono text-amber-700">/{dictTooltip.word.toLowerCase()}/</p>
            <p className="text-slate-800 font-medium">
              Từ vựng quan trọng xuất hiện trong ngữ cảnh bài đọc.
            </p>
          </div>

          <button
            onClick={() => setSavedFlashcard(true)}
            className={`w-full py-1.5 px-3 rounded-lg text-xs font-heading font-bold transition-all flex items-center justify-center gap-1.5 ${
              savedFlashcard
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
            }`}
          >
            {savedFlashcard ? '✓ Đã lưu vào Flashcards' : '+ Lưu Flashcard'}
          </button>
        </div>
      )}

      {/* 4b. SELECTION TOOLBAR & DELETE TOOLTIP */}
      <SelectionToolbar
        selection={selection}
        showAi={isPractice && selection !== null && selection.text.length > 1 && selection.text.length < 35 && /^[a-zA-Z\s-]+$/.test(selection.text)}
        onHighlight={handleHighlight}
        onAiLookup={handleAiLookup}
      />

      {deleteTooltip && createPortal(
        <div
          className="absolute z-50 flex items-center bg-white border border-gray-200 shadow-lg rounded-md px-3 py-1 cursor-pointer hover:bg-gray-50"
          style={{ top: deleteTooltip.top, left: deleteTooltip.left }}
          onClick={handleDeleteHighlight}
        >
          <span className="text-sm font-medium text-red-600">Xóa highlight</span>
        </div>,
        document.body
      )}

      {/* 5. MODALS & SUBMIT OVERLAYS */}
      <SubmitConfirmModal
        open={showConfirm}
        total={allQuestions.length}
        answered={allQuestions.length - unansweredCount}
        unansweredCount={unansweredCount}
        isLoading={isSubmitting}
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
        onClose={() => {
          if (submitResultUrl) {
            navigate(submitResultUrl);
          } else {
            navigate(`/attempts/${attemptId}/result`);
          }
        }}
      />

      <SubmitOverlay
        visible={showOverlay}
        isRetrying={isSubmitting}
        onRetry={() => handleSubmit(false)}
      />
    </div>
  );
};

export default WorkspacePage;
