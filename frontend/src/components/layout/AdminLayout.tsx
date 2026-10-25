import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, LogOut, ShieldAlert, Crown, Menu, X, Activity, Receipt, Bot, User, KeyRound, ChevronDown } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import type { RootState } from '../../app/store';
import { logout } from '../../features/auth/store/authSlice';
import { authApi } from '../../features/auth/api/authApi';
import { alertUtil } from '../../utils/alert';
import './AdminLayout.css';

const AdminLayout = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const toggleSidebarCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      alertUtil.toast('Đăng xuất thành công', 'success');
    },
    onSettled: () => {
      dispatch(logout());
      navigate('/');
    }
  });

  const handleLogout = async () => {
    setShowProfileMenu(false);
    const isConfirmed = await alertUtil.confirm('Bạn có chắc chắn muốn đăng xuất?', 'Đăng xuất', 'Hủy');
    if (isConfirmed) {
      logoutMutation.mutate();
    }
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="admin-layout-container">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div className="admin-sidebar-backdrop" onClick={closeSidebar} />
      )}

      {/* Admin Sidebar (Light Theme, Collapsible) */}
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="admin-sidebar-header" style={{ padding: isCollapsed ? '1.25rem 0.5rem' : '1.25rem 1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', height: '70px', gap: '0.5rem' }}>
          {!isCollapsed && (
            <div className="admin-sidebar-brand-full">
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: 0, lineHeight: 1.2 }}>Multilingo</h2>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Admin Portal</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              type="button"
              className="admin-collapse-toggle desktop-only"
              onClick={toggleSidebarCollapse}
              aria-label={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
              title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            >
              <Menu size={20} />
            </button>
            <button 
              type="button" 
              className="admin-menu-toggle mobile-only"
              onClick={closeSidebar}
              aria-label="Đóng menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <nav style={{ padding: isCollapsed ? '1.5rem 0.5rem' : '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
          <NavLink to="/admin/dashboard" title="Tổng quan" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} className="admin-nav-icon" />
            <span className="admin-nav-text">Tổng quan</span>
          </NavLink>
          <NavLink to="/admin/users" title="Quản lý Người dùng" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} className="admin-nav-icon" />
            <span className="admin-nav-text">Quản lý Người dùng</span>
          </NavLink>
          <NavLink to="/admin/tracking" title="Giám sát & Tracking" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Activity size={20} className="admin-nav-icon" />
            <span className="admin-nav-text">Giám sát & Tracking</span>
          </NavLink>
          <NavLink to="/admin/transactions" title="Đối soát VNPAY" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Receipt size={20} className="admin-nav-icon" />
            <span className="admin-nav-text">Đối soát VNPAY</span>
          </NavLink>
          <NavLink to="/admin/quotas" title="Hạn mức Quota AI" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Bot size={20} className="admin-nav-icon" />
            <span className="admin-nav-text">Hạn mức Quota AI</span>
          </NavLink>
          <NavLink to="/admin/audit" title="Logs Kiểm toán" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <ShieldAlert size={20} className="admin-nav-icon" />
            <span className="admin-nav-text">Logs Kiểm toán</span>
          </NavLink>

          {!isCollapsed ? (
            <div className="admin-nav-group-title" style={{ marginTop: '1.25rem', padding: '0 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Nội dung & Gói
            </div>
          ) : (
            <div className="admin-nav-group-divider" style={{ borderTop: '1px solid var(--border-light)', margin: '0.75rem 0.5rem' }} />
          )}

          <NavLink to="/admin/exams" title="Quản lý Đề thi" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={20} className="admin-nav-icon" />
            <span className="admin-nav-text">Quản lý Đề thi</span>
          </NavLink>
          <NavLink to="/admin/premium" title="Quản lý Gói Premium" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Crown size={20} className="admin-nav-icon" />
            <span className="admin-nav-text">Quản lý Gói Premium</span>
          </NavLink>
          <NavLink to="/admin/settings" title="Cài đặt" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={20} className="admin-nav-icon" />
            <span className="admin-nav-text">Cài đặt</span>
          </NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="admin-content-wrapper">
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              type="button" 
              className="admin-menu-toggle mobile-only"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Mở menu"
            >
              <Menu size={20} />
            </button>
            <h3 className="admin-header-title" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Trang quản trị hệ thống</h3>
          </div>
          
          {/* Top-Right Avatar & Dropdown */}
          <div ref={profileMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="admin-profile-trigger"
              onClick={() => setShowProfileMenu(prev => !prev)}
              aria-haspopup="true"
              aria-expanded={showProfileMenu}
              aria-label={user?.fullName || 'Admin (System)'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: showProfileMenu ? 'var(--bg-tertiary)' : 'transparent',
                border: 'none',
                padding: '0.375rem 0.625rem',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div className="admin-user-info-text" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                  {user?.fullName || 'Admin (System)'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                  {user?.role === 'ADMIN' ? 'Quản trị viên' : (user?.email || 'Admin')}
                </div>
              </div>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)',
                  flexShrink: 0
                }}
              >
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'A'}
              </div>
              <ChevronDown
                size={16}
                style={{
                  color: 'var(--text-muted)',
                  transform: showProfileMenu ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease'
                }}
              />
            </button>

            {showProfileMenu && (
              <div
                className="admin-profile-dropdown ed-card slide-up"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  minWidth: '220px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 1050,
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
              >
                <div style={{ padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--border-light)', marginBottom: '0.25rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                    {user?.fullName || 'Admin (System)'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                    {user?.email || 'admin@multilingo.com'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); navigate('/student/settings?tab=general'); }}
                  className="admin-dropdown-item"
                >
                  <User size={16} color="var(--text-secondary)" />
                  <span>Quản lý thông tin</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); navigate('/student/settings?tab=password'); }}
                  className="admin-dropdown-item"
                >
                  <KeyRound size={16} color="var(--text-secondary)" />
                  <span>Đổi mật khẩu</span>
                </button>

                <div style={{ borderTop: '1px solid var(--border-light)', margin: '0.25rem 0' }} />

                <button
                  type="button"
                  onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                  disabled={logoutMutation.isPending}
                  className="admin-dropdown-item logout"
                >
                  <LogOut size={16} />
                  <span>{logoutMutation.isPending ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
