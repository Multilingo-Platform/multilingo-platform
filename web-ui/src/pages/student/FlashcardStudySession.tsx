import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  RotateCw, 
  Volume2, 
  CheckCircle2, 
  Flame, 
  Sparkles, 
  Layers,
  HelpCircle
} from 'lucide-react';

interface Flashcard {
  id: number;
  word: string;
  ipa: string;
  type: string;
  meaning: string;
  example: string;
  contextSource: string;
}

const CARDS_TODAY: Flashcard[] = [
  {
    id: 1,
    word: 'Ubiquitous',
    ipa: '/juːˈbɪk.wɪ.təs/',
    type: 'adjective',
    meaning: 'Có mặt ở khắp nơi, phổ biến cùng một lúc',
    example: 'Smartphones have become virtually ubiquitous in contemporary society.',
    contextSource: 'IELTS Cam 18 - Reading Passage 1'
  },
  {
    id: 2,
    word: 'Altruism',
    ipa: '/ˈæl.tru.ɪ.zəm/',
    type: 'noun',
    meaning: 'Lòng vị tha, sự quan tâm vô tư tới quyền lợi người khác',
    example: 'Adolescents engage in voluntary work out of genuine altruism.',
    contextSource: 'IELTS Cam 18 - Writing Task 2'
  },
  {
    id: 3,
    word: 'Cohesion',
    ipa: '/kəʊˈhiː.ʒən/',
    type: 'noun',
    meaning: 'Sự gắn kết, tính liên kết chặt chẽ',
    example: 'Community initiatives strengthen overall societal cohesion.',
    contextSource: 'TOEIC ETS 2023 - Reading Part 7'
  },
  {
    id: 4,
    word: 'Disparity',
    ipa: '/dɪˈspær.ə.ti/',
    type: 'noun',
    meaning: 'Sự chênh lệch, sự bất bình đẳng',
    example: 'The economic disparity between rural and metropolitan areas continues to widen.',
    contextSource: 'IELTS Cam 17 - Reading Passage 2'
  },
  {
    id: 5,
    word: 'Formative',
    ipa: '/ˈfɔː.mə.tɪv/',
    type: 'adjective',
    meaning: 'Mang tính định hình nhân cách và sự phát triển',
    example: 'Secondary school education plays a formative role in young adults.',
    contextSource: 'IELTS Writing Task 2 Lexicon'
  }
];

