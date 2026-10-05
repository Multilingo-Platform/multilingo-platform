import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Minus, X as CloseIcon } from 'lucide-react';

// Mock Data
const mockStats = {
  examName: 'IELTS Collection 1 Reading Test 1',
  partName: 'Passage 1',
  correct: 2,
  wrong: 11,
  skipped: 0,
  total: 13,
  time: '0:00:00'
};

const mockCategories = [
  {
    name: '[Reading] Matching Features',
    correct: 1,
    wrong: 4,
    skipped: 0,
    questions: [4, 5, 6, 7, 8]
  },
  {
    name: '[Reading] Multiple Choice',
    correct: 1,
    wrong: 2,
    skipped: 0,
    questions: [1, 2, 3]
  },
  {
    name: '[Reading] Short Answer',
    correct: 0,
    wrong: 5,
    skipped: 0,
    questions: [9, 10, 11, 12, 13]
  }
];

const mockQuestions = Array.from({ length: 13 }, (_, i) => {
  const id = i + 1;
  const isCorrect = id === 2 || id === 7;
  return {
    id,
    status: isCorrect ? 'correct' : 'wrong',
    passage: 'The family of mammals called bovids belongs to the Artiodactyl class, which also includes giraffes. Bovids are a highly diverse group consisting of 137 species, some of which are man\'s most important domestic animals.\n\nBovids are well represented in most parts of Eurasia and Southeast Asian islands...',
    questionText: 'can endure very harsh environments',
    userAnswer: 'a',
    correctAnswer: 'C',
    explanation: 'The sub-family Caprinae includes the sheep and the goat, together with various relatives... Take one of extreme conditions is to be found in the...'
  };
});

