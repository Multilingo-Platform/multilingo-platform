import React, { useEffect, useState, useMemo, useRef } from 'react';
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
import { autosaveAnswers, submitAttempt, lockSection } from '../api/attemptApi';
import { setAnswer, toggleFlag, selectSaveStatus } from '../store/answerSlice';
import { isAnswered } from '../utils/answerUtils';
import { extractMinWords, getPartHeaderInfo } from '../utils/examPartUtils';
import type { AppDispatch, RootState } from '../../../store/store';
import type { Question } from '../types/exam.types';

interface DictTooltip {
  word: string;
  x: number;
  y: number;
}

const WorkspacePage: React.FC = () => {
  const { attemptId: attemptIdStr } = useParams<{ attemptId: string }>();
  const attemptId = parseInt(attemptIdStr ?? '0', 10);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { workspace, loading, error, retry } = useWorkspace(attemptId);
  const { displayTime, isExpired, isPractice } = useExamTimer(
    workspace?.serverTime ?? null,
    workspace?.deadline ?? null
  );
  useAutosave(workspace && workspace.status === 'IN_PROGRESS' ? attemptId : null);

  const { isDirty } = useSelector((state: RootState) => selectSaveStatus(state));
  const answersState = useSelector((state: RootState) => state.answers);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showTimeUp, setShowTimeUp] = useState(false);
  const [submitResultUrl, setSubmitResultUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);

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

  // Flatten all parts for quick selection
  const allParts = useMemo(() => {
    return workspace?.exam_snapshot?.sections?.flatMap(s => s.parts ?? []) ?? [];
  }, [workspace]);

  const currentSection = useMemo(() => {
    if (selectedPartId !== null) {
      const found = workspace?.exam_snapshot?.sections?.find(s => 
        s.parts?.some(p => ((p as any).id === selectedPartId || (p as any).part_id === selectedPartId))
      );
      if (found) return found;
    }
    return workspace?.exam_snapshot?.sections?.[0];
  }, [workspace, selectedPartId]);

  // Active part: selected part or first part available
  const currentPart = useMemo(() => {
    if (selectedPartId !== null) {
      const found = allParts.find(p => (p as any).id === selectedPartId || (p as any).part_id === selectedPartId);
      if (found) return found;
    }
    return currentSection?.parts?.[0];
  }, [currentSection, selectedPartId, allParts]);

  const currentSkill = currentSection?.skill_type || ((currentSection as any)?.name?.toUpperCase() as any) || 'READING';

  const partHeaderInfo = useMemo(() => {
    return getPartHeaderInfo(currentSkill, currentPart, currentSection?.parts, allParts);
  }, [currentSkill, currentPart, currentSection, allParts]);

  // Active part questions extraction: supports both part.questions & part.content.question_groups
  const currentPartQuestions = useMemo(() => {
    if (!currentPart) return [];
    if (Array.isArray((currentPart as any).questions) && (currentPart as any).questions.length > 0) {
      return (currentPart as any).questions;
    }
    return currentPart?.content?.question_groups?.flatMap((g: any) => g.questions ?? []) ?? [];
  }, [currentPart]);

  const partQuestions: Question[] = useMemo(() => {
    return currentPartQuestions.map((q: any) => ({
      ...q,
      question_id: q.question_id || String(q.id),
      question_number: q.question_number ?? q.id,
      type: q.type === 'MCQ' ? 'SINGLE_CHOICE' : q.type === 'FILL_IN' ? 'FILL_IN_THE_BLANK' : q.type,
      question_text: q.question_text || q.prompt || '',
      options: q.options ?? null,
    }));
  }, [currentPartQuestions]);

  const partId = (currentPart as any)?.id ?? (currentPart as any)?.part_id ?? 1;

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
    setIsSubmitting(true);
    try {
      // Pre-submit flush: push unsaved answers to server before closing attempt
      if (isDirty) {
        const answers = Object.entries(answersState.answers).map(([pId, qMap]) => ({
          part_id: Number(pId),
          answers: Object.entries(qMap).map(([question_id, answer]) => ({ question_id, answer })),
        }));
        await autosaveAnswers(attemptId, { version: answersState.version, answers });
        try { localStorage.removeItem(`exam_draft_${attemptId}`); } catch { /* ignore */ }
      }
      const result = await submitAttempt(attemptId, {
        version: answersState.version,
        answers: [],
        reason: isTimeout ? 'TIMEOUT_CLIENT' : 'MANUAL',
      });
      // Always clean up localStorage draft after successful submit
      try { localStorage.removeItem(`exam_draft_${attemptId}`); } catch { /* ignore */ }
      if (isTimeout) {
        setSubmitResultUrl(result.redirect_url);
      } else {
        navigate(result.redirect_url);
      }
    } catch (err: any) {
      try { localStorage.removeItem(`exam_draft_${attemptId}`); } catch { /* ignore */ }
      const resultUrl = `/attempts/${attemptId}/result`;
      if (isTimeout) {
        setSubmitResultUrl(resultUrl);
      } else {
        const is409 = err?.response?.status === 409 || err?.message?.includes('409') || err?.code === 409;
        if (is409) {
          navigate(resultUrl);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-submit when time expires
  useEffect(() => {
    if (
      isExpired &&
      !showTimeUp &&
      !showOverlay &&
      !isSubmitting &&
      workspace &&
      workspace.status === 'IN_PROGRESS' &&
      workspace.deadline !== null
    ) {
      setShowTimeUp(true);
      handleSubmit(true);
    }
  }, [isExpired, showTimeUp, showOverlay, isSubmitting, workspace]);

  // Handle text selection in Reading Passage for AI Dictionary popup
  const handlePassageMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 1 && text.length < 35 && /^[a-zA-Z\s-]+$/.test(text)) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if (rect) {
        setDictTooltip({
          word: text,
          x: Math.max(16, rect.left + rect.width / 2 - 140),
          y: Math.max(70, rect.bottom + 8),
        });
        setSavedFlashcard(false);
      }
    }
  };

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

  if (!workspace) return null;

  if (workspace.status === 'COMPLETED') {
    navigate(`/attempts/${attemptId}/result`);
    return null;
  }

  const passageHtml = (currentPart as any)?.contentHtml || (currentPart as any)?.content_html || currentPart?.content?.content_html;
  const partInstruction = (currentPart as any)?.instruction || currentPart?.content?.instruction;
  const partTitle = currentPart?.title || currentPart?.content?.part_title || `${partHeaderInfo.unitLabel} ${partHeaderInfo.currentNumber}`;
  const isMockFull = workspace.test_mode === 'MOCK_TEST' && workspace.test_scope === 'FULL_EXAM';

  const handlePartClick = async (targetPartId: number) => {
    if (!isMockFull) {
      setSelectedPartId(targetPartId);
      return;
    }

    const currentSId = (currentSection as any)?.section_id ?? currentSection?.id;
    const targetSection = workspace?.exam_snapshot?.sections?.find(s =>
      (s.parts || []).some((p: any) => (p.part_id ?? p.id) === targetPartId)
    );
    const targetSId = (targetSection as any)?.section_id ?? targetSection?.id;

    // Same section, allow jumping
    if (currentSId === targetSId) {
      setSelectedPartId(targetPartId);
      return;
    }

    // Locked section check
    if (workspace.lockedSections?.includes(targetSId)) {
      alert("Phần này đã bị khóa và không thể truy cập lại.");
      return;
    }

    // Different section, confirm and lock current
    if (currentSId) {
      // Calculate unanswered count in current section
      let sectionUnanswered = 0;
      const parts = currentSection?.parts || [];
      for (const p of parts) {
        const pId = (p as any).part_id ?? p.id;
        const savedAnswers = workspace.saved_answers?.find(a => (a as any).partId === pId || (a as any).part_id === pId)?.answers || [];
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
        try {
          await lockSection(attemptId, currentSId);
          retry(); // refresh workspace to get new lockedSections
          setSelectedPartId(targetPartId);
        } catch (e: any) {
          alert("Lỗi khi khóa phần thi: " + e.message);
        }
      }
    } else {
      setSelectedPartId(targetPartId);
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
              {workspace.exam_snapshot?.title || 'Bài thi'}
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
          <SaveStatusBadge />
          <TimerDisplay displayTime={displayTime} isExpired={isExpired} isPractice={isPractice} />
        </div>
      </header>

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
              onMouseUp={isPractice && currentSkill === 'READING' ? handlePassageMouseUp : undefined}
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
                  {partQuestions[0] && (
                    <div className="space-y-4">
                      <div className="prose prose-slate max-w-none text-slate-800 font-medium whitespace-pre-wrap">
                        {partQuestions[0].question_text}
                      </div>
                      {partQuestions[0].media?.url && (
                        <div className="mt-4 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex justify-center p-2">
                          <img src={partQuestions[0].media.url} alt="Writing Prompt Graph" className="max-w-full h-auto max-h-[60vh] object-contain" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : passageHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: passageHtml }}
                  className="prose prose-slate max-w-none [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mb-3 [&_p]:mb-4 [&_p]:leading-relaxed [&_strong]:text-amber-700"
                />
              ) : partInstruction ? (
                <div className="space-y-4">
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

                {partQuestions.map((q) => {
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
                          onClick={() => dispatch(toggleFlag({ partId, questionId: qId }))}
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
                        <QuestionRenderer
                          question={q}
                          partId={partId}
                          currentAnswer={currentVal}
                          minWords={minWords}
                          onChange={(val) => {
                            dispatch(setAnswer({ partId, questionId: qId, value: val }));
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
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
                  const sIdx = workspace.exam_snapshot.sections.findIndex(s => ((s as any).section_id ?? s.id) === ((currentSection as any).section_id ?? currentSection.id));
                  const nextSection = sIdx !== -1 && sIdx + 1 < workspace.exam_snapshot.sections.length ? workspace.exam_snapshot.sections[sIdx + 1] : null;
                  
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
                    const targetSection = workspace?.exam_snapshot?.sections?.find(s => (s.parts || []).some((part: any) => (part.part_id ?? part.id) === pId));
                    const targetSId = (targetSection as any)?.section_id ?? targetSection?.id;
                    const isLocked = isMockFull && workspace?.lockedSections?.includes(targetSId);

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
