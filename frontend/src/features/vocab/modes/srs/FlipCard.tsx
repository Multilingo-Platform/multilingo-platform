import React, { useState, useRef, useEffect } from 'react';
import type { StudySessionCardDto } from '../../types/vocab.types';
import { SpeakButton } from '../../components/common/SpeakButton';

export interface FlipCardProps {
  card: StudySessionCardDto;
  targetLanguage: string;
  isFlipped: boolean;
  onFlip: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Component Thẻ Lật Flashcard 3D (FlipCard) - Tối Giản & Hỗ Trợ Vuốt Kéo Thẻ (Swipe Gesture)
 *
 * ĐIỂM CẢI TIẾN:
 * 1. Tối ưu kích thước vừa vặn khung nhìn (h-[330px] sm:h-[350px]), không gây tràn màn hình.
 * 2. Loại bỏ các icon trang trí không cần thiết (Minimalist, Apple / Notion style).
 * 3. Hỗ trợ thao tác kéo chuột / vuốt cảm ứng (Swipe Tinder Gesture):
 *    - Kéo sang phải (👉): Thẻ nghiêng theo chuột, hiện nhãn xanh "ĐÃ THUỘC" ➔ Thả tay > 100px: Ghi nhận Đã thuộc.
 *    - Kéo sang trái (👈): Thẻ nghiêng theo chuột, hiện nhãn đỏ "QUÊN" ➔ Thả tay > 100px: Ghi nhận Quên.
 *    - Nhấp chuột thông thường (kéo < 10px): Lật thẻ mặt trước / mặt sau.
 */
export const FlipCard: React.FC<FlipCardProps> = ({
  card,
  targetLanguage,
  isFlipped,
  onFlip,
  onSwipeLeft,
  onSwipeRight,
}) => {
  // Trạng thái kéo thẻ (Swipe)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  /**
   * Bắt đầu kéo chuột / chạm cảm ứng (Gắn listener toàn cục để kéo mượt không bao giờ bị rơi)
   */
  const handlePointerDown = (e: React.PointerEvent) => {
    // Chỉ kích hoạt bằng chuột trái hoặc chạm ngón tay
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Không kích hoạt kéo khi nhấn vào nút (như SpeakButton)
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    isDraggingRef.current = true;
    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };

    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - startPosRef.current.x;
      const deltaY = (moveEvent.clientY - startPosRef.current.y) * 0.15; // Giảm dịch chuyển trục Y
      setDragOffset({ x: deltaX, y: deltaY });
    };

    const handleWindowPointerUp = (upEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);

      const deltaX = upEvent.clientX - startPosRef.current.x;
      const deltaY = upEvent.clientY - startPosRef.current.y;
      const dist = Math.hypot(deltaX, deltaY);

      setDragOffset({ x: 0, y: 0 });

      // Ngưỡng kéo để xác nhận đánh giá: > 75px
      if (deltaX > 75) {
        onSwipeRight?.();
      } else if (deltaX < -75) {
        onSwipeLeft?.();
      } else if (dist < 10) {
        // Nhấn chuột thông thường không kéo -> Lật thẻ
        onFlip();
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
  };

  // Dọn dẹp listener khi unmount
  useEffect(() => {
    return () => {
      isDraggingRef.current = false;
    };
  }, []);

  // Tính góc nghiêng khi kéo (tối đa ~15 độ)
  const rotationAngle = Math.max(-15, Math.min(15, dragOffset.x * 0.05));

  return (
    <div
      className="w-full max-w-2xl mx-auto [perspective:1200px] cursor-grab active:cursor-grabbing select-none touch-none"
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={0}
      aria-label={isFlipped ? 'Mặt sau thẻ từ vựng' : 'Mặt trước thẻ từ vựng'}
      onKeyDown={(e) => {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          onFlip();
        }
      }}
    >
      {/* Wrapper điều khiển vị trí kéo vuốt thẻ */}
      <div
        className="relative w-full h-[330px] sm:h-[360px] md:h-[380px] max-h-[52vh] transition-transform"
        style={{
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotationAngle}deg)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
      >
        {/* ========================================================
            STAMP NHÃN VUỐT: ĐÃ THUỘC (XANH LÁ) / QUÊN (ĐỎ)
           ======================================================== */}
        {dragOffset.x > 35 && (
          <div
            className="absolute top-5 left-5 z-30 px-3.5 py-1.5 rounded-xl border-2 border-emerald-500 text-emerald-600 bg-white/95 font-black text-xs sm:text-sm tracking-wider uppercase rotate-[-12deg] shadow-lg pointer-events-none transition-opacity"
            style={{ opacity: Math.min(1, (dragOffset.x - 35) / 50) }}
          >
            ĐÃ THUỘC 👉
          </div>
        )}

