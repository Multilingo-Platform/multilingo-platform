import { useState } from 'react';
import { Search, Clock, BarChart, BookOpen, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ExamLibrary = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const exams = [
    { id: 'cam-18-1', title: 'Cambridge IELTS 18 - Academic Test 1', type: 'IELTS', level: 'Academic', time: '180 phút', joins: 1240 },
    { id: 'cam-18-2', title: 'Cambridge IELTS 18 - Academic Test 2', type: 'IELTS', level: 'Academic', time: '180 phút', joins: 980 },
    { id: 'cam-18-3', title: 'Cambridge IELTS 18 - Academic Test 3', type: 'IELTS', level: 'Academic', time: '180 phút', joins: 1100 },
    { id: 'toeic-ets-2023', title: 'TOEIC ETS 2024 - Full Test 1 (Part 1 - 7)', type: 'TOEIC', level: 'General', time: '120 phút', joins: 3450 },
    { id: 'toeic-ets-2024-2', title: 'TOEIC ETS 2024 - Full Test 2', type: 'TOEIC', level: 'General', time: '120 phút', joins: 2180 },
    { id: 'vstep-b1', title: 'VSTEP B1-B2 - Đề luyện thi số 1', type: 'VSTEP', level: 'B1-B2', time: '135 phút', joins: 540 },
  ];

  const filteredExams = exams.filter(e => {
    const matchCat = selectedCategory === 'ALL' || e.type === selectedCategory;
    const matchSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.25rem 1rem 3.5rem' }}>
      
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#64748b', marginBottom: '1rem' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/dashboard')}>Trang chủ</span>
        <ChevronRight size={14} />
        <span style={{ color: '#0f172a', fontWeight: 600 }}>Thư viện đề thi chuẩn hóa</span>
      </div>

      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.15rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111827', margin: 0 }}>
            Thư Viện Đề Thi Chuẩn Hóa
          </h1>
          <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: '3px 0 0' }}>
            Tổng hợp ngân hàng đề thi IELTS, TOEIC và VSTEP có đáp án và giải thích chi tiết.
          </p>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} color="#94a3af" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Tìm theo tên đề thi..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              border: '1px solid #cbd5e1', 
              borderRadius: 5, 
              padding: '0.45rem 0.65rem 0.45rem 2rem', 
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
              background: '#ffffff',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
            }} 
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#f59e0b';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.2)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Category Tabs - Standard Rectangular Education Style */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
        {[
          { id: 'ALL', label: 'Tất cả đề thi' },
          { id: 'IELTS', label: 'Luyện thi IELTS' },
          { id: 'TOEIC', label: 'Luyện thi TOEIC' },
          { id: 'VSTEP', label: 'Luyện thi VSTEP' }
        ].map(cat => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                background: isActive ? '#f59e0b' : '#ffffff',
                color: isActive ? '#111827' : '#475569',
                border: isActive ? '1px solid #d97706' : '1px solid #e2e8f0',
                borderRadius: 4,
                padding: '0.45rem 0.95rem',
                fontSize: '0.84rem',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Exam Cards Grid - Balanced 6px Radius, Subtle Borders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {filteredExams.map((exam) => (
          <div 
            key={exam.id} 
            style={{ 
              background: '#ffffff', 
              border: '1px solid #e2e8f0', 
              borderRadius: 6, 
              padding: '1.15rem',
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, padding: '2px 7px' }}>
                  {exam.type} • {exam.level}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  {exam.joins} lượt làm
                </span>
              </div>

              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#111827', margin: '0 0 0.5rem', lineHeight: 1.4 }}>
                {exam.title}
              </h3>

              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: '#6b7280', marginBottom: '1.15rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={13} /> {exam.time}</span>
                <span>• 4 kỹ năng</span>
              </div>
            </div>

            {/* Action Buttons: Reading, Listening, Writing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
              <button 
                onClick={() => navigate(`/student/exam/${exam.id}`)}
                style={{ 
                  background: '#ffffff', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: 5, 
                  padding: '0.42rem 0.2rem', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  color: '#374151',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
              >
                Reading
              </button>
              <button 
                onClick={() => navigate(`/student/exam/${exam.id}/listening`)}
                style={{ 
                  background: '#ffffff', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: 5, 
                  padding: '0.42rem 0.2rem', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  color: '#374151',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
              >
                Listening
              </button>
              <button 
                onClick={() => navigate(`/student/exam/${exam.id}/writing`)}
                style={{ 
                  background: '#f59e0b', 
                  border: '1px solid #d97706', 
                  borderRadius: 5, 
                  padding: '0.42rem 0.2rem', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  color: '#111827',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#eab308'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f59e0b'}
              >
                Writing
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default ExamLibrary;
