import React from 'react';
import { Search, Filter, Play, Clock, BarChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ExamLibrary = () => {
  const navigate = useNavigate();

  const exams = [
    { id: 'cam-18-1', title: 'Cambridge IELTS 18 - Test 1', type: 'IELTS', level: 'Academic', time: '180 phút', joins: 1240 },
    { id: 'cam-18-2', title: 'Cambridge IELTS 18 - Test 2', type: 'IELTS', level: 'Academic', time: '180 phút', joins: 980 },
    { id: 'cam-18-3', title: 'Cambridge IELTS 18 - Test 3', type: 'IELTS', level: 'Academic', time: '180 phút', joins: 1100 },
    { id: 'toeic-ets-2023', title: 'TOEIC ETS 2023 - Test 1', type: 'TOEIC', level: 'General', time: '120 phút', joins: 3450 },
    { id: 'vstep-b1', title: 'VSTEP B1 - Đề số 1', type: 'VNLTV', level: 'B1', time: '135 phút', joins: 540 },
  ];

  return (
    <div className="container">
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '2rem' }}>Thư viện Đề thi</h1>
      
      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Left Sidebar Filter */}
        <aside style={{ width: '280px', flexShrink: 0 }}>
          <div className="ed-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={18} /> Bộ lọc
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Tìm kiếm</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', top: '10px', left: '10px' }} />
                <input type="text" className="input-field" placeholder="Nhập tên đề thi..." style={{ paddingLeft: '2.5rem' }} />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Loại Chứng chỉ</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked /> IELTS
                </label>
                <label className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" /> TOEIC
                </label>
                <label className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" /> VSTEP
                </label>
              </div>
            </div>
            
            <button className="btn btn-primary" style={{ width: '100%' }}>Áp dụng</button>
          </div>
        </aside>

        {/* Right Main Grid */}
        <main style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {exams.map((exam) => (
              <div key={exam.id} className="ed-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Card Thumbnail */}
                <div style={{ height: '140px', background: 'var(--bg-tertiary)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--border-dark)', opacity: 0.5 }}>{exam.type}</span>
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                    <span className="badge badge-orange">{exam.level}</span>
                  </div>
                </div>
                
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>{exam.title}</h3>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', flex: 1 }}>
                    <div className="flex-center" style={{ gap: '0.25rem' }}><Clock size={16} /> {exam.time}</div>
                    <div className="flex-center" style={{ gap: '0.25rem' }}><BarChart size={16} /> {exam.joins} lượt thi</div>
                  </div>

                  <button className="btn btn-outline" style={{ width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)' }} onClick={() => navigate(`/student/exam/${exam.id}`)}>
                    Chi tiết đề thi
                  </button>
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
