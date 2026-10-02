import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Save, Volume2, CheckCircle, XCircle, Info } from 'lucide-react';

const MockTestEngine = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedText, setSelectedText] = useState('');
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  
  // Trạng thái làm bài / nộp bài
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [q1Ans, setQ1Ans] = useState('');
  const [q2Ans, setQ2Ans] = useState('');

  const handleMouseUp = (e: React.MouseEvent) => {
    const text = window.getSelection()?.toString().trim();
    if (text) {
      setSelectedText(text);
      setPopupPos({ x: e.pageX, y: e.pageY - 60 });
    } else {
      setSelectedText('');
    }
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      {/* Top Header */}
      <header style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', padding: '0.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flex-center" style={{ gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ padding: '0.5rem', border: 'none' }}><ArrowLeft size={20} /></button>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>IELTS Reading: {id}</h2>
        </div>
        
        {isSubmitted ? (
          <div className="flex-center" style={{ gap: '2rem' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Điểm của bạn: <span style={{ color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 800 }}>6.5</span> / 9.0</div>
            <button className="btn btn-primary" onClick={() => navigate(`/student/exam/${id}/result`)}>Xem Báo cáo Chi tiết</button>
          </div>
        ) : (
          <div className="flex-center" style={{ gap: '2rem' }}>
            <div className="flex-center badge badge-orange" style={{ gap: '0.5rem', fontSize: '1.25rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
              <Clock size={20} /> 59:45
            </div>
            <button className="btn btn-primary" onClick={handleSubmit}><Save size={18} /> Nộp bài</button>
          </div>
        )}
      </header>

      {/* Split Pane Container */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane: Reading Passage */}
        <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-light)' }} onMouseUp={handleMouseUp}>
          <div className="badge badge-gray" style={{ marginBottom: '1rem', display: 'inline-block' }}>Reading Passage 1</div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', fontWeight: 800 }}>The rise of urban farming</h1>
          
          <div style={{ fontSize: '1.125rem', lineHeight: '1.8', color: 'var(--text-primary)', textAlign: 'justify' }}>
            <p style={{ marginBottom: '1.5rem' }}>
              In recent years, urban farming has become an increasingly <span style={{ background: 'var(--primary-light)', borderBottom: '2px dashed var(--primary)', cursor: 'pointer' }}>ubiquitous</span> phenomenon in major cities around the globe.
              Driven by concerns over food security, carbon footprints, and a desire to reconnect with nature, city dwellers are turning vacant lots, rooftops, and even balconies into productive agricultural spaces.
            </p>
            <p>
              The <strong>benefits</strong> of this localized approach to agriculture are manifold. Not only does it reduce the distance food must travel from farm to table—thereby slashing transportation emissions—but it also fosters a sense of community and provides educational opportunities for urban youth who might otherwise be disconnected from the sources of their sustenance.
            </p>
          </div>
        </div>

        {/* Right Pane: Questions & Palette (or Results) */}
        <div style={{ width: '500px', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
          {/* Question List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
            {isSubmitted && (
              <div className="ed-card" style={{ padding: '1.5rem', marginBottom: '2rem', background: '#ecfdf5', border: '1px solid #10b981' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)', marginBottom: '0.5rem' }}>Tuyệt vời!</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Bạn đã hoàn thành bài thi với độ chính xác 75%. Dưới đây là phân tích chi tiết đáp án.</p>
              </div>
            )}

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Questions 1 - 5</h3>
            <div style={{ background: 'var(--primary-light)', padding: '1rem', borderLeft: '4px solid var(--primary)', marginBottom: '1.5rem', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
              <p style={{ fontStyle: 'italic', color: 'var(--primary)', fontSize: '0.875rem' }}>Do the following statements agree with the information given in Reading Passage 1?</p>
            </div>
            
            {/* Question 1: True/False/Not Given */}
            <div className="ed-card" style={{ padding: '1.5rem', marginBottom: '1rem', border: isSubmitted ? (q1Ans === 'TRUE' ? '1px solid var(--success)' : '1px solid var(--danger)') : '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
                <p style={{ fontWeight: 500 }}>Urban farming is primarily driven by a desire to reduce agricultural water usage.</p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', cursor: isSubmitted ? 'default' : 'pointer', padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: (isSubmitted && q1Ans==='TRUE') ? '#ecfdf5' : 'var(--bg-secondary)' }}>
                  <input type="radio" name="q1" value="TRUE" disabled={isSubmitted} checked={q1Ans==='TRUE'} onChange={() => setQ1Ans('TRUE')} /> TRUE {isSubmitted && q1Ans==='TRUE' && <CheckCircle size={16} color="var(--success)" style={{marginLeft:'auto'}}/>}
                </label>
                <label className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', cursor: isSubmitted ? 'default' : 'pointer', padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: (isSubmitted && q1Ans==='FALSE') ? '#fef2f2' : 'var(--bg-secondary)' }}>
                  <input type="radio" name="q1" value="FALSE" disabled={isSubmitted} checked={q1Ans==='FALSE'} onChange={() => setQ1Ans('FALSE')} /> FALSE {isSubmitted && q1Ans==='FALSE' && <XCircle size={16} color="var(--danger)" style={{marginLeft:'auto'}}/>}
                </label>
                <label className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', cursor: isSubmitted ? 'default' : 'pointer', padding: '0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: (isSubmitted && q1Ans==='NOT_GIVEN') ? '#fef2f2' : 'var(--bg-secondary)' }}>
                  <input type="radio" name="q1" value="NOT_GIVEN" disabled={isSubmitted} checked={q1Ans==='NOT_GIVEN'} onChange={() => setQ1Ans('NOT_GIVEN')} /> NOT GIVEN {isSubmitted && q1Ans==='NOT_GIVEN' && <XCircle size={16} color="var(--danger)" style={{marginLeft:'auto'}}/>}
                </label>
              </div>

              {isSubmitted && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
                  <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    <Info size={16} /> Giải thích (Explanation):
                  </div>
                  <p style={{ color: 'var(--text-secondary)' }}>Đoạn văn đề cập đến "food security, carbon footprints, and a desire to reconnect with nature" là nguyên nhân chính, KHÔNG nhắc đến "water usage". Vì vậy đáp án phải là <strong>FALSE</strong>.</p>
                </div>
              )}
            </div>

            {/* Question 2: Fill in the blanks */}
            <div className="ed-card" style={{ padding: '1.5rem', marginBottom: '1rem', border: isSubmitted ? (q2Ans.toLowerCase() === 'community' ? '1px solid var(--success)' : '1px solid var(--danger)') : '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</span>
                <p style={{ fontWeight: 500 }}>Fill in the blank with NO MORE THAN ONE WORD.</p>
              </div>
              
              <div style={{ lineHeight: '2' }}>
                Urban agriculture provides environmental benefits by reducing transport emissions and also fosters a sense of 
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ display: 'inline-block', width: '120px', padding: '0.25rem 0.5rem', margin: '0 0.5rem', border: isSubmitted && q2Ans.toLowerCase() !== 'community' ? '1px solid var(--danger)' : '1px solid var(--primary)' }} 
                  value={q2Ans}
                  onChange={(e) => setQ2Ans(e.target.value)}
                  disabled={isSubmitted}
                />
                among city residents.
              </div>

              {isSubmitted && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '0.5rem' }}>Đáp án đúng: community</div>
                  <p style={{ color: 'var(--text-secondary)' }}>Câu cuối đoạn 2: "...it also fosters a sense of <strong>community</strong>..."</p>
                </div>
              )}
            </div>

          </div>

          {/* Question Palette (Study4 Style) */}
          <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)', padding: '1.5rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Bảng câu hỏi</h4>
            <div className="question-palette">
              <div className={`q-box ${isSubmitted ? (q1Ans === 'FALSE' ? 'done' : 'current') : (q1Ans ? 'done' : '')}`} style={isSubmitted && q1Ans !== 'FALSE' ? {borderColor: 'var(--danger)', color: 'var(--danger)'} : {}}>1</div>
              <div className={`q-box ${isSubmitted ? (q2Ans.toLowerCase() === 'community' ? 'done' : 'current') : (q2Ans ? 'done' : '')}`} style={isSubmitted && q2Ans.toLowerCase() !== 'community' ? {borderColor: 'var(--danger)', color: 'var(--danger)'} : {}}>2</div>
              <div className="q-box">3</div>
              <div className="q-box">4</div>
              <div className="q-box">5</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dictionary Popup (Solid Flat) */}
      {selectedText && (
        <div className="ed-card slide-up" style={{
          position: 'absolute',
          left: popupPos.x,
          top: popupPos.y,
          padding: '1rem',
          zIndex: 1000,
          boxShadow: 'var(--shadow-hover)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          minWidth: '250px'
        }}>
          <div className="flex-between">
            <h4 style={{ color: 'var(--primary)', fontSize: '1.125rem', fontWeight: 700 }}>{selectedText}</h4>
            <Volume2 size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
          </div>
          <p style={{ fontStyle: 'italic', fontSize: '0.875rem', color: 'var(--text-muted)' }}>/juːˈbɪk.wɪ.təs/ - Tính từ</p>
          <p style={{ fontWeight: 500 }}>Có mặt ở khắp mọi nơi</p>
          <button className="btn btn-light" style={{ padding: '0.5rem', fontSize: '0.875rem', marginTop: '0.5rem' }}>+ Lưu Flashcard</button>
        </div>
      )}
    </div>
  );
};

export default MockTestEngine;
