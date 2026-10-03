import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Volume2, 
  Award, 
  RotateCw,
  ChevronRight
} from 'lucide-react';
import { INITIAL_DECKS, INITIAL_CARDS, type CardItem } from './vocabData';

interface QuizQuestion {
  id: number;
  type: 'MEANING' | 'CONTEXT_BLANK';
  prompt: string;
  targetWord: string;
  ipa: string;
  options: { label: string; isCorrect: boolean }[];
  explanation: string;
}

export const VocabLearnQuiz: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();

  const deck = INITIAL_DECKS.find(d => d.id === deckId) || INITIAL_DECKS[0];
  const deckCards = INITIAL_CARDS.filter(c => c.deckId === deck.id);
  const activeCards = deckCards.length >= 4 ? deckCards : INITIAL_CARDS;

  // Generate quiz questions from cards
  const [questions] = useState<QuizQuestion[]>(() => {
    return activeCards.map((card, idx) => {
      // Pick 3 distractors
      const distractors = activeCards.filter(c => c.id !== card.id).slice(0, 3);
      
      if (idx % 2 === 0) {
        // Dạng 1: Chọn nghĩa tiếng Việt
        const opts = [
          { label: card.meaningVi, isCorrect: true },
          ...distractors.map(d => ({ label: d.meaningVi, isCorrect: false }))
        ].sort(() => Math.random() - 0.5);

        return {
          id: card.id,
          type: 'MEANING',
          prompt: `Nghĩa tiếng Việt chính xác của từ "${card.word}" là gì?`,
          targetWord: card.word,
          ipa: card.ipa,
          options: opts,
          explanation: `"${card.word}" (${card.type}): ${card.meaningVi}. Ví dụ: ${card.example}`
        };
      } else {
        // Dạng 2: Điền từ vào câu ngữ cảnh
        const sentenceWithBlank = card.example.replace(new RegExp(card.word, 'gi'), '_______');
        const opts = [
          { label: card.word, isCorrect: true },
          ...distractors.map(d => ({ label: d.word, isCorrect: false }))
        ].sort(() => Math.random() - 0.5);

        return {
          id: card.id,
          type: 'CONTEXT_BLANK',
          prompt: `Chọn từ thích hợp điền vào chỗ trống:\n"${sentenceWithBlank}"`,
          targetWord: card.word,
          ipa: card.ipa,
          options: opts,
          explanation: `Đáp án đúng là "${card.word}". Câu hoàn chỉnh: "${card.example}" (${card.exampleTranslation})`
        };
      }
    });
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const currentQ = questions[currentIndex] || questions[0];

  const handleSelectOption = (optIndex: number) => {
    if (isAnswered) return;
    setSelectedOption(optIndex);
    setIsAnswered(true);

    if (currentQ.options[optIndex].isCorrect) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsCompleted(true);
    }
  };

  // Play audio
  const playWordAudio = (word: string) => {
    try {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } catch {
      alert(`Phát âm: ${word}`);
    }
  };

  if (isCompleted) {
    const accuracy = Math.round((score / questions.length) * 100);

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
            Kết Thúc Bài Học Từ Vựng Trắc Nghiệm!
          </h1>
          <p style={{ color: '#666666', fontSize: 14, margin: '0 0 24px' }}>
            Bạn đã hoàn thành phiên luyện tập trắc nghiệm phản hồi tức thì cho bộ thẻ.
          </p>

          <div className="stats-container" style={{ justifyContent: 'center', marginBottom: 24 }}>
            <div className="stat-box" style={{ minWidth: 120 }}>
              <span className="stat-number">{score} / {questions.length}</span>
              <span className="stat-label">Số câu trả lời đúng</span>
            </div>
            <div className="stat-box" style={{ minWidth: 120 }}>
              <span className="stat-number" style={{ color: accuracy >= 75 ? '#16a34a' : '#d97706' }}>
                {accuracy}%
              </span>
              <span className="stat-label">Độ chính xác</span>
            </div>
            <div className="stat-box" style={{ minWidth: 120 }}>
              <span className="stat-number">+{score * 10}</span>
              <span className="stat-label">Điểm EXP nhận được</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button 
              onClick={() => {
                setCurrentIndex(0);
                setSelectedOption(null);
                setIsAnswered(false);
                setScore(0);
                setIsCompleted(false);
              }}
              className="btn btn-secondary"
            >
              <RotateCw size={15} />
              Luyện tập lại
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
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '16px 16px 48px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button 
          onClick={() => navigate(`/student/flashcards/deck/${deck.id}`)}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: 13 }}
        >
          <ArrowLeft size={14} />
          Dừng bài học
        </button>

        <div style={{ fontSize: 13, color: '#666666' }}>
          {deck.name} • Chế độ học từ vựng
        </div>

        <div style={{ fontSize: 13, color: '#222222', fontWeight: 600 }}>
          Câu {currentIndex + 1} / {questions.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: 4, background: '#e5e5e5', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ 
          width: `${Math.round(((currentIndex + 1) / questions.length) * 100)}%`, 
          height: '100%', 
          background: '#f5b301', 
          transition: 'width 0.2s ease' 
        }} />
      </div>

      {/* Question Card */}
      <div className="box-card" style={{ marginBottom: 20 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <span style={{ 
            fontSize: 12, 
            background: '#f7f7f7', 
            color: '#666666', 
            border: '1px solid #e5e5e5', 
            padding: '2px 8px', 
            borderRadius: 4, 
            fontWeight: 500 
          }}>
            {currentQ.type === 'MEANING' ? 'NGHĨA TỪ VỰNG' : 'ĐIỀN TỪ NGỮ CẢNH'}
          </span>

          <button 
            onClick={() => playWordAudio(currentQ.targetWord)}
            style={{ 
              background: '#f7f7f7', 
              border: '1px solid #ddd', 
              borderRadius: 4, 
              padding: '4px 8px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: '#222'
            }}
          >
            <Volume2 size={13} color="#f5b301" />
            <span>Phát âm</span>
          </button>
        </div>

        {/* Prompt */}
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#222222', lineHeight: 1.45, marginBottom: 16 }}>
          {currentQ.prompt}
        </h2>

        {/* 4 Multiple Choice Options (Rule 5: Rectangular buttons) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {currentQ.options.map((opt, oIdx) => {
            const isSelected = selectedOption === oIdx;
            let btnStyle: React.CSSProperties = {
              background: '#ffffff',
              border: '1px solid #e5e5e5',
              borderRadius: 4,
              padding: '12px 16px',
              textAlign: 'left',
              fontSize: 14.5,
              cursor: isAnswered ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#222222',
              transition: 'all 0.15s ease'
            };

            if (isAnswered) {
              if (opt.isCorrect) {
                btnStyle.background = '#f0fdf4';
                btnStyle.borderColor = '#16a34a';
                btnStyle.color = '#15803d';
                btnStyle.fontWeight = 500;
              } else if (isSelected && !opt.isCorrect) {
                btnStyle.background = '#fef2f2';
                btnStyle.borderColor = '#dc2626';
                btnStyle.color = '#b91c1c';
              }
            } else {
              // Hover style can be handled natively
            }

            return (
              <button
                key={oIdx}
                onClick={() => handleSelectOption(oIdx)}
                style={btnStyle}
                disabled={isAnswered}
              >
                <span>
                  <strong style={{ marginRight: 8, color: '#666' }}>{String.fromCharCode(65 + oIdx)}.</strong>
                  {opt.label}
                </span>

                {isAnswered && opt.isCorrect && (
                  <CheckCircle2 size={16} color="#16a34a" />
                )}
                {isAnswered && isSelected && !opt.isCorrect && (
                  <XCircle size={16} color="#dc2626" />
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* Instant Feedback & Explanation Box */}
      {isAnswered && (
        <div className="box-card" style={{ 
          marginBottom: 20, 
          borderLeft: currentQ.options[selectedOption!].isCorrect ? '4px solid #16a34a' : '4px solid #dc2626',
          background: currentQ.options[selectedOption!].isCorrect ? '#f0fdf4' : '#fef2f2'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {currentQ.options[selectedOption!].isCorrect ? (
              <>
                <CheckCircle2 size={18} color="#16a34a" />
                <span style={{ fontWeight: 600, color: '#15803d', fontSize: 15 }}>
                  Chính xác! (+10 EXP)
                </span>
              </>
            ) : (
              <>
                <XCircle size={18} color="#dc2626" />
                <span style={{ fontWeight: 600, color: '#b91c1c', fontSize: 15 }}>
                  Chưa chính xác!
                </span>
              </>
            )}
          </div>

          <div style={{ fontSize: 13.5, color: '#333333', lineHeight: 1.5, marginTop: 4 }}>
            {currentQ.explanation}
          </div>
        </div>
      )}

      {/* Bottom Next Action */}
      {isAnswered && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={handleNext}
            className="btn btn-primary"
            style={{ padding: '9px 24px', fontSize: 14.5 }}
          >
            {currentIndex + 1 < questions.length ? 'Câu tiếp theo' : 'Xem kết quả bài học'}
            <ChevronRight size={15} />
          </button>
        </div>
      )}

    </div>
  );
};

export default VocabLearnQuiz;
