import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  Flame,
  Loader2,
} from 'lucide-react';
import type {
  DeckSummary,
  StudySessionCardDto,
  StudySessionSummaryResponse,
} from '../../types/vocab.types';
import { vocabApi } from '../../api/vocabApi';
import { ModeHeader } from '../../components/common/ModeHeader';
import { SessionSummaryCard } from '../../components/common/SessionSummaryCard';
import { EmptyState } from '../../components/common/EmptyState';
import { FlipCard } from './FlipCard';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { speakWord } from '../../../../utils/speech';
import Swal from 'sweetalert2';
import { alertUtil } from '../../../../utils/alert';

export interface SrsStudyViewProps {
  /** Thông tin bộ thẻ đang học */
  deck: DeckSummary;
  /** Callback quay lại màn hình chi tiết bộ thẻ */
  onBack: () => void;
  /** Callback tùy chọn khi kết thúc phiên */
  onFinish?: () => void;
}

/**
 * Component Chế độ Ôn tập Flashcard SRS (Spaced Repetition - UC012.2)
 *
 * TÍNH NĂNG CHÍNH:
 * 1. Tải danh sách thẻ cần ôn qua API `getStudySession` (ưu tiên thẻ tới hạn, có maskedSentence).
 * 2. Thẻ lật 3D siêu mượt bằng Tailwind CSS (`FlipCard.tsx`).
 * 3. Tự động phát âm giọng đọc bản xứ khi lật sang thẻ mới qua Web Speech Synthesis API.
 * 4. Phím tắt bàn phím:
 *    - <Space>: Lật thẻ xem nghĩa
 *    - Phím 1: Đánh giá "Quên" (Xếp lịch lại vào ngày mai + Đưa thẻ về cuối phiên)
 *    - Phím 2: Đánh giá "Đã thuộc" (Tăng khoảng cách lặp lại SRS)
 *    - Phím Esc: Mở hộp thoại xác nhận thoát giữa chừng
 * 5. Luồng 6a: Thẻ "Quên" tự động được push vào cuối hàng đợi để củng cố phản xạ ngay trong phiên.
 * 6. Luồng 8a: Dừng phiên học giữa chừng hỏi lưu tiến độ những từ đã ôn tập.
 * 7. Đồng bộ kết quả với API `reviewCard` và `finishSession`, cộng điểm XP và cập nhật chuỗi Streak.
 */
