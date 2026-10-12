import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Flame,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  DeckSummary,
  Flashcard,
  PracticeQuestionSnapshotDto,
  PracticeSessionSnapshotDto,
  SubmitPracticeResponse,
  SubmitPracticeAnswerDto,
} from '../../types/vocab.types';
import { vocabApi } from '../../api/vocabApi';
import { quizSessionStore } from '../../utils/quizSessionStore';
import { alertUtil } from '../../../../utils/alert';
import { ModeHeader } from '../../components/common/ModeHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { SpeakButton } from '../../components/common/SpeakButton';
import { SessionSummaryCard, type SessionStatItem } from '../../components/common/SessionSummaryCard';
import { QuizOptionButton } from './QuizOptionButton';
import { useSoundEffects } from '../../hooks/useSoundEffects';

export interface QuizPracticeViewProps {
  /** Thông tin bộ thẻ đang học */
  deck: DeckSummary;
  /** Danh sách các thẻ từ vựng trong bộ */
  cards: Flashcard[];
  /** Callback quay lại màn hình chi tiết bộ thẻ */
  onBack: () => void;
  /** Callback tùy chọn khi kết thúc bài học để refresh lại decks */
  onFinish?: () => void;
}

/**
 * Định dạng ký hiệu từ loại chuẩn quốc tế (n, v, adj, adv...)
 */
function formatPosAbbreviation(pos?: string): string {
  if (!pos) return '';
  const clean = pos.trim().toLowerCase().replace(/\.$/, '');
  switch (clean) {
    case 'noun':
    case 'danh từ':
    case 'n':
      return 'n';
    case 'verb':
    case 'động từ':
    case 'v':
      return 'v';
    case 'adjective':
    case 'tính từ':
    case 'adj':
      return 'adj';
    case 'adverb':
    case 'phó từ':
    case 'trạng từ':
    case 'adv':
      return 'adv';
    default:
      return clean.length <= 4 ? clean : clean;
  }
}

const UI_TEXT = {
  modeTitle: 'Luyện tập từ vựng',
  questionSubtitle: 'Chọn nghĩa chính xác',
  nextQuestionBtn: 'Câu tiếp theo',
  finishBtn: 'Hoàn thành & Xem kết quả',
  enterKey: 'Enter',
  exitConfirmMessage: 'Tiến độ bài luyện tập hiện tại sẽ không được lưu. Bạn có chắc chắn muốn rời khỏi không?',
  exitConfirmBtn: 'Rời khỏi',
  exitCancelBtn: 'Tiếp tục luyện tập',
  submittingNotice: 'Đang ghi nhận kết quả và điểm XP...',
  reviewMistakesTitle: 'Xem lại các từ trả lời chưa đúng',
};

