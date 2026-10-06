import React, { useState } from 'react';
import { Search, Filter, Play, Clock, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ExamLibrary = () => {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const exams = [
    { id: 'cam-18-1', title: 'Cambridge IELTS 18 - Test 1', type: 'IELTS', level: 'Academic', time: '180 phút', joins: 1240, tags: ['Listening', 'Reading', 'Writing'], color: 'from-blue-500 to-indigo-600' },
    { id: 'cam-18-2', title: 'Cambridge IELTS 18 - Test 2', type: 'IELTS', level: 'Academic', time: '180 phút', joins: 980, tags: ['Listening', 'Reading', 'Writing'], color: 'from-blue-500 to-indigo-600' },
    { id: 'cam-18-3', title: 'Cambridge IELTS 18 - Test 3', type: 'IELTS', level: 'Academic', time: '180 phút', joins: 1100, tags: ['Listening', 'Reading', 'Writing'], color: 'from-blue-500 to-indigo-600' },
    { id: 'toeic-ets-2023', title: 'TOEIC ETS 2023 - Test 1', type: 'TOEIC', level: 'General', time: '120 phút', joins: 3450, tags: ['Listening', 'Reading'], color: 'from-emerald-500 to-teal-600' },
    { id: 'nltv-b1', title: 'NLTV B1 - Đề số 1', type: 'NLTV', level: 'B1', time: '135 phút', joins: 540, tags: ['Đọc hiểu', 'Nghe hiểu', 'Viết'], color: 'from-amber-500 to-orange-600' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '3rem' }}>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #ea580c 100%)',
        padding: '3rem 0',
        color: 'white',
        marginBottom: '2rem'
      }}>
        <div className="container">
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>Thư viện Đề thi</h1>
          <p style={{ fontSize: '1.125rem', opacity: 0.9, maxWidth: '600px' }}>Hàng ngàn đề thi chuẩn hóa IELTS, TOEIC và Năng Lực Tiếng Việt (NLTV). Luyện tập ngay hôm nay để đạt mục tiêu của bạn.</p>
        </div>
      </div>

      <div className="container" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        {/* Left Sidebar Filter */}
        <aside style={{ width: '280px', flexShrink: 0, position: 'sticky', top: '2rem' }}>
          <div className="ed-card" style={{ padding: '1.5rem', borderTop: '4px solid var(--primary)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Filter size={20} color="var(--primary)" /> Lọc Đề Thi
            </h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>TÌM KIẾM</label>
              <div style={{ position: 'relative' }}>
                <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', top: '12px', left: '12px' }} />
                <input type="text" className="input-field" placeholder="Nhập tên đề thi..." style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-full)' }} />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>CHỨNG CHỈ</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {['IELTS', 'TOEIC', 'Năng Lực Tiếng Việt (NLTV)'].map((cert, idx) => (
                  <label key={idx} className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.75rem', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500 }}>
                    <input type="checkbox" defaultChecked={idx === 0} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} /> {cert}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>KỸ NĂNG</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['Listening', 'Reading', 'Writing'].map((skill, idx) => (
                  <span key={idx} style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    backgroundColor: idx === 0 ? 'var(--primary-light)' : 'var(--bg-tertiary)',
                    color: idx === 0 ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    border: `1px solid ${idx === 0 ? 'var(--primary)' : 'transparent'}`
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', borderRadius: 'var(--radius-full)' }}>Áp dụng bộ lọc</button>
          </div>
        </aside>

        {/* Right Main Grid */}
        <main style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Hiển thị <strong>{exams.length}</strong> kết quả</div>
            <select className="input-field" style={{ width: 'auto', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}>
              <option>Mới nhất</option>
              <option>Được thi nhiều nhất</option>
              <option>Đánh giá cao nhất</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="ed-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: hoveredId === exam.id ? 'translateY(-8px)' : 'none',
                  boxShadow: hoveredId === exam.id ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  border: '1px solid var(--border-light)'
                }}
                onMouseEnter={() => setHoveredId(exam.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => navigate(`/student/exam/${exam.id}`)}
              >
                {/* Card Thumbnail */}
                <div style={{
                  height: '160px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: exam.type === 'IELTS' ? 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)' : exam.type === 'TOEIC' ? 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Cg/%3E%3C/svg%3E")' }}></div>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', letterSpacing: '2px', zIndex: 1, textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{exam.type}</h2>
                  <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1 }}>
                    <span style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', color: 'white', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.3)' }}>{exam.level}</span>
                  </div>

                  {/* Play Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: hoveredId === exam.id ? 1 : 0,
                    transition: 'opacity 0.2s',
                    zIndex: 2
                  }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                      <Play size={24} fill="white" style={{ marginLeft: '4px' }} />
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>{exam.title}</h3>

                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                    {exam.tags.map(tag => (
                      <span key={tag} style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: '4px' }}>{tag}</span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                    <div className="flex-center" style={{ gap: '0.35rem', fontWeight: 500 }}><Clock size={15} color="var(--text-muted)" /> {exam.time}</div>
                    <div className="flex-center" style={{ gap: '0.35rem', fontWeight: 500 }}><BookOpen size={15} color="var(--text-muted)" /> {exam.joins} lượt thi</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ExamLibrary;
