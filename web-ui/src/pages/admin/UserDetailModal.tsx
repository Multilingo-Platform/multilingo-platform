import { useState } from 'react';
import { 
  User, 
  Clock, 
  Target, 
  ShieldAlert, 
  Smartphone, 
  Laptop, 
  Lock, 
  Unlock, 
  X,
  Flame,
  Award
} from 'lucide-react';

interface UserDetailModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onToggleStatus: (userId: number) => void;
}

export const UserDetailModal = ({ user, isOpen, onClose, onToggleStatus }: UserDetailModalProps) => {
  if (!isOpen || !user) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1.5rem' }}>
      <div className="ed-card slide-up" style={{ width: '100%', maxWidth: 650, background: 'white', borderRadius: 20, overflow: 'hidden' }}>
        
        {/* Header */}
        <div className="flex-between" style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
              {user.name?.[0] || 'U'}
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Chi Tiết Học Viên & Tracking Hành Vi (A_Tracking)
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: #{user.id} • {user.email}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.75rem', maxHeight: 480, overflowY: 'auto' }}>
          
          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.75rem' }}>
            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 12, textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Tổng Bài Thi Đã Làm</span>
              <strong style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>14 đề</strong>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 12, textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Điểm Trung Bình</span>
              <strong style={{ fontSize: '1.4rem', color: '#10b981' }}>Band 6.5</strong>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 12, textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Tổng Giờ Ôn Luyện</span>
              <strong style={{ fontSize: '1.4rem', color: '#3b82f6' }}>28.4 giờ</strong>
            </div>
          </div>

          {/* Account Status & Tier */}
          <div style={{ padding: '1rem 1.25rem', border: '1px solid var(--border-light)', borderRadius: 12, marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>Trạng Thái & Hạng Tài Khoản:</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span className={user.status === 'Active' ? 'badge badge-green' : 'badge badge-gray'} style={{ color: user.status !== 'Active' ? '#dc2626' : undefined }}>
                  {user.status === 'Active' ? 'Đang Hoạt Động' : 'Đã Khóa'}
                </span>
                <span className="badge badge-orange">{user.role}</span>
              </div>
            </div>

            <button
              onClick={() => onToggleStatus(user.id)}
              className="btn btn-outline"
              style={{
                fontSize: '0.8rem',
                padding: '0.45rem 0.9rem',
                color: user.status === 'Active' ? '#dc2626' : '#166534',
                borderColor: user.status === 'Active' ? '#fca5a5' : '#86efac',
                gap: 6
              }}
            >
              {user.status === 'Active' ? <><Lock size={14} /> Khóa Tài Khoản</> : <><Unlock size={14} /> Mở Khóa</>}
            </button>
          </div>

          {/* Login History & Devices */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Lịch Sử Đăng Nhập & Thiết Bị Gần Nhất (login_history)
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { device: 'Chrome 124 on Windows 11', ip: '113.190.234.12 (Hanoi)', time: '03/10/2026 13:30', status: 'SUCCESS' },
                { device: 'Safari on iPhone 15 Pro', ip: '113.190.234.12 (Hanoi)', time: '02/10/2026 21:15', status: 'SUCCESS' },
                { device: 'Chrome on MacOS', ip: '14.238.102.88 (Da Nang)', time: '28/09/2026 09:12', status: 'SUCCESS' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Laptop size={15} color="var(--text-muted)" />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.device}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>IP: {item.ip}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{item.time}</span>
                    <span style={{ color: '#166534', fontWeight: 700, display: 'block', fontSize: '0.72rem' }}>✓ {item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-primary)' }}>
          <button className="btn btn-outline" onClick={onClose} style={{ fontSize: '0.85rem' }}>
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
