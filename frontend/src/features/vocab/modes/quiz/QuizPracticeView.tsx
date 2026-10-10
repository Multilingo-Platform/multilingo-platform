import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import type { DeckSummary, Flashcard } from '../../types/vocab.types';
import { alertUtil } from '../../../../utils/alert';
import { ModeHeader } from '../../components/common/ModeHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { SpeakButton } from '../../components/common/SpeakButton';
import { SessionSummaryCard } from '../../components/common/SessionSummaryCard';
import { QuizOptionButton } from './QuizOptionButton';
import { generateQuizQuestions } from '../../utils/distractorGenerator';

export interface QuizPracticeViewProps {
  /** Thông tin bộ thẻ đang học */
  deck: DeckSummary;
  /** Danh sách các thẻ từ vựng trong bộ */
  cards: Flashcard[];
  /** Callback quay lại màn hình chi tiết bộ thẻ */
  onBack: () => void;
  /** Callback tùy chọn khi kết thúc bài học */
  onFinish?: () => void;
}

/**
 * Chuyển đổi từ loại sang ký hiệu chuẩn từ điển quốc tế (n., v., adj., adv...)
 * Không viền, không nền - tinh tế chuẩn học thuật
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
    case 'preposition':
    case 'giới từ':
    case 'prep':
      return 'prep';
    case 'conjunction':
    case 'liên từ':
    case 'conj':
      return 'conj';
    case 'pronoun':
    case 'đại từ':
    case 'pron':
      return 'pron';
    case 'interjection':
    case 'thán từ':
    case 'interj':
      return 'interj';
    default:
      return clean.length <= 4 ? clean : clean;
  }
}

// Từ điển văn bản giao diện (tập trung, đồng bộ tông màu và phong cách dự án)
const UI_TEXT = {
  modeTitle: 'Luyện tập từ vựng',
  questionSubtitle: 'Chọn nghĩa chính xác',
  correctFeedbackTitle: 'Chính xác! Bạn đã chọn đúng.',
  incorrectFeedbackTitle: (correctAnswer: string) => `Chưa chính xác. Đáp án đúng là: "${correctAnswer}"`,
  exampleContextLabel: 'Ngữ cảnh ví dụ:',
  nextQuestionBtn: 'Câu tiếp theo',
  finishBtn: 'Xem kết quả',
  enterKey: 'Enter',
  exitConfirmMessage: 'Tiến độ bài luyện tập hiện tại sẽ không được lưu. Bạn có chắc chắn muốn rời khỏi không?',
  exitConfirmBtn: 'Rời khỏi',
  exitCancelBtn: 'Tiếp tục luyện tập',
  emptyState: {
    title: 'Chưa đủ từ vựng để luyện tập',
    description: (count: number) =>
      `Chế độ Luyện tập cần tối thiểu 4 thẻ từ vựng trong bộ thẻ để tạo các câu hỏi trắc nghiệm A, B, C, D. Hiện tại bộ thẻ mới có ${count} thẻ.`,
    action: 'Quay lại bộ thẻ',
  },
  summary: {
    title: 'Hoàn thành bài luyện tập!',
    subtitle: 'Bạn đã hoàn thành xuất sắc bài luyện tập trắc nghiệm.',
    totalQuestionsLabel: 'Số câu hỏi',
    correctLabel: 'Trả lời đúng',
    incorrectLabel: 'Trả lời sai',
    playAgainBtn: 'Luyện tập lại',
    backToDeckBtn: 'Quay lại bộ thẻ',
  },
};

/**
 * Component Chế độ Học từ vựng Trắc nghiệm (UC012.4)
 *
 * CẢI TIẾN THEO YÊU CẦU:
 * 1. Dùng popup dùng chung của hệ thống (alertUtil.confirm) thay vì modal tự chế.
 * 2. Mở rộng kích thước khung thoáng đãng (max-w-3xl, padding cân đối).
 * 3. Đồng nhất phông chữ và bảng màu với thương hiệu Multilingo (Amber/Slate theme).
 * 4. Ký hiệu từ loại chuẩn từ điển (n., v., adj...) phẳng, không viền, không nền.
 */