        {dragOffset.x < -35 && (
          <div
            className="absolute top-5 right-5 z-30 px-3.5 py-1.5 rounded-xl border-2 border-rose-500 text-rose-600 bg-white/95 font-black text-xs sm:text-sm tracking-wider uppercase rotate-[12deg] shadow-lg pointer-events-none transition-opacity"
            style={{ opacity: Math.min(1, (Math.abs(dragOffset.x) - 35) / 50) }}
          >
            👈 QUÊN
          </div>
        )}

        {/* Khối lật 3D */}
        <div
          className={`relative w-full h-full transition-transform duration-500 ease-out [transform-style:preserve-3d] ${
            isFlipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          {/* ========================================================
              1. MẶT TRƯỚC (FRONT FACE) - GIAO DIỆN HỌC TINH GỌN, KHÔNG CÂU GỢI Ý
             ======================================================== */}
          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] bg-white rounded-2xl border border-slate-200/90 shadow-md hover:shadow-lg p-6 sm:p-8 flex flex-col justify-between hover:border-amber-300 transition-all">
            {/* Header: Từ loại & Loa phát âm */}
            <div className="flex items-center justify-between w-full">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200/60">
                {card.pos || targetLanguage.toUpperCase()}
              </span>

              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <SpeakButton
                  text={card.customWord}
                  langCode={targetLanguage}
                  size="md"
                  className="bg-slate-50 hover:bg-amber-50 hover:text-amber-600 border border-slate-200 shadow-2xs"
                />
              </div>
            </div>

            {/* Nội dung trung tâm: Từ vựng & Phiên âm IPA */}
            <div className="text-center my-auto py-2">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3">
                {card.customWord}
              </h2>

              {card.phonetic && (
                <div className="inline-block px-3.5 py-1 rounded-full text-xs sm:text-sm font-mono font-medium text-slate-600 bg-slate-100">
                  {card.phonetic}
                </div>
              )}
            </div>

            {/* Footer mặt trước: Gợi ý lật thẻ tối giản */}
            <div className="text-center pt-2.5 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-medium inline-flex items-center gap-1.5">
                <span>Nhấn vào thẻ hoặc</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-mono font-bold text-slate-600">
                  Space
                </kbd>
                <span>để xem đáp án</span>
              </p>
            </div>
          </div>

          {/* ========================================================
              2. MẶT SAU (BACK FACE)
             ======================================================== */}
          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-slate-50 via-white to-amber-50/30 rounded-2xl border-2 border-amber-300 shadow-lg p-6 sm:p-8 flex flex-col justify-between">
            {/* Header mặt sau */}
            <div className="flex items-center justify-between w-full border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-slate-900">{card.customWord}</span>
                {card.pos && (
                  <span className="text-xs font-semibold text-slate-500">({card.pos})</span>
                )}
              </div>

              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <SpeakButton
                  text={card.customWord}
                  langCode={targetLanguage}
                  size="sm"
                  className="bg-slate-50 hover:bg-amber-50 hover:text-amber-600 border border-slate-200"
                />
              </div>
            </div>

            {/* Nội dung trung tâm: Dịch nghĩa & Câu ví dụ ngữ cảnh */}
            <div className="text-center my-auto py-2">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug mb-2">
                {card.customMeaning}
              </h3>

              {/* Ảnh minh họa nếu có */}
              {card.customImageUrl && (
                <div className="my-2 flex justify-center">
                  <img
                    src={card.customImageUrl}
                    alt={card.customWord}
                    className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-slate-200 shadow-2xs"
                  />
                </div>
              )}

              {/* Câu ví dụ hoàn chỉnh */}
              {(card.fullSentence || card.maskedSentence) && (
                <div className="mt-3.5 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-slate-700 text-xs sm:text-sm leading-relaxed text-center max-w-lg mx-auto shadow-2xs">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                    Ví dụ ngữ cảnh:
                  </span>
                  <p className="italic text-slate-800">
                    “{card.fullSentence || card.maskedSentence}”
                  </p>
                </div>
              )}
            </div>

            {/* Footer mặt sau */}
            <div className="text-center pt-2.5 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-medium">
                Chọn <span className="text-rose-600 font-bold">Quên (1)</span> hoặc <span className="text-emerald-600 font-bold">Đã thuộc (2)</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
