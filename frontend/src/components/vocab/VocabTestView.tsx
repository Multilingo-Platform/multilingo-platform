import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, RotateCcw, Volume2, ShieldCheck } from 'lucide-react';
import type { DeckSummary, Flashcard } from '../../types/vocab';
import { speakWord } from '../../utils/speech';
import './vocab.css';

export interface VocabTestViewProps {
  deck: DeckSummary;
  cards: Flashcard[];
  onBack: () => void;
}

interface TestQuestion {
  id: number;
  card: Flashcard;
  options: string[];
  correctAnswer: string;
}

export const VocabTestView: React.FC<VocabTestViewProps> = ({ deck, cards, onBack }) => {
  // Chuẩn bị danh sách 10 câu hỏi thi thử
  const testQuestions: TestQuestion[] = useMemo(() => {
    if (cards.length < 4) return [];
    
    const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
    const selectedPool = shuffledCards.slice(0, Math.min(10, shuffledCards.length));

    return selectedPool.map((currentCard, index) => {
      const correctAnswer = currentCard.customMeaning || currentCard.customWord;
      const otherOptions = cards
        .filter((c) => c.id !== currentCard.id)
        .map((c) => c.customMeaning || c.customWord)
        .filter((m) => m !== correctAnswer);

      const shuffledOthers = [...new Set(otherOptions)].sort(() => Math.random() - 0.5).slice(0, 3);
      while (shuffledOthers.length < 3) {
        shuffledOthers.push(`Lựa chọn dự phòng ${shuffledOthers.length + 1}`);
      }

      const options = [correctAnswer, ...shuffledOthers].sort(() => Math.random() - 0.5);

      return {
        id: index + 1,
        card: currentCard,
        options,
        correctAnswer,
      };
    });
  }, [cards]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(300); // 5 phút = 300 giây
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Đếm ngược thời gian
  useEffect(() => {
    if (isSubmitted || testQuestions.length < 4) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSubmitted, testQuestions.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectAnswer = (option: string) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentIndex]: option,
    }));
  };

  const handleSubmit = () => {
    setShowConfirmSubmit(false);
    setIsSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleRestart = () => {
    setUserAnswers({});
    setCurrentIndex(0);
    setTimeLeft(300);
    setIsSubmitted(false);
    setShowConfirmSubmit(false);
  };

  if (testQuestions.length < 4) {
    return (
      <div className="vocab-interactive-container">
        <div className="vocab-view-header-bar">
          <button onClick={onBack} className="vocab-deck-back-btn">
            <ArrowLeft size={18} /> Quay lại bộ thẻ
          </button>
        </div>
        <div className="vocab-empty-state-box">
          <AlertCircle size={48} color="#ef4444" />
          <h3>Chưa đủ từ vựng để mở bài thi thử</h3>
          <p>Chế độ Thi thử cần tối thiểu 4 từ vựng trong bộ thẻ để thiết lập các câu hỏi trắc nghiệm khách quan.</p>
          <button onClick={onBack} className="vocab-study-btn-primary" style={{ maxWidth: '200px', margin: '1rem auto 0' }}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Kết quả sau khi nộp bài
  if (isSubmitted) {
    let correctCount = 0;
    testQuestions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / testQuestions.length) * 100);
    const timeUsed = 300 - timeLeft;

    return (
      <div className="vocab-interactive-container">
        <div className="vocab-view-header-bar">
          <button onClick={onBack} className="vocab-deck-back-btn">
            <ArrowLeft size={18} /> Quay lại bộ thẻ
          </button>
        </div>

        <div className="vocab-result-card">
          <div className="vocab-result-icon-badge" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
            <ShieldCheck size={40} color="#059669" />
          </div>
          <h2 className="vocab-result-title">Kết Quả Bài Thi Thử Từ Vựng</h2>
          <p className="vocab-result-desc">
            Bộ thẻ: <strong>{deck.name}</strong> • Thời gian làm bài: <strong>{formatTime(timeUsed)}</strong>
          </p>

          <div className="vocab-result-stats-row">
            <div className="vocab-result-stat-box">
              <span className="vocab-result-stat-val" style={{ color: score >= 80 ? '#16a34a' : '#ea580c' }}>
                {score}/100
              </span>
              <span className="vocab-result-stat-label">Điểm số</span>
            </div>
            <div className="vocab-result-stat-box">
              <span className="vocab-result-stat-val">{correctCount} / {testQuestions.length}</span>
              <span className="vocab-result-stat-label">Số câu đúng</span>
            </div>
            <div className="vocab-result-stat-box">
              <span className="vocab-result-stat-val" style={{ color: '#2563eb' }}>
                {formatTime(timeUsed)}
              </span>
              <span className="vocab-result-stat-label">Thời gian hoàn thành</span>
            </div>
          </div>

          {/* Chi tiết đáp án từng câu */}
          <div className="vocab-test-review-list">
            <h3 className="vocab-test-review-title">Chi tiết từng câu hỏi:</h3>
            {testQuestions.map((q, idx) => {
              const isCorrect = userAnswers[idx] === q.correctAnswer;
              return (
                <div key={idx} className={`vocab-test-review-item ${isCorrect ? 'correct' : 'wrong'}`}>
                  <div className="vocab-test-review-item-header">
                    <span className="vocab-test-review-num">Câu {idx + 1}: <strong>{q.card.customWord}</strong></span>
                    {isCorrect ? (
                      <span className="vocab-test-review-badge success">
                        <CheckCircle size={14} /> Chính xác (+10đ)
                      </span>
                    ) : (
                      <span className="vocab-test-review-badge danger">
                        <XCircle size={14} /> Chưa đúng
                      </span>
                    )}
                  </div>
                  <div className="vocab-test-review-detail">
                    <p>Bạn chọn: <strong>{userAnswers[idx] || 'Chưa trả lời'}</strong></p>
                    {!isCorrect && (
                      <p style={{ color: '#16a34a' }}>Đáp án đúng: <strong>{q.correctAnswer}</strong></p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="vocab-result-actions" style={{ marginTop: '2rem' }}>
            <button onClick={handleRestart} className="vocab-study-btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <RotateCcw size={18} /> Thi lại đề khác
            </button>
            <button onClick={onBack} className="vocab-study-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={18} /> Về chi tiết bộ thẻ
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = testQuestions[currentIndex];
  const answeredCount = Object.keys(userAnswers).length;

  return (
    <div className="vocab-interactive-container">
      {/* Header bar */}
      <div className="vocab-view-header-bar">
        <button onClick={onBack} className="vocab-deck-back-btn">
          <ArrowLeft size={18} /> Rời bài thi
        </button>

        {/* Đồng hồ đếm ngược */}
        <div className={`vocab-test-timer-badge ${timeLeft < 60 ? 'urgent' : ''}`}>
          <Clock size={18} />
          <span>{formatTime(timeLeft)}</span>
        </div>

        <button onClick={() => setShowConfirmSubmit(true)} className="vocab-btn-submit-test">
          Nộp bài ({answeredCount}/{testQuestions.length})
        </button>
      </div>

      <div className="vocab-test-layout-grid">
        {/* Vùng câu hỏi chính */}
        <div className="vocab-test-main-panel">
          <div className="vocab-quiz-question-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span className="vocab-quiz-prompt-label">Câu hỏi {currentIndex + 1} / {testQuestions.length}</span>
              <button
                onClick={() => speakWord(currentQ.card.customWord, deck.targetLanguage)}
                className="vocab-audio-btn-large"
                title="Nghe phát âm"
              >
                <Volume2 size={20} />
              </button>
            </div>

            <h2 className="vocab-quiz-word-text">{currentQ.card.customWord}</h2>
            {currentQ.card.phonetic && (
              <span className="vocab-quiz-phonetic">{currentQ.card.phonetic}</span>
            )}
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Hãy chọn định nghĩa chính xác nhất của từ trên:
            </p>
          </div>

          {/* Danh sách 4 lựa chọn */}
          <div className="vocab-quiz-options-grid">
            {currentQ.options.map((option, idx) => {
              const isSelected = userAnswers[currentIndex] === option;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectAnswer(option)}
                  className={`vocab-quiz-option-btn ${isSelected ? 'selected' : ''}`}
                >
                  <span className="vocab-quiz-option-letter">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="vocab-quiz-option-text">{option}</span>
                </button>
              );
            })}
          </div>

          {/* Nút điều hướng trước / sau */}
          <div className="vocab-test-nav-actions">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="vocab-btn-secondary"
            >
              ← Câu trước
            </button>
            <button
              onClick={() => setCurrentIndex((i) => Math.min(testQuestions.length - 1, i + 1))}
              disabled={currentIndex === testQuestions.length - 1}
              className="vocab-study-btn-primary"
            >
              Câu tiếp ➔
            </button>
          </div>
        </div>

        {/* Bảng điều hướng các câu hỏi (Palette) */}
        <div className="vocab-test-sidebar-palette">
          <h3 className="vocab-test-palette-title">Danh sách câu hỏi</h3>
          <div className="vocab-test-palette-grid">
            {testQuestions.map((q, idx) => {
              const isAnswered = Boolean(userAnswers[idx]);
              const isCurrent = currentIndex === idx;
              let itemClass = 'vocab-palette-item';
              if (isCurrent) itemClass += ' current';
              if (isAnswered) itemClass += ' answered';

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={itemClass}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="vocab-test-palette-legend">
            <div className="legend-row">
              <span className="legend-box answered"></span>
              <span>Đã trả lời ({answeredCount})</span>
            </div>
            <div className="legend-row">
              <span className="legend-box"></span>
              <span>Chưa làm ({testQuestions.length - answeredCount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Xác nhận nộp bài */}
      {showConfirmSubmit && (
        <div className="vocab-modal-backdrop" onClick={() => setShowConfirmSubmit(false)}>
          <div className="vocab-modal-card" style={{ maxWidth: '420px', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>
              Xác nhận nộp bài thi?
            </h3>
            <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Bạn đã hoàn thành <strong>{answeredCount} / {testQuestions.length}</strong> câu hỏi. Bạn có chắc chắn muốn nộp bài để chấm điểm ngay bây giờ?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConfirmSubmit(false)} className="vocab-btn-secondary">
                Làm tiếp
              </button>
              <button onClick={handleSubmit} className="vocab-study-btn-primary">
                Nộp bài ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
