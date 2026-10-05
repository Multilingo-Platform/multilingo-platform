import React, { useState, useMemo } from 'react';
import { ArrowLeft, Volume2, CheckCircle2, XCircle, RotateCcw, Award, Flame } from 'lucide-react';
import type { DeckSummary, Flashcard } from '../../types/vocab';
import { speakWord } from '../../utils/speech';
import './vocab.css';

export interface QuizPracticeViewProps {
  deck: DeckSummary;
  cards: Flashcard[];
  onBack: () => void;
}

interface Question {
  card: Flashcard;
  options: string[];
  correctAnswer: string;
}

export const QuizPracticeView: React.FC<QuizPracticeViewProps> = ({ deck, cards, onBack }) => {
  // Chuẩn bị danh sách câu hỏi trắc nghiệm từ các thẻ từ vựng
  const questions: Question[] = useMemo(() => {
    if (cards.length < 4) return [];
    
    // Xáo trộn danh sách thẻ
    const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
    const validCards = shuffledCards.filter((c) => Boolean(c.customMeaning && c.customMeaning.trim()));
    const targetPool = validCards.length >= 4 ? validCards : cards;

    return targetPool.map((currentCard) => {
      const correctAnswer = currentCard.customMeaning || currentCard.customWord;
      // Chọn 3 đáp án sai từ các thẻ khác
      const otherMeanings = targetPool
        .filter((c) => c.id !== currentCard.id)
        .map((c) => c.customMeaning || c.customWord)
        .filter((m) => m !== correctAnswer);
      
      const shuffledOthers = [...new Set(otherMeanings)].sort(() => Math.random() - 0.5).slice(0, 3);
      
      // Nếu thiếu đáp án, bổ sung placeholder hợp lý
      while (shuffledOthers.length < 3) {
        shuffledOthers.push(`Nghĩa bổ trợ ${shuffledOthers.length + 1}`);
      }

      const options = [correctAnswer, ...shuffledOthers].sort(() => Math.random() - 0.5);

      return {
        card: currentCard,
        options,
        correctAnswer,
      };
    });
  }, [cards]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (option: string) => {
    if (isAnswered || isFinished || !currentQ) return;

    setSelectedOption(option);
    setIsAnswered(true);

    const isCorrect = option === currentQ.correctAnswer;
    if (isCorrect) {
      setScore((s) => s + 1);
      setStreak((st) => {
        const next = st + 1;
        if (next > maxStreak) setMaxStreak(next);
        return next;
      });
    } else {
      setStreak(0);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setStreak(0);
    setIsFinished(false);
  };

  if (questions.length < 4) {
    return (
      <div className="vocab-interactive-container">
        <div className="vocab-view-header-bar">
          <button onClick={onBack} className="vocab-deck-back-btn">
            <ArrowLeft size={18} /> Quay lại bộ thẻ
          </button>
        </div>
        <div className="vocab-empty-state-box">
          <XCircle size={48} color="#ef4444" />
          <h3>Chưa đủ từ vựng để luyện tập</h3>
          <p>Chế độ Luyện tập trắc nghiệm cần tối thiểu 4 từ vựng trong bộ thẻ. Vui lòng thêm từ mới trước khi bắt đầu.</p>
          <button onClick={onBack} className="vocab-study-btn-primary" style={{ maxWidth: '200px', margin: '1rem auto 0' }}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Màn hình kết thúc
  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="vocab-interactive-container">
        <div className="vocab-view-header-bar">
          <button onClick={onBack} className="vocab-deck-back-btn">
            <ArrowLeft size={18} /> Quay lại bộ thẻ
          </button>
        </div>

        <div className="vocab-result-card">
          <div className="vocab-result-icon-badge">
            <Award size={40} color="#d97706" />
          </div>
          <h2 className="vocab-result-title">Hoàn thành bài Luyện tập!</h2>
          <p className="vocab-result-desc">
            Bạn đã xuất sắc hoàn thành buổi luyện tập phản xạ từ vựng cho bộ <strong>"{deck.name}"</strong>.
          </p>

          <div className="vocab-result-stats-row">
            <div className="vocab-result-stat-box">
              <span className="vocab-result-stat-val">{score} / {questions.length}</span>
              <span className="vocab-result-stat-label">Số câu đúng</span>
            </div>
            <div className="vocab-result-stat-box">
              <span className="vocab-result-stat-val" style={{ color: percentage >= 80 ? '#16a34a' : '#d97706' }}>
                {percentage}%
              </span>
              <span className="vocab-result-stat-label">Độ chính xác</span>
            </div>
            <div className="vocab-result-stat-box">
              <span className="vocab-result-stat-val" style={{ color: '#ea580c' }}>
                🔥 {maxStreak}
              </span>
              <span className="vocab-result-stat-label">Chuỗi đúng dài nhất</span>
            </div>
          </div>

          <div className="vocab-result-actions">
            <button onClick={handleRestart} className="vocab-study-btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <RotateCcw size={18} /> Luyện tập lại
            </button>
            <button onClick={onBack} className="vocab-study-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={18} /> Về bộ thẻ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vocab-interactive-container">
      {/* Top Header */}
      <div className="vocab-view-header-bar">
        <button onClick={onBack} className="vocab-deck-back-btn">
          <ArrowLeft size={18} /> Thoát luyện tập
        </button>

        <div className="vocab-quiz-meta-info">
          {streak > 1 && (
            <div className="vocab-streak-badge">
              <Flame size={16} fill="#ea580c" color="#ea580c" />
              <span>Chuỗi đúng x{streak}</span>
            </div>
          )}
          <span className="vocab-count-indicator">
            Câu {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="vocab-interactive-progress-bar">
        <div
          className="vocab-interactive-progress-fill"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="vocab-quiz-question-card">
        <span className="vocab-quiz-prompt-label">Chọn định nghĩa chính xác của từ vựng:</span>
        <div className="vocab-quiz-word-row">
          <h2 className="vocab-quiz-word-text">{currentQ.card.customWord}</h2>
          <button
            onClick={() => speakWord(currentQ.card.customWord, deck.targetLanguage)}
            className="vocab-audio-btn-large"
            title="Nghe phát âm"
          >
            <Volume2 size={24} />
          </button>
        </div>
        {currentQ.card.phonetic && (
          <span className="vocab-quiz-phonetic">{currentQ.card.phonetic}</span>
        )}
      </div>

      {/* Options Grid */}
      <div className="vocab-quiz-options-grid">
        {currentQ.options.map((option, idx) => {
          let btnClass = 'vocab-quiz-option-btn';
          if (isAnswered) {
            if (option === currentQ.correctAnswer) {
              btnClass += ' correct';
            } else if (option === selectedOption) {
              btnClass += ' wrong';
            } else {
              btnClass += ' dimmed';
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelectOption(option)}
              disabled={isAnswered}
              className={btnClass}
            >
              <span className="vocab-quiz-option-letter">
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="vocab-quiz-option-text">{option}</span>
              {isAnswered && option === currentQ.correctAnswer && (
                <CheckCircle2 size={20} color="#16a34a" style={{ marginLeft: 'auto', flexShrink: 0 }} />
              )}
              {isAnswered && option === selectedOption && option !== currentQ.correctAnswer && (
                <XCircle size={20} color="#dc2626" style={{ marginLeft: 'auto', flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback & Next Button */}
      {isAnswered && (
        <div className="vocab-quiz-feedback-bar">
          <div className="vocab-quiz-feedback-content">
            {selectedOption === currentQ.correctAnswer ? (
              <div className="vocab-quiz-feedback-msg success">
                <CheckCircle2 size={20} />
                <span>Chính xác! Làm tốt lắm.</span>
              </div>
            ) : (
              <div className="vocab-quiz-feedback-msg error">
                <XCircle size={20} />
                <span>Chưa đúng! Đáp án đúng: <strong>{currentQ.correctAnswer}</strong></span>
              </div>
            )}
            {currentQ.card.exampleSentence && (
              <p className="vocab-quiz-feedback-example">
                💡 Ngữ cảnh: <em>"{currentQ.card.exampleSentence}"</em>
              </p>
            )}
          </div>
          <button onClick={handleNext} className="vocab-study-btn-primary" style={{ minWidth: '150px' }}>
            {currentIndex + 1 < questions.length ? 'Câu tiếp theo ➔' : 'Xem kết quả 🏆'}
          </button>
        </div>
      )}
    </div>
  );
};
