import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Clock,
  Flag,
  ArrowLeft,
  ArrowRight,
  Send,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import type { DeckSummary, Flashcard } from '../../types/vocab.types';
import type { VocabTestExam } from '../../types/vocabTest.types';
import { vocabTestApi } from '../../api/vocabTestApi';
import { useVocabTestProgress } from '../../hooks/useVocabTestProgress';
import { TestQuestionPalette } from './TestQuestionPalette';
import { VocabTestReviewView } from './VocabTestReviewView';
import { SpeakButton } from '../../components/common/SpeakButton';
import { EmptyState } from '../../components/common/EmptyState';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { alertUtil } from '../../../../utils/alert';

export interface VocabTestViewProps {
  deck: DeckSummary;
  cards?: Flashcard[];
  onBack: () => void;
  initialTestToken?: string;
}

type TestStage = 'INITIALIZING' | 'TESTING' | 'SUBMITTING' | 'REVIEW';

export const VocabTestView: React.FC<VocabTestViewProps> = ({
  deck,
  cards = [],
  onBack,
  initialTestToken,
}) => {
  const [stage, setStage] = useState<TestStage>('INITIALIZING');
  const [exam, setExam] = useState<VocabTestExam | null>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const [reviewToken, setReviewToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { playVictorySound } = useSoundEffects();
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serverTimeOffsetRef = useRef<number>(0);

  // Hook quản lý câu trả lời & Autosave CAS
  const {
    answersMap,
    confirmedVersion,
    saveStatus,
    selectAnswer,
    toggleFlag,
    flushSave,
    getAnswersArray,
  } = useVocabTestProgress({
    testToken: exam?.testToken || '',
    initialVersion: 0,
    isReadOnly: stage === 'SUBMITTING' || stage === 'REVIEW',
    onConflict: () => {
      alertUtil.toast('Tiến độ làm bài đã được đồng bộ lại từ máy chủ.', 'warning');
    },
  });

  // 1. Khởi tạo hoặc Khôi phục đề thi
  const initializeTest = useCallback(async () => {
    setStage('INITIALIZING');
    setErrorMessage(null);

    try {
      const storageKey = `multilingo_vocab_test_${deck.id}`;
      const savedToken = initialTestToken || localStorage.getItem(storageKey);

      if (savedToken) {
        try {
          const resumed = await vocabTestApi.resumeTest(savedToken);

          if (resumed.status === 'COMPLETED' || resumed.status === 'TIMED_OUT' || resumed.deadlinePassed) {
            localStorage.removeItem(storageKey);
            setReviewToken(savedToken);
            setStage('REVIEW');
            return;
          }

          // Resume hợp lệ
          const offset = new Date(resumed.serverTime).getTime() - Date.now();
          serverTimeOffsetRef.current = offset;

          const remaining = Math.max(
            0,
            Math.floor((new Date(resumed.expiresAt).getTime() - (Date.now() + offset)) / 1000)
          );

          setExam({
            testToken: resumed.testToken,
            deckId: resumed.deckId,
            deckName: resumed.deckName,
            timeLimitSeconds: resumed.timeLimitSeconds,
            totalQuestions: resumed.totalQuestions,
            startedAt: resumed.startedAt,
            expiresAt: resumed.expiresAt,
            serverTime: resumed.serverTime,
            questions: resumed.questions,
          });

          setSecondsLeft(remaining);
          setStage('TESTING');
          return;
        } catch {
          // Token cũ hết hạn hoặc không hợp lệ -> xóa cache và tạo đề mới
          localStorage.removeItem(storageKey);
        }
      }

      // Tạo đề thi mới
      const newExam = await vocabTestApi.generateTest(deck.id, 10);
      localStorage.setItem(storageKey, newExam.testToken);

      const offset = new Date(newExam.serverTime).getTime() - Date.now();
      serverTimeOffsetRef.current = offset;

      const remaining = Math.max(
        0,
        Math.floor((new Date(newExam.expiresAt).getTime() - (Date.now() + offset)) / 1000)
      );

      setExam(newExam);
      setSecondsLeft(remaining);
      setStage('TESTING');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorMessage(
        errorObj?.response?.data?.message || errorObj?.message || 'Không thể tạo đề thi thử.'
      );
      setStage('INITIALIZING');
    }
  }, [deck.id, initialTestToken]);

  useEffect(() => {
    initializeTest();
  }, [initializeTest]);

  // 2. Nộp bài thi
  const handleSubmitExam = useCallback(
    async (isAutoTimeout = false) => {
      if (!exam || stage === 'SUBMITTING' || stage === 'REVIEW') return;

      setStage('SUBMITTING');

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      try {
        await flushSave();
        const answers = getAnswersArray();
        const result = await vocabTestApi.submitTest(
          exam.testToken,
          confirmedVersion,
          answers
        );

        localStorage.removeItem(`multilingo_vocab_test_${deck.id}`);
        playVictorySound();
        setReviewToken(result.testToken);
        setStage('REVIEW');
      } catch (err: unknown) {
        const errorObj = err as { response?: { data?: { message?: string } } };
        alertUtil.toast(
          errorObj?.response?.data?.message || 'Có lỗi khi nộp bài. Đang chuyển sang xem kết quả.',
          'error'
        );
        localStorage.removeItem(`multilingo_vocab_test_${deck.id}`);
        setReviewToken(exam.testToken);
        setStage('REVIEW');
      }
    },
    [exam, stage, confirmedVersion, flushSave, getAnswersArray, deck.id, playVictorySound]
  );

  // 3. Quản lý đồng hồ đếm ngược
  useEffect(() => {
    if (stage !== 'TESTING' || !exam) return;

    timerIntervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          handleSubmitExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [stage, exam, handleSubmitExam]);

  // 4. Xử lý thoát phòng thi bằng alertUtil.confirm của hệ thống
  const handleExit = async () => {
    const confirmed = await alertUtil.confirm(
      'Thời gian đếm ngược của bài thi vẫn sẽ tiếp tục chạy trên máy chủ. Bạn có chắc chắn muốn rời phòng thi không?',
      'Rời phòng',
      'Tiếp tục thi'
    );
    if (confirmed) {
      await flushSave();
      onBack();
    }
  };

  // 5. Xử lý nộp bài bằng alertUtil.confirm của hệ thống
  const handleConfirmSubmit = async () => {
    if (!exam || stage === 'SUBMITTING') return;

    let answered = 0;
    for (let i = 1; i <= exam.totalQuestions; i++) {
      if (answersMap[i]?.selectedKey) answered++;
    }
    const unanswered = exam.totalQuestions - answered;

    let message = `Bạn đã hoàn thành ${answered}/${exam.totalQuestions} câu hỏi. Bạn có chắc chắn muốn nộp bài thi?`;
    if (unanswered > 0) {
      message = `Còn ${unanswered} câu chưa chọn đáp án. Bạn có chắc chắn muốn nộp bài thi ngay không?`;
    }

    const confirmed = await alertUtil.confirm(message, 'Nộp bài', 'Làm tiếp');
    if (confirmed) {
      handleSubmitExam(false);
    }
  };

  // 6. Xử lý phím tắt bàn phím khi làm bài
  useEffect(() => {
    if (stage !== 'TESTING' || !exam) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const q = exam.questions[currentIdx];
      if (!q) return;

      const keyUpper = e.key.toUpperCase();
      if (['1', 'A'].includes(keyUpper) && q.options[0]) {
        selectAnswer(q.questionNumber, q.options[0].key);
      } else if (['2', 'B'].includes(keyUpper) && q.options[1]) {
        selectAnswer(q.questionNumber, q.options[1].key);
      } else if (['3', 'C'].includes(keyUpper) && q.options[2]) {
        selectAnswer(q.questionNumber, q.options[2].key);
      } else if (['4', 'D'].includes(keyUpper) && q.options[3]) {
        selectAnswer(q.questionNumber, q.options[3].key);
      } else if (keyUpper === 'F') {
        toggleFlag(q.questionNumber);
      } else if (e.key === 'ArrowLeft') {
        if (currentIdx > 0) setCurrentIdx((prev) => prev - 1);
      } else if (e.key === 'ArrowRight') {
        if (currentIdx < exam.questions.length - 1) setCurrentIdx((prev) => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, exam, currentIdx, selectAnswer, toggleFlag]);

  // Định dạng thời gian MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- TRƯỜNG HỢP MÀN HÌNH REVIEW ---
  if (stage === 'REVIEW' && reviewToken) {
    return (
      <VocabTestReviewView
        testToken={reviewToken}
        onRetry={() => {
          setReviewToken(null);
          initializeTest();
        }}
        onBackToDeck={onBack}
      />
    );
  }

  // --- TRƯỜNG HỢP BỊ LỖI KHỞI TẠO HOẶC KHÔNG ĐỦ THẺ ---
  if (stage === 'INITIALIZING') {
    if (errorMessage) {
      return (
        <div className="fixed inset-0 z-[200] bg-slate-100 flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-md border border-slate-200 p-8 text-center max-w-md w-full shadow-sm animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-md bg-rose-50 text-rose-500 flex items-center justify-center mb-3 mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Không thể bắt đầu bài thi</h2>
            <p className="text-sm sm:text-base text-slate-600 mb-6 leading-relaxed">{errorMessage}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded transition-colors cursor-pointer"
              >
                Quay lại bộ thẻ
              </button>
              <button
                type="button"
                onClick={initializeTest}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded transition-colors cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[200] bg-slate-100 flex flex-col items-center justify-center p-4 select-none">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-600 font-semibold text-sm">Đang chuẩn bị đề thi thử...</p>
      </div>
    );
  }

  if (!exam || exam.questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-100 flex items-center justify-center p-4 select-none">
        <EmptyState
          title="Không tìm thấy câu hỏi"
          description="Bộ thẻ cần có ít nhất 4 từ vựng để tạo bài thi thử trắc nghiệm."
          actionText="Quay lại bộ thẻ"
          onAction={onBack}
        />
      </div>
    );
  }

  const currentQuestion = exam.questions[currentIdx];
  const currentAnswer = answersMap[currentQuestion.questionNumber];
  const isFlagged = !!currentAnswer?.flagged;

  let answeredCount = 0;
  for (let i = 1; i <= exam.totalQuestions; i++) {
    if (answersMap[i]?.selectedKey) answeredCount++;
  }

  const isTimerCritical = secondsLeft <= 60;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-100 flex flex-col justify-between overflow-y-auto overflow-x-hidden select-none">
      {/* 1. Header Phòng Thi Trải Dài Toàn Màn Hình */}
      <header className="w-full bg-white border-b border-slate-200 shadow-2xs shrink-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Nút thoát & Tiêu đề */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleExit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Rời phòng</span>
            </button>

            <h1 className="text-base font-bold text-slate-900 truncate">
              Thi thử từ vựng
            </h1>
          </div>

          {/* Vùng trung tâm: Đồng hồ đếm ngược */}
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md border font-mono font-bold text-base transition-colors ${
              isTimerCritical
                ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <Clock className={`w-4 h-4 ${isTimerCritical ? 'text-rose-500' : 'text-slate-500'}`} />
            <span>{formatTime(secondsLeft)}</span>
          </div>

          {/* Góc phải: Trạng thái lưu & Nút Nộp bài */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 text-sm text-slate-600 font-medium">
              {saveStatus === 'saving' && <span>Đang lưu...</span>}
              {saveStatus === 'saved' && <span className="text-emerald-600 font-semibold">Đã lưu</span>}
              {saveStatus === 'error' && <span className="text-rose-500 font-semibold">Lỗi lưu</span>}
            </div>

            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={stage === 'SUBMITTING'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Nộp bài ({answeredCount}/{exam.totalQuestions})</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Thân phòng thi: 2 cột */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Cột trái: Khối câu hỏi chính (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-md border border-slate-200 p-6 sm:p-7 shadow-xs">
            {/* Header câu hỏi */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
              <span className="text-sm font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                Câu {currentQuestion.questionNumber} / {exam.totalQuestions}
              </span>

              <button
                type="button"
                onClick={() => toggleFlag(currentQuestion.questionNumber)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold transition-colors cursor-pointer ${
                  isFlagged
                    ? 'bg-amber-100 text-amber-800'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Gắn cờ để kiểm tra lại trước khi nộp (Phím tắt: F)"
              >
                <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-600 text-amber-600' : ''}`} />
                <span>{isFlagged ? 'Đã gắn cờ' : 'Gắn cờ'}</span>
              </button>
            </div>

            {/* Từ vựng */}
            <div className="mb-5">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {currentQuestion.word}
                </h2>
                <SpeakButton text={currentQuestion.word} size="sm" />
                {currentQuestion.pos && (
                  <span className="text-sm font-serif italic text-slate-500 font-medium">
                    {currentQuestion.pos}.
                  </span>
                )}
              </div>

              {currentQuestion.phonetic && (
                <p className="text-sm sm:text-[15px] text-slate-500 font-mono">
                  {currentQuestion.phonetic}
                </p>
              )}

              {currentQuestion.sentence && (
                <p className="text-sm sm:text-[15px] text-slate-600 italic mt-2.5 bg-slate-50 px-3 py-2 rounded border border-slate-100">
                  &ldquo;{currentQuestion.sentence}&rdquo;
                </p>
              )}

              <p className="text-sm sm:text-base text-slate-700 font-semibold mt-4">
                Chọn nghĩa phù hợp nhất của từ:
              </p>
            </div>

            {/* Danh sách 4 lựa chọn A, B, C, D */}
            <div className="space-y-2.5 mb-2">
              {currentQuestion.options.map((option) => {
                const isSelected = currentAnswer?.selectedKey === option.key;

                let btnStyle =
                  'flex items-center gap-3 w-full min-h-[52px] sm:min-h-[56px] px-4 py-3 rounded-md border text-left text-[15px] sm:text-base transition-colors cursor-pointer select-none ';

                if (isSelected) {
                  btnStyle +=
                    'border-amber-500 bg-amber-50/70 text-slate-900 font-semibold shadow-2xs';
                } else {
                  btnStyle +=
                    'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/20 text-slate-800 font-medium';
                }

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => selectAnswer(currentQuestion.questionNumber, option.key)}
                    className={btnStyle}
                  >
                    <span
                      className={`w-7 h-7 rounded flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {option.key}
                    </span>
                    <span className="flex-1 leading-normal break-words">{option.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thanh điều hướng: Câu trước / Câu tiếp */}
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Câu trước</span>
            </button>

            {currentIdx < exam.questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIdx((prev) => Math.min(exam.questions.length - 1, prev + 1))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
              >
                <span>Câu tiếp theo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="inline-flex items-center gap-2 px-5 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
              >
                <span>Nộp bài ngay</span>
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Cột phải: Palette câu hỏi (4 cols) */}
        <div className="lg:col-span-4">
          <div className="sticky top-20 space-y-4">
            <TestQuestionPalette
              totalQuestions={exam.totalQuestions}
              currentQuestionNumber={currentQuestion.questionNumber}
              answersMap={answersMap}
              onSelectQuestion={(qNum) => setCurrentIdx(qNum - 1)}
            />

            {/* Mẹo phím tắt */}
            <div className="bg-slate-50 rounded-md border border-slate-200 p-3.5 text-sm text-slate-700 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1 text-sm">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <span>Phím tắt thao tác</span>
              </div>
              <p>• Phím <strong>1, 2, 3, 4</strong> (hoặc <strong>A, B, C, D</strong>): Chọn đáp án</p>
              <p>• Phím <strong>F</strong>: Gắn cờ câu hỏi để xem lại sau</p>
              <p>• Phím <strong>← / →</strong>: Chuyển câu hỏi trước/sau</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
