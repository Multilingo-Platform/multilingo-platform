import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Flame, 
  Sparkles, 
  CreditCard, 
  CheckCheck, 
  Clock, 
  ChevronRight,
  X
} from 'lucide-react';

interface NotificationItem {
  id: number;
  title: string;
  desc: string;
  time: string;
  type: 'srs' | 'ai' | 'billing';
  path: string;
  isRead: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    title: 'Đến hạn ôn tập 5 thẻ từ vựng hôm nay',
    desc: 'Thuật toán SuperMemo SM-2 đã kích hoạt chu kỳ ôn tập các từ: Ubiquitous, Altruism,...',
    time: '15 phút trước',
    type: 'srs',
    path: '/student/flashcards/study',
    isRead: false
  },
  {
    id: 2,
    title: 'AI Gemini đã chấm xong bài Writing của bạn',
    desc: 'Bài luận IELTS Writing Task 2 đạt kết quả Band 7.0. Bấm để xem Interactive Diff-View phân tích lỗi.',
    time: '2 giờ trước',
    type: 'ai',
    path: '/student/exam/cam-18-1/result',
    isRead: false
  },
  {
    id: 3,
    title: 'Ưu đãi nâng cấp tài khoản VIP 1 năm',
    desc: 'Mở khóa không giới hạn lượt chấm bài bằng Gemini 2.5 Flash và toàn bộ kho đề thi bản quyền.',
    time: '1 ngày trước',
    type: 'billing',
    path: '/student/pricing',
    isRead: false
  }
];

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer = ({ isOpen, onClose }: NotificationDrawerProps) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const handleClickItem = (n: NotificationItem) => {
    setNotifications(notifications.map(item => item.id === n.id ? { ...item, isRead: true } : item));
    onClose();
    navigate(n.path);
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'srs': return <Flame size={18} color="#d97706" />;
      case 'ai': return <Sparkles size={18} color="#3b82f6" />;
      case 'billing': return <CreditCard size={18} color="#10b981" />;
    }
  };

  return (
    <div 
      className="slide-up ed-card"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 10,
        width: 380,
        maxHeight: 520,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)'
      }}
    >
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={18} color="var(--primary)" />
          <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Thông Báo Của Bạn</span>
          {unreadCount > 0 && (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'var(--primary)', color: 'white' }}>
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllRead}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <CheckCheck size={14} /> Đã đọc tất cả
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Không có thông báo mới nào.
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleClickItem(n)}
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border-light)',
                cursor: 'pointer',
                background: n.isRead ? 'transparent' : 'rgba(217, 119, 6, 0.04)',
                transition: 'background 0.15s ease',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(217, 119, 6, 0.04)'}
            >
              <div style={{ marginTop: 2, padding: 6, borderRadius: 8, background: 'var(--bg-primary)' }}>
                {getIcon(n.type)}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: n.isRead ? 600 : 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: 2 }}>
                  {n.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
                  {n.desc}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} /> {n.time}
                </div>
              </div>

              {!n.isRead && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', marginTop: 6 }} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '0.75rem', textAlign: 'center', borderTop: '1px solid var(--border-light)', background: 'var(--bg-primary)' }}>
        <button 
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Đóng hộp thông báo
        </button>
      </div>
    </div>
  );
};