export const QuizPracticeView: React.FC<QuizPracticeViewProps> = ({
  deck,
  cards,
  onBack,
  onFinish,
}) => {
  // Sinh danh sách câu hỏi chuẩn từ distractorGenerator
  const questions = useMemo(() => generateQuizQuestions(cards), [cards]);

  // Trạng thái câu hỏi hiện tại
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  // Thống kê phiên học
  const [score, setScore] = useState(0);
  const [wrongCards, setWrongCards] = useState<Flashcard[]>([]);

  // Trạng thái kết thúc phiên
  const [isFinished, setIsFinished] = useState(false);

  const currentQ = questions[currentIndex];
  const correctOption = currentQ?.options.find((opt) => opt.isCorrect);
  const isSelectedCorrect = currentQ?.options.find((opt) => opt.key === selectedKey)?.isCorrect ?? false;
  const shortcutNumbers = ['1', '2', '3', '4'];
  const posAbbr = formatPosAbbreviation(currentQ?.pos);
  const formattedPhonetic = currentQ?.phonetic
    ? currentQ.phonetic.trim().startsWith('/')
      ? currentQ.phonetic.trim()
      : `/${currentQ.phonetic.trim()}/`
    : null;

  /**
   * Xử lý xác nhận thoát bằng popup dùng chung của hệ thống (alertUtil.confirm)
   */
  const handleExit = useCallback(async () => {
    const isConfirmed = await alertUtil.confirm(
      UI_TEXT.exitConfirmMessage,
      UI_TEXT.exitConfirmBtn,
      UI_TEXT.exitCancelBtn
    );
    if (isConfirmed) {
      onBack();
    }
  }, [onBack]);

  /**
   * Xử lý khi người dùng chọn một phương án
   */
  const handleSelectOption = useCallback(
    (key: string) => {
      if (isAnswered || isFinished || !currentQ) return;

      setSelectedKey(key);
      setIsAnswered(true);

      const chosen = currentQ.options.find((opt) => opt.key === key);
      if (chosen?.isCorrect) {
        setScore((prev) => prev + 1);
      } else {
        if (currentQ.card) {
          setWrongCards((prev) => [...prev, currentQ.card!]);
        }
      }
    },
    [isAnswered, isFinished, currentQ]
  );

  /**
   * Chuyển sang câu hỏi tiếp theo hoặc kết thúc
   */
  const handleNext = useCallback(() => {
    if (!isAnswered) return;

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedKey(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
      if (onFinish) onFinish();
    }
  }, [isAnswered, currentIndex, questions.length, onFinish]);

  /**
   * Lắng nghe phím tắt bàn phím (1-4 chọn phương án, Enter/Space tiếp tục, Esc thoát)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Enter hoặc Space: Chuyển câu tiếp theo khi đã trả lời xong
      if (e.code === 'Enter' || e.code === 'Space') {
        if (isAnswered) {
          e.preventDefault();
          handleNext();
        }
      }

      // Phím 1, 2, 3, 4: Chọn phương án khi chưa trả lời
      if (!isAnswered && currentQ) {
        const keyIndex = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
        if (keyIndex !== -1 && currentQ.options[keyIndex]) {
          e.preventDefault();
          handleSelectOption(currentQ.options[keyIndex].key);
        }
      }

      // Esc: Mở popup xác nhận thoát dùng chung
      if (e.code === 'Escape') {
        e.preventDefault();
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, currentQ, isFinished, handleNext, handleSelectOption, handleExit]);

  /**
   * Khởi động lại phiên học từ đầu
   */
  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setSelectedKey(null);
    setIsAnswered(false);
    setScore(0);
    setWrongCards([]);
    setIsFinished(false);
  }, []);

  // ========================================================
  // A. NGOẠI LỆ: BỘ THẺ DƯỚI 4 TỪ VỰNG
  // ========================================================
  if (questions.length < 4) {
    return (
      <div className="fixed inset-0 z-[150] bg-slate-50 flex flex-col justify-between overflow-hidden select-none font-sans">
        <ModeHeader
          title={UI_TEXT.modeTitle}
          deckName={deck.name}
          onBack={onBack}
          confirmOnBack={false}
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <EmptyState
            title={UI_TEXT.emptyState.title}
            description={UI_TEXT.emptyState.description(cards.length)}
            actionText={UI_TEXT.emptyState.action}
            onAction={onBack}
          />
        </div>
      </div>
    );
  }

  // ========================================================
  // B. MÀN HÌNH TỔNG KẾT PHIÊN HỌC (GIAO DIỆN HÀI HÒA, THANH LỊCH)
  // ========================================================
  if (isFinished) {
    const accuracy =
      questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const earnedXp = 15 + score * 2;
    const incorrectCount = questions.length - score;

    return (
      <div className="fixed inset-0 z-[150] bg-slate-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans select-none">
        <SessionSummaryCard
          title={UI_TEXT.summary.title}
          subtitle={UI_TEXT.summary.subtitle}
          earnedXp={earnedXp}
          accuracyPercent={accuracy}
          totalCards={questions.length}
          totalCardsLabel={UI_TEXT.summary.totalQuestionsLabel}
          correctCount={score}
          correctCountLabel={UI_TEXT.summary.correctLabel}
          incorrectCount={incorrectCount}
          incorrectCountLabel={UI_TEXT.summary.incorrectLabel}
          onPlayAgain={handleRestart}
          playAgainText={UI_TEXT.summary.playAgainBtn}
          onBackToDeck={onBack}
          backToDeckText={UI_TEXT.summary.backToDeckBtn}
        />
      </div>
    );
  }

  // ========================================================
  // C. PHÒNG HỌC TRẮC NGHIỆM CHÍNH (CÂN ĐỐI TỈ LỆ - MAX-W-2XL)
  // ========================================================
  return (
    <div className="fixed inset-0 z-[150] bg-slate-50 flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* 1. Header trên cùng: Nút Thoát, Tên Deck, Bộ đếm tiến độ */}
      <ModeHeader
        title={UI_TEXT.modeTitle}
        deckName={deck.name}
        currentIndex={currentIndex + 1}
        totalItems={questions.length}
        onBack={handleExit}
        confirmOnBack={false}
      />

      {/* 2. Khu vực câu hỏi chính (Cân đối tỉ lệ - max-w-2xl) */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center max-w-2xl mx-auto px-4 sm:px-6 py-4 w-full">
        {/* Thẻ câu hỏi trung tâm (Question Card) */}
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-xs p-6 sm:p-7 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {UI_TEXT.questionSubtitle}
            </span>

            {/* Nút nghe phát âm chuẩn Web Speech API */}
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <SpeakButton
                text={currentQ.targetWord}
                langCode={deck.targetLanguage}
                size="md"
                className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
              />
            </div>
          </div>

          {/* Dòng 1: Từ vựng mục tiêu + Ký hiệu từ loại (n, v, adj...) phẳng không viền */}
          <div className="flex items-baseline gap-3">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
              {currentQ.targetWord}
            </h2>

            {/* Ký hiệu từ loại phẳng, không viền, không có dấu chấm */}
            {posAbbr && (
              <span className="text-slate-400 font-medium text-sm sm:text-base italic select-none">
                {posAbbr}
              </span>
            )}
          </div>

          {/* Dòng 2: Phiên âm IPA riêng biệt xuống dòng mới */}
          {formattedPhonetic && (
            <div className="mt-1.5 text-slate-400 font-mono text-sm sm:text-base">
              {formattedPhonetic}
            </div>
          )}
        </div>

        {/* Lưới 4 phương án A, B, C, D */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
          {currentQ.options.map((option, idx) => (
            <QuizOptionButton
              key={`${currentQ.cardId}-${option.key}`}
              label={option.key}
              shortcutKey={shortcutNumbers[idx]}
              optionText={option.text}
              isSelected={selectedKey === option.key}
              isCorrect={option.isCorrect}
              isAnswered={isAnswered}
              onSelect={() => handleSelectOption(option.key)}
            />
          ))}
        </div>
      </main>

      {/* 3. Thanh điều khiển đáy màn hình (Feedback Bar & Nút Tiếp tục) */}
      <footer className="w-full max-w-2xl mx-auto px-4 sm:px-6 pb-4 sm:pb-6 pt-1 shrink-0 min-h-[70px]">
        {isAnswered && (
          <div className="animate-in slide-in-from-bottom-2 fade-in duration-150 flex flex-col gap-2.5">
            {/* Hộp phản hồi Đúng / Sai */}
            <div
              className={`w-full rounded-lg border px-4 py-3 flex items-start gap-3 shadow-xs ${
                isSelectedCorrect
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/90 border-rose-200 text-rose-950'
              }`}
            >
              {isSelectedCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {isSelectedCorrect
                    ? UI_TEXT.correctFeedbackTitle
                    : UI_TEXT.incorrectFeedbackTitle(correctOption?.text || '')}
                </p>
                {currentQ.sentence && (
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    <span className="font-semibold text-slate-700">{UI_TEXT.exampleContextLabel}</span>{' '}
                    <span className="italic">"{currentQ.sentence}"</span>
                  </p>
                )}
              </div>
            </div>

            {/* Nút Tiếp tục / Xem kết quả (Màu chuẩn theme Multilingo: Amber-600) */}
            <button
              type="button"
              onClick={handleNext}
              className="w-full py-3.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-sm sm:text-base shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {currentIndex + 1 < questions.length
                  ? UI_TEXT.nextQuestionBtn
                  : UI_TEXT.finishBtn}
              </span>
              {currentIndex + 1 < questions.length ? (
                <ArrowRight className="w-4 h-4" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <kbd className="px-1.5 py-0.5 rounded bg-amber-500/40 text-xs font-mono font-medium text-amber-50">
                {UI_TEXT.enterKey}
              </kbd>
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
