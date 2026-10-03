import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Calendar, Clock, CheckCircle, Target, ArrowRight, ChevronRight } from 'lucide-react';

const mockHistory = [
  {
    id: 'att-001',
    examTitle: 'Cambridge IELTS 18 - Test 1',
    mode: 'MOCK_TEST',
    date: '2026-10-01T08:30:00Z',
    score: 7.5,
    maxScore: 9.0,
    duration: '115 phút',
    status: 'COMPLETED'
  },
  {
    id: 'att-002',
    examTitle: 'TOEIC ETS 2024 - Test 3 (Reading Part 5)',
    mode: 'PRACTICE',
    date: '2026-09-28T14:15:00Z',
    score: 85,
    maxScore: 100,
    duration: '15 phút',
    status: 'COMPLETED'
  },
  {
    id: 'att-003',
    examTitle: 'VSTEP B1-C1 - Đề thi thử số 1',
    mode: 'MOCK_TEST',
    date: '2026-09-25T09:00:00Z',
    score: 5.5,
    maxScore: 10.0,
    duration: '120 phút',
    status: 'COMPLETED'
  }
];

const TestHistory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filteredHistory = mockHistory.filter(item => 
    item.examTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.25rem 1rem 3.5rem' }}>
      
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#64748b', marginBottom: '1rem' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/dashboard')}>Trang chủ</span>
        <ChevronRight size={14} />
        <span style={{ color: '#0f172a', fontWeight: 600 }}>Lịch sử làm bài & Thi thử</span>
      </div>

      {/* Header and Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111827', margin: 0 }}>
            Lịch Sử Làm Bài & Thi Thử
          </h1>
          <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: '3px 0 0' }}>
            Theo dõi tiến trình học tập, đối soát đáp án chi tiết và nhận xét phân tích AI.
          </p>
        </div>
        
        {/* Simple Summary Box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.65rem 1.25rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111827' }}>{mockHistory.length}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Bài đã làm</div>
          </div>
          <div style={{ width: '1px', height: '32px', background: '#e2e8f0' }}></div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#15803d' }}>7.5</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Điểm TB</div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.85rem 1rem', marginBottom: '1.25rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={15} color="#94a3af" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên đề thi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.5rem 0.75rem 0.5rem 2rem', 
                borderRadius: 5, 
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                outline: 'none',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
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
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 5, 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: 5, 
                padding: '0.5rem 0.85rem', 
                fontSize: '0.82rem', 
                fontWeight: 600, 
                color: '#374151',
                cursor: 'pointer' 
              }}
            >
              <Filter size={14} /> Lọc kết quả
            </button>
            <button 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 5, 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: 5, 
                padding: '0.5rem 0.85rem', 
                fontSize: '0.82rem', 
                fontWeight: 600, 
                color: '#374151',
                cursor: 'pointer' 
              }}
            >
              <Calendar size={14} /> Thời gian
            </button>
          </div>
        </div>
      </div>

      {/* History Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredHistory.map((item) => {
          const isHighScore = item.score >= 7.0 || item.score >= 80;
          return (
            <div 
              key={item.id} 
              style={{ 
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '1rem 1.25rem',
                display: 'flex', 
                gap: '1.25rem', 
                alignItems: 'center', 
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
              }}
            >
              {/* Highlighted Score Box */}
              <div style={{ 
                width: '74px', 
                height: '74px', 
                borderRadius: 5, 
                background: isHighScore ? '#fffbeb' : '#f8fafc',
                border: isHighScore ? '1px solid #fde047' : '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '1.45rem', fontWeight: 700, color: isHighScore ? '#b45309' : '#111827' }}>
                  {item.score}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>
                  / {item.maxScore}
                </span>
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                  <span style={{ 
                    background: item.mode === 'MOCK_TEST' ? '#fef3c7' : '#f0fdf4', 
                    color: item.mode === 'MOCK_TEST' ? '#92400e' : '#166534', 
                    border: item.mode === 'MOCK_TEST' ? '1px solid #fde68a' : '1px solid #bbf7d0',
                    borderRadius: 4, 
                    fontSize: '0.74rem', 
                    fontWeight: 600, 
                    padding: '2px 7px' 
                  }}>
                    {item.mode === 'MOCK_TEST' ? 'Thi thử' : 'Luyện tập'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={13} /> {formatDate(item.date)}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.02rem', fontWeight: 600, color: '#111827', margin: '0 0 0.35rem' }}>
                  {item.examTitle}
                </h3>
                <div style={{ display: 'flex', gap: '1.25rem', color: '#6b7280', fontSize: '0.82rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={14} /> {item.duration}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#15803d', fontWeight: 500 }}>
                    <CheckCircle size={14} /> Hoàn thành
                  </div>
                </div>
              </div>
              
              <div style={{ paddingLeft: '1rem', borderLeft: '1px solid #f1f5f9' }}>
                <button 
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#f59e0b',
                    color: '#111827',
                    border: '1px solid #d97706',
                    borderRadius: 5,
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => navigate(`/student/exam/${item.id}/result`)}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#eab308'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f59e0b'}
                >
                  Xem chi tiết <ArrowRight size={15} />
                </button>
              </div>
            </div>
          );
        })}
        
        {filteredHistory.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
            <Target size={40} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', margin: 0 }}>Chưa tìm thấy bài làm phù hợp</h3>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 4, marginBottom: '1.25rem' }}>
              Hãy thử tìm kiếm từ khóa khác hoặc truy cập Thư viện Đề thi để bắt đầu làm bài.
            </p>
            <button 
              style={{ background: '#f59e0b', color: '#111827', border: '1px solid #d97706', borderRadius: 5, padding: '0.5rem 1.25rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
              onClick={() => navigate('/student/library')}
            >
              Vào Thư viện Đề thi ngay
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default TestHistory;
