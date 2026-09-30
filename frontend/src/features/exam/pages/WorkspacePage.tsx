import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import useWorkspace from '../hooks/useWorkspace';
import { useExamTimer } from '../hooks/useExamTimer';
import { useAutosave } from '../hooks/useAutosave';
import { TimerDisplay } from '../components/TimerDisplay';
import { SaveStatusBadge } from '../components/SaveStatusBadge';
import { SubmitOverlay } from '../components/SubmitOverlay';
import { SubmitConfirmModal } from '../components/SubmitConfirmModal';
import { QuestionPalette } from '../components/QuestionPalette';
import { autosaveAnswers, submitAttempt } from '../api/attemptApi';
import { selectSaveStatus } from '../store/answerSlice';
import type { RootState } from '../../../store/store';
import type { Question } from '../types/exam.types';

const WorkspacePage: React.FC = () => {
  const { attemptId: attemptIdStr } = useParams<{ attemptId: string }>();
  const attemptId = parseInt(attemptIdStr ?? '0', 10);
  const navigate = useNavigate();

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

  // Compute all questions and active part for QuestionPalette
  const currentSection = workspace?.exam_snapshot?.sections?.[0];
  const currentPart = currentSection?.parts?.[0];
  const partQuestions: Question[] = currentPart?.questions ?? [];
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
    return <div role="status" aria-live="polite" style={{ padding: 32 }}>Đang tải phiên thi...</div>;
  }

  if (error) {
    return (
      <div role="alert" style={{ padding: 32 }}>
        <p>{error}</p>
        <button onClick={retry}>Thử lại</button>
        <button onClick={() => navigate('/')}>Về trang chủ</button>
      </div>
    );
  }

  if (!workspace) return null;

  if (workspace.status === 'COMPLETED') {
    navigate(`/attempts/${attemptId}/result`);
    return null;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left: nội dung đề thi */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>{workspace.exam_snapshot?.title || 'Bài thi'}</h2>
          <SaveStatusBadge />
        </div>
        <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '400px' }}>
          {JSON.stringify(workspace.exam_snapshot, null, 2)}
        </pre>
      </div>

      {/* Right: Timer + Palette + Submit */}
      <div
        style={{
          width: 300,
          borderLeft: '1px solid #e5e7eb',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          backgroundColor: '#f9fafb',
        }}
      >
        <TimerDisplay displayTime={displayTime} isExpired={isExpired} isPractice={isPractice} />

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <QuestionPalette
            questions={partQuestions}
            partId={partId}
            onNavigate={(qId) => {
              const el = document.getElementById(`q-${qId}`);
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>

        <button
          disabled={isSubmitting}
          onClick={() => setShowConfirm(true)}
          style={{
            padding: '12px 20px',
            background: isSubmitting ? '#9ca3af' : '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
          }}
        >
          Nộp bài
        </button>
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
