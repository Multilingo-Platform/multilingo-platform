import React from 'react';
import { Target, Clock, Zap, BookOpen } from 'lucide-react';

const StudentDashboard = () => {
  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '2rem' }}>Bảng điều khiển học tập</h1>
      
      <div className="dashboard-grid">
        <div className="ed-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="flex-between">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Thời lượng học (Tuần)</span>
            <Clock size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>12.5 <span style={{fontSize: '1rem', color: 'var(--text-muted)'}}>giờ</span></div>
          <p style={{fontSize: '0.875rem', color: 'var(--success)'}}>+2.5 giờ so với tuần trước</p>
        </div>
        
        <div className="ed-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="flex-between">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Thẻ cần ôn hôm nay</span>
            <BookOpen size={20} color="var(--accent)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>45 <span style={{fontSize: '1rem', color: 'var(--text-muted)'}}>thẻ</span></div>
          <button className="btn btn-outline" style={{marginTop: '0.5rem', width: 'fit-content', padding: '0.4rem 1rem', fontSize: '0.875rem'}}>Ôn tập ngay</button>
        </div>

        <div className="ed-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="flex-between">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Mục tiêu hiện tại</span>
            <Target size={20} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>IELTS 7.0</div>
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', marginTop: '0.5rem' }}>
            <div style={{ width: '60%', height: '100%', background: 'var(--primary)', borderRadius: '3px' }}></div>
          </div>
          <p style={{fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem'}}>Đã hoàn thành 60% lộ trình</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="ed-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem', fontWeight: 700, fontSize: '1.25rem' }}>Lịch sử thi gần đây</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                <th style={{ paddingBottom: '1rem', fontWeight: 600 }}>Tên bài thi</th>
                <th style={{ paddingBottom: '1rem', fontWeight: 600 }}>Ngày làm</th>
                <th style={{ paddingBottom: '1rem', fontWeight: 600 }}>Kết quả</th>
                <th style={{ paddingBottom: '1rem', fontWeight: 600 }}>Trạng thái AI</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--bg-tertiary)' }}>
                <td style={{ padding: '1rem 0', fontWeight: 500 }}>Cambridge IELTS 18 - Test 1</td>
                <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>Hôm nay</td>
                <td style={{ padding: '1rem 0' }}><span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>6.5</span> / 9.0</td>
                <td style={{ padding: '1rem 0' }}><span className="badge badge-orange">Đã nhận xét</span></td>
              </tr>
              <tr>
                <td style={{ padding: '1rem 0', fontWeight: 500 }}>TOEIC ETS 2023 - Test 1</td>
                <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>Hôm qua</td>
                <td style={{ padding: '1rem 0' }}><span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>750</span> / 990</td>
                <td style={{ padding: '1rem 0' }}><span className="badge badge-gray">Chờ chấm</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ed-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem', fontWeight: 700, fontSize: '1.25rem' }}>Kỹ năng mạnh/yếu</h2>
          <div className="flex-center" style={{ height: '200px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
            {/* Placeholder for Radar Chart */}
            [Radar Chart Component]
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
