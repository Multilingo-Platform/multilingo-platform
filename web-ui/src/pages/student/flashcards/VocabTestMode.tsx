import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Award, 
  AlertTriangle,
  RotateCw,
  ChevronRight
} from 'lucide-react';
import { INITIAL_DECKS, INITIAL_CARDS } from './vocabData';

export const VocabTestMode: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();

  const deck = INITIAL_DECKS.find(d => d.id === deckId) || INITIAL_DECKS[0];
  const deckCards = INITIAL_CARDS.filter(c => c.deckId === deck.id);
  const activeCards = deckCards.length >= 4 ? deckCards : INITIAL_CARDS;

  // Test questions
  const [questions] = useState(() => {
    return activeCards.map((card, idx) => {
      const distractors = activeCards.filter(c => c.id !== card.id).slice(0, 3);
      const opts = [
        { text: card.meaningVi, isCorrect: true },
        ...distractors.map(d => ({ text: d.meaningVi, isCorrect: false }))
      ].sort(() => Math.random() - 0.5);

      return {
        id: card.id,
        number: idx + 1,
        word: card.word,
        ipa: card.ipa,
        type: card.type,
        prompt: `Câu ${idx + 1}: Chọn định nghĩa chính xác nhất cho từ vựng "${card.word}" (${card.ipa}):`,
        options: opts,
        explanation: `Từ "${card.word}" có nghĩa là: ${card.meaningVi}. Ví dụ: ${card.example}`
      };
    });
  });

  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (isSubmitted || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSubmitted, timeLeft]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectAnswer = (qIndex: number, optIndex: number) => {
    if (isSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [qIndex]: optIndex }));
  };

  const handleSubmitTest = () => {
    setShowConfirmModal(false);
    setIsSubmitted(true);
  };

  // Calculate score
  const answeredCount = Object.keys(userAnswers).length;
  let correctCount = 0;
  if (isSubmitted) {
    questions.forEach((q, idx) => {
      const chosenOpt = userAnswers[idx];
      if (chosenOpt !== undefined && q.options[chosenOpt]?.isCorrect) {
        correctCount++;
      }
    });
  }

  const scorePercent = Math.round((correctCount / questions.length) * 100);

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '16px 16px 48px' }}>
      
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
            Kiểm Tra Từ Vựng: {deck.name}
          </h1>
        </div>

        {/* Timer & Submit CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {!isSubmitted && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              padding: '6px 12px', 
              borderRadius: 4, 
              border: '1px solid #ddd', 
              background: '#fff',
              color: timeLeft < 60 ? '#dc2626' : '#222222',
              fontWeight: 600,
              fontSize: 15
            }}>
              <Clock size={16} color={timeLeft < 60 ? '#dc2626' : '#f5b301'} />
              <span>{formatTimer(timeLeft)}</span>
            </div>
          )}

          {!isSubmitted ? (
            <button 
              onClick={() => setShowConfirmModal(true)}
              className="btn btn-primary"
            >
              Nộp bài kiểm tra ({answeredCount}/{questions.length})
            </button>
          ) : (
            <button 
              onClick={() => navigate(`/student/flashcards/deck/${deck.id}`)}
              className="btn btn-secondary"
            >
              Về chi tiết bộ thẻ
            </button>
          )}
        </div>
      </div>

      {/* Post-submission Score Report */}
      {isSubmitted && (
        <div className="box-card" style={{ marginBottom: 24, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ 
              width: 52, 
              height: 52, 
              borderRadius: '50%', 
              background: '#fffbeb', 
              border: '2px solid #f5b301', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Award size={26} color="#f5b301" />
            </div>

            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#222222', margin: '0 0 4px' }}>
                Báo Cáo Kết Quả Kiểm Tra Từ Vựng
              </h2>
              <p style={{ color: '#666666', fontSize: 13.5, margin: 0 }}>
                Bạn đạt <strong>{scorePercent}%</strong> ({correctCount}/{questions.length} câu đúng) • {scorePercent >= 80 ? 'Xếp loại: Xuất sắc' : scorePercent >= 60 ? 'Xếp loại: Khá' : 'Xếp loại: Cần ôn tập thêm'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Layout: [ CONTENT LEFT ] [ SIDEBAR ] */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 20, alignItems: 'start' }}>
        
        {/* Left Column: List of Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {questions.map((q, qIdx) => {
            const chosenOpt = userAnswers[qIdx];
            const isCorrect = isSubmitted && chosenOpt !== undefined && q.options[chosenOpt]?.isCorrect;

            return (
              <div 
                key={q.id} 
                id={`q-${qIdx}`}
                className="box-card"
                style={{
                  borderLeft: isSubmitted ? (isCorrect ? '4px solid #16a34a' : '4px solid #dc2626') : '1px solid #e5e5e5'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f5b301' }}>
                    CÂU {q.number}
                  </span>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {q.type}
                  </span>
                </div>

                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#222222', marginBottom: 12, lineHeight: 1.4 }}>
                  {q.prompt}
                </h3>

                {/* 4 Options */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                  {q.options.map((opt, oIdx) => {
                    const isSelected = chosenOpt === oIdx;
                    
                    let bg = '#ffffff';
                    let borderCol = '#dddddd';
                    let textCol = '#222222';

                    if (isSubmitted) {
                      if (opt.isCorrect) {
                        bg = '#f0fdf4';
                        borderCol = '#16a34a';
                        textCol = '#15803d';
                      } else if (isSelected && !opt.isCorrect) {
                        bg = '#fef2f2';
                        borderCol = '#dc2626';
                        textCol = '#b91c1c';
                      }
                    } else if (isSelected) {
                      bg = '#fffbeb';
                      borderCol = '#f5b301';
                    }

                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleSelectAnswer(qIdx, oIdx)}
                        disabled={isSubmitted}
                        style={{
                          background: bg,
                          border: `1px solid ${borderCol}`,
                          borderRadius: 4,
                          padding: '10px 14px',
                          textAlign: 'left',
                          fontSize: 14,
                          color: textCol,
                          cursor: isSubmitted ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>
                          <strong style={{ marginRight: 8, color: '#666' }}>
                            {String.fromCharCode(65 + oIdx)}.
                          </strong>
                          {opt.text}
                        </span>

                        {isSubmitted && opt.isCorrect && <CheckCircle2 size={16} color="#16a34a" />}
                        {isSubmitted && isSelected && !opt.isCorrect && <XCircle size={16} color="#dc2626" />}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation on submit */}
                {isSubmitted && (
                  <div style={{ 
                    marginTop: 12, 
                    padding: '8px 12px', 
                    background: '#f7f7f7', 
                    borderRadius: 4, 
                    fontSize: 13, 
                    color: '#444' 
                  }}>
                    <strong>Giải thích:</strong> {q.explanation}
                  </div>
                )}

              </div>
            );
          })}
        </div>

        {/* Right Column: Question Palette Sidebar */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div className="box-card">
            <h4 style={{ fontSize: 14, fontWeight: 600, color: '#222222', marginBottom: 12 }}>
              Bảng câu hỏi ({answeredCount}/{questions.length})
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {questions.map((q, idx) => {
                const isAnswered = userAnswers[idx] !== undefined;
                let bg = '#ffffff';
                let col = '#222222';
                let border = '#dddddd';

                if (isSubmitted) {
                  const correct = q.options[userAnswers[idx]]?.isCorrect;
                  bg = correct ? '#f0fdf4' : '#fef2f2';
                  col = correct ? '#16a34a' : '#dc2626';
                  border = correct ? '#16a34a' : '#dc2626';
                } else if (isAnswered) {
                  bg = '#fffbeb';
                  col = '#b45309';
                  border = '#f5b301';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      document.getElementById(`q-${idx}`)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      background: bg,
                      color: col,
                      border: `1px solid ${border}`,
                      borderRadius: 4,
                      padding: '8px 0',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 12, color: '#666666', borderTop: '1px solid #e5e5e5', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, background: '#fffbeb', border: '1px solid #f5b301', borderRadius: 2 }} />
                <span>Đã làm</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, background: '#fff', border: '1px solid #ddd', borderRadius: 2 }} />
                <span>Chưa chọn</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.4)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000, 
          padding: 16 
        }}>
          <div className="box-card" style={{ maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#222', margin: '0 0 8px' }}>
              Xác nhận nộp bài kiểm tra?
            </h3>
            <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px', lineHeight: 1.5 }}>
              Bạn đã hoàn thành <strong>{answeredCount} / {questions.length}</strong> câu hỏi. Bạn có chắc muốn nộp bài để xem điểm số ngay bây giờ không?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="btn btn-secondary"
              >
                Tiếp tục làm bài
              </button>
              <button 
                onClick={handleSubmitTest}
                className="btn btn-primary"
              >
                Nộp bài ngay
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default VocabTestMode;
