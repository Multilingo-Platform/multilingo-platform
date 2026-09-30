import React, { useEffect, useState, useMemo } from 'react';
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

  // Flatten all parts for quick selection
  const allParts = useMemo(() => {
    return workspace?.exam_snapshot?.sections?.flatMap(s => s.parts ?? []) ?? [];
  }, [workspace]);

  // Active part: selected part or first part available
  const currentPart = useMemo(() => {
    if (selectedPartId !== null) {
      const found = allParts.find(p => (p.part_id ?? p.id) === selectedPartId);
      if (found) return found;
    }
    const firstSection = workspace?.exam_snapshot?.sections?.[0];
    return firstSection?.parts?.[0];
  }, [workspace, selectedPartId, allParts]);

  const partQuestions: Question[] = (currentPart?.questions ?? []).map((q: any) => ({
    ...q,
    question_id: q.question_id || String(q.id),
    question_number: q.question_number ?? q.id,
    type: q.type === 'MCQ' ? 'SINGLE_CHOICE' : q.type === 'FILL_IN' ? 'FILL_IN_THE_BLANK' : q.type,
    question_text: q.question_text || q.prompt || '',
  }));
  const partId = currentPart?.part_id ?? currentPart?.id ?? 1;

  // Compute unanswered questions across the entire exam
  const allQuestions = useMemo(() => {
    return workspace?.exam_snapshot?.sections?.flatMap(s =>
      s.parts?.flatMap(p => p.questions ?? []) ?? []
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
    if (isExpired && !showOverlay && workspace && workspace.status === 'IN_PROGRESS') {
      setShowOverlay(true);
      handleSubmit();
    }
  }, [isExpired, workspace]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" style={{
        minHeight: '100vh', backgroundColor: '#0F172A',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem',
      }}>
        <svg style={{ animation: 'spin 1s linear infinite', height: '2.5rem', width: '2.5rem', color: '#2151DA' }} viewBox="0 0 24 24" fill="none">
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Đang tải phiên thi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" style={{
        minHeight: '100vh', backgroundColor: '#0F172A',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      }}>
        <div style={{
          maxWidth: '384px', width: '100%',
          background: '#1E293B', border: '1px solid #334155',
          borderRadius: '1rem', padding: '1.5rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
          <p style={{ color: '#cbd5e1', marginBottom: '1.5rem', fontSize: '0.875rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={retry} style={{
              padding: '0.5rem 1rem', background: '#2151DA', color: '#fff',
              borderRadius: '0.75rem', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.875rem',
            }}>Thử lại</button>
            <button onClick={() => navigate('/')} style={{
              padding: '0.5rem 1rem', background: '#263549', color: '#94A3B8',
              borderRadius: '0.75rem', border: '1px solid #334155', cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: '0.875rem',
            }}>Về trang chủ</button>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0F172A', overflow: 'hidden' }}>
      {/* Sticky Header */}
      <header style={{
        flexShrink: 0,
        borderBottom: '1px solid rgba(51,65,85,0.5)',
        backgroundColor: 'rgba(15,23,42,0.95)',
        backdropFilter: 'blur(8px)',
        padding: '0.75rem 1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        zIndex: 20,
      }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#e2e8f0',
          fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          margin: 0,
        }}>
          {workspace.exam_snapshot?.title || 'Bài thi'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <SaveStatusBadge />
          <TimerDisplay displayTime={displayTime} isExpired={isExpired} isPractice={isPractice} />
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
          {/* Part tabs */}
          {allParts.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {allParts.map((p: any) => {
                const pId = p.part_id ?? p.id;
                const isActive = pId === partId;
                return (
                  <button
                    key={pId}
                    type="button"
                    onClick={() => setSelectedPartId(pId)}
                    style={{
                      padding: '0.375rem 1rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: isActive ? 700 : 500,
                      backgroundColor: isActive ? '#2151DA' : '#1E293B',
                      color: isActive ? '#ffffff' : '#94A3B8',
                      border: isActive ? '1px solid #2151DA' : '1px solid #334155',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isActive ? '0 2px 8px rgba(33,81,218,0.3)' : 'none',
                    }}
                  >
                    {p.title || `Part ${pId}`}
                  </button>
                );
              })}
            </div>
          )}

          {/* Questions */}
          {partQuestions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '768px' }}>
              {partQuestions.map((q) => {
                const qId = q.question_id;
                const currentVal = answersState.answers?.[partId]?.[qId] ?? null;
                return (
                  <div
                    key={qId}
                    id={`q-${qId}`}
                    style={{
                      background: 'rgba(30,41,59,0.6)',
                      padding: '1.25rem 1.5rem',
                      borderRadius: '1rem',
                      border: '1px solid rgba(51,65,85,0.6)',
                      scrollMarginTop: '1rem',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div style={{
                      fontFamily: 'var(--font-heading)', fontWeight: 600,
                      color: '#e2e8f0', marginBottom: '1rem', fontSize: '0.875rem',
                      lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                    }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '1.5rem', height: '1.5rem', borderRadius: '50%',
                        background: 'rgba(33,81,218,0.2)', color: '#3b5fe8',
                        fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, marginTop: '1px',
                      }}>
                        {q.question_number}
                      </span>
                      {q.question_text}
                    </div>
                    <QuestionRenderer
                      question={q}
                      partId={partId}
                      currentAnswer={currentVal}
                      onChange={(val) => {
                        dispatch(setAnswer({ partId, questionId: qId, value: val }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <pre style={{
              fontSize: '0.75rem', overflow: 'auto', maxHeight: '400px',
              background: '#1E293B', color: '#94A3B8',
              borderRadius: '0.75rem', padding: '1rem', border: '1px solid #334155',
            }}>
              {JSON.stringify(workspace.exam_snapshot, null, 2)}
            </pre>
          )}
        </main>

        {/* Sidebar */}
        <aside style={{
          width: '18rem', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid rgba(51,65,85,0.5)',
          background: 'rgba(30,41,59,0.3)',
          overflowY: 'auto',
        }}>
          <div style={{ padding: '1rem', flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.7rem',
              textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b',
              marginBottom: '0.75rem',
            }}>
              Bảng câu hỏi
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

          <div style={{ padding: '1rem', borderTop: '1px solid rgba(51,65,85,0.5)' }}>
            <button
              id="btn-submit-exam"
              disabled={isSubmitting}
              onClick={() => setShowConfirm(true)}
              style={{
                width: '100%', padding: '0.75rem',
                borderRadius: '0.75rem',
                fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.875rem',
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                ...(isSubmitting
                  ? { background: '#1E293B', color: '#94A3B8', border: '1px solid #334155' }
                  : { background: '#EF4444', color: '#fff', boxShadow: '0 4px 16px rgba(239,68,68,0.25)' }
                ),
              }}
            >
              {isSubmitting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <svg style={{ animation: 'spin 1s linear infinite', height: '1rem', width: '1rem' }} viewBox="0 0 24 24" fill="none">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Đang nộp...
                </span>
              ) : '🚀 Nộp bài'}
            </button>
          </div>
        </aside>
      </div>

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
