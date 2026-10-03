import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Gamepad2, 
  Clock, 
  Award, 
  RotateCw, 
  AlertTriangle,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { INITIAL_DECKS, INITIAL_CARDS, type CardItem } from './vocabData';

interface MatchTile {
  id: string; // unique tile id
  cardId: number; // reference to original card
  text: string;
  type: 'WORD' | 'MEANING';
  isMatched: boolean;
}

export const VocabSpeedMatch: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();

  const deck = INITIAL_DECKS.find(d => d.id === deckId) || INITIAL_DECKS[0];
  const deckCards = INITIAL_CARDS.filter(c => c.deckId === deck.id);
  const eligibleCards = deckCards.length >= 6 ? deckCards : INITIAL_CARDS.slice(0, 6);

  // Setup 12 tiles (6 words, 6 meanings)
  const [tiles, setTiles] = useState<MatchTile[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [wrongTileIds, setWrongTileIds] = useState<string[]>([]);
  const [matchedTileIds, setMatchedTileIds] = useState<string[]>([]);
  
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [penaltyNotice, setPenaltyNotice] = useState<string | null>(null);

  // Initialize or Reset game
  const initGame = () => {
    const selectedSix = [...eligibleCards].sort(() => Math.random() - 0.5).slice(0, 6);

    const generatedTiles: MatchTile[] = [];
    selectedSix.forEach(card => {
      generatedTiles.push({
        id: `w-${card.id}`,
        cardId: card.id,
        text: card.word,
        type: 'WORD',
        isMatched: false
      });
      generatedTiles.push({
        id: `m-${card.id}`,
        cardId: card.id,
        text: card.meaningVi,
        type: 'MEANING',
        isMatched: false
      });
    });

    // Shuffle the 12 tiles
    setTiles(generatedTiles.sort(() => Math.random() - 0.5));
    setSelectedTileId(null);
    setWrongTileIds([]);
    setMatchedTileIds([]);
    setTimeLeft(60);
    setScore(0);
    setCombo(1);
    setIsGameOver(false);
    setPenaltyNotice(null);
  };

  useEffect(() => {
    initGame();
  }, [deckId]);

  // 60-second Timer
  useEffect(() => {
    if (isGameOver || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isGameOver, timeLeft]);

  // Check victory condition
  useEffect(() => {
    if (tiles.length > 0 && matchedTileIds.length === tiles.length) {
      setIsGameOver(true);
    }
  }, [matchedTileIds, tiles]);

  // Handle tile selection (UC012.5)
  const handleTileClick = (clickedTile: MatchTile) => {
    if (isGameOver || clickedTile.isMatched || wrongTileIds.length > 0) return;

    // First tile selection
    if (!selectedTileId) {
      setSelectedTileId(clickedTile.id);
      return;
    }

    // Clicked same tile
    if (selectedTileId === clickedTile.id) {
      setSelectedTileId(null);
      return;
    }

    const firstTile = tiles.find(t => t.id === selectedTileId);
    if (!firstTile) return;

    // Check if matched
    if (firstTile.cardId === clickedTile.cardId && firstTile.type !== clickedTile.type) {
      // Correct Match!
      const bonus = 100 * combo;
      setScore(prev => prev + bonus);
      setCombo(prev => prev + 1);
      setMatchedTileIds(prev => [...prev, firstTile.id, clickedTile.id]);
      setSelectedTileId(null);

      // Update state in tiles
      setTiles(prev => prev.map(t => 
        (t.id === firstTile.id || t.id === clickedTile.id) ? { ...t, isMatched: true } : t
      ));
    } else {
      // Wrong Match: Penalty -5 seconds!
      setCombo(1);
      setWrongTileIds([firstTile.id, clickedTile.id]);
      setTimeLeft(prev => Math.max(0, prev - 5));
      setPenaltyNotice('Sai cặp! Phạt -5 giây');

      setTimeout(() => {
        setWrongTileIds([]);
        setSelectedTileId(null);
        setPenaltyNotice(null);
      }, 700);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '16px 16px 48px' }}>
      
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <button 
            onClick={() => navigate(`/student/flashcards/deck/${deck.id}`)}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: 13, marginBottom: 6 }}
          >
            <ArrowLeft size={14} />
            Quay lại bộ thẻ
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#222222', margin: 0 }}>
            Trò Chơi Ghép Thẻ Tốc Độ (Speed Match)
          </h1>
        </div>

        {/* Live game counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Combo badge */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4, 
            background: '#fffbeb', 
            border: '1px solid #fef3c7', 
            padding: '6px 12px', 
            borderRadius: 4,
            color: '#b45309',
            fontWeight: 600,
            fontSize: 14
          }}>
            <Zap size={15} color="#f5b301" />
            <span>Combo: x{combo}</span>
          </div>

          {/* Score */}
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid #e5e5e5', 
            padding: '6px 14px', 
            borderRadius: 4,
            fontWeight: 600,
            fontSize: 15,
            color: '#222222'
          }}>
            Điểm: <span style={{ color: '#f5b301' }}>{score}</span>
          </div>

          {/* Timer */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            background: timeLeft <= 10 ? '#fef2f2' : '#ffffff', 
            border: `1px solid ${timeLeft <= 10 ? '#fca5a5' : '#e5e5e5'}`, 
            padding: '6px 14px', 
            borderRadius: 4,
            fontWeight: 700,
            fontSize: 15,
            color: timeLeft <= 10 ? '#dc2626' : '#222222'
          }}>
            <Clock size={16} color={timeLeft <= 10 ? '#dc2626' : '#666666'} />
            <span>{timeLeft}s</span>
          </div>
        </div>
      </div>

      {/* Penalty notice alert */}
      {penaltyNotice && (
        <div style={{ 
          background: '#fef2f2', 
          border: '1px solid #fca5a5', 
          color: '#b91c1c', 
          padding: '8px 12px', 
          borderRadius: 4, 
          fontSize: 13.5, 
          fontWeight: 500, 
          textAlign: 'center',
          marginBottom: 14
        }}>
          {penaltyNotice}
        </div>
      )}

      {/* Game Board: 12 tiles in a 4x3 or 3x4 grid */}
      {!isGameOver ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
          gap: 12, 
          marginTop: 12 
        }}>
          {tiles.map(tile => {
            const isSelected = selectedTileId === tile.id;
            const isWrong = wrongTileIds.includes(tile.id);
            const isMatched = tile.isMatched;

            let bg = '#ffffff';
            let border = '#e5e5e5';
            let color = '#222222';
            let opacity = 1;

            if (isMatched) {
              bg = '#f0fdf4';
              border = '#16a34a';
              color = '#15803d';
              opacity = 0; // hide matched tiles cleanly
            } else if (isWrong) {
              bg = '#fef2f2';
              border = '#dc2626';
              color = '#b91c1c';
            } else if (isSelected) {
              bg = '#fffbeb';
              border = '#f5b301';
              color = '#222222';
            }

            return (
              <button
                key={tile.id}
                onClick={() => handleTileClick(tile)}
                disabled={isMatched}
                style={{
                  background: bg,
                  border: `2px solid ${border}`,
                  borderRadius: 4,
                  padding: '16px 12px',
                  minHeight: 88,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  fontSize: tile.type === 'WORD' ? 16 : 13.5,
                  fontWeight: tile.type === 'WORD' ? 600 : 400,
                  color: color,
                  cursor: isMatched ? 'default' : 'pointer',
                  opacity: opacity,
                  pointerEvents: isMatched ? 'none' : 'auto',
                  transition: 'opacity 0.25s ease, background-color 0.15s ease, border-color 0.15s ease'
                }}
              >
                {tile.text}
              </button>
            );
          })}
        </div>
      ) : (
        /* Victory / Game Over Screen */
        <div className="box-card" style={{ textAlign: 'center', padding: '36px 24px', maxWidth: 580, margin: '20px auto' }}>
          
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: '50%', 
            background: '#fffbeb', 
            border: '2px solid #f5b301', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 16px' 
          }}>
            <Award size={28} color="#f5b301" />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#222222', margin: '0 0 6px' }}>
            {matchedTileIds.length === tiles.length ? 'Chiến Thắng Xuất Sắc!' : 'Hết Giờ Thi Đấu!'}
          </h2>
          <p style={{ color: '#666666', fontSize: 14, margin: '0 0 24px' }}>
            Bạn đã ghép thành công {matchedTileIds.length / 2} / 6 cặp từ vựng.
          </p>

          <div className="stats-container" style={{ justifyContent: 'center', marginBottom: 24 }}>
            <div className="stat-box" style={{ minWidth: 120 }}>
              <span className="stat-number">{score}</span>
              <span className="stat-label">Tổng điểm đạt được</span>
            </div>
            <div className="stat-box" style={{ minWidth: 120 }}>
              <span className="stat-number" style={{ color: '#16a34a' }}>
                {60 - timeLeft}s
              </span>
              <span className="stat-label">Thời gian hoàn thành</span>
            </div>
            <div className="stat-box" style={{ minWidth: 120 }}>
              <span className="stat-number">Top 3</span>
              <span className="stat-label">Bảng xếp hạng tuần</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button 
              onClick={initGame}
              className="btn btn-secondary"
            >
              <RotateCw size={15} />
              Chơi lại ván mới
            </button>
            <button 
              onClick={() => navigate(`/student/flashcards/deck/${deck.id}`)}
              className="btn btn-primary"
            >
              Về chi tiết bộ thẻ
            </button>
          </div>

        </div>
      )}

      {/* Rules instruction note */}
      <div style={{ marginTop: 28, padding: '12px 16px', background: '#f7f7f7', borderRadius: 4, fontSize: 13, color: '#666666' }}>
        <strong>Quy tắc trò chơi ghép thẻ:</strong> Nhấp chọn 1 ô từ tiếng Anh và 1 ô định nghĩa tiếng Việt tương ứng. Mỗi cặp ghép đúng cộng 100 điểm kèm hệ số Combo. Mỗi cặp ghép sai sẽ bị phạt trừ 5 giây thời gian thi đấu!
      </div>

    </div>
  );
};

export default VocabSpeedMatch;
