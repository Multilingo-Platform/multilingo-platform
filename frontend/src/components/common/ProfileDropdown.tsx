import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Globe } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { logout } from '../../features/auth/store/authSlice';
import { authApi } from '../../features/auth/api/authApi';
import { alertUtil } from '../../utils/alert';
import { useTranslation } from 'react-i18next';

const ProfileDropdown = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const { user: myInfo } = useSelector((state: any) => state.auth);
  
  const avatarLetter = myInfo?.fullName ? myInfo.fullName.charAt(0).toUpperCase() : 'U';

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
      alertUtil.toast(t('auth.logout_success'), 'success');
    },
    onSettled: () => {
      dispatch(logout());
      navigate('/');
    }
  });

  const handleLogout = async () => {
    setShowProfileMenu(false);
    const isConfirmed = await alertUtil.confirm(t('auth.logout_confirm'), t('auth.logout'), t('auth.cancel'));
    if (isConfirmed) {
      logoutMutation.mutate();
    }
  };

  return (
    <div ref={profileMenuRef} style={{ position: 'relative' }}>
      <div
        style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
        onClick={() => setShowProfileMenu(!showProfileMenu)}
      >
        {avatarLetter}
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
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{myInfo?.fullName || t('auth.default_user')}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{myInfo?.email || t('auth.loading')}</div>
          </div>

          <div
            className="flex-center"
            onClick={() => { setShowProfileMenu(false); navigate('/student/settings'); }}
            style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontWeight: 500, justifyContent: 'flex-start', gap: '0.75rem', color: 'var(--text-primary)' }}
          >
            <User size={18} color="var(--text-secondary)" /> {t('auth.profile_settings')}
          </div>

          <div
            className="flex-center"
            onClick={() => {
              i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi');
              setShowProfileMenu(false);
            }}
            style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontWeight: 500, justifyContent: 'flex-start', gap: '0.75rem', color: 'var(--text-primary)' }}
          >
            <Globe size={18} color="var(--text-secondary)" />
            {i18n.language === 'vi' ? 'Chuyển sang Tiếng Anh' : 'Switch to Vietnamese'}
          </div>

          <div
            className="flex-center"
            onClick={handleLogout}
            style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontWeight: 500, justifyContent: 'flex-start', gap: '0.75rem', color: 'var(--danger)' }}
          >
            <LogOut size={18} /> {t('auth.logout')}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
