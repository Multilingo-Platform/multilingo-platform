import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Flame, User, LogOut } from 'lucide-react';

const UserLayout = () => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Top Navbar */}
      <header className="top-nav">
        <div className="container flex-between" style={{ height: '70px' }}>
          <div className="flex-center" style={{ gap: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, cursor: 'pointer', color: 'var(--primary)' }} onClick={() => navigate('/student/dashboard')}>
              Multilingo
            </h2>
            <nav style={{ display: 'flex', gap: '0.5rem', height: '100%' }}>
              <NavLink to="/student/dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 1.5rem' }}>
                Bảng điều khiển
              </NavLink>
              <NavLink to="/student/library" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 1.5rem' }}>
                Thư viện Đề thi
              </NavLink>
              <NavLink to="/student/flashcards" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 1.5rem' }}>
                Từ vựng SRS
              </NavLink>
            </nav>
          </div>
          
          <div className="flex-center" style={{ gap: '1.5rem' }}>
            <div className="badge badge-orange flex-center" style={{ gap: '0.25rem', padding: '0.4rem 0.75rem', borderRadius: '50px' }}>
              <Flame size={16} fill="currentColor" /> 5 ngày
            </div>
            
            {/* Profile Dropdown */}
            <div ref={profileMenuRef} style={{ position: 'relative' }}>
              <div 
                style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                J
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
      <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)', padding: '2rem 0', marginTop: 'auto' }}>
        <div className="container flex-center" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          &copy; 2026 Multilingo Platform.
        </div>
      </footer>
    </div>
  );
};

export default UserLayout;
