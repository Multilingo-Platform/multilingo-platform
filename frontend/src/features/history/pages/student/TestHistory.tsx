import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Calendar, Clock, CheckCircle, Target, ArrowRight, BarChart2 } from 'lucide-react';

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

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Lịch sử làm bài
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Theo dõi tiến trình học tập và xem lại kết quả các bài thi đã làm.
          </p>
        </div>
        
        <div className="flex-center" style={{ gap: '1rem' }}>
          <div className="ed-card flex-center" style={{ padding: '1rem', gap: '1rem', background: 'var(--bg-card)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{mockHistory.length}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Bài đã làm</div>
            </div>
            <div style={{ width: '1px', height: '40px', background: 'var(--border-light)' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>7.5</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Điểm TB</div>
            </div>
          </div>
        </div>
      </div>

      <div className="ed-card" style={{ marginBottom: '2rem' }}>
        <div className="flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={20} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên đề thi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.75rem 1rem 0.75rem 3rem', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-light)',
                background: 'var(--bg-secondary)',
                outline: 'none'
              }}
            />
          </div>
          
          <div className="flex-center" style={{ gap: '0.5rem' }}>
            <button className="btn btn-outline flex-center" style={{ gap: '0.5rem' }}>
              <Filter size={18} /> Lọc kết quả
            </button>
            <button className="btn btn-outline flex-center" style={{ gap: '0.5rem' }}>
              <Calendar size={18} /> Thời gian
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {mockHistory.map((item) => (
          <div key={item.id} className="ed-card slide-up" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', transition: 'all 0.2s' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: 'var(--radius-md)', 
              background: 'var(--bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-light)'
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                {item.score}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                / {item.maxScore}
              </span>
            </div>
            
            <div style={{ flex: 1 }}>
              <div className="flex-center" style={{ gap: '0.75rem', marginBottom: '0.25rem' }}>
                <span className={`badge ${item.mode === 'MOCK_TEST' ? 'badge-primary' : 'badge-green'}`}>
                  {item.mode === 'MOCK_TEST' ? 'Thi thử' : 'Luyện tập'}
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }} className="flex-center">
                  <Calendar size={14} style={{ marginRight: '4px' }} /> {formatDate(item.date)}
                </span>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                {item.examTitle}
              </h3>
              <div className="flex-center" style={{ gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <div className="flex-center" style={{ gap: '0.25rem' }}>
                  <Clock size={16} /> {item.duration}
                </div>
                <div className="flex-center" style={{ gap: '0.25rem' }}>
                  <CheckCircle size={16} color="var(--success)" /> Hoàn thành
                </div>
              </div>
            </div>
            
            <div className="flex-center" style={{ gap: '1rem', paddingLeft: '1rem', borderLeft: '1px solid var(--border-light)' }}>
              <button 
                className="btn btn-primary flex-center" 
                style={{ gap: '0.5rem' }}
                onClick={() => navigate(`/student/exam/${item.id}/result`)}
              >
                Xem chi tiết <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ))}
        
        {mockHistory.length === 0 && (
          <div className="ed-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <Target size={48} color="var(--border-light)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Chưa có lịch sử làm bài</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
              Bạn chưa hoàn thành bất kỳ bài thi hay luyện tập nào.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/student/library')}>
              Vào Thư viện Đề thi ngay
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestHistory;
