import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Volume2,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Trophy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { DeckSummary, Flashcard } from '../../types/vocab';
import { speakWord } from '../../utils/speech';
import './vocab.css';

/**
 * Interface định nghĩa các Props cho Chế độ Ôn tập Flashcard SRS (SrsStudyView).
 */
interface SrsStudyViewProps {
  /** Thông tin của bộ thẻ đang học */
  deck: DeckSummary;
  /** Danh sách các thẻ từ vựng cần ôn tập */
  cards: Flashcard[];
  /** Callback quay lại màn hình danh sách thẻ hoặc bộ thẻ */
  onBack: () => void;
  /** Callback hoàn tất phiên ôn tập */
  onFinish?: () => void;
}

/**
 * Component Chế độ Ôn tập Flashcard Spaced Repetition (SRS 3D Flip Card).
 *
 * TÍNH NĂNG CHÍNH:
 * 1. Hiệu ứng lật thẻ 3D trực quan kế thừa từ bản thiết kế mẫu trong web-ui.
 * 2. Tích hợp Web Speech Synthesis API tự động phát âm chuẩn giọng bản xứ (targetLanguage) khi chuyển thẻ.
 * 3. Hỗ trợ phím tắt bàn phím (Keyboard Shortcuts):
 *    - Phím Space: Lật thẻ
 *    - Phím 1: Đánh giá Quên (1 ngày)
 *    - Phím 2: Đánh giá Khó (3 ngày)
 *    - Phím 3: Đánh giá Nhớ (7 ngày)
 *    - Phím Mũi tên Trái / Phải: Chuyển thẻ trước / sau
 * 4. Màn hình Chúc mừng hoàn thành phiên học khi ôn hết danh sách thẻ.
 */
