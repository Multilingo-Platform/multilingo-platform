import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Flame, Crown, User, LogOut, Globe } from 'lucide-react';
import Header from './Header';
import ProfileDropdown from '../common/ProfileDropdown';
import Footer from './Footer';
import { useTranslation } from 'react-i18next';

const UserLayout = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Top Navbar */}
      <Header
        navItems={
          <>
            <NavLink to="/student/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              {t('userLayout.dashboard')}
            </NavLink>
            <NavLink to="/student/library" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              {t('userLayout.library')}
            </NavLink>
            <NavLink to="/student/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              {t('userLayout.history')}
            </NavLink>
            <NavLink to="/student/flashcards" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              {t('userLayout.flashcards')}
            </NavLink>
            <NavLink to="/student/settings" className={({ isActive }) => `nav-item mobile-only-nav ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', gap: '0.5rem' }}>
              <User size={18} /> {t('userLayout.profile_settings')}
            </NavLink>
            <div className="nav-item mobile-only-nav" onClick={() => navigate('/')} style={{ height: '70px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', cursor: 'pointer', color: 'var(--danger)', gap: '0.5rem' }}>
              <LogOut size={18} /> {t('userLayout.logout')}
            </div>
            <div className="nav-item mobile-only-nav" onClick={() => i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')} style={{ height: '70px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', cursor: 'pointer', gap: '0.5rem' }}>
              <Globe size={18} /> {i18n.language === 'vi' ? 'Chuyển sang Tiếng Anh' : 'Switch to Vietnamese'}
            </div>
          </>
        }
        rightActions={
          <>
            <button 
              onClick={() => navigate('/student/premium')}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'row',
                gap: '0.375rem',
                padding: '0.4rem 1rem',
                borderRadius: '50px',
                background: 'linear-gradient(90deg, #FFB800 0%, #FF8A00 100%)',
                color: 'white',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255, 138, 0, 0.25)',
                fontSize: '0.9rem',
                whiteSpace: 'nowrap',
                height: '38px'
              }}
            >
              <Crown size={18} fill="currentColor" />
              <span>{t('userLayout.upgrade_pro')}</span>
            </button>
            <div className="badge badge-orange" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row', gap: '0.25rem', padding: '0.4rem 0.75rem', borderRadius: '50px', whiteSpace: 'nowrap', height: '38px', fontSize: '0.9rem' }}>
              <Flame size={16} fill="currentColor" />
              <span>{t('userLayout.streak_days', { count: 5 })}</span>
            </div>
            <div className="desktop-only">
              <ProfileDropdown />
            </div>
          </>
        }
      />

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem 0' }}>
        <Outlet />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default UserLayout;
