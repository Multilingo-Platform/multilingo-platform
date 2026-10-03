import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Volume2, 
  RotateCw, 
  CheckCircle2, 
  Award, 
  Sparkles, 
  ChevronRight,
  BookOpen,
  Check
} from 'lucide-react';
import { INITIAL_DECKS, INITIAL_CARDS, type CardItem } from './vocabData';

export const VocabSRSStudy: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();

  const deck = INITIAL_DECKS.find(d => d.id === deckId) || INITIAL_DECKS[0];
  const deckCards = INITIAL_CARDS.filter(c => c.deckId === deck.id);
  const studyQueue = deckCards.length > 0 ? deckCards : INITIAL_CARDS.slice(0, 5);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [reviewedCards, setReviewedCards] = useState<{ id: number; rating: number }[]>([]);

  const currentCard: CardItem = studyQueue[currentIndex] || studyQueue[0];

  // Play audio
  const playWordAudio = (word: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch {
      alert(`Đang phát âm cho từ: ${word}`);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (isFlipped) {
        if (e.key === '1') handleRate(1);
        else if (e.key === '2') handleRate(2);
        else if (e.key === '3') handleRate(3);
        else if (e.key === '4') handleRate(4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, currentIndex, isCompleted]);

  // Handle rating (SM-2: 1: Học lại, 2: Khó, 3: Tốt, 4: Dễ)
  const handleRate = (rating: number) => {
    setReviewedCards(prev => [...prev, { id: currentCard.id, rating }]);
    setIsFlipped(false);

    if (currentIndex + 1 < studyQueue.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const progressPercent = Math.round(((currentIndex + 1) / studyQueue.length) * 100);

  // If completed session
  if (isCompleted) {
    const goodCount = reviewedCards.filter(r => r.rating >= 3).length;
    const retryCount = reviewedCards.filter(r => r.rating < 3).length;

    return (
      <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <div className="box-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          
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

          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#222222', margin: '0 0 6px' }}>
            Hoàn Thành Phiên Ôn Tập Flashcard!
          </h1>
          <p style={{ color: '#666666', fontSize: 14, margin: '0 0 24px' }}>
            Thuật toán ngắt quãng SM-2 đã cập nhật lịch ôn tập tiếp theo cho {studyQueue.length} từ vựng.
          </p>

          {/* Stats */}
          <div className="stats-container" style={{ justifyContent: 'center', marginBottom: 24 }}>
            <div className="stat-box" style={{ minWidth: 120 }}>
              <span className="stat-number">{studyQueue.length}</span>
              <span className="stat-label">Tổng từ đã ôn</span>
            </div>
            <div className="stat-box" style={{ minWidth: 120 }}>
              <span className="stat-number" style={{ color: '#16a34a' }}>{goodCount}</span>
              <span className="stat-label">Nhớ tốt (3-7 ngày)</span>
            </div>
            <div className="stat-box" style={{ minWidth: 120 }}>
              <span className="stat-number" style={{ color: '#dc2626' }}>{retryCount}</span>
              <span className="stat-label">Cần ôn lại (&lt;1 ngày)</span>
            </div>
            <div className="stat-box" style={{ minWidth: 120 }}>
              <span className="stat-number">+50</span>
              <span className="stat-label">Điểm EXP nhận được</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button 
              onClick={() => {
                setCurrentIndex(0);
                setIsFlipped(false);
                setIsCompleted(false);
                setReviewedCards([]);
              }}
              className="btn btn-secondary"
            >
              <RotateCw size={15} />
              Ôn lại lượt nữa
            </button>
            <button 
              onClick={() => navigate(`/student/flashcards/deck/${deck.id}`)}
              className="btn btn-primary"
            >
              Về chi tiết bộ thẻ
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 16px 48px' }}>
      
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button 
          onClick={() => navigate(`/student/flashcards/deck/${deck.id}`)}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: 13 }}
        >
          <ArrowLeft size={14} />
          Quay lại bộ thẻ
        </button>

        <div style={{ fontSize: 13, color: '#666666', fontWeight: 500 }}>
          {deck.name}
        </div>

        <div style={{ fontSize: 13, color: '#222222', fontWeight: 600 }}>
          Thẻ {currentIndex + 1} / {studyQueue.length}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ 
        width: '100%', 
        height: 4, 
        background: '#e5e5e5', 
        borderRadius: 2, 
        marginBottom: 24, 
        overflow: 'hidden' 
      }}>
        <div style={{ 
          width: `${progressPercent}%`, 
          height: '100%', 
          background: '#f5b301', 
          transition: 'width 0.25s ease' 
        }} />
      </div>

      {/* Flashcard Area (Click to flip) */}
      <div 
        onClick={() => setIsFlipped(!isFlipped)}
        style={{
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 4,
          minHeight: 340,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 24,
          cursor: 'pointer',
          position: 'relative',
          userSelect: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          marginBottom: 20
        }}
      >
        {/* Card Header tag */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ 
            fontSize: 12, 
            background: '#f7f7f7', 
            color: '#666666', 
            border: '1px solid #e5e5e5', 
            padding: '2px 8px', 
            borderRadius: 4 
          }}>
            {isFlipped ? 'MẶT SAU (ĐỊNH NGHĨA)' : 'MẶT TRƯỚC (TỪ VỰNG)'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888888' }}>
            <RotateCw size={13} />
            <span>Nhấn Space hoặc nhấp chuột để lật</span>
          </div>
        </div>

        {/* Card Body */}
        {!isFlipped ? (
          // Front Side: Word, IPA, Audio
          <div style={{ textAlign: 'center', margin: 'auto 0' }}>
            <h2 style={{ fontSize: 32, fontWeight: 600, color: '#222222', margin: '0 0 10px' }}>
              {currentCard.word}
            </h2>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16, color: '#666666', fontFamily: 'monospace' }}>
                {currentCard.ipa}
              </span>
              <button 
                onClick={(e) => playWordAudio(currentCard.word, e)}
                title="Nghe phát âm"
                style={{ 
                  background: '#f7f7f7', 
                  border: '1px solid #ddd', 
                  borderRadius: 4, 
                  padding: '4px 8px', 
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: '#222'
                }}
              >
                <Volume2 size={14} color="#f5b301" />
                <span>UK / US</span>
              </button>
            </div>

            <div style={{ marginTop: 8 }}>
              <span style={{ 
                fontSize: 13, 
                color: '#444444', 
                background: '#f2f2f2', 
                padding: '2px 8px', 
                borderRadius: 4 
              }}>
                {currentCard.type}
              </span>
            </div>
            
            <p style={{ fontSize: 13, color: '#999999', marginTop: 16 }}>
              (Nhấp để xem giải nghĩa và ví dụ trong bài thi)
            </p>
          </div>
        ) : (
          // Back Side: Meaning, Definition, Example
          <div style={{ margin: 'auto 0' }}>
            
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: '#222222' }}>
                {currentCard.word}
              </span>
              <span style={{ fontSize: 14, color: '#666666', fontFamily: 'monospace' }}>
                {currentCard.ipa}
              </span>
              <span style={{ fontSize: 12, color: '#444', background: '#f2f2f2', padding: '1px 6px', borderRadius: 3 }}>
                {currentCard.type}
              </span>
            </div>

            {/* Vietnamese Meaning */}
            <div style={{ 
              background: '#fffbeb', 
              borderLeft: '3px solid #f5b301', 
              padding: '10px 14px', 
              borderRadius: 2, 
              fontSize: 15, 
              fontWeight: 500, 
              color: '#222222',
              marginBottom: 14
            }}>
              {currentCard.meaningVi}
            </div>

            {/* English Definition */}
            <div style={{ fontSize: 13.5, color: '#444444', marginBottom: 12 }}>
              <strong>Định nghĩa:</strong> {currentCard.definitionEn}
            </div>

            {/* Example sentence */}
            <div style={{ background: '#f7f7f7', border: '1px solid #e5e5e5', borderRadius: 4, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 13.5, color: '#222222', fontStyle: 'italic', marginBottom: 4 }}>
                "{currentCard.example}"
              </div>
              <div style={{ fontSize: 12.5, color: '#666666' }}>
                → {currentCard.exampleTranslation}
              </div>
            </div>

            {/* Collocations */}
            {currentCard.collocations.length > 0 && (
              <div style={{ fontSize: 13, color: '#666666' }}>
                <span style={{ fontWeight: 500, color: '#222' }}>Collocations: </span>
                {currentCard.collocations.join(', ')}
              </div>
            )}

          </div>
        )}

        {/* Card Footer status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#888888', borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
          <span>Lịch ôn tập: {currentCard.nextReview}</span>
          <span>Đã lặp lại {currentCard.reviews} lần</span>
        </div>
      </div>

      {/* 4 SM-2 Rating Buttons (Chỉ hiển thị sau khi đã lật thẻ xem đáp án) */}
      {isFlipped ? (
        <div>
          <div style={{ textAlign: 'center', fontSize: 13, color: '#666666', marginBottom: 10 }}>
            Bạn nhớ từ này như thế nào? (Chọn 1 mức độ để tính chu kỳ lặp lại SM-2)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            
            {/* 1. Học lại */}
            <button 
              onClick={() => handleRate(1)}
              style={{
                background: '#ffffff',
                border: '1px solid #fca5a5',
                color: '#dc2626',
                borderRadius: 4,
                padding: '10px 8px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>1. Học lại</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>&lt; 10 phút [1]</div>
            </button>

            {/* 2. Khó */}
            <button 
              onClick={() => handleRate(2)}
              style={{
                background: '#ffffff',
                border: '1px solid #fdba74',
                color: '#c2410c',
                borderRadius: 4,
                padding: '10px 8px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>2. Khó</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>1 ngày [2]</div>
            </button>

            {/* 3. Tốt (Primary Yellow) */}
            <button 
              onClick={() => handleRate(3)}
              style={{
                background: '#f5b301',
                border: '1px solid #d99a00',
                color: '#ffffff',
                borderRadius: 4,
                padding: '10px 8px',
                cursor: 'pointer',
                textAlign: 'center',
                fontWeight: 600
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>3. Tốt</div>
              <div style={{ fontSize: 12, color: '#fff', marginTop: 2 }}>3 ngày [3]</div>
            </button>

            {/* 4. Dễ */}
            <button 
              onClick={() => handleRate(4)}
              style={{
                background: '#ffffff',
                border: '1px solid #86efac',
                color: '#16a34a',
                borderRadius: 4,
                padding: '10px 8px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>4. Dễ</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>7 ngày [4]</div>
            </button>

          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <button 
            onClick={() => setIsFlipped(true)}
            className="btn btn-primary"
            style={{ padding: '10px 28px', fontSize: 15 }}
          >
            Lật thẻ xem nghĩa (Phím Space)
          </button>
        </div>
      )}

    </div>
  );
};

export default VocabSRSStudy;
