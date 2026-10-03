import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  Sparkles, 
  Send, 
  FileEdit, 
  BookOpen, 
  Lightbulb, 
  CheckCircle2, 
  BookmarkPlus,
  HelpCircle,
  X
} from 'lucide-react';

const WritingPracticeEngine = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTask, setActiveTask] = useState<'task1' | 'task2'>('task2');
  const [timeLeft, setTimeLeft] = useState(2400); // 40 mins
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [selectedWord, setSelectedWord] = useState('');
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  // Student essay text
  const [essayText, setEssayText] = useState(
`In contemporary society, whether volunteer work should be enforced as a compulsory obligation in high school curricula remains a subject of intense controversy. While some critics express concerns regarding academic overload, I firmly concur with the view that mandatory community service confers indispensable merits upon teenagers' holistic development and societal cohesion.

Primarily, participation in unpaid community engagement nurtures a profound sense of civic responsibility and altruism. During their formative secondary education years, adolescents are susceptible to becoming overly self-centred due to mounting exam pressures. Engaging directly in charitable endeavors—such as aiding vulnerable elderly residents in nursing homes or assisting local environmental clean-up initiatives—allows students to witness underprivileged realities firsthand.`
  );

  // Word count calculation
  const words = essayText.trim() ? essayText.trim().split(/\s+/).length : 0;
  const targetWords = activeTask === 'task1' ? 150 : 250;
  const progressPercent = Math.min(100, Math.round((words / targetWords) * 100));

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTextSelect = (e: React.MouseEvent) => {
    const text = window.getSelection()?.toString().trim();
    if (text && text.length < 30) {
      setSelectedWord(text);
      setPopupPos({ x: e.pageX, y: e.pageY - 60 });
    } else {
      setSelectedWord('');
    }
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
                <FileEdit size={13} /> WRITING PRACTICE
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                IELTS Academic Writing ({id || 'cam-18-1'})
              </h2>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Trình soạn thảo văn bản học thuật kết nối Trợ lý AI Gemini
            </span>
          </div>
        </div>

        <div className="flex-center" style={{ gap: '1.25rem' }}>
          {/* AI Hints Trigger */}
          <button 
            className="btn btn-light"
            onClick={() => setShowAiDrawer(true)}
            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, borderColor: 'var(--primary)' }}
          >
            <Sparkles size={18} />
            <span>💡 Gợi ý AI Hints (Gemini)</span>
          </button>

          <div className="flex-center badge badge-orange" style={{ gap: '0.5rem', fontSize: '1.15rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
            <Clock size={18} /> {formatTime(timeLeft)}
          </div>

          <button 
            className="btn btn-primary"
            onClick={() => navigate(`/student/exam/${id || 'cam-18-1'}/result`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Send size={16} /> Nộp Bài Chấm Điểm AI
          </button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* Left Pane: Prompt & Instructions */}
        <div 
          style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-light)' }}
          onMouseUp={handleTextSelect}
        >
          {/* Task 1 / Task 2 Switcher */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <button
              onClick={() => setActiveTask('task1')}
              className={`btn ${activeTask === 'task1' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            >
              Task 1 (Report - 150 words)
            </button>
            <button
              onClick={() => setActiveTask('task2')}
              className={`btn ${activeTask === 'task2' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            >
              Task 2 (Essay - 250 words)
            </button>
          </div>

          {activeTask === 'task2' ? (
            <div className="slide-up">
              <span className="badge badge-gray" style={{ marginBottom: '1rem', display: 'inline-block' }}>
                WRITING TASK 2 - OPINION ESSAY
              </span>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.5, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Some people believe that unpaid community service should be a compulsory part of high school programmes. To what extent do you agree or disagree?
              </h1>

              <div style={{ background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Yêu cầu đề bài (Instructions):
                </h4>
                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  <li>Give reasons for your answer and include any relevant examples from your own knowledge or experience.</li>
                  <li>Write at least <strong>250 words</strong>.</li>
                  <li>Recommended time: <strong>40 minutes</strong>.</li>
                </ul>
              </div>

              <div className="ed-card" style={{ padding: '1.25rem', background: '#fffbeb', borderColor: '#fde68a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#92400e', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <Lightbulb size={16} /> Mẹo làm bài từ chuyên gia
                </div>
                <p style={{ fontSize: '0.85rem', color: '#78350f', lineHeight: 1.6 }}>
                  Hãy bôi đen bất kỳ từ vựng nào trong đề bài để dịch nghĩa tại chỗ hoặc bấm nút <strong>"💡 Gợi ý AI Hints"</strong> để nhận dàn ý phân tích 3 phần và 10 từ vựng band 8.0+!
                </p>
              </div>
            </div>
          ) : (
            <div className="slide-up">
              <span className="badge badge-gray" style={{ marginBottom: '1rem', display: 'inline-block' }}>
                WRITING TASK 1 - DATA INTERPRETATION
              </span>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.5, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                The chart below shows the percentage of households in different countries with internet access from 2010 to 2024.
              </h1>
              <div style={{ background: '#f3f4f6', height: 260, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', marginBottom: '1.5rem', color: '#64748b' }}>
                [Biểu đồ thống kê đường xu hướng Internet Adoption 2010 - 2024]
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.</p>
            </div>
          )}
        </div>

        {/* Right Pane: Text Area & Word Counter */}
        <div style={{ flex: 1.3, padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
          
          {/* Word Counter Progress Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Số từ: <strong style={{ color: words >= targetWords ? 'var(--success)' : 'var(--primary)', fontSize: '1.1rem' }}>{words}</strong> / {targetWords} từ
              </span>
              {words >= targetWords && (
                <span className="badge badge-green flex-center" style={{ gap: 4 }}>
                  <CheckCircle2 size={12} /> Đã đủ số từ tối thiểu
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {essayText.length} ký tự
            </span>
          </div>

          <div style={{ width: '100%', height: 6, background: 'var(--border-light)', borderRadius: 3, marginBottom: '1.25rem', overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${progressPercent}%`, 
                height: '100%', 
                background: words >= targetWords ? 'var(--success)' : 'var(--primary)',
                transition: 'width 0.3s ease'
              }} 
            />
          </div>

          {/* Text Editor Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <textarea
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              placeholder="Nhập nội dung bài viết của bạn tại đây... Hệ thống sẽ tự động lưu nháp mỗi 30 giây."
              style={{
                flex: 1,
                width: '100%',
                padding: '1.5rem',
                fontSize: '1.02rem',
                lineHeight: 1.8,
                fontFamily: 'Inter, sans-serif',
                border: '1px solid var(--border-dark)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                resize: 'none',
                outline: 'none',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
              }}
            />
          </div>
        </div>

        {/* Quick Translate Popup */}
        {selectedWord && (
          <div 
            className="ed-card slide-up"
            style={{
              position: 'absolute',
              top: popupPos.y,
              left: popupPos.x,
              zIndex: 1000,
              padding: '0.75rem 1rem',
              minWidth: '220px',
              boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
              background: '#1f2937',
              color: 'white',
              borderRadius: 8
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fbbf24' }}>{selectedWord}</span>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>/ˈkɒmpəlsəri/</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#e5e7eb', marginBottom: 8 }}>
              (adj): Bắt buộc, cưỡng bách theo quy định
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => { alert(`Đã lưu "${selectedWord}" vào Flashcard cá nhân kèm ngữ cảnh câu!`); setSelectedWord(''); }}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: '100%' }}
            >
              <BookmarkPlus size={13} /> + Lưu vào Flashcard
            </button>
          </div>
        )}

        {/* AI Hints Drawer */}
        {showAiDrawer && (
          <div 
            className="slide-up"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '420px',
              background: '#ffffff',
              borderLeft: '2px solid var(--border-dark)',
              boxShadow: '-10px 0 25px rgba(0,0,0,0.15)',
              zIndex: 500,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Drawer Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Gợi Ý AI Hints (Gemini)
                </h3>
              </div>
              <button 
                onClick={() => setShowAiDrawer(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
              
              {/* Section 1: Essay Outline */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--primary)' }}>
                  <BookOpen size={16} /> 1. Dàn Ý Triển Khai (Recommended Outline)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem', lineHeight: 1.6 }}>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                    <strong>Mở bài:</strong> Paraphrase lại đề bài và khẳng định quan điểm (Đồng ý rằng hoạt động cộng đồng bắt buộc đem lại nhiều lợi ích).
                  </div>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                    <strong>Thân bài 1 (Lợi ích cá nhân):</strong> Rèn luyện lòng vị tha (altruism), kỹ năng sống thực tế (hands-on soft skills), thấu cảm với các hoàn cảnh khó khăn.
                  </div>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                    <strong>Thân bài 2 (Lợi ích xã hội):</strong> Gắn kết cộng đồng (social cohesion), giảm thiểu tệ nạn thanh thiếu niên, bồi đắp trách nhiệm công dân.
                  </div>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                    <strong>Kết luận:</strong> Tóm tắt luận điểm và nhấn mạnh cần có chính sách triển khai linh hoạt tránh gây áp lực học tập.
                  </div>
                </div>
              </div>

              {/* Section 2: High-scoring Vocabulary */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: '#10b981' }}>
                  <Lightbulb size={16} /> 2. Từ Vựng Ăn Điểm (Band 7.5+ Vocab)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { en: 'Altruism', vi: 'Lòng vị tha, nhân ái', type: 'n' },
                    { en: 'Civic responsibility', vi: 'Trách nhiệm công dân', type: 'colloc' },
                    { en: 'Holistic development', vi: 'Sự phát triển toàn diện', type: 'colloc' },
                    { en: 'Social cohesion', vi: 'Sự gắn kết xã hội', type: 'n' },
                    { en: 'Formative years', vi: 'Những năm tháng định hình nhân cách', type: 'colloc' },
                    { en: 'Underprivileged groups', vi: 'Những nhóm người yếm thế trong XH', type: 'n' },
                  ].map((v, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 700, color: '#15803d' }}>{v.en}</span>
                      <span style={{ color: '#374151' }}>{v.vi}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Cohesive Devices */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: '#8b5cf6' }}>
                  <HelpCircle size={16} /> 3. Cụm Từ Nối Mạch Lạc (Cohesive Devices)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['In substantial measure', 'It is axiomatic that', 'By way of illustration', 'On the flip side', 'Irrefutably'].map((phrase, i) => (
                    <span key={i} style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9', padding: '4px 8px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600 }}>
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default WritingPracticeEngine;
