import { useState } from 'react';
import { Search, Monitor, Smartphone, ShieldAlert, Power, Eye, Lock, Unlock } from 'lucide-react';
import { UserDetailModal } from './UserDetailModal';

const UserManagement = () => {
  const [users, setUsers] = useState([
    { id: 1, email: 'john.doe@example.com', name: 'John Doe', role: 'STUDENT (VIP)', status: 'Active', lastLogin: 'Vừa xong', ip: '113.190.23.1', device: 'Chrome / Windows', fraudRisk: false },
    { id: 2, email: 'alice.smith@example.com', name: 'Alice Smith', role: 'STUDENT (VIP)', status: 'Active', lastLogin: '5 phút trước', ip: '14.23.45.1', device: 'Firefox / MacOS (Lạ)', fraudRisk: true },
    { id: 3, email: 'hoang.nguyen@example.com', name: 'Hoàng Nguyễn', role: 'STUDENT (FREE)', status: 'Active', lastLogin: '2 giờ trước', ip: '1.53.20.10', device: 'Safari / iOS', fraudRisk: false },
    { id: 4, email: 'bad.actor@temp.com', name: 'Bad Actor', role: 'STUDENT (FREE)', status: 'Locked', lastLogin: '3 ngày trước', ip: '45.134.22.90', device: 'Headless Chrome', fraudRisk: false },
  ]);

  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const handleToggleStatus = (userId: number) => {
    setUsers(users.map(u => {
      if (u.id === userId) {
        const newStatus = u.status === 'Active' ? 'Locked' : 'Active';
        return { ...u, status: newStatus };
      }
      return u;
    }));
    if (selectedUser) {
      setSelectedUser((prev: any) => ({ ...prev, status: prev.status === 'Active' ? 'Locked' : 'Active' }));
    }
  };

  const handleForceLogout = (userId: number) => {
    alert(`Đã thu hồi token phiên làm việc của User #${userId}.`);
  };

  return (
    <div className="slide-up">
      <div className="flex-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="badge badge-orange">UC15 / A_TRACKING</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4 }}>Quản lý Người dùng & Tracking Hành vi</h1>
        </div>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', top: '10px', left: '10px' }} />
          <input type="text" className="input-field" placeholder="Tìm theo email hoặc IP..." style={{ paddingLeft: '2.5rem' }} />
        </div>
      </div>

      <div className="ed-card">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-dark)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 700 }}>Tài khoản Học viên</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 700 }}>Trạng thái Hiện diện</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 700 }}>Thiết bị (Session)</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 700, textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--border-light)', background: user.fraudRisk ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
                    <span className={user.status === 'Active' ? 'badge badge-green' : 'badge badge-gray'} style={{ color: user.status !== 'Active' ? '#dc2626' : undefined }}>
                      {user.status === 'Active' ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                  {user.fraudRisk && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>
                      <ShieldAlert size={14} /> Nghi ngờ Share tài khoản VIP
                    </div>
                  )}
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Last login: {user.lastLogin}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>IP: {user.ip}</div>
                </td>
                <td style={{ padding: '1.25rem 1.5rem' }}>
                  <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {user.device.includes('iOS') ? <Smartphone size={16} /> : <Monitor size={16} />}
                    {user.device}
                  </div>
                </td>
                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => setSelectedUser(user)}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', gap: 4 }}
                    >
                      <Eye size={14} /> Xem Tracking
                    </button>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => handleForceLogout(user.id)}
                      style={{ borderColor: 'var(--danger)', color: 'var(--danger)', padding: '0.4rem 0.75rem', fontSize: '0.8rem', gap: 4 }}
                    >
                      <Power size={14} /> Buộc Thoát
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserDetailModal
        user={selectedUser}
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  );
};

export default UserManagement;
