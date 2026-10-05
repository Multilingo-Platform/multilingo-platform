import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Clock, Zap, RotateCcw, Trophy, AlertCircle } from 'lucide-react';
import type { DeckSummary, Flashcard } from '../../types/vocab';
import './vocab.css';

export interface MatchGameViewProps {
  deck: DeckSummary;
  cards: Flashcard[];
  onBack: () => void;
}

interface TileItem {
  id: string; // unique ID cho tile
  cardId: number; // ID của thẻ gốc
  text: string; // Nội dung hiển thị (từ hoặc nghĩa)
  type: 'WORD' | 'MEANING';
  isMatched: boolean;
}

export const MatchGameView: React.FC<MatchGameViewProps> = ({ deck, cards, onBack }) => {
  const [tiles, setTiles] = useState<TileItem[]>([]);
  const [selectedTile, setSelectedTile] = useState<TileItem | null>(null);
  const [wrongPairIds, setWrongPairIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isGameOver, setIsGameOver] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Khởi tạo bàn chơi (chọn 6 cặp từ vựng ngẫu nhiên)
  const initGame = () => {
    if (cards.length < 4) return;

    // Chọn tối đa 6 từ vựng có nghĩa rõ ràng
    const validCards = cards.filter((c) => Boolean(c.customMeaning && c.customMeaning.trim()));
    const pool = validCards.length >= 4 ? validCards : cards;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 6);

    const generatedTiles: TileItem[] = [];
    shuffled.forEach((c) => {
      generatedTiles.push({
        id: `word-${c.id}`,
        cardId: c.id,
        text: c.customWord,
        type: 'WORD',
        isMatched: false,
      });
      generatedTiles.push({
        id: `meaning-${c.id}`,
        cardId: c.id,
        text: c.customMeaning || c.customWord,
        type: 'MEANING',
        isMatched: false,
      });
    });

    // Xáo trộn 12 thẻ
    setTiles(generatedTiles.sort(() => Math.random() - 0.5));
    setSelectedTile(null);
    setWrongPairIds([]);
    setScore(0);
    setCombo(1);
    setTimeLeft(60);
    setIsGameOver(false);
  };

  useEffect(() => {
    initGame();
  }, [cards]);

  // Bộ đếm ngược 60 giây
  useEffect(() => {
    if (isGameOver || cards.length < 4) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGameOver, cards.length]);

  // Kiểm tra thắng màn khi tất cả các thẻ đã ghép xong
  useEffect(() => {
    if (tiles.length > 0 && tiles.every((t) => t.isMatched) && !isGameOver) {
      // Thưởng thêm điểm hoàn thành sớm
      setScore((s) => s + timeLeft * 50);
      setIsGameOver(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [tiles, isGameOver, timeLeft]);

  const handleTileClick = (tile: TileItem) => {
    if (tile.isMatched || isGameOver || wrongPairIds.length > 0) return;

    // Nếu bấm lại chính thẻ đang chọn -> bỏ chọn
    if (selectedTile?.id === tile.id) {
      setSelectedTile(null);
      return;
    }

    // Nếu chưa chọn thẻ đầu tiên
    if (!selectedTile) {
      setSelectedTile(tile);
      return;
    }

    // Nếu chọn thẻ thứ hai: Kiểm tra ghép cặp
    if (selectedTile.cardId === tile.cardId && selectedTile.type !== tile.type) {
      // Ghép ĐÚNG!
      const currentCombo = combo;
      setScore((s) => s + 100 * currentCombo);
      setCombo((c) => c + 1);

      setTiles((prev) =>
        prev.map((t) =>
          t.cardId === tile.cardId ? { ...t, isMatched: true } : t
        )
      );
      setSelectedTile(null);
    } else {
      // Ghép SAI!
      setCombo(1);
      const wrongIds = [selectedTile.id, tile.id];
      setWrongPairIds(wrongIds);

      setTimeout(() => {
        setWrongPairIds([]);
        setSelectedTile(null);
      }, 700);
    }
  };

  if (cards.length < 4) {
    return (
      <div className="vocab-interactive-container">
        <div className="vocab-view-header-bar">
          <button onClick={onBack} className="vocab-deck-back-btn">
            <ArrowLeft size={18} /> Quay lại bộ thẻ
          </button>
        </div>
        <div className="vocab-empty-state-box">
          <AlertCircle size={48} color="#ef4444" />
          <h3>Chưa đủ từ vựng để chơi Ghép từ</h3>
          <p>Trò chơi Ghép từ tốc độ cần tối thiểu 4 từ vựng để tạo các thẻ tương tác. Hãy thêm từ mới trước khi chơi.</p>
          <button onClick={onBack} className="vocab-study-btn-primary" style={{ maxWidth: '200px', margin: '1rem auto 0' }}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Màn hình kết thúc trò chơi
  if (isGameOver) {
    const isWin = tiles.length > 0 && tiles.every((t) => t.isMatched);
    return (
      <div className="vocab-interactive-container">
        <div className="vocab-view-header-bar">
          <button onClick={onBack} className="vocab-deck-back-btn">
            <ArrowLeft size={18} /> Quay lại bộ thẻ
          </button>
        </div>

        <div className="vocab-result-card">
          <div className="vocab-result-icon-badge" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
            <Trophy size={40} color="#dc2626" />
          </div>
          <h2 className="vocab-result-title">
            {isWin ? 'Tuyệt Vời! Đã Ghép Hết Các Cặp Thẻ 🎉' : 'Hết Giờ Rồi! Cố Gắng Lần Sau Nhé ⏰'}
          </h2>
          <p className="vocab-result-desc">
            Trò chơi Ghép từ tốc độ bộ thẻ <strong>"{deck.name}"</strong>
          </p>

          <div className="vocab-result-stats-row">
            <div className="vocab-result-stat-box">
              <span className="vocab-result-stat-val" style={{ color: '#dc2626' }}>
                {score}
              </span>
              <span className="vocab-result-stat-label">Tổng điểm</span>
            </div>
            <div className="vocab-result-stat-box">
              <span className="vocab-result-stat-val" style={{ color: '#ea580c' }}>
                {tiles.filter((t) => t.isMatched).length / 2} / {tiles.length / 2}
              </span>
              <span className="vocab-result-stat-label">Số cặp ghép đúng</span>
            </div>
            <div className="vocab-result-stat-box">
              <span className="vocab-result-stat-val" style={{ color: '#059669' }}>
                {60 - timeLeft}s
              </span>
              <span className="vocab-result-stat-label">Thời gian đã chơi</span>
            </div>
          </div>

          <div className="vocab-result-actions" style={{ marginTop: '2rem' }}>
            <button onClick={initGame} className="vocab-study-btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <RotateCcw size={18} /> Chơi lại ván mới
            </button>
            <button onClick={onBack} className="vocab-study-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={18} /> Về chi tiết bộ thẻ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vocab-interactive-container">
      {/* Header Bar */}
      <div className="vocab-view-header-bar">
        <button onClick={onBack} className="vocab-deck-back-btn">
          <ArrowLeft size={18} /> Thoát trò chơi
        </button>

        {/* Thanh đếm thời gian */}
        <div className={`vocab-match-timer-pill ${timeLeft <= 15 ? 'urgent' : ''}`}>
          <Clock size={18} />
          <span>{timeLeft}s</span>
        </div>

        {/* Bảng điểm & Combo */}
        <div className="vocab-match-score-pill">
          <span className="score-val">{score} điểm</span>
          {combo > 1 && (
            <span className="combo-badge">
              <Zap size={14} fill="currentColor" /> x{combo} Combo
            </span>
          )}
        </div>
      </div>

      <p className="vocab-match-hint">
        💡 Hãy nhấp chọn 1 thẻ <strong>Từ vựng</strong> và 1 thẻ <strong>Định nghĩa</strong> tương ứng để ghép cặp!
      </p>

      {/* Grid 12 thẻ ghép */}
      <div className="vocab-match-grid">
        {tiles.map((tile) => {
          const isSelected = selectedTile?.id === tile.id;
          const isWrong = wrongPairIds.includes(tile.id);
          let tileClass = 'vocab-match-tile';
          if (tile.isMatched) tileClass += ' matched';
          if (isSelected) tileClass += ' selected';
          if (isWrong) tileClass += ' wrong';

          return (
            <button
              key={tile.id}
              onClick={() => handleTileClick(tile)}
              disabled={tile.isMatched}
              className={tileClass}
            >
              <span className="vocab-match-tile-type">
                {tile.type === 'WORD' ? 'TỪ VỰNG' : 'ĐỊNH NGHĨA'}
              </span>
              <span className="vocab-match-tile-text">{tile.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
