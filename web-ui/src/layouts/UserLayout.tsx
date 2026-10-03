import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Flame, User, LogOut, Bell, Crown, BookOpen, BarChart2 } from 'lucide-react';
import { NotificationDrawer } from '../components/NotificationDrawer';

const UserLayout = () => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Top Navbar - Balanced Conventional Education Style */}
      <header className="top-nav" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="container flex-between" style={{ height: '60px' }}>
          <div className="flex-center" style={{ gap: '2rem' }}>
            <div className="flex-center" style={{ gap: '0.45rem', cursor: 'pointer' }} onClick={() => navigate('/student/dashboard')}>
              <div style={{ width: 30, height: 30, borderRadius: 4, background: '#f5b301', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>
                M
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#222222', letterSpacing: '-0.3px', margin: 0 }}>
                Multi<span style={{ color: '#d99a00' }}>lingo</span>
              </h2>
            </div>
            <nav style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', height: '60px' }}>
              <NavLink to="/student/dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                Bảng điều khiển
              </NavLink>
              <NavLink to="/student/library" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                Thư viện Đề thi
              </NavLink>
              <NavLink to="/student/flashcards" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                Sổ tay Flashcard
              </NavLink>
              <NavLink to="/student/history" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                Lịch sử thi
              </NavLink>
              <NavLink to="/student/analytics" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                Radar Năng lực
              </NavLink>
            </nav>
          </div>
          
          <div className="flex-center" style={{ gap: '0.75rem' }}>
            {/* VIP Upgrade Button - Elegant Soft Amber Tag */}
            <button 
              onClick={() => navigate('/student/pricing')}
              style={{ 
                background: '#fffbeb', 
                color: '#92400e', 
                fontWeight: 600, 
                padding: '6px 12px', 
                fontSize: '13px', 
                borderRadius: 4, 
                border: '1px solid #fde68a',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Crown size={14} color="#d97706" /> Nâng Cấp VIP
            </button>

            {/* Streak Badge - Balanced soft tag */}
            <div style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', borderRadius: 4, padding: '5px 10px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Flame size={14} fill="currentColor" color="#f5b301" /> 5 ngày
            </div>
            
            {/* Notification Bell */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 5,
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                  position: 'relative'
                }}
              >
                <Bell size={16} />
                <span style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
              </button>

              <NotificationDrawer 
                isOpen={showNotifications} 
                onClose={() => setShowNotifications(false)} 
              />
            </div>

            {/* Profile Dropdown */}
            <div ref={profileMenuRef} style={{ position: 'relative' }}>
              <div 
                style={{ 
                  width: '34px', 
                  height: '34px', 
                  borderRadius: 5, 
                  background: '#f1f5f9', 
                  border: '1px solid #cbd5e1',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#0f172a', 
                  fontWeight: 700, 
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                S
              </div>

              {showProfileMenu && (
                <div className="ed-card slide-up" style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  minWidth: '220px',
                  zIndex: 1000,
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>John Doe</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>john@example.com</div>
                    <span className="badge badge-orange" style={{ marginTop: 4, display: 'inline-block' }}>Học viên VIP</span>
                  </div>
                  
                  <div 
                    className="flex-center"
                    onClick={() => { setShowProfileMenu(false); navigate('/student/settings'); }}
                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontWeight: 500, justifyContent: 'flex-start', gap: '0.75rem', color: 'var(--text-primary)' }}
                  >
                    <User size={18} color="var(--text-secondary)" /> Hồ sơ & Cài đặt
                  </div>
                  
                  <div 
                    className="flex-center"
                    onClick={() => { setShowProfileMenu(false); navigate('/'); }}
                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontWeight: 500, justifyContent: 'flex-start', gap: '0.75rem', color: 'var(--danger)' }}
                  >
                    <LogOut size={18} /> Đăng xuất
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="slide-up" style={{ flex: 1, padding: '2rem 0' }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)', padding: '1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        <div className="container flex-between">
          <span>© 2026 Multilingo Platform. Nền tảng thi thử & đánh giá năng lực ngoại ngữ chuẩn quốc tế.</span>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/library')}>Thư viện đề</span>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/pricing')}>Gói cước VIP</span>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/dashboard')}>Admin Portal</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default UserLayout;
