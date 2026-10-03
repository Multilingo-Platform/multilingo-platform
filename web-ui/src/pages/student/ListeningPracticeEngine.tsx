import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  FileText, 
  CheckCircle, 
  Sparkles,
  Headphones
} from 'lucide-react';

const ListeningPracticeEngine = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(42);
  const [duration] = useState(380); // 6m 20s
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showTranscript, setShowTranscript] = useState(false);

  // Exam State
  const [timeLeft, setTimeLeft] = useState(1800); // 30 mins
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({
    q1: 'South Bank',
    q2: '',
    q3: '0412 889 123',
    q4: '',
    q5: 'student card',
    q6: 'B',
    q7: '',
    q8: 'A',
    q9: '',
    q10: 'C',
  });

  // Simulated audio playing loop
  useEffect(() => {
    let interval: any;
    if (isPlaying && currentTime < duration) {
      interval = setInterval(() => {
        setCurrentTime(prev => Math.min(prev + 1, duration));
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTime, duration, playbackSpeed]);

  // Exam timer countdown
  useEffect(() => {
    if (isSubmitted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (qKey: string, val: string) => {
    setUserAnswers(prev => ({ ...prev, [qKey]: val }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      {/* Top Header */}
      <header style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', padding: '0.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flex-center" style={{ gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ padding: '0.5rem', border: 'none' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-orange flex-center" style={{ gap: 4 }}>
                <Headphones size={13} /> LISTENING
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                IELTS Listening Practice - Test 1 ({id || 'cam-18-1'})
              </h2>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Section 1: Accommodation Inquiry & Part 2: Campus Tour</span>
          </div>
        </div>

        {isSubmitted ? (
          <div className="flex-center" style={{ gap: '1.5rem' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>
              Điểm số: <span style={{ color: 'var(--primary)', fontSize: '1.4rem', fontWeight: 800 }}>8.0</span> / 9.0 (8/10 câu đúng)
            </div>
            <button className="btn btn-primary" onClick={() => navigate(`/student/exam/${id || 'cam-18-1'}/result`)}>
              Xem Lời Giải Chi Tiết
            </button>
          </div>
        ) : (
          <div className="flex-center" style={{ gap: '1.5rem' }}>
            <div className="flex-center badge badge-orange" style={{ gap: '0.5rem', fontSize: '1.15rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
              <Clock size={18} /> {formatTime(timeLeft)}
            </div>
            <button className="btn btn-primary" onClick={() => setIsSubmitted(true)}>
              Nộp Bài Thi
            </button>
          </div>
        )}
      </header>

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane: Audio Waveform Player & Transcript */}
        <div style={{ flex: 1.1, padding: '2rem 2.5rem', overflowY: 'auto', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column' }}>
          
          {/* Audio Player Card */}
          <div className="ed-card" style={{ padding: '1.75rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)', color: 'white', borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Headphones size={22} color="white" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Audio Track - Section 1 & 2</h3>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Official Recording (British Council Accent)</span>
                </div>
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', padding: '3px 10px', borderRadius: 20 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Dynamic Waveform Visualizer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 45, marginBottom: '1.25rem', padding: '0 4px' }}>
              {Array.from({ length: 48 }).map((_, index) => {
                const progressRatio = currentTime / duration;
                const isPassed = index / 48 <= progressRatio;
                // Pseudo random bar heights
                const heights = [20, 35, 15, 45, 30, 25, 40, 10, 32, 28, 42, 18, 26, 38, 14, 44, 22, 34, 16, 40, 30, 24, 36, 12, 28, 42, 18, 32, 24, 38, 14, 44, 20, 30, 15, 35, 25, 40, 18, 30, 22, 36, 12, 28, 38, 16, 34, 20];
                const barHeight = heights[index % heights.length];
                return (
                  <div
                    key={index}
                    onClick={() => setCurrentTime(Math.floor((index / 48) * duration))}
                    style={{
                      flex: 1,
                      height: `${barHeight}px`,
                      background: isPassed ? 'var(--primary)' : '#4b5563',
                      borderRadius: 3,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      boxShadow: isPassed && isPlaying ? '0 0 6px rgba(217, 119, 6, 0.6)' : 'none'
                    }}
                  />
                );
              })}
            </div>

            {/* Controls Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button 
                  onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
                  title="Tua lại 5s"
                  style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 6 }}
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    border: 'none',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.4)'
                  }}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
                </button>
                <button 
                  onClick={() => setCurrentTime(Math.min(duration, currentTime + 5))}
                  title="Tua tới 5s"
                  style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 6 }}
                >
                  <RotateCw size={18} />
                </button>
              </div>

              {/* Speed Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 3 }}>
                {[0.75, 1.0, 1.25, 1.5].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    style={{
                      background: playbackSpeed === speed ? 'var(--primary)' : 'transparent',
                      border: 'none',
                      color: 'white',
                      borderRadius: 16,
                      padding: '3px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af' }}>
                <Volume2 size={18} />
                <span style={{ fontSize: '0.8rem' }}>100%</span>
              </div>
            </div>
          </div>

          {/* Transcript Toggle & View */}
          <div className="ed-card" style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.95rem' }}>
                <FileText size={18} color="var(--primary)" />
                <span>Audio Transcript (Lời thoại bài nghe)</span>
              </div>
              <button 
                className="btn btn-outline" 
                onClick={() => setShowTranscript(!showTranscript)}
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
              >
                {showTranscript ? 'Ẩn Lời Thoại' : 'Hiện Lời Thoại'}
              </button>
            </div>

            {showTranscript ? (
              <div style={{ fontSize: '0.92rem', lineHeight: 1.8, color: 'var(--text-secondary)', overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
                <p><strong>OFFICER:</strong> Good morning. Can I help you?</p>
                <p><strong>STUDENT:</strong> Yes, I'm looking for accommodation near the university campus for the upcoming autumn semester.</p>
                <p><strong>OFFICER:</strong> Sure. May I take down your preferred district first?</p>
                <p><strong>STUDENT:</strong> I would prefer somewhere in <mark style={{ background: '#fef08a', padding: '1px 4px', borderRadius: 3 }}>South Bank</mark> area because my department is situated right across the river.</p>
                <p><strong>OFFICER:</strong> Excellent. And what kind of monthly budget range are we considering?</p>
                <p><strong>STUDENT:</strong> Up to about <mark style={{ background: '#fef08a', padding: '1px 4px', borderRadius: 3 }}>$650</mark> per month including utility bills.</p>
                <p><strong>OFFICER:</strong> Alright, let me register your contact phone number please...</p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                <Headphones size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.9rem' }}>Lời thoại đang được ẩn để mô phỏng điều kiện thi thật.</p>
                <p style={{ fontSize: '0.8rem' }}>Bấm nút "Hiện Lời Thoại" phía trên nếu bạn muốn đọc lại transcript khi ôn luyện.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Questions & Answer Sheet */}
        <div style={{ flex: 1.2, padding: '2rem 2.5rem', overflowY: 'auto', background: 'var(--bg-primary)' }}>
          
          {/* Section 1 Questions */}
          <div className="ed-card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="badge badge-orange">Section 1: Questions 1 - 5</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Complete the notes below. Write ONE WORD AND/OR A NUMBER.</span>
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
              Accommodation Request Form
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, width: 28 }}>Q1.</span>
                <span>Preferred Location:</span>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '220px', padding: '0.45rem 0.8rem' }}
                  value={userAnswers.q1}
                  onChange={(e) => handleAnswerChange('q1', e.target.value)}
                  placeholder="Điền đáp án..."
                />
                {isSubmitted && <span className="badge badge-green">Đúng (+1)</span>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, width: 28 }}>Q2.</span>
                <span>Maximum Monthly Rent: $</span>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '180px', padding: '0.45rem 0.8rem' }}
                  value={userAnswers.q2}
                  onChange={(e) => handleAnswerChange('q2', e.target.value)}
                  placeholder="VD: 650"
                />
                {isSubmitted && <span className="badge badge-gray" style={{ color: 'var(--danger)' }}>Đáp án đúng: 650</span>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, width: 28 }}>Q3.</span>
                <span>Student Phone Number:</span>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '220px', padding: '0.45rem 0.8rem' }}
                  value={userAnswers.q3}
                  onChange={(e) => handleAnswerChange('q3', e.target.value)}
                  placeholder="Số điện thoại..."
                />
                {isSubmitted && <span className="badge badge-green">Đúng (+1)</span>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, width: 28 }}>Q4.</span>
                <span>Move-in Date:</span>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '220px', padding: '0.45rem 0.8rem' }}
                  value={userAnswers.q4}
                  onChange={(e) => handleAnswerChange('q4', e.target.value)}
                  placeholder="VD: 15th September"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, width: 28 }}>Q5.</span>
                <span>Required Identification:</span>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '220px', padding: '0.45rem 0.8rem' }}
                  value={userAnswers.q5}
                  onChange={(e) => handleAnswerChange('q5', e.target.value)}
                  placeholder="Điền từ..."
                />
                {isSubmitted && <span className="badge badge-green">Đúng (+1)</span>}
              </div>
            </div>
          </div>

          {/* Section 2 Questions - Multiple Choice */}
          <div className="ed-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="badge badge-orange">Section 2: Questions 6 - 8</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choose the correct letter, A, B, or C.</span>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>
                Q6. What makes the university central library unique according to the speaker?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem' }}>
                {[
                  { key: 'A', text: 'It remains open 24 hours every day during term time.' },
                  { key: 'B', text: 'It houses the largest rare manuscript collection in the state.' },
                  { key: 'C', text: 'It provides completely free printing services for freshmen.' },
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="radio" 
                      name="q6" 
                      checked={userAnswers.q6 === opt.key} 
                      onChange={() => handleAnswerChange('q6', opt.key)} 
                    />
                    <span><strong>{opt.key}.</strong> {opt.text}</span>
                  </label>
                ))}
              </div>
              {isSubmitted && <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--success)' }}>✓ Đáp án B là chính xác</div>}
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>
                Q7. When is the orientation campus tour scheduled to begin?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem' }}>
                {[
                  { key: 'A', text: '9:00 AM at the North Gate.' },
                  { key: 'B', text: '10:30 AM outside the Student Union Hall.' },
                  { key: 'C', text: '1:15 PM inside the Sports Complex.' },
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="radio" 
                      name="q7" 
                      checked={userAnswers.q7 === opt.key} 
                      onChange={() => handleAnswerChange('q7', opt.key)} 
                    />
                    <span><strong>{opt.key}.</strong> {opt.text}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Palette Questions at bottom */}
          <div className="ed-card" style={{ marginTop: '1.5rem', padding: '1rem 1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
              Bảng Tiến Trình Câu Hỏi:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'].map((q, idx) => {
                const isAnswered = !!userAnswers[q];
                return (
                  <div
                    key={q}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      background: isAnswered ? 'var(--primary)' : 'var(--bg-tertiary)',
                      color: isAnswered ? 'white' : 'var(--text-secondary)',
                      border: '1px solid var(--border-dark)',
                      cursor: 'pointer'
                    }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ListeningPracticeEngine;
