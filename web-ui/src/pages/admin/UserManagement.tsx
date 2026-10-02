import React from 'react';
import { Search, Monitor, Smartphone, ShieldAlert, Power } from 'lucide-react';

const UserManagement = () => {
  const users = [
    { id: 1, email: 'john.doe@example.com', name: 'John Doe', lastLogin: 'Vừa xong', ip: '113.190.23.1', device: 'Chrome / Windows', fraudRisk: false },
    { id: 2, email: 'alice.smith@example.com', name: 'Alice Smith', lastLogin: '5 phút trước', ip: '14.23.45.1', device: 'Firefox / MacOS (Lạ)', fraudRisk: true },
    { id: 3, email: 'hoang.nguyen@example.com', name: 'Hoàng Nguyễn', lastLogin: '2 giờ trước', ip: '1.53.20.10', device: 'Safari / iOS', fraudRisk: false },
  ];

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Quản lý Người dùng & Session</h1>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', top: '10px', left: '10px' }} />
          <input type="text" className="input-field" placeholder="Tìm theo email hoặc IP..." style={{ paddingLeft: '2.5rem' }} />
        </div>
      </div>

      <div className="ed-card">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-dark)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Tài khoản</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Trạng thái Hiện diện</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Thiết bị (Session)</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'right' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--border-light)', background: user.fraudRisk ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                <td style={{ padding: '1.5rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{user.name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                  {user.fraudRisk && <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}><ShieldAlert size={14} /> Nghi ngờ Share tài khoản</div>}
                </td>
                <td style={{ padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Last login: {user.lastLogin}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>IP: {user.ip}</div>
                </td>
                <td style={{ padding: '1.5rem' }}>
                  <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {user.device.includes('iOS') ? <Smartphone size={16} /> : <Monitor size={16} />}
                    {user.device}
                  </div>
                </td>
                <td style={{ padding: '1.5rem', textAlign: 'right' }}>
                  <button className="btn btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}>
                    <Power size={14} /> Force Logout
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
