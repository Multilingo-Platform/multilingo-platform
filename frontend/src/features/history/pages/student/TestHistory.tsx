import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Calendar, Clock, CheckCircle, Target, ArrowRight, BarChart2, Flame, BookOpen } from 'lucide-react';

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
    examTitle: 'NLTV B1 - Đề thi thử số 1',
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const statCards = [
    { title: 'Tổng bài đã làm', value: '34', icon: <BookOpen size={32} />, color: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)' },
    { title: 'Điểm trung bình', value: '7.5', icon: <Target size={32} />, color: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)' },
    { title: 'Thời gian luyện tập', value: '42h', icon: <Clock size={32} />, color: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' },
    { title: 'Chuỗi ngày học', value: '12', icon: <Flame size={32} />, color: 'linear-gradient(135deg, #ec4899 0%, #e11d48 100%)' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '4rem' }}>
      {/* Top Banner / Dashboard */}
      <div style={{ background: 'var(--bg-primary)', padding: '2rem 0 3rem', borderBottom: '1px solid var(--border-light)' }}>
        <div className="container" style={{ maxWidth: '1100px' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <BarChart2 size={32} color="var(--primary)" /> Báo Cáo Học Tập
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              Theo dõi tiến trình, đánh giá năng lực và chinh phục mục tiêu của bạn.
            </p>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {statCards.map((stat, idx) => (
              <div key={idx} className="ed-card" style={{
                background: stat.color,
                color: 'white',
                padding: '1.5rem',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', right: '-15px', top: '-10px', opacity: 0.2, transform: 'scale(2.5)' }}>
                  {stat.icon}
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>{stat.title}</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '1100px', marginTop: '2rem' }}>
        <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Lịch sử làm bài gần đây</h2>

          <div className="flex-center" style={{ gap: '1rem' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Tìm tên đề thi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 1rem 0.6rem 2.5rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-primary)',
                  outline: 'none',
                  fontSize: '0.95rem'
                }}
              />
            </div>
            <button className="btn btn-outline flex-center" style={{ gap: '0.5rem', borderRadius: 'var(--radius-full)', padding: '0.6rem 1.2rem' }}>
              <Filter size={16} /> Lọc
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mockHistory.map((item) => (
            <div
              key={item.id}
              className="ed-card"
              style={{
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: hoveredId === item.id ? 'translateY(-4px)' : 'none',
                boxShadow: hoveredId === item.id ? '0 10px 15px -3px rgba(0,0,0,0.05)' : 'var(--shadow-sm)',
                border: hoveredId === item.id ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                padding: '1.25rem 1.5rem',
                cursor: 'pointer'
              }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => navigate(`/student/exam/${item.id}/result`)}
            >
              {/* Score Box */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: item.score >= (item.maxScore * 0.8) ? 'var(--success-light)' : item.score >= (item.maxScore * 0.5) ? 'var(--warning-light)' : 'var(--danger-light)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: `3px solid ${item.score >= (item.maxScore * 0.8) ? 'var(--success)' : item.score >= (item.maxScore * 0.5) ? 'var(--warning)' : 'var(--danger)'}`,
                flexShrink: 0
              }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: item.score >= (item.maxScore * 0.8) ? 'var(--success-dark)' : item.score >= (item.maxScore * 0.5) ? 'var(--warning-dark)' : 'var(--danger-dark)', lineHeight: 1 }}>
                  {item.score}
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  / {item.maxScore}
                </span>
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div className="flex-center" style={{ gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <span style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: item.mode === 'MOCK_TEST' ? 'var(--primary)' : 'var(--success)',
                    color: 'white',
                    letterSpacing: '0.5px'
                  }}>
                    {item.mode === 'MOCK_TEST' ? 'Thi thử' : 'Luyện tập'}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }} className="flex-center">
                    <Calendar size={14} style={{ marginRight: '6px' }} color="var(--text-muted)" /> {formatDate(item.date)}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {item.examTitle}
                </h3>
                <div className="flex-center" style={{ gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
                  <div className="flex-center" style={{ gap: '0.4rem' }}>
                    <Clock size={16} color="var(--text-muted)" /> {item.duration}
                  </div>
                  <div className="flex-center" style={{ gap: '0.4rem' }}>
                    <CheckCircle size={16} color="var(--success)" /> Hoàn thành
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex-center" style={{ paddingLeft: '1.5rem' }}>
                <div
                  className="flex-center"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: hoveredId === item.id ? 'var(--primary)' : 'var(--bg-tertiary)',
                    color: hoveredId === item.id ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  <ArrowRight size={20} />
                </div>
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
              <button className="btn btn-primary" onClick={() => navigate('/student/library')} style={{ borderRadius: 'var(--radius-full)', padding: '0.75rem 2rem' }}>
                Khám phá Thư viện Đề thi
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestHistory;
