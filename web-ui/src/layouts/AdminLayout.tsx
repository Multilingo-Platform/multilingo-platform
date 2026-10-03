import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, LogOut, ShieldAlert, DollarSign, ExternalLink } from 'lucide-react';

const AdminLayout = () => {
  const navigate = useNavigate();

  return (
    <div className="layout-container" style={{ background: 'var(--bg-primary)', display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Admin Sidebar (Sleek Deep Navy Slate with Indigo Accent) */}
      <aside style={{ width: '270px', background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)', color: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ padding: '1.5rem 1.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.6rem', cursor: 'pointer' }} onClick={() => navigate('/admin/dashboard')}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
              M
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px', margin: 0 }}>
                Multilingo
              </h2>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#818cf8', fontWeight: 700 }}>Admin Portal</span>
            </div>
          </div>
        </div>
        
        <nav style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
          <div style={{ padding: '0 0.75rem', fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 4, letterSpacing: '0.5px' }}>
            Nghiệp Vụ Học Liệu
          </div>
          <NavLink to="/admin/dashboard" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> Tổng quan (Dashboard)
          </NavLink>
          <NavLink to="/admin/exams" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={18} /> Quản lý Đề thi & CMS
          </NavLink>
          <NavLink to="/admin/users" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Users size={18} /> Quản lý Học viên & Tracking
          </NavLink>
          
          <div style={{ marginTop: '1.5rem', padding: '0 0.75rem', fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 4, letterSpacing: '0.5px' }}>
            Tài Chính & Vận Hành
          </div>
          <NavLink to="/admin/billing" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <DollarSign size={18} /> Doanh thu & Giao dịch VNPAY
          </NavLink>
          <NavLink to="/admin/audit" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <ShieldAlert size={18} /> Nhật ký Kiểm toán & Gian lận
          </NavLink>
          <NavLink to="/admin/settings" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={18} /> Cấu hình Quota AI & RBAC
          </NavLink>
        </nav>

        <div style={{ padding: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button 
            className="flex-center" 
            style={{ width: '100%', gap: '0.5rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600, padding: '0.65rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', transition: 'all 0.2s ease' }} 
            onClick={() => navigate('/student/dashboard')}
          >
            <ExternalLink size={16} /> Sang Không Gian Học Viên
          </button>
          <button 
            className="flex-center" 
            style={{ width: '100%', gap: '0.5rem', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 600, padding: '0.5rem', fontSize: '0.85rem' }} 
            onClick={() => navigate('/')}
          >
            <LogOut size={16} /> Đăng xuất Admin
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: '70px', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', padding: '0 2rem', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Trang Quản Trị Hệ Thống Multilingo</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cập nhật hệ thống: Hoạt động bình thường (99.98% uptime)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="badge badge-indigo">SuperAdmin</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Sơn Nguyễn</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 2px 8px var(--primary-glow)' }}>A</div>
          </div>
        </header>

        <main className="slide-up" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
