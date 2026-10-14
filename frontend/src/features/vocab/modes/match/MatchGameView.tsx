import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Clock, Trophy, RotateCcw, Sparkles, Award, CheckCircle2 } from 'lucide-react';
import type { DeckSummary, Flashcard } from '../../types/vocab.types';
import { useVocabTimer } from '../../hooks/useVocabTimer';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { EmptyState } from '../../components/common/EmptyState';
import { MatchTile } from './MatchTile';

export interface MatchGameViewProps {
  deck: DeckSummary;
  cards: Flashcard[];
  onBack: () => void;
}

interface MatchTileItem {
  id: string;
  cardId: number;
  text: string;
  type: 'WORD' | 'MEANING';
  isMatched: boolean;
}

const LOCAL_STORAGE_KEY_PREFIX = 'multilingo_match_score_';

/**
 * Component MatchGameView - Chế độ Trò chơi Ghép thẻ tốc độ (UC012.6)
 * - Nghiệp vụ tính điểm cố định: Ghép đúng +100 điểm, ghép sai phạt trừ 5 giây.
 * - Kỷ lục đơn giản: Lưu số điểm cao nhất của bộ thẻ vào localStorage.
 * - Giao diện kết quả to rộng, có icon vinh danh vừa phải, cân đối và hiện đại.
 */
