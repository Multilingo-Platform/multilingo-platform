import { useNavigate } from 'react-router-dom';
import { Target, Clock, Zap, BookOpen, Flame, ArrowRight, Award, Headphones, PenTool, CheckCircle2 } from 'lucide-react';

const StudentDashboard = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.25rem 1rem 3.5rem' }}>
      
      {/* Student Welcome Banner - Conventional & Balanced */}
      <div 
        style={{ 
          background: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: 6, 
          padding: '1.25rem 1.5rem', 
          marginBottom: '1.15rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, padding: '3px 8px', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Flame size={13} fill="currentColor" color="#d97706" /> 5 ngày streak
            </span>
            <span style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 8px', fontSize: '0.78rem', fontWeight: 600 }}>
              Mục tiêu: IELTS 7.5
            </span>
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111827', margin: 0 }}>
            Xin chào Sơn Nguyễn, chúc bạn một ngày học tập hiệu quả!
          </h1>
          <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: '3px 0 0' }}>
            Hôm nay bạn có 1 bài thi nghe và 45 thẻ từ vựng cần ôn tập.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <button 
            onClick={() => navigate('/student/exam/1/listening')}
            style={{ 
              background: '#f59e0b', 
              color: '#111827', 
              border: '1px solid #d97706', 
              borderRadius: 5, 
              padding: '0.5rem 1.15rem', 
              fontSize: '0.85rem', 
              fontWeight: 600, 
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <Headphones size={15} /> Luyện Listening
          </button>
          
          <button 
            onClick={() => navigate('/student/flashcards')}
            style={{ 
              background: '#ffffff', 
              color: '#374151', 
              border: '1px solid #cbd5e1', 
              borderRadius: 5, 
              padding: '0.5rem 1.15rem', 
              fontSize: '0.85rem', 
              fontWeight: 600, 
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            Ôn 45 Thẻ SRS
          </button>
        </div>
      </div>

      {/* 4 Balanced Rectangular Stat Boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #f59e0b', borderRadius: 5, padding: '0.85rem 1.15rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>
            Thời lượng học tuần
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#111827' }}>
            12.5 <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>giờ</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: 3, fontWeight: 500 }}>
            +2.5 giờ so với tuần trước
          </div>
        </div>
        
        {/* Highlighted Stat Box for Priority Action */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde047', borderRadius: 5, padding: '0.85rem 1.15rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
              Thẻ SRS cần ôn hôm nay
            </span>
            <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>Ưu tiên</span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#b45309' }}>
            45 <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#92400e' }}>thẻ</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#78350f', marginTop: 3 }}>
            Khoảng nhớ vàng trong ngày
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 5, padding: '0.85rem 1.15rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>
            Điểm dự đoán
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#111827' }}>
            7.5 <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>/ 9.0</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: 3, fontWeight: 500 }}>
            Đạt 100% mục tiêu đề ra
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 5, padding: '0.85rem 1.15rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>
            Tiến độ lộ trình
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#111827' }}>
            68%
          </div>
          <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ width: '68%', height: '100%', background: '#f59e0b', borderRadius: 3 }}></div>
          </div>
        </div>
      </div>

      {/* Main Split: Recent Tests & Skill Progress */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.1fr', gap: '1rem' }}>
        
        {/* Recent Exams Table */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1.15rem 1.35rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0 }}>Lịch sử luyện thi gần đây</h2>
              <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Bài làm mới nhất kèm nhận xét</span>
            </div>
            <button 
              onClick={() => navigate('/student/history')}
              style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Xem tất cả &gt;
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {[
              {
                title: 'Cambridge IELTS 18 - Academic Test 1',
                type: 'Full Mock Test',
                date: 'Hôm nay, 10:30',
                score: 'Band 7.0',
                status: 'Đã có kết quả',
                statusBg: '#fef3c7',
                statusColor: '#92400e',
                route: '/student/exam/1/result'
              },
              {
                title: 'TOEIC ETS 2024 - Reading Part 5 & 6',
                type: 'Chuyên đề Ngữ pháp',
                date: 'Hôm qua, 16:45',
                score: '420/495',
                status: 'Hoàn thành',
                statusBg: '#f0fdf4',
                statusColor: '#166534',
                route: '/student/exam/2/result'
              },
              {
                title: 'IELTS Writing Task 2 - Global Warming & Carbon Tax',
                type: 'Writing Essay',
                date: '3 ngày trước',
                score: 'Band 6.5',
                status: 'Đã nhận xét',
                statusBg: '#fef3c7',
                statusColor: '#92400e',
                route: '/student/exam/3/writing'
              }
            ].map((item, idx) => (
              <div 
                key={idx}
                onClick={() => navigate(item.route)}
                style={{ 
                  padding: '0.75rem 0.95rem', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: 5, 
                  background: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>{item.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
                    <span>{item.type}</span> • <span>{item.date}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ background: item.statusBg, color: item.statusColor, fontSize: '0.75rem', fontWeight: 600, padding: '3px 7px', borderRadius: 4 }}>
                    {item.status}
                  </span>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem', minWidth: '60px', textAlign: 'right' }}>
                    {item.score}
                  </div>
                  <ArrowRight size={14} color="#9ca3af" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skill Health & Progress */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '1.15rem 1.35rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0 }}>Năng lực 4 kỹ năng</h2>
                <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Đánh giá theo 28 bài luyện tập</span>
              </div>
              <button 
                onClick={() => navigate('/student/analytics')}
                style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Chi tiết &gt;
              </button>
            </div>

            {/* 4 Skill Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { name: 'Listening (Nghe hiểu)', score: '7.5 / 9.0', percent: 83 },
                { name: 'Reading (Đọc hiểu)', score: '7.5 / 9.0', percent: 83 },
                { name: 'Writing (Viết luận)', score: '6.5 / 9.0', percent: 72, note: 'Cần trau dồi từ vựng' },
                { name: 'Speaking (Nói & Phát âm)', score: '6.5 / 9.0', percent: 72 },
              ].map((skill, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, marginBottom: 3 }}>
                    <span style={{ color: '#374151' }}>{skill.name}</span>
                    <span style={{ color: '#111827' }}>{skill.score}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${skill.percent}%`, height: '100%', background: '#f59e0b', borderRadius: 3 }}></div>
                  </div>
                  {skill.note && (
                    <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: 3 }}>
                      * {skill.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Notice Box - Highlighted */}
          <div 
            style={{ 
              marginTop: '1.25rem', 
              padding: '0.85rem 1rem', 
              background: '#fffbeb', 
              border: '1px solid #fde047', 
              borderRadius: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#854d0e' }}>Gợi ý bài tập tiếp theo:</div>
              <div style={{ fontSize: '0.78rem', color: '#713f12', marginTop: 1 }}>Luyện 1 bài Writing Task 2 để nâng band từ vựng.</div>
            </div>
            <button 
              onClick={() => navigate('/student/exam/1/writing')}
              style={{ background: '#f59e0b', border: '1px solid #d97706', color: '#111827', fontWeight: 600, fontSize: '0.78rem', padding: '0.4rem 0.8rem', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Làm ngay
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};

export default StudentDashboard;