export const SrsStudyView: React.FC<SrsStudyViewProps> = ({
  deck,
  cards,
  onBack,
  onFinish,
}) => {
  // --- Quản lý State cho phiên ôn tập ---
  const [currentIndex, setCurrentIndex] = useState(0);    // Vị trí thẻ hiện tại (0-indexed)
  const [isFlipped, setIsFlipped] = useState(false);        // Trạng thái thẻ đang lật (Mặt trước <-> Mặt sau)
  const [isCompleted, setIsCompleted] = useState(false);    // Trạng thái đã hoàn thành toàn bộ thẻ trong phiên

  // Lấy thẻ từ vựng hiện tại đang hiển thị
  const currentCard = cards[currentIndex];

  /**
   * Phát âm từ vựng của thẻ hiện tại bằng giọng đọc bản xứ theo ngôn ngữ của bộ thẻ
   */
  const handleSpeakCurrentWord = useCallback(() => {
    if (currentCard?.customWord) {
      speakWord(currentCard.customWord, deck.targetLanguage);
    }
  }, [currentCard, deck.targetLanguage]);

  /**
   * Tự động phát âm mỗi khi chuyển sang thẻ mới
   */
  useEffect(() => {
    if (currentCard && !isCompleted) {
      setIsFlipped(false); // Reset về mặt trước khi đổi thẻ
      handleSpeakCurrentWord();
    }
  }, [currentIndex, currentCard, isCompleted, handleSpeakCurrentWord]);

  /**
   * Xử lý đánh giá mức độ ghi nhớ SRS (Quên / Khó / Nhớ)
   * Trong tương lai sẽ gọi API cập nhật intervalDays, easeFactor và nextReviewDate
   */
  const handleRateCard = (rating: 'AGAIN' | 'HARD' | 'GOOD') => {
    console.log(`Đánh giá thẻ #${currentCard.id} ('${currentCard.customWord}'): ${rating}`);

    if (currentIndex < cards.length - 1) {
      // Chuyển sang thẻ tiếp theo
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Đã hoàn tất toàn bộ danh sách thẻ
      setIsCompleted(true);
      if (onFinish) onFinish();
    }
  };

  /**
   * Chuyển về thẻ phía trước
   */
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  /**
   * Chuyển sang thẻ phía sau
   */
  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  /**
   * Lắng nghe phím tắt bàn phím tiện lợi
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Nếu đang trong màn hình hoàn tất thì bỏ qua phím tắt
      if (isCompleted) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === '1' && isFlipped) {
        handleRateCard('AGAIN');
      } else if (e.key === '2' && isFlipped) {
        handleRateCard('HARD');
      } else if (e.key === '3' && isFlipped) {
        handleRateCard('GOOD');
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, currentIndex, cards.length, isCompleted]);

  // ========================================================
  // 1. MÀN HÌNH CHÚC MỪNG HOÀN THÀNH PHIÊN ÔN TẬP
  // ========================================================
  if (isCompleted || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-8 bg-white rounded-3xl border border-gray-200/80 shadow-sm max-w-xl mx-auto animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-6 shadow-inner">
          <Trophy size={42} />
        </div>

        <span className="badge badge-orange text-xs font-bold uppercase tracking-wider mb-2">
          Xuất sắc!
        </span>

        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
          Đã hoàn thành phiên ôn tập!
        </h2>

        <p className="text-sm text-gray-600 max-w-md mb-8">
          Bạn đã hoàn thành ôn tập <strong>{cards.length}</strong> thẻ từ vựng trong bộ thẻ{' '}
          <strong className="text-amber-700">"{deck.name}"</strong>. Hệ thống SRS sẽ tự động xếp lịch ôn tập tối ưu cho bạn ở các ngày tiếp theo.
        </p>

        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn btn-outline text-sm py-2.5">
            <ArrowLeft size={16} /> Quay lại danh sách
          </button>
          <button
            onClick={() => {
              setCurrentIndex(0);
              setIsCompleted(false);
            }}
            className="btn btn-primary text-sm py-2.5 flex items-center gap-1.5"
          >
            <RefreshCcw size={16} /> Ôn tập lại từ đầu
          </button>
        </div>
      </div>
    );
  }

  // Tính phần trăm tiến độ ôn tập
  const progressPercent = Math.round(((currentIndex + 1) / cards.length) * 100);

  return (
    <div className="flex flex-col items-center max-w-2xl mx-auto gap-6">
      {/* ========================================================
          2. THANH TIẾN ĐỘ & NÚT THOÁT
         ======================================================== */}
      <div className="w-full flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-amber-600 transition cursor-pointer"
        >
          <ArrowLeft size={16} /> Dừng phiên học
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-600">
            Thẻ {currentIndex + 1} / {cards.length}
          </span>
          <div className="w-32 h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. CONTAINER THẺ FLASHCARD (CLEAN FLAT DESIGN)
         ======================================================== */}
      <div
        className="w-full max-w-lg bg-white rounded-2xl border-2 border-gray-100 shadow-md p-6 sm:p-8 flex flex-col justify-between min-h-[420px] select-none cursor-pointer transition hover:border-amber-200 hover:shadow-lg"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {!isFlipped ? (
          /* MẶT TRƯỚC: Từ vựng, phát âm, phiên âm */
          <div className="flex flex-col justify-between h-full min-h-[360px]">
            <div className="flex items-center justify-between w-full">
              <span className="badge badge-orange font-bold text-xs uppercase">
                {currentCard.pos || deck.targetLanguage.toUpperCase()}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSpeakCurrentWord();
                }}
                className="p-2.5 rounded-full text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                title="Nghe phát âm chuẩn"
              >
                <Volume2 size={24} />
              </button>
            </div>

            <div className="text-center my-auto py-6">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-amber-700 tracking-tight mb-3">
                {currentCard.customWord}
              </h2>

              {currentCard.phonetic && (
                <div className="text-base font-mono text-gray-500 bg-gray-100 px-4 py-1.5 rounded-full inline-block">
                  {currentCard.phonetic}
                </div>
              )}
            </div>

            <p className="text-center text-sm text-gray-400 font-medium">
              Click vào thẻ hoặc nhấn <kbd className="px-2 py-0.5 bg-gray-100 border rounded text-xs font-mono text-gray-600">Space</kbd> để lật xem nghĩa
            </p>
          </div>
        ) : (
          /* MẶT SAU: Nghĩa, ví dụ, bộ nút đánh giá SRS */
          <div className="flex flex-col justify-between h-full min-h-[360px]">
            <div className="flex items-center justify-between w-full border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-800">{currentCard.customWord}</span>
                <span className="text-xs text-gray-400">({deck.targetLanguage.toUpperCase()})</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSpeakCurrentWord();
                }}
                className="p-2 rounded-full text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                title="Nghe phát âm"
              >
                <Volume2 size={20} />
              </button>
            </div>

            <div className="my-auto py-4 flex flex-col gap-3.5">
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-snug">
                {currentCard.customMeaning || 'Chưa có giải nghĩa'}
              </h3>

              {currentCard.exampleSentence && (
                <div className="bg-amber-50/70 p-4 rounded-xl border-l-4 border-amber-500 text-sm text-gray-700 italic leading-relaxed">
                  "{currentCard.exampleSentence}"
                </div>
              )}
            </div>

            {/* Bộ điều khiển đánh giá Spaced Repetition (SRS Buttons) */}
            <div
              className="pt-3 border-t border-gray-100 flex items-center gap-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => handleRateCard('AGAIN')}
                className="btn btn-outline flex-1 py-2.5 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 flex items-center justify-center gap-1.5 cursor-pointer rounded-lg"
                title="Phím tắt: 1"
              >
                <XCircle size={16} /> Quên (1d)
              </button>

              <button
                type="button"
                onClick={() => handleRateCard('HARD')}
                className="btn btn-outline flex-1 py-2.5 text-xs font-bold text-amber-600 border-amber-200 hover:bg-amber-50 flex items-center justify-center gap-1.5 cursor-pointer rounded-lg"
                title="Phím tắt: 2"
              >
                <RefreshCcw size={16} /> Khó (3d)
              </button>

              <button
                type="button"
                onClick={() => handleRateCard('GOOD')}
                className="btn btn-outline flex-1 py-2.5 text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 flex items-center justify-center gap-1.5 cursor-pointer rounded-lg"
                title="Phím tắt: 3"
              >
                <CheckCircle size={16} /> Nhớ (7d)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          4. THANH ĐIỀU HƯỚNG TRƯỚC / SAU & GỢI Ý PHÍM TẮT
         ======================================================== */}
      <div className="w-full flex items-center justify-between text-xs text-gray-400">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-1 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400 transition cursor-pointer"
        >
          <ChevronLeft size={16} /> Thẻ trước
        </button>

        <span className="hidden sm:inline-block">
          Phím tắt: <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Space</kbd> Lật • <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">1/2/3</kbd> Đánh giá
        </span>

        <button
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          className="inline-flex items-center gap-1 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400 transition cursor-pointer"
        >
          Thẻ sau <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