export const SrsStudyView: React.FC<SrsStudyViewProps> = ({
  deck,
  onBack,
  onFinish,
}) => {
  // Trạng thái tải dữ liệu ban đầu
  const [loading, setLoading] = useState(true);

  // Hàng đợi thẻ trong phiên học hiện tại (có thể dài ra nếu bấm Quên - Luồng 6a)
  const [queue, setQueue] = useState<StudySessionCardDto[]>([]);

  // Vị trí thẻ hiện tại đang hiển thị
  const [currentIndex, setCurrentIndex] = useState(0);

  // Trạng thái lật thẻ: false = Mặt trước, true = Mặt sau
  const [isFlipped, setIsFlipped] = useState(false);

  // Trạng thái đã hoàn tất toàn bộ phiên
  const [isCompleted, setIsCompleted] = useState(false);

  // Kết quả tổng kết trả về từ API Backend sau khi kết thúc phiên
  const [summaryResult, setSummaryResult] = useState<StudySessionSummaryResponse | null>(null);

  // Thống kê phiên học
  const [reviewedCount, setReviewedCount] = useState(0);
  const [rememberedCount, setRememberedCount] = useState(0);
  const [forgottenCount, setForgottenCount] = useState(0);
  // Mốc thời gian bắt đầu phiên học để tính durationSeconds
  const startTimeRef = useRef<number>(Date.now());

  // Thẻ hiện tại đang hiển thị trong phiên
  const currentCard = useMemo(() => queue[currentIndex] || null, [queue, currentIndex]);

  /**
   * 1. Khởi tạo phiên ôn tập Flashcard từ API Backend
   */
  const initSession = useCallback(async () => {
    try {
      setLoading(true);
      const data = await vocabApi.getStudySession(deck.id);
      setQueue(data.cards || []);
      setCurrentIndex(0);
      setIsFlipped(false);
      setIsCompleted(false);
      setReviewedCount(0);
      setRememberedCount(0);
      setForgottenCount(0);
      setSummaryResult(null);
      startTimeRef.current = Date.now();
    } catch (err) {
      console.error('Lỗi khi khởi tạo phiên ôn tập SRS:', err);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [deck.id]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  /**
   * Tự động phát âm từ vựng khi mở thẻ mới (Luồng 4a)
   */
  useEffect(() => {
    if (currentCard?.customWord && !isCompleted && !loading) {
      setIsFlipped(false);
      // Phát âm sau một nhịp trễ ngắn để animation chuyển thẻ ổn định
      const timer = setTimeout(() => {
        speakWord(currentCard.customWord, deck.targetLanguage);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentCard, isCompleted, loading, deck.targetLanguage]);



  /**
   * 2. Hoàn tất phiên ôn tập và gọi API ghi nhận kết quả & Gamification
   */
  const handleFinishSession = useCallback(
    async (finalReviewed?: number, finalRemembered?: number, finalForgotten?: number) => {
      const reviewed = finalReviewed ?? reviewedCount;
      const remembered = finalRemembered ?? rememberedCount;
      const forgotten = finalForgotten ?? forgottenCount;
      const durationSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

      try {
        const result = await vocabApi.finishSession(deck.id, {
          cardsReviewed: reviewed,
          cardsRemembered: remembered,
          cardsForgotten: forgotten,
          durationSeconds,
        });
        setSummaryResult(result);
      } catch (err) {
        console.error('Lỗi khi gửi kết quả phiên học lên server:', err);
        // Fallback hiển thị kết quả cục bộ nếu mạng lỗi
        setSummaryResult({
          earnedXp: 10 + remembered * 2,
          currentStreak: 1,
          totalMasteredCards: 0,
          cardsReviewed: reviewed,
        });
      } finally {
        setIsCompleted(true);
        if (onFinish) onFinish();
      }
    },
    [deck.id, reviewedCount, rememberedCount, forgottenCount, onFinish]
  );

  /**
   * 3. Xử lý đánh giá mức độ nhớ của thẻ ("FORGOTTEN" / "REMEMBERED")
   */
  const handleRateCard = useCallback(
    (rating: 'FORGOTTEN' | 'REMEMBERED') => {
      if (!currentCard || isCompleted) return;

      const cardId = currentCard.id;
      const nextReviewed = reviewedCount + 1;
      const nextRemembered = rating === 'REMEMBERED' ? rememberedCount + 1 : rememberedCount;
      const nextForgotten = rating === 'FORGOTTEN' ? forgottenCount + 1 : forgottenCount;

      // 1. Gọi API Backend ngầm (không chặn trải nghiệm người dùng)
      vocabApi
        .reviewCard(cardId, { rating })
        .catch((err) => console.error(`Lỗi cập nhật SRS thẻ #${cardId}:`, err));

      // 2. Cập nhật biến đếm thống kê
      setReviewedCount(nextReviewed);
      if (rating === 'REMEMBERED') {
        setRememberedCount(nextRemembered);
      } else {
        setForgottenCount(nextForgotten);
        // Luồng 6a: Thẻ Quên được đưa về cuối hàng đợi phiên học để luyện lại ngay
        setQueue((prev) => [...prev, { ...currentCard }]);
        alertUtil.toast('Đã xếp thẻ về cuối phiên để bạn ôn lại ngay!', 'info');
      }

      // 3. Chuyển thẻ tiếp theo hoặc hoàn tất phiên nếu đã hết hàng đợi
      if (currentIndex < queue.length - 1 || rating === 'FORGOTTEN') {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      } else {
        // Đã hoàn thành toàn bộ thẻ trong phiên
        handleFinishSession(nextReviewed, nextRemembered, nextForgotten);
      }
    },
    [currentCard, isCompleted, reviewedCount, rememberedCount, forgottenCount, currentIndex, queue.length, handleFinishSession]
  );

  /**
   * 4. Xử lý thoát giữa chừng bằng popup dùng chung của hệ thống (Luồng 8a)
   */
  const handleExit = useCallback(async () => {
    // Nếu chưa ôn từ nào, chỉ cần hỏi xác nhận thoát đơn giản
    if (reviewedCount === 0) {
      const isConfirmed = await alertUtil.confirm(
        'Bạn có chắc chắn muốn dừng phiên ôn tập này không?',
        'Dừng học',
        'Tiếp tục'
      );
      if (isConfirmed) onBack();
      return;
    }

    // Nếu đã ôn một số từ, hỏi lưu tiến độ với 3 lựa chọn
    const result = await Swal.fire({
      title: 'Dừng phiên ôn tập?',
      html: `Bạn đã ôn tập <b>${reviewedCount} từ</b>.<br/>Bạn có muốn lưu tiến độ trước khi thoát không?`,
      icon: 'warning',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Lưu & Thoát',
      denyButtonText: 'Thoát không lưu',
      cancelButtonText: 'Tiếp tục học',
      confirmButtonColor: '#f59e0b',
      denyButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
    });

    if (result.isConfirmed) {
      try {
        const durationSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        await vocabApi.finishSession(deck.id, {
          cardsReviewed: reviewedCount,
          cardsRemembered: rememberedCount,
          cardsForgotten: forgottenCount,
          durationSeconds,
        });
      } catch (err) {
        console.error('Lỗi khi lưu tiến độ thoát giữa chừng:', err);
      } finally {
        onBack();
      }
    } else if (result.isDenied) {
      onBack();
    }
  }, [reviewedCount, rememberedCount, forgottenCount, deck.id, onBack]);

  /**
   * 5. Phím tắt bàn phím tiện lợi
   */
  useKeyboardShortcuts({
    Space: (e) => {
      if (!isCompleted) {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      }
    },
    '1': () => {
      if (isFlipped && !isCompleted) {
        handleRateCard('FORGOTTEN');
      }
    },
    '2': () => {
      if (isFlipped && !isCompleted) {
        handleRateCard('REMEMBERED');
      }
    },
    Escape: () => {
      if (!isCompleted) {
        handleExit();
      }
    },
  });

  // ========================================================
  // A. TRẠNG THÁI LOADING BAN ĐẦU
  // ========================================================
  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="text-slate-600 font-medium text-sm">
          Đang khởi tạo phiên ôn tập Flashcard...
        </p>
      </div>
    );
  }

  // ========================================================
  // B. LUỒNG 2a: BỘ THẺ RỖNG (EMPTY STATE)
  // ========================================================
  if (queue.length === 0 && !isCompleted) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full">
          <EmptyState
            title="Bộ thẻ chưa có từ vựng nào"
            description="Hãy thêm từ vựng mới vào bộ thẻ để bắt đầu chế độ ôn tập lặp lại ngắt quãng (SRS)!"
            actionText="Quay về bộ thẻ"
            onAction={onBack}
          />
        </div>
      </div>
    );
  }

  // ========================================================
  // C. MÀN HÌNH TỔNG KẾT KHI KẾT THÚC PHIÊN HỌC (LUỒNG 10)
  // ========================================================
  if (isCompleted) {
    const accuracy =
      reviewedCount > 0 ? Math.round((rememberedCount / reviewedCount) * 100) : 100;

    return (
      <div className="fixed inset-0 z-[200] bg-slate-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="max-w-lg w-full py-6 animate-in fade-in duration-300">
          <SessionSummaryCard
            title="Hoàn thành phiên ôn tập!"
            earnedXp={summaryResult?.earnedXp || 10 + rememberedCount * 2}
            accuracyPercent={accuracy}
            correctCount={rememberedCount}
            incorrectCount={forgottenCount}
            totalCards={reviewedCount}
            extraStats={[
              {
                label: 'Chuỗi ngày học (Streak)',
                value: `${summaryResult?.currentStreak || 1} ngày`,
                icon: <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />,
              },
              {
                label: 'Thẻ đã thành thạo (Mastered)',
                value: summaryResult?.totalMasteredCards ?? 0,
                icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
              },
            ]}
            onPlayAgain={initSession}
            onBackToDeck={onBack}
          />
        </div>
      </div>
    );
  }

  // ========================================================
  // D. GIAO DIỆN PHÒNG HỌC SRS CHÍNH (FOCUS MODE TOÀN MÀN HÌNH)
  // ========================================================
  return (
    <div className="fixed inset-0 z-[200] bg-slate-100/90 backdrop-blur-xs flex flex-col justify-between overflow-y-auto overflow-x-hidden select-none">
      {/* 1. Header trên cùng: Tên Deck, Tiến độ và nút Thoát */}
      <ModeHeader
        title="Ôn tập Flashcard SRS"
        deckName={deck.name}
        currentIndex={currentIndex + 1}
        totalItems={queue.length}
        onBack={handleExit}
      />

      {/* 2. Khối học tập trung tâm: Thẻ Flashcard & Nút điều khiển liền mạch */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6 w-full max-w-2xl mx-auto my-auto min-h-0">

        {/* Khối tương tác trung tâm: Thẻ + Phím bấm liền mạch */}
        <div className="w-full flex flex-col items-center gap-5 sm:gap-6">
          {/* Component thẻ lật 3D */}
          {currentCard && (
            <FlipCard
              card={currentCard}
              targetLanguage={deck.targetLanguage}
              isFlipped={isFlipped}
              onFlip={() => setIsFlipped((prev) => !prev)}
              onSwipeLeft={() => handleRateCard('FORGOTTEN')}
              onSwipeRight={() => handleRateCard('REMEMBERED')}
            />
          )}

          {/* Cụm nút điều khiển hành động NGAY DƯỚI THẺ */}
          <div className="w-full">
            {!isFlipped ? (
              /* Mặt trước: Nút Lật thẻ */
              <button
                type="button"
                onClick={() => setIsFlipped(true)}
                className="w-full py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-extrabold text-sm sm:text-base shadow-md shadow-amber-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <span>Lật thẻ xem đáp án</span>
                <kbd className="px-2 py-0.5 rounded-md bg-amber-400 text-xs font-mono font-bold text-amber-950 shadow-2xs">
                  Space
                </kbd>
              </button>
            ) : (
              /* Mặt sau: 2 Nút Đánh giá SRS Quên (1) / Đã thuộc (2) */
              <div className="w-full grid grid-cols-2 gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Nút 1: Quên */}
                <button
                  type="button"
                  onClick={() => handleRateCard('FORGOTTEN')}
                  className="py-3.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100/90 active:scale-[0.99] border-2 border-rose-200 hover:border-rose-400 transition-all flex items-center justify-center gap-2.5 shadow-xs cursor-pointer text-center group"
                >
                  <span className="text-sm sm:text-base font-black text-rose-700 group-hover:text-rose-800">
                    Quên
                  </span>
                  <kbd className="px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-900 font-mono font-bold text-xs">
                    1
                  </kbd>
                </button>

                {/* Nút 2: Đã thuộc */}
                <button
                  type="button"
                  onClick={() => handleRateCard('REMEMBERED')}
                  className="py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] border-2 border-emerald-600 hover:border-emerald-700 text-white transition-all flex items-center justify-center gap-2.5 shadow-md shadow-emerald-600/25 cursor-pointer text-center"
                >
                  <span className="text-sm sm:text-base font-black text-white">
                    Đã thuộc
                  </span>
                  <kbd className="px-1.5 py-0.5 rounded bg-emerald-500 text-white font-mono font-bold text-xs">
                    2
                  </kbd>
                </button>
              </div>
            )}
          </div>

          {/* Dòng hướng dẫn phím tắt bàn phím tinh tế */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 text-xs font-medium text-slate-400 select-none">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200/80 text-slate-600 rounded text-[11px] font-mono">Space</kbd> Lật
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200/80 text-slate-600 rounded text-[11px] font-mono">1</kbd> Quên
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200/80 text-slate-600 rounded text-[11px] font-mono">2</kbd> Đã thuộc
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200/80 text-slate-600 rounded text-[11px] font-mono">Esc</kbd> Thoát
            </span>
          </div>
        </div>
      </main>


    </div>
  );
};
