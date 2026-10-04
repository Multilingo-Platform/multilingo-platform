import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Flame } from 'lucide-react';
import Header from './Header';
import ProfileDropdown from '../common/ProfileDropdown';
import Footer from './Footer';

const UserLayout = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Top Navbar */}
      <Header 
        navItems={
          <>
            <NavLink to="/student/dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 1.5rem', display: 'flex', alignItems: 'center' }}>
              Bảng điều khiển
            </NavLink>
            <NavLink to="/student/library" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 1.5rem', display: 'flex', alignItems: 'center' }}>
              Thư viện Đề thi
            </NavLink>
            <NavLink to="/student/history" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 1.5rem', display: 'flex', alignItems: 'center' }}>
              Lịch sử làm bài
            </NavLink>
            <NavLink to="/student/flashcards" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 1.5rem', display: 'flex', alignItems: 'center' }}>
              Từ vựng SRS
            </NavLink>
          </>
        }
        rightActions={
          <>
            <div className="badge badge-orange flex-center" style={{ gap: '0.25rem', padding: '0.4rem 0.75rem', borderRadius: '50px' }}>
              <Flame size={16} fill="currentColor" /> 5 ngày
            </div>
            <ProfileDropdown />
          </>
        }
      />

      {/* Main Content */}
      <main className="slide-up" style={{ flex: 1, padding: '2rem 0' }}>
        <Outlet />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default UserLayout;