export const MatchGameView: React.FC<MatchGameViewProps> = ({ deck, cards, onBack }) => {
  const [tiles, setTiles] = useState<MatchTileItem[]>([]);
  const [selectedTile, setSelectedTile] = useState<MatchTileItem | null>(null);
  const [wrongPairIds, setWrongPairIds] = useState<string[]>([]);
  const [isLockInteraction, setIsLockInteraction] = useState(false);

  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const { playCorrectSound, playWrongSound, playVictorySound } = useSoundEffects();

  // Đọc điểm kỷ lục cao nhất từ localStorage
  const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}${deck.id}`;
  const savedBestScore = useMemo<number>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? Number(raw) : 0;
    } catch {
      return 0;
    }
  }, [storageKey]);

  // Lọc các thẻ từ vựng hợp lệ (có đủ từ và nghĩa)
  const validCards = useMemo(() => {
    return cards.filter(
      (c) => Boolean(c.customWord && c.customWord.trim()) && Boolean(c.customMeaning && c.customMeaning.trim())
    );
  }, [cards]);

  // Khởi tạo bàn chơi 12 ô (6 cặp từ - nghĩa)
  const initGame = useCallback(() => {
    if (validCards.length < 6) return;

    const shuffledCards = [...validCards].sort(() => Math.random() - 0.5).slice(0, 6);

    const generatedTiles: MatchTileItem[] = [];
    shuffledCards.forEach((c) => {
      generatedTiles.push({
        id: `${c.id}-WORD`,
        cardId: c.id,
        text: c.customWord,
        type: 'WORD',
        isMatched: false,
      });
      generatedTiles.push({
        id: `${c.id}-MEANING`,
        cardId: c.id,
        text: c.customMeaning,
        type: 'MEANING',
        isMatched: false,
      });
    });

    setTiles(generatedTiles.sort(() => Math.random() - 0.5));
    setSelectedTile(null);
    setWrongPairIds([]);
    setIsLockInteraction(false);
    setScore(0);
    setIsGameOver(false);
    setIsWin(false);
    setIsNewRecord(false);
  }, [validCards]);

  // Xử lý khi hết 60 giây
  const handleTimeUp = useCallback(() => {
    setIsGameOver(true);
    setIsWin(false);
    setIsLockInteraction(true);
    playWrongSound();
  }, [playWrongSound]);

  // Đồng hồ đếm ngược 60 giây
  const timer = useVocabTimer({
    initialSeconds: 60,
    onTimeUp: handleTimeUp,
    autoStart: validCards.length >= 6,
  });

  // Khởi tạo trò chơi khi mount
  useEffect(() => {
    if (validCards.length >= 6) {
      initGame();
      timer.reset(60);
      timer.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validCards.length]);

  // Kiểm tra khi ghép hoàn thành toàn bộ 12 ô
  useEffect(() => {
    if (tiles.length > 0 && tiles.every((t) => t.isMatched) && !isGameOver) {
      timer.pause();
      setIsWin(true);
      setIsGameOver(true);
      playVictorySound();

      // Cập nhật kỷ lục điểm cao nhất nếu đạt điểm mới
      if (score > savedBestScore) {
        setIsNewRecord(true);
        try {
          localStorage.setItem(storageKey, String(score));
        } catch {
          // Bỏ qua lỗi storage
        }
      }
    }
  }, [tiles, isGameOver, score, timer, storageKey, savedBestScore, playVictorySound]);

  // Xử lý khi người dùng click vào 1 ô thẻ
  const handleTileClick = (tile: MatchTileItem) => {
    if (isGameOver || tile.isMatched || isLockInteraction || wrongPairIds.length > 0) return;

    // Nhấp lại vào ô đang chọn -> Hủy chọn ngay
    if (selectedTile?.id === tile.id) {
      setSelectedTile(null);
      return;
    }

    // Chọn ô đầu tiên
    if (!selectedTile) {
      setSelectedTile(tile);
      return;
    }

    // Đã chọn ô thứ nhất và nhấp ô thứ hai: Kiểm tra ghép cặp
    if (selectedTile.cardId === tile.cardId && selectedTile.type !== tile.type) {
      // GHÉP ĐÚNG: Cộng cố định 100 điểm
      playCorrectSound();
      setScore((s) => s + 100);

      setTiles((prev) =>
        prev.map((t) => (t.cardId === tile.cardId ? { ...t, isMatched: true } : t))
      );
      setSelectedTile(null);
    } else {
      // GHÉP SAI: Phạt trừ 5 giây trên đồng hồ
      playWrongSound();
      timer.deductTime(5);

      const wrongIds = [selectedTile.id, tile.id];
      setWrongPairIds(wrongIds);
      setIsLockInteraction(true);

      setTimeout(() => {
        setWrongPairIds([]);
        setSelectedTile(null);
        setIsLockInteraction(false);
      }, 500);
    }
  };

  const handleRestart = () => {
    initGame();
    timer.reset(60);
    timer.start();
  };

  // Bộ thẻ không đủ 6 từ
  if (validCards.length < 6) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex flex-col bg-slate-50/50 font-sans">
        <div className="w-full bg-white border-b border-slate-200 px-6 sm:px-12 py-3.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại bộ thẻ
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <EmptyState
              title="Chưa đủ từ vựng để chơi Ghép thẻ"
              description={`Trò chơi Ghép thẻ tốc độ cần tối thiểu 6 từ vựng hoàn chỉnh để tạo bàn chơi 12 ô. Bộ thẻ của bạn hiện mới có ${validCards.length} từ.`}
              actionText="Quay lại chi tiết bộ thẻ"
              onAction={onBack}
            />
          </div>
        </div>
      </div>
    );
  }

  // Màn hình kết thúc ván chơi (Thắng hoặc Hết giờ)
  if (isGameOver) {
    const matchedPairsCount = tiles.filter((t) => t.isMatched).length / 2;
    const timeSpentSeconds = 60 - timer.secondsLeft;
    const displayBestScore = Math.max(score, savedBestScore);

    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex flex-col bg-slate-50/50 animate-fade-in font-sans">
        {/* Header toàn màn hình tinh gọn */}
        <div className="w-full bg-white border-b border-slate-200 px-6 sm:px-12 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Về chi tiết bộ thẻ
          </button>
          <div className="w-10" />
        </div>

        {/* Khung kết quả trang trọng, to rộng hơn, icon vừa phải */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-md p-6 sm:p-8 text-center relative transition-all">
            {/* Biểu tượng Vinh danh ở đầu (Cúp hoặc Đồng hồ) */}
            <div
              className={`w-14 h-14 mx-auto mb-4 rounded-lg flex items-center justify-center border shadow-xs ${
                isWin
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}
            >
              {isWin ? (
                <Trophy className="w-7 h-7 text-amber-600 stroke-[2]" />
              ) : (
                <Clock className="w-7 h-7 text-slate-500 stroke-[2]" />
              )}
            </div>

            {/* Tiêu đề & Tên bộ thẻ */}
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1.5">
              {isWin ? 'Xuất sắc! Hoàn thành ván chơi' : 'Hết giờ rồi! Cố gắng lần sau'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-normal mb-5">
              Bộ thẻ: <span className="text-slate-700 font-semibold">"{deck.name}"</span>
            </p>

            {/* Badge Kỷ Lục Mới */}
            {isNewRecord && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-xs mb-5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Kỷ lục cá nhân mới!</span>
              </div>
            )}

            {/* Lưới 3 chỉ số thống kê - màu sắc trung tính, hài hòa, phông vừa vặn */}
            <div className="grid grid-cols-3 gap-2 p-4 sm:p-5 rounded-lg bg-slate-50 border border-slate-200 mb-5">
              <div className="flex flex-col items-center justify-center">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {score}
                </span>
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">
                  Tổng điểm
                </span>
              </div>
              <div className="flex flex-col items-center justify-center border-x border-slate-200 px-2 sm:px-4">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {matchedPairsCount}/6
                </span>
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">
                  Cặp đúng
                </span>
              </div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {timeSpentSeconds}s
                </span>
                <span className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">
                  Thời gian
                </span>
              </div>
            </div>

            {/* Kỷ lục điểm cao nhất - thiết kế nhẹ nhàng, ít màu */}
            {displayBestScore > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-medium mb-6">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <Award className="w-4 h-4 text-amber-600" />
                  Kỷ lục điểm cao nhất:
                </span>
                <span className="font-bold text-slate-900">
                  {displayBestScore} điểm
                </span>
              </div>
            )}

            {/* 2 Nút bấm hành động bo góc ít, phông chữ gọn gàng */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi lại ván mới</span>
              </button>
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-sm transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-500" />
                <span>Hoàn tất</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Màn hình Bàn chơi tương tác 12 ô
  return (
    <div className="w-full min-h-[calc(100vh-80px)] flex flex-col bg-slate-50/50 animate-fade-in font-sans">
      {/* Header Bar toàn màn hình */}
      <div className="w-full bg-white border-b border-slate-200 px-6 sm:px-12 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Thoát
        </button>

        {/* Đồng hồ đếm ngược 60s */}
        <div
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-sm font-bold transition-colors ${
            timer.secondsLeft <= 15
              ? 'bg-red-50 text-red-600 border-red-300 animate-pulse'
              : 'bg-slate-100 text-slate-800 border-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-current" />
          <span>{timer.secondsLeft}s</span>
        </div>

        {/* Điểm số */}
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-sm font-bold">
          <span>{score} điểm</span>
        </div>
      </div>

      {/* Lời gợi ý */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-2">
        <p className="text-center text-xs sm:text-sm font-medium text-slate-500">
          💡 Nhấp chọn 1 ô từ vựng và 1 ô định nghĩa tương ứng để ghép cặp
        </p>
      </div>

      {/* Lưới 12 ô thẻ */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-4 sm:py-6 flex flex-col justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {tiles.map((tile) => {
            const isSelected = selectedTile?.id === tile.id;
            const isWrong = wrongPairIds.includes(tile.id);

            return (
              <MatchTile
                key={tile.id}
                id={tile.id}
                cardId={tile.cardId}
                text={tile.text}
                type={tile.type}
                isSelected={isSelected}
                isWrong={isWrong}
                isMatched={tile.isMatched}
                disabled={isLockInteraction}
                onClick={() => handleTileClick(tile)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default MatchGameView;