export const QuizPracticeView: React.FC<QuizPracticeViewProps> = ({
  deck,
  cards,
  onBack,
  onFinish,
}) => {
  const { playCorrectSound, playWrongSound, playVictorySound } = useSoundEffects();

  // --- Trạng thái phiên thi (Session) từ Backend ---
  const [session, setSession] = useState<PracticeSessionSnapshotDto | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, { selectedOptionId: string; isCorrect: boolean; timeSpentSeconds: number }>
  >({});
  const [currentSelectedOptionId, setCurrentSelectedOptionId] = useState<string | null>(null);
  const [isAnsweredCurrent, setIsAnsweredCurrent] = useState<boolean>(false);

  // Thời gian làm bài
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [totalElapsedTime, setTotalElapsedTime] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Trạng thái nộp bài & Kết quả ---
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<SubmitPracticeResponse | null>(null);
  const [showMistakes, setShowMistakes] = useState<boolean>(false);

  /**
   * Khởi tạo bài trắc nghiệm từ Backend API (Lấy mặc định tối đa 15 câu, hoặc bằng số từ có sẵn)
   */
  const initPracticeSession = useCallback(async () => {
    if (cards.length < 4) {
      setLoadingSession(false);
      return;
    }

    try {
      setLoadingSession(true);
      const snapshot = await vocabApi.createPracticeSession(deck.id, {
        filterStatus: 'ALL',
        limit: 15,
      });
      setSession(snapshot);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setCurrentSelectedOptionId(null);
      setIsAnsweredCurrent(false);
      setSubmissionResult(null);
      setTotalElapsedTime(0);
      setQuestionStartTime(Date.now());

      // Lưu tiến độ ban đầu
      quizSessionStore.saveProgress(snapshot.sessionId, 0, {}, 0);
    } catch (err: unknown) {
      console.error('Lỗi khi tạo phiên trắc nghiệm:', err);
      const msg = err instanceof Error ? err.message : 'Không đủ từ vựng để tạo bài luyện tập';
      alertUtil.toast(msg, 'error');
    } finally {
      setLoadingSession(false);
    }
  }, [deck.id, cards.length]);

  // Tự động khởi tạo phiên học khi vào chế độ Luyện tập
  useEffect(() => {
    initPracticeSession();
  }, [initPracticeSession]);

  // Bộ đếm thời gian tổng
  useEffect(() => {
    if (!loadingSession && session && !submissionResult) {
      timerRef.current = setInterval(() => {
        setTotalElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadingSession, session, submissionResult]);

  const currentQ: PracticeQuestionSnapshotDto | undefined = session?.questions[currentIndex];

  /**
   * Xử lý khi chọn một phương án (Phản hồi tức thì 0ms, tra correctOptionId gốc)
   */
  const handleSelectOption = useCallback(
    (optionId: string) => {
      if (isAnsweredCurrent || !currentQ || !session) return;

      const spentSec = Math.max(1, Math.round((Date.now() - questionStartTime) / 1000));
      setCurrentSelectedOptionId(optionId);
      setIsAnsweredCurrent(true);

      // So khớp trực tiếp với correctOptionId từ backend snapshot (0ms round-trip)
      const isCorrect = optionId.toUpperCase() === currentQ.correctOptionId.toUpperCase();
      if (isCorrect) {
        playCorrectSound();
      } else {
        playWrongSound();
      }

      const nextAnswers = {
        ...selectedAnswers,
        [currentQ.questionId]: {
          selectedOptionId: optionId,
          isCorrect,
          timeSpentSeconds: spentSec,
        },
      };
      setSelectedAnswers(nextAnswers);

      // Đồng bộ tiến độ vào LocalStorage
      const legacyAnswersFormat: Record<number, { selectedOption: string; timeSpentSeconds: number }> = {};
      Object.entries(nextAnswers).forEach(([qId, val]) => {
        legacyAnswersFormat[Number(qId)] = {
          selectedOption: val.selectedOptionId,
          timeSpentSeconds: val.timeSpentSeconds,
        };
      });
      quizSessionStore.saveProgress(
        session.sessionId,
        currentIndex,
        legacyAnswersFormat,
        totalElapsedTime
      );
    },
    [
      isAnsweredCurrent,
      currentQ,
      session,
      questionStartTime,
      selectedAnswers,
      currentIndex,
      totalElapsedTime,
      playCorrectSound,
      playWrongSound,
    ]
  );

  /**
   * Nộp kết quả lên Backend để ghi nhận PostgreSQL Receipt và nhận +10 XP
   */
  const handleSubmitQuiz = useCallback(async () => {
    if (!session) return;
    try {
      setIsSubmitting(true);

      const answerDtos: SubmitPracticeAnswerDto[] = session.questions.map((q) => {
        const recorded = selectedAnswers[q.questionId];
        return {
          questionId: q.questionId,
          selectedOptionId: recorded ? recorded.selectedOptionId : undefined,
        };
      });

      const result = await vocabApi.submitPracticeSession(session.sessionId, {
        durationSeconds: totalElapsedTime,
        answers: answerDtos,
      });

      setSubmissionResult(result);
      quizSessionStore.clearProgress(session.sessionId);
      playVictorySound();
      if (onFinish) onFinish();
    } catch (err: unknown) {
      console.error('Lỗi khi nộp bài luyện tập:', err);
      const msg = err instanceof Error ? err.message : 'Ghi nhận kết quả thất bại, vui lòng thử lại';
      alertUtil.toast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [session, selectedAnswers, totalElapsedTime, playVictorySound, onFinish]);

  /**
   * Chuyển sang câu tiếp theo hoặc tự động nộp bài ở câu cuối
   */
  const handleNext = useCallback(() => {
    if (!isAnsweredCurrent || !session) return;

    if (currentIndex + 1 < session.questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setCurrentSelectedOptionId(null);
      setIsAnsweredCurrent(false);
      setQuestionStartTime(Date.now());
    } else {
      // Câu cuối cùng -> Tự động nộp bài
      handleSubmitQuiz();
    }
  }, [isAnsweredCurrent, session, currentIndex, handleSubmitQuiz]);

  /**
   * Xác nhận thoát
   */
  const handleExit = useCallback(async () => {
    if (submissionResult) {
      onBack();
      return;
    }
    const isConfirmed = await alertUtil.confirm(
      UI_TEXT.exitConfirmMessage,
      UI_TEXT.exitConfirmBtn,
      UI_TEXT.exitCancelBtn
    );
    if (isConfirmed) {
      if (session) quizSessionStore.clearProgress(session.sessionId);
      onBack();
    }
  }, [submissionResult, session, onBack]);

  /**
   * Lắng nghe phím tắt: 1-4 chọn phương án, Enter câu tiếp theo, Esc thoát
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (submissionResult || isSubmitting) return;

      if (!isAnsweredCurrent && currentQ) {
        const optionKeys = ['1', '2', '3', '4'];
        const keyIndex = optionKeys.indexOf(e.key);
        if (keyIndex !== -1 && keyIndex < currentQ.options.length) {
          e.preventDefault();
          handleSelectOption(currentQ.options[keyIndex].optionId);
          return;
        }
      }

      if (isAnsweredCurrent && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleNext();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    submissionResult,
    isSubmitting,
    isAnsweredCurrent,
    currentQ,
    handleSelectOption,
    handleNext,
    handleExit,
  ]);

  // =========================================================================
  // GIAO DIỆN A: KHÔNG ĐỦ TỪ VỰNG (< 4 TỪ)
  // =========================================================================
  if (cards.length < 4) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-100/90 backdrop-blur-xs flex items-center justify-center p-4 select-none">
        <EmptyState
          title="Không đủ từ vựng để luyện tập"
          description={`Bộ thẻ hiện có ${cards.length} thẻ. Cần tối thiểu 4 từ vựng để tạo bài trắc nghiệm 4 đáp án.`}
          actionText="Quay lại bộ thẻ"
          onAction={onBack}
        />
      </div>
    );
  }

  // =========================================================================
  // GIAO DIỆN B: ĐANG TẢI PHIÊN LUYỆN TẬP TỪ REDIS
  // =========================================================================
  if (loadingSession) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-100/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-slate-600 font-semibold select-none">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm sm:text-base">Đang chuẩn bị bài luyện tập từ vựng...</p>
      </div>
    );
  }

  // =========================================================================
  // GIAO DIỆN C: MÀN HÌNH TỔNG KẾT & VINH DANH (SUBMISSION RESULT)
  // =========================================================================
  if (submissionResult) {
    const wrongQuestions = submissionResult.wrongAnswers || [];

    const extraStats: SessionStatItem[] = [
      {
        label: 'Chuỗi Streak',
        value: `${submissionResult.currentStreak} ngày`,
        icon: <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />,
        colorClass: 'text-amber-600',
      },
      {
        label: 'Thời gian làm bài',
        value: `${Math.floor(submissionResult.timeSpentSeconds / 60)}p ${
          submissionResult.timeSpentSeconds % 60
        }s`,
        icon: <Clock className="w-4 h-4 text-slate-400" />,
        colorClass: 'text-slate-700',
      },
    ];

    return (
      <div className="fixed inset-0 z-[200] bg-slate-100/90 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none">
        <div className="w-full max-w-2xl my-auto animate-in fade-in duration-200">
          <SessionSummaryCard
            title="Hoàn thành bài luyện tập!"
            subtitle={`Bộ thẻ: ${deck.name}`}
            earnedXp={submissionResult.xpEarned}
            accuracyPercent={submissionResult.accuracyPercent}
            correctCount={submissionResult.correctAnswers}
            correctCountLabel="Trả lời đúng"
            incorrectCount={submissionResult.totalQuestions - submissionResult.correctAnswers}
            incorrectCountLabel="Trả lời sai"
            totalCards={submissionResult.totalQuestions}
            totalCardsLabel="Tổng số câu"
            extraStats={extraStats}
            onPlayAgain={initPracticeSession}
            playAgainText="Luyện tập lại"
            onBackToDeck={onBack}
            backToDeckText="Quay lại bộ thẻ"
          >
            {/* Danh sách các câu làm sai */}
            {wrongQuestions.length > 0 && (
              <div className="mt-5 text-left border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMistakes((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs sm:text-sm font-bold text-slate-700 hover:text-amber-600 transition-colors py-1 cursor-pointer"
                >
                  <span>
                    {UI_TEXT.reviewMistakesTitle} ({wrongQuestions.length})
                  </span>
                  {showMistakes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showMistakes && (
                  <div className="mt-2.5 space-y-2 max-h-60 overflow-y-auto pr-1">
                    {wrongQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm"
                      >
                        <div className="font-bold text-slate-900 mb-1">{q.word}</div>
                        <div className="flex items-center gap-2 text-rose-600 mb-0.5">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Đã chọn: Phương án {q.selectedOptionId || '(Chưa chọn)'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Đáp án đúng: Phương án {q.correctOptionId} ({q.correctMeaning})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </SessionSummaryCard>
        </div>
      </div>
    );
  }

  // Nếu session rỗng hoặc lỗi
  if (!session || !currentQ) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-100/90 backdrop-blur-xs flex items-center justify-center p-4 select-none">
        <EmptyState
          title="Không tìm thấy câu hỏi"
          description="Không thể tải bộ câu hỏi luyện tập. Vui lòng quay lại bộ thẻ."
          actionText="Quay lại bộ thẻ"
          onAction={onBack}
        />
      </div>
    );
  }

  // =========================================================================
  // GIAO DIỆN D: PHÒNG LÀM BÀI TRẮC NGHIỆM TOÀN MÀN HÌNH (FOCUS IMMERSION MODE)
  // =========================================================================
  const shortcutNumbers = ['1', '2', '3', '4'];
  const targetWord = currentQ.targetWord || '';
  const posAbbr = formatPosAbbreviation(currentQ.pos);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-100/90 backdrop-blur-xs flex flex-col justify-between overflow-y-auto overflow-x-hidden select-none">
      {/* 1. Header trên cùng: Tên bộ thẻ, tiến trình và nút thoát */}
      <ModeHeader
        title={UI_TEXT.modeTitle}
        deckName={deck.name}
        currentIndex={currentIndex + 1}
        totalItems={session.questions.length}
        onBack={handleExit}
      />

      {/* 2. Khối làm bài trung tâm */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6 w-full max-w-3xl mx-auto my-auto min-h-0">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sm:p-8 w-full animate-in fade-in duration-150">
          {/* Hàng trên: Ký hiệu từ loại, âm thanh */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Câu {currentIndex + 1} / {session.questions.length}
              </span>
              {posAbbr && (
                <span className="text-xs font-serif italic text-slate-400">
                  {posAbbr}.
                </span>
              )}
              {currentQ.phonetic && (
                <span className="text-xs text-slate-400 font-mono">
                  {currentQ.phonetic}
                </span>
              )}
            </div>
            {targetWord && (
              <SpeakButton
                text={targetWord}
                langCode={deck.targetLanguage}
                size="sm"
              />
            )}
          </div>

          {/* Từ vựng đích to, rõ */}
          {targetWord && (
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
              {targetWord}
            </h1>
          )}

          {/* Câu ví dụ ngữ cảnh (nếu có) */}
          {currentQ.sentence && (
            <p className="text-xs sm:text-sm text-slate-500 italic mb-4">
              &quot;{currentQ.sentence}&quot;
            </p>
          )}

          <p className="text-sm sm:text-base text-slate-600 font-medium mb-6">
            {UI_TEXT.questionSubtitle}
          </p>

          {/* 3. Bốn phương án lựa chọn A, B, C, D */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {currentQ.options.map((option, idx) => {
              const isSelected = currentSelectedOptionId === option.optionId;
              const isCorrect = option.optionId.toUpperCase() === currentQ.correctOptionId.toUpperCase();

              return (
                <QuizOptionButton
                  key={option.optionId}
                  label={option.optionId}
                  optionText={option.text}
                  isSelected={isSelected}
                  isCorrect={isCorrect}
                  isAnswered={isAnsweredCurrent}
                  shortcutKey={shortcutNumbers[idx] || ''}
                  onSelect={() => handleSelectOption(option.optionId)}
                />
              );
            })}
          </div>

          {/* Giải thích sau khi chọn (nếu có) */}
          {isAnsweredCurrent && currentQ.explanation && (
            <div className="mb-4 p-3 rounded-md bg-amber-50/60 border border-amber-200/80 text-xs sm:text-sm text-amber-900 animate-in fade-in duration-150">
              <span className="font-bold">Giải thích: </span>
              <span>{currentQ.explanation}</span>
            </div>
          )}

          {/* 4. Thanh điều hướng phía dưới */}
          {isAnsweredCurrent && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 animate-in fade-in duration-150">
              <div className="text-xs sm:text-sm text-slate-500">
                Nhấn <kbd className="px-1.5 py-0.5 rounded border border-slate-300 font-mono text-xs">Enter</kbd> hoặc <kbd className="px-1.5 py-0.5 rounded border border-slate-300 font-mono text-xs">Space</kbd> để tiếp tục
              </div>
              <button
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-md bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-sm shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>
                  {currentIndex + 1 < session.questions.length
                    ? UI_TEXT.nextQuestionBtn
                    : isSubmitting
                    ? UI_TEXT.submittingNotice
                    : UI_TEXT.finishBtn}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
