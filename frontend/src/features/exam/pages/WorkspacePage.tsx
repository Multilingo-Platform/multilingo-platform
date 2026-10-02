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
import { QuestionPalette } from '../components/QuestionPalette';
import QuestionRenderer from '../components/renderers/QuestionRenderer';
import { autosaveAnswers, submitAttempt } from '../api/attemptApi';
import { setAnswer, selectSaveStatus } from '../store/answerSlice';
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
    workspace?.deadline ?? null,
    workspace?.serverTimeOffset ?? 0
  );
  useAutosave(workspace && workspace.status === 'IN_PROGRESS' ? attemptId : null);

  const { isDirty } = useSelector((state: RootState) => selectSaveStatus(state));
  const answersState = useSelector((state: RootState) => state.answers);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);

  // Floating AI Dictionary Tooltip state
  const [dictTooltip, setDictTooltip] = useState<DictTooltip | null>(null);
  const [savedFlashcard, setSavedFlashcard] = useState(false);
  const readingContainerRef = useRef<HTMLDivElement>(null);

  // Flatten all parts for quick selection
  const allParts = useMemo(() => {
    return workspace?.exam_snapshot?.sections?.flatMap(s => s.parts ?? []) ?? [];
  }, [workspace]);

  // Active part: selected part or first part available
  const currentPart = useMemo(() => {
    if (selectedPartId !== null) {
      const found = allParts.find(p => p.id === selectedPartId);
      if (found) return found;
    }
    const firstSection = workspace?.exam_snapshot?.sections?.[0];
    return firstSection?.parts?.[0];
  }, [workspace, selectedPartId, allParts]);

  const currentPartQuestions = currentPart?.content?.question_groups?.flatMap(g => g.questions) ?? [];
  const partQuestions: Question[] = currentPartQuestions.map((q: any) => ({
    ...q,
    question_id: q.question_id || String(q.id),
    question_number: q.question_number ?? q.id,
    type: q.type === 'MCQ' ? 'SINGLE_CHOICE' : q.type === 'FILL_IN' ? 'FILL_IN_THE_BLANK' : q.type,
    question_text: q.question_text || q.prompt || '',
  }));
  const partId = currentPart?.id ?? 1;

  // Compute unanswered questions across the entire exam
  const allQuestions = useMemo(() => {
    return workspace?.exam_snapshot?.sections?.flatMap(s =>
      s.parts?.flatMap(p => p.content?.question_groups?.flatMap(g => g.questions) ?? []) ?? []
    ) ?? [];
  }, [workspace]);

  const unansweredCount = useMemo(() => {
    let answered = 0;
    for (const partMap of Object.values(answersState.answers ?? {})) {
      for (const val of Object.values(partMap ?? {})) {
        if (val !== null && val !== undefined && (!Array.isArray(val) || val.length > 0)) {
          answered++;
        }
      }
    }
    return Math.max(0, allQuestions.length - answered);
  }, [allQuestions, answersState.answers]);

  const handleSubmit = async () => {
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
      const result = await submitAttempt(attemptId, { version: answersState.version, answers: [] });
      // Always clean up localStorage draft after successful submit
      try { localStorage.removeItem(`exam_draft_${attemptId}`); } catch { /* ignore */ }
      navigate(result.redirect_url);
    } catch {
      setIsSubmitting(false);
    }
  };

  // Auto-submit when time expires
  useEffect(() => {
    if (
      isExpired &&
      !showOverlay &&
      !isSubmitting &&
      workspace &&
      workspace.status === 'IN_PROGRESS' &&
      workspace.deadline !== null
    ) {
      setShowOverlay(true);
      handleSubmit();
    }
  }, [isExpired, showOverlay, isSubmitting, workspace]);

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

  const passageHtml = currentPart?.content?.content_html;
  const currentPartNumber = currentPart?.part_number ?? (allParts.findIndex(p => p.id === partId) + 1 || 1);

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
              <span className="badge-orange shrink-0 hidden md:inline-flex">
                Passage {currentPartNumber} / {allParts.length}
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
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANE: Reading Passage Workspace */}
        {allParts.length > 0 && (
          <section className="hidden lg:flex lg:w-1/2 flex-col bg-white border-r border-slate-200 h-full overflow-hidden">
            {/* Passage Toolbar */}
            <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider bg-white px-2.5 py-1 rounded border border-slate-200">
                  {currentPart?.content?.part_title || `Passage ${currentPartNumber}`}
                </span>
                <span className="text-xs text-slate-500">IELTS Academic Reading</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Bôi đen từ để tra từ điển AI
                </span>
              </div>
            </div>

            {/* Passage Text Content */}
            <div
              ref={readingContainerRef}
              onMouseUp={handlePassageMouseUp}
              className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 text-slate-800 leading-relaxed font-sans text-[15px]"
            >
              {passageHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: passageHtml }}
                  className="prose prose-slate max-w-none [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mb-3 [&_p]:mb-4 [&_p]:leading-relaxed [&_strong]:text-amber-700"
                />
              ) : currentPart?.content?.instruction ? (
                <div className="space-y-4">
                  <h2 className="font-heading text-lg font-bold text-slate-900">
                    {currentPart.content.part_title || 'Hướng dẫn phần thi'}
                  </h2>
                  <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 text-slate-700 text-sm">
                    {currentPart.content.instruction}
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

        {/* RIGHT PANE: Questions & Interaction */}
        <main className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden">
          {/* Part Switcher Tabs */}
          {allParts.length > 1 && (
            <div className="bg-white px-6 border-b border-slate-200 flex items-center gap-6 shrink-0 overflow-x-auto">
              {allParts.map((p: any) => {
                const pId = (p as any).part_id ?? p.id;
                const isActive = pId === partId;
                const pIndex = allParts.findIndex(item => ((item as any).part_id ?? item.id) === pId) + 1;
                return (
                  <button
                    key={pId}
                    type="button"
                    onClick={() => setSelectedPartId(pId)}
                    className={`py-3 font-heading font-semibold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'text-amber-700 border-amber-600'
                        : 'text-slate-500 border-transparent hover:text-slate-900'
                    }`}
                  >
                    <span>{p.title || `Part ${pIndex}`}</span>
                    {p.content?.question_groups && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {p.content.question_groups.flatMap((g: any) => g.questions ?? []).length} câu
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scrollable Questions Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {partQuestions.length > 0 ? (
              <div className="flex flex-col gap-4 max-w-3xl">
                {/* Part Instruction Callout */}
                {currentPart?.content?.instruction && (
                  <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-r-xl p-3.5 text-sm text-slate-700">
                    <span className="font-bold text-amber-800 block mb-0.5">Hướng dẫn làm bài:</span>
                    {currentPart.content.instruction}
                  </div>
                )}

                {partQuestions.map((q) => {
                  const qId = q.question_id;
                  const currentVal = answersState.answers?.[partId]?.[qId] ?? null;
                  const isAnswered = currentVal !== null && currentVal !== undefined && (!Array.isArray(currentVal) || currentVal.length > 0);

                  return (
                    <div
                      key={qId}
                      id={`q-${qId}`}
                      className={`ed-card p-5 scroll-mt-4 transition-all duration-200 ${
                        isAnswered ? 'border-amber-200/80 bg-white' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3.5">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-heading font-bold text-xs shrink-0 mt-0.5 transition-colors ${
                          isAnswered ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {q.question_number}
                        </span>
                        <div className="font-heading font-semibold text-slate-900 text-sm sm:text-[15px] leading-relaxed flex-1">
                          {q.question_text}
                        </div>
                      </div>

                      <div className="pl-10">
                        <QuestionRenderer
                          question={q}
                          partId={partId}
                          currentAnswer={currentVal}
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
              <pre className="text-xs overflow-auto max-h-96 bg-white text-slate-600 rounded-xl p-4 border border-slate-200">
                {JSON.stringify(workspace.exam_snapshot, null, 2)}
              </pre>
            )}
          </div>
        </main>

        {/* 3. RIGHT SIDEBAR: STUDY4-STYLE QUESTION PALETTE DOCK */}
        <aside className="w-64 sm:w-72 shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-xs">
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="font-heading font-bold text-xs uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
              <span>Bảng câu hỏi</span>
              <span className="badge-orange text-[11px]">
                {partQuestions.length} câu
              </span>
            </div>
            <QuestionPalette
              questions={partQuestions}
              partId={partId}
              onNavigate={(qId) => {
                const el = document.getElementById(`q-${qId}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
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
        unansweredCount={unansweredCount}
        onConfirm={() => {
          setShowConfirm(false);
          setShowOverlay(true);
          handleSubmit();
        }}
        onCancel={() => setShowConfirm(false)}
      />

      <SubmitOverlay
        visible={showOverlay}
        isRetrying={isSubmitting}
        onRetry={handleSubmit}
      />
    </div>
  );
};

export default WorkspacePage;