const ExamResult = () => {
  const navigate = useNavigate();
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);

  const accuracy = ((mockStats.correct / mockStats.total) * 100).toFixed(1);
  const activeQuestion = selectedQuestion ? mockQuestions.find(q => q.id === selectedQuestion) : null;

  return (
    <div className="container slide-up" style={{ padding: '2rem 0', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* 1. Header Title */}
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
        Kết quả luyện tập: {mockStats.examName} <span className="badge badge-orange" style={{ fontSize: '1rem', padding: '4px 10px', marginLeft: '8px' }}>{mockStats.partName}</span>
      </h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
        <button className="btn btn-primary">Xem đáp án</button>
        <button className="btn btn-outline" onClick={() => navigate('/student/library')}>Tới trang đề thi</button>
      </div>

      {/* 2. Thống kê (Stats Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Info Card */}
        <div className="ed-card" style={{ padding: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} /> Kết quả làm bài</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mockStats.correct}/{mockStats.total}</span>
          </div>
          <div className="flex-between" style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🎯 Độ chính xác</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{accuracy}%</span>
          </div>
          <div className="flex-between" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>⏱ Thời gian</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mockStats.time}</span>
          </div>
        </div>

        {/* Correct Card */}
        <div className="ed-card flex-center flex-column" style={{ padding: '1.5rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <Check size={20} strokeWidth={3} />
          </div>
          <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: '1.125rem' }}>Trả lời đúng</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{mockStats.correct}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>câu hỏi</div>
        </div>

        {/* Wrong Card */}
        <div className="ed-card flex-center flex-column" style={{ padding: '1.5rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--danger)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <X size={20} strokeWidth={3} />
          </div>
          <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '1.125rem' }}>Trả lời sai</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{mockStats.wrong}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>câu hỏi</div>
        </div>

        {/* Skipped Card */}
        <div className="ed-card flex-center flex-column" style={{ padding: '1.5rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--text-muted)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <Minus size={20} strokeWidth={3} />
          </div>
          <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1.125rem' }}>Bỏ qua</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{mockStats.skipped}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>câu hỏi</div>
        </div>
      </div>

      {/* 3. Phân tích chi tiết */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Phân tích chi tiết</h2>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <button className="badge badge-orange" style={{ padding: '6px 16px', fontSize: '1rem', borderRadius: '20px', cursor: 'pointer', border: 'none' }}>Passage</button>
        <button className="badge badge-gray" style={{ padding: '6px 16px', fontSize: '1rem', borderRadius: '20px', cursor: 'pointer', border: 'none' }}>Tổng quát</button>
      </div>

      <div className="ed-card" style={{ overflowX: 'auto', marginBottom: '2.5rem' }}>
        <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Phân loại câu hỏi</th>
              <th style={{ padding: '1rem', fontWeight: 600 }}>Số câu đúng</th>
              <th style={{ padding: '1rem', fontWeight: 600 }}>Số câu sai</th>
              <th style={{ padding: '1rem', fontWeight: 600 }}>Số câu bỏ qua</th>
              <th style={{ padding: '1rem', fontWeight: 600 }}>Độ chính xác</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Danh sách câu hỏi</th>
            </tr>
          </thead>
          <tbody>
            {mockCategories.map((cat, idx) => {
              const totalCat = cat.correct + cat.wrong + cat.skipped;
              const acc = totalCat === 0 ? 0 : ((cat.correct / totalCat) * 100).toFixed(2);
              return (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>{cat.name}</td>
                  <td style={{ padding: '1rem' }}>{cat.correct}</td>
                  <td style={{ padding: '1rem' }}>{cat.wrong}</td>
                  <td style={{ padding: '1rem' }}>{cat.skipped}</td>
                  <td style={{ padding: '1rem' }}>{acc}%</td>
                  <td style={{ padding: '1rem 1.5rem', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {cat.questions.map(qId => {
                      const qData = mockQuestions.find(q => q.id === qId);
                      const isCorrect = qData?.status === 'correct';
                      const colorVar = isCorrect ? 'var(--success)' : 'var(--danger)';
                      return (
                        <button 
                          key={qId}
                          onClick={() => setSelectedQuestion(qId)}
                          style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            border: `1px solid ${colorVar}`,
                            color: colorVar,
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.875rem', fontWeight: 600,
                            transition: 'all 0.2s'
                          }}
                        >
                          {qId}
                        </button>
                      );
                    })}
                  </td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              <td style={{ padding: '1rem 1.5rem' }}>Total</td>
              <td style={{ padding: '1rem' }}>{mockStats.correct}</td>
              <td style={{ padding: '1rem' }}>{mockStats.wrong}</td>
              <td style={{ padding: '1rem' }}>{mockStats.skipped}</td>
              <td style={{ padding: '1rem' }}>{accuracy}%</td>
              <td style={{ padding: '1rem 1.5rem' }}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 4. Question Palette Grid */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Bảng đáp án</h2>
      <div className="ed-card" style={{ padding: '1.5rem', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {mockQuestions.map(q => {
          const isCorrect = q.status === 'correct';
          return (
            <button
              key={q.id}
              onClick={() => setSelectedQuestion(q.id)}
              style={{
                width: '40px', height: '40px',
                borderRadius: 'var(--radius-sm)',
                background: isCorrect ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${isCorrect ? '#a7f3d0' : '#fecaca'}`,
                color: isCorrect ? 'var(--success)' : 'var(--danger)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.1s'
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '-2px' }}>{q.id}</span>
              {isCorrect ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
            </button>
          )
        })}
      </div>

      {/* Modal / Popup cho Đáp án chi tiết */}
      {selectedQuestion && activeQuestion && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="slide-up" style={{
            background: 'var(--bg-secondary)', width: '90%', maxWidth: '700px',
            maxHeight: '90vh', borderRadius: 'var(--radius-lg)',
            display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--shadow-hover)', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Đáp án chi tiết #{selectedQuestion}</h3>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>{mockStats.examName}</div>
              </div>
              <button 
                onClick={() => setSelectedQuestion(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <CloseIcon size={24} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <div className="badge badge-gray" style={{ padding: '4px 8px', marginBottom: '1rem', display: 'inline-block' }}>
                #[Reading] {mockCategories.find(c => c.questions.includes(selectedQuestion))?.name.replace('[Reading] ', '')}
              </div>

              <div style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '2rem', whiteSpace: 'pre-wrap' }}>
                {activeQuestion.passage}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 }}>
                  {activeQuestion.id}
                </div>
                <div style={{ paddingTop: '6px', color: 'var(--text-primary)' }}>
                  {activeQuestion.questionText}
                </div>
              </div>

              <div style={{ marginLeft: '48px', marginBottom: '1rem', padding: '12px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
                {activeQuestion.userAnswer}
              </div>

              <div style={{ marginLeft: '48px', marginBottom: '1.5rem', color: 'var(--success)', fontWeight: 600 }}>
                Đáp án đúng: {activeQuestion.correctAnswer}
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
                <h4 style={{ fontWeight: 600, color: '#3b82f6', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Giải thích chi tiết đáp án
                </h4>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Trích đoạn chứa đáp án:</div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {activeQuestion.explanation}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default ExamResult;
