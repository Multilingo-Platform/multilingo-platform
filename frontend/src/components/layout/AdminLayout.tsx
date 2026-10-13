import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, LogOut, ShieldAlert, Crown, Menu, X, Activity, Receipt, Bot } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { logout } from '../../features/auth/store/authSlice';
import { authApi } from '../../features/auth/api/authApi';
import { alertUtil } from '../../utils/alert';
import './AdminLayout.css';

const AdminLayout = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

      {/* Admin Sidebar (Light Theme) */}
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '1.5rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>Multilingo</h2>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Admin Portal</span>
          </div>
          <button 
            type="button" 
            className="admin-menu-toggle"
            onClick={closeSidebar}
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
          <NavLink to="/admin/dashboard" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} /> Tổng quan
          </NavLink>
          <NavLink to="/admin/users" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} /> Quản lý Người dùng
          </NavLink>
          <NavLink to="/admin/tracking" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Activity size={20} /> Giám sát & Tracking
          </NavLink>
          <NavLink to="/admin/transactions" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Receipt size={20} /> Đối soát VNPAY
          </NavLink>
          <NavLink to="/admin/quotas" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Bot size={20} /> Hạn mức Quota AI
          </NavLink>
          <NavLink to="/admin/audit" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <ShieldAlert size={20} /> Logs Kiểm toán
          </NavLink>

          <div style={{ marginTop: '1.5rem', padding: '0 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Nội dung & Gói</div>
          <NavLink to="/admin/exams" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={20} /> Quản lý Đề thi
          </NavLink>
          <NavLink to="/admin/premium" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Crown size={20} /> Quản lý Gói Premium
          </NavLink>
          <NavLink to="/admin/settings" onClick={closeSidebar} className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={20} /> Cài đặt
          </NavLink>
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-light)' }}>
          <button className="flex-center" style={{ width: '100%', gap: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }} onClick={handleLogout} disabled={logoutMutation.isPending}>
            <LogOut size={20} /> {logoutMutation.isPending ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="admin-content-wrapper">
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="admin-menu-toggle"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Mở menu"
            >
              <Menu size={22} />
            </button>
            <h3 className="admin-header-title" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Trang quản trị hệ thống</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, display: 'inline-block' }}>Admin (System)</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>A</div>
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