const FlashcardStudySession = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const currentCard = CARDS_TODAY[currentIndex];
  const progressPercent = Math.round(((currentIndex) / CARDS_TODAY.length) * 100);

  // Keyboard navigation: Space to flip, 1-4 to rate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (isFlipped) {
        if (e.key === '1') handleRate('again');
        if (e.key === '2') handleRate('hard');
        if (e.key === '3') handleRate('good');
        if (e.key === '4') handleRate('easy');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, currentIndex, isCompleted]);

  const handleRate = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    setIsFlipped(false);
    setReviewedCount(prev => prev + 1);

    if (currentIndex + 1 < CARDS_TODAY.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    alert(`Đang phát âm thanh mẫu cho từ: "${currentCard.word}"`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Session Top Bar */}
      <header style={{ height: 70, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem' }}>
        <button 
          className="btn btn-outline" 
          onClick={() => navigate('/student/flashcards')}
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
        >
          <ArrowLeft size={16} /> Thoát Phiên Học
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Tiến độ: {currentIndex + 1} / {CARDS_TODAY.length} thẻ
          </span>
          <div style={{ width: 140, height: 8, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }} />
          </div>
        </div>

        <div className="badge badge-orange flex-center" style={{ gap: 4, padding: '0.4rem 0.8rem', borderRadius: 20 }}>
          <Flame size={16} fill="currentColor" /> Chuỗi 5 ngày
        </div>
      </header>

      {/* Main Flashcard Stage */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem 4rem' }}>
        
        {!isCompleted ? (
          <div style={{ width: '100%', maxWidth: 640 }} className="slide-up">
            
            {/* 3D Flip Card Container */}
            <div 
              className="flip-card-container"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className={`flip-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
                
                {/* FRONT SIDE */}
                <div className="flip-card-front">
                  <div className="flex-between">
                    <span className="badge badge-gray">{currentCard.type}</span>
                    <button 
                      onClick={playAudio}
                      style={{ background: 'var(--primary-light)', border: 'none', color: 'var(--primary)', padding: 8, borderRadius: '50%', cursor: 'pointer' }}
                    >
                      <Volume2 size={20} />
                    </button>
                  </div>

                  <div style={{ margin: 'auto 0' }}>
                    <h2 style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8 }}>
                      {currentCard.word}
                    </h2>
                    <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {currentCard.ipa}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <RotateCw size={14} /> Bấm vào thẻ hoặc phím [Space] để xem nghĩa
                  </div>
                </div>

                {/* BACK SIDE */}
                <div className="flip-card-back">
                  <div className="flex-between">
                    <span className="badge badge-orange">Định nghĩa & Ngữ cảnh</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
                      {currentCard.contextSource}
                    </span>
                  </div>

                  <div style={{ margin: 'auto 0' }}>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
                      {currentCard.meaning}
                    </h3>
                    <div style={{ background: 'white', padding: '1rem', borderRadius: 10, border: '1px solid #fed7aa', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                      "{currentCard.example}"
                    </div>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Hãy chọn mức độ ghi nhớ theo thang đo SuperMemo SM-2 bên dưới:
                  </div>
                </div>

              </div>
            </div>

            {/* SM-2 Rating Buttons (Active when flipped) */}
            <div style={{ marginTop: '2rem' }}>
              {isFlipped ? (
                <div className="slide-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                  <button
                    onClick={() => handleRate('again')}
                    className="btn"
                    style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', flexDirection: 'column', padding: '0.75rem 0.5rem', gap: 2 }}
                  >
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>[1] Chưa nhớ</span>
                    <strong style={{ fontSize: '0.95rem' }}>Quên (&lt;10p)</strong>
                  </button>

                  <button
                    onClick={() => handleRate('hard')}
                    className="btn"
                    style={{ background: '#ffedd5', border: '1px solid #fdba74', color: '#c2410c', flexDirection: 'column', padding: '0.75rem 0.5rem', gap: 2 }}
                  >
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>[2] Khá khó</span>
                    <strong style={{ fontSize: '0.95rem' }}>Khó (1 ngày)</strong>
                  </button>

                  <button
                    onClick={() => handleRate('good')}
                    className="btn"
                    style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', flexDirection: 'column', padding: '0.75rem 0.5rem', gap: 2 }}
                  >
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>[3] Nhớ được</span>
                    <strong style={{ fontSize: '0.95rem' }}>Nhớ Tốt (3 ngày)</strong>
                  </button>

                  <button
                    onClick={() => handleRate('easy')}
                    className="btn"
                    style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', flexDirection: 'column', padding: '0.75rem 0.5rem', gap: 2 }}
                  >
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>[4] Thuộc làu</span>
                    <strong style={{ fontSize: '0.95rem' }}>Rất Dễ (7 ngày)</strong>
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  💡 Gợi ý: Hãy tự nhớ nghĩa trong đầu trước khi lật mặt sau để kích hoạt ghi nhớ chủ động (Active Recall).
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Session Completed Summary Screen */
          <div className="ed-card slide-up" style={{ width: '100%', maxWidth: 540, padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <CheckCircle2 size={42} />
            </div>

            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
              Hoàn Thành Phiên Ôn Tập Hôm Nay!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Bạn đã ôn luyện thành công <strong>{reviewedCount} thẻ từ vựng</strong>. Thuật toán SuperMemo SM-2 đã tự động tính toán lại chu kỳ nhắc nhở tiếp theo cho từng từ.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 10 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Từ đã ôn</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{reviewedCount}</div>
              </div>
              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 10 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Chuỗi học tập</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Flame size={20} fill="currentColor" /> +1 Ngày
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => navigate('/student/flashcards')}
                style={{ flex: 1, padding: '0.85rem' }}
              >
                Về Sổ Tay Flashcard
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => { setCurrentIndex(0); setIsCompleted(false); setIsFlipped(false); }}
                style={{ padding: '0.85rem 1.25rem' }}
              >
                Ôn Lại
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default FlashcardStudySession;
