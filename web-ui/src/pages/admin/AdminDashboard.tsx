import React from 'react';
import { Users, FileText, Activity, AlertTriangle } from 'lucide-react';

const AdminDashboard = () => {
  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '2rem' }}>Tổng quan Hệ thống</h1>
      
      <div className="dashboard-grid">
        <div className="ed-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Tổng Học viên</h3>
            <Users size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>12,450</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--success)', marginTop: '0.5rem' }}>+120 học viên tuần này</p>
        </div>

        <div className="ed-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent)' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Bộ Đề thi</h3>
            <FileText size={20} color="var(--accent)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>345</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--success)', marginTop: '0.5rem' }}>+5 bộ đề mới</p>
        </div>

        <div className="ed-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--danger)' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Cảnh báo Gian lận</h3>
            <AlertTriangle size={20} color="var(--danger)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--danger)' }}>12</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Cần xử lý (IP bất thường)</p>
        </div>
      </div>

      <div className="ed-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Nhật ký Hoạt động (Audit Logs)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-dark)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 0' }}>Thời gian</th>
              <th style={{ padding: '1rem 0' }}>Người dùng</th>
              <th style={{ padding: '1rem 0' }}>Hành động</th>
              <th style={{ padding: '1rem 0' }}>Thiết bị / IP</th>
              <th style={{ padding: '1rem 0' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>Vừa xong</td>
              <td style={{ padding: '1rem 0', fontWeight: 500 }}>john@example.com</td>
              <td style={{ padding: '1rem 0' }}>Nộp bài thi CAM-18-1</td>
              <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>Chrome / 192.168.1.1</td>
              <td style={{ padding: '1rem 0' }}><span className="badge badge-green">Thành công</span></td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(239, 68, 68, 0.05)' }}>
              <td style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>5 phút trước</td>
              <td style={{ padding: '1rem 0', fontWeight: 500 }}>alice@example.com</td>
              <td style={{ padding: '1rem 0', color: 'var(--danger)', fontWeight: 500 }}>Đăng nhập từ IP lạ</td>
              <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>Firefox / 114.23.45.1</td>
              <td style={{ padding: '1rem 0' }}><span className="badge" style={{background:'var(--danger)', color:'white'}}>Cảnh báo</span></td>
            </tr>
            <tr>
              <td style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>12 phút trước</td>
              <td style={{ padding: '1rem 0', fontWeight: 500 }}>admin@multilingo.com</td>
              <td style={{ padding: '1rem 0' }}>Cập nhật Đề thi TOEIC-2023</td>
              <td style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>Safari / 10.0.0.1</td>
              <td style={{ padding: '1rem 0' }}><span className="badge badge-green">Thành công</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
