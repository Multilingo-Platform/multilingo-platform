import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Flame, Crown, User, LogOut, Receipt, LayoutDashboard, BookOpen, History, Layers, Globe } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import Header from './Header';
import ProfileDropdown from '../common/ProfileDropdown';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Footer from './Footer';
import { logout } from '../../features/auth/store/authSlice';
import { authApi } from '../../features/auth/api/authApi';
import { alertUtil } from '../../utils/alert';
import { useTranslation } from 'react-i18next';

const UserLayout = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const isPaymentResultPage = location.pathname.includes('/payment/result');

  const { user: myInfo } = useSelector((state: any) => state.auth);
  const avatarLetter = myInfo?.fullName ? myInfo.fullName.charAt(0).toUpperCase() : 'U';

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      alertUtil.toast(t('auth.logout_success'), 'success');
    },
    onSettled: () => {
      dispatch(logout());
      navigate('/');
    }
  });

  const handleLogout = async () => {
    const isConfirmed = await alertUtil.confirm(t('auth.logout_confirm'), t('auth.logout'), t('auth.cancel'));
    if (isConfirmed) {
      logoutMutation.mutate();
    }
  };
  // Kiểm tra nếu đang ở chế độ làm bài / ôn tập / thi thử Flashcard toàn màn hình
  const searchParams = new URLSearchParams(location.search);
  const flashcardMode = searchParams.get('mode');
  const isFlashcardFullscreenMode =
    location.pathname.includes('/flashcards') &&
    ['study', 'practice', 'quiz', 'test', 'match'].includes(flashcardMode || '');

  if (isFlashcardFullscreenMode) {
    return (
      <main style={{ minHeight: '100vh', width: '100%', margin: 0, padding: 0 }}>
        <Outlet />
      </main>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Top Navbar */}
      <Header
        navItems={
          <>
            <NavLink to="/student/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 0.75rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '0.9375rem' }}>
              {t('userLayout.dashboard')}
            </NavLink>
            <NavLink to="/student/library" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 0.75rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '0.9375rem' }}>
              {t('userLayout.library')}
            </NavLink>
            <NavLink to="/student/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 0.75rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '0.9375rem' }}>
              {t('userLayout.history')}
            </NavLink>
            <NavLink to="/student/flashcards" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ height: '70px', padding: '0 0.75rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '0.9375rem' }}>
              {t('userLayout.flashcards')}
            </NavLink>
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
                padding: '0.4rem 0.95rem',
                borderRadius: '50px',
                background: 'linear-gradient(90deg, #FFB800 0%, #FF8A00 100%)',
                color: 'white',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255, 138, 0, 0.25)',
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
                height: '38px',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
            >
              <Crown size={16} fill="currentColor" />
              <span>{t('userLayout.upgrade_pro')}</span>
            </button>
            <div className="badge badge-orange" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row', gap: '0.25rem', padding: '0.4rem 0.75rem', borderRadius: '50px', whiteSpace: 'nowrap', height: '38px', fontSize: '0.875rem' }}>
              <Flame size={16} fill="currentColor" />
              <span>{t('userLayout.streak_days', { count: 5 })}</span>
            </div>
            <LanguageSwitcher />
            <div className="desktop-only">
              <ProfileDropdown />
            </div>
          </>
        }
        mobileContent={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Profile Info Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.875rem',
              padding: '1rem',
              borderRadius: '16px',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-light, #e2e8f0)'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent, #f97316)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.125rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }}>
                {avatarLetter}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {myInfo?.fullName || t('auth.default_user')}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {myInfo?.email || t('auth.loading')}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons (Upgrade PRO & Streak) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'center' }}>
              <button 
                onClick={() => navigate('/student/premium')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(90deg, #FFB800 0%, #FF8A00 100%)',
                  color: 'white',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(255, 138, 0, 0.25)',
                  fontSize: '0.875rem'
                }}
              >
                <Crown size={17} fill="currentColor" />
                <span>{t('userLayout.upgrade_pro')}</span>
              </button>

              <div className="badge badge-orange" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.625rem 0.85rem', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 700 }}>
                <Flame size={16} fill="currentColor" />
                <span>{t('userLayout.streak_days', { count: 5 })}</span>
              </div>
            </div>

            {/* Main Navigation Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <NavLink 
                to="/student/dashboard" 
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive ? 'var(--primary, #ea580c)' : 'var(--text-primary, #334155)',
                  backgroundColor: isActive ? '#fff7ed' : 'transparent',
                  fontSize: '0.9375rem'
                })}
              >
                <LayoutDashboard size={19} />
                <span>{t('userLayout.dashboard')}</span>
              </NavLink>

              <NavLink 
                to="/student/library" 
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive ? 'var(--primary, #ea580c)' : 'var(--text-primary, #334155)',
                  backgroundColor: isActive ? '#fff7ed' : 'transparent',
                  fontSize: '0.9375rem'
                })}
              >
                <BookOpen size={19} />
                <span>{t('userLayout.library')}</span>
              </NavLink>

              <NavLink 
                to="/student/history" 
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive ? 'var(--primary, #ea580c)' : 'var(--text-primary, #334155)',
                  backgroundColor: isActive ? '#fff7ed' : 'transparent',
                  fontSize: '0.9375rem'
                })}
              >
                <History size={19} />
                <span>{t('userLayout.history')}</span>
              </NavLink>

              <NavLink 
                to="/student/flashcards" 
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive ? 'var(--primary, #ea580c)' : 'var(--text-primary, #334155)',
                  backgroundColor: isActive ? '#fff7ed' : 'transparent',
                  fontSize: '0.9375rem'
                })}
              >
                <Layers size={19} />
                <span>{t('userLayout.flashcards')}</span>
              </NavLink>
            </div>

            {/* Account & Settings Links */}
            <div style={{ height: '1px', backgroundColor: 'var(--border-light, #f1f5f9)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <NavLink 
                to="/student/settings" 
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive ? 'var(--primary, #ea580c)' : 'var(--text-primary, #334155)',
                  backgroundColor: isActive ? '#fff7ed' : 'transparent',
                  fontSize: '0.9375rem'
                })}
              >
                <User size={19} />
                <span>{t('userLayout.profile_settings')}</span>
              </NavLink>

              <NavLink 
                to="/student/purchase-history" 
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isActive ? 'var(--primary, #ea580c)' : 'var(--text-primary, #334155)',
                  backgroundColor: isActive ? '#fff7ed' : 'transparent',
                  fontSize: '0.9375rem'
                })}
              >
                <Receipt size={19} />
                <span>{t('userLayout.purchase_history')}</span>
              </NavLink>
            </div>

            {/* Language Switcher Section */}
            <div style={{ height: '1px', backgroundColor: 'var(--border-light, #f1f5f9)' }} />

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Globe size={13} />
                <span>{i18n.language === 'vi' ? 'Ngôn ngữ hệ thống' : 'System Language'}</span>
              </div>
              <LanguageSwitcher variant="inline" />
            </div>

            {/* Logout Button */}
            <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light, #f1f5f9)' }}>
              <button 
                type="button"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  fontWeight: 600,
                  color: 'var(--danger, #ef4444)',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fee2e2',
                  cursor: 'pointer',
                  fontSize: '0.9375rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <LogOut size={19} />
                <span>{t('userLayout.logout')}</span>
              </button>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <main className="slide-up" style={{ flex: 1, padding: isPaymentResultPage ? '0.5rem 0' : '2rem 0', display: 'flex', flexDirection: 'column', justifyContent: isPaymentResultPage ? 'center' : 'flex-start' }}>
        <Outlet />
      </main>

      {/* Footer */}
      {!isPaymentResultPage && <Footer />}
    </div>
  );
};

export default UserLayout;
