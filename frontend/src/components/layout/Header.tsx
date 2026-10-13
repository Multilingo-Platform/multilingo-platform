import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

interface HeaderProps {
  navItems?: React.ReactNode;
  rightActions?: React.ReactNode;
  mobileContent?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ navItems, rightActions, mobileContent }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Khóa scroll body khi mở menu mobile
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <style>{`
        .header-container {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 70px;
        }
        @media (min-width: 1440px) {
          .header-container {
            padding: 0 2.5rem;
          }
        }
        .desktop-nav {
          display: flex;
          align-items: center;
        }
        .mobile-toggle {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-primary);
          padding: 0.5rem;
          border-radius: 8px;
          transition: background-color 0.2s;
        }
        .mobile-toggle:hover {
          background-color: var(--bg-tertiary, #f8fafc);
        }
        .mobile-menu {
          display: none;
          position: fixed;
          top: 70px;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--bg-primary, white);
          z-index: 999;
          padding: 1.25rem 1.25rem 2.5rem;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          flex-direction: column;
          gap: 1.25rem;
          border-top: 1px solid var(--border-light, #e2e8f0);
        }
        .mobile-menu.open {
          display: flex;
        }
        @media (max-width: 1024px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .desktop-only {
            display: none !important;
          }
        }
        @media (min-width: 1025px) {
          .mobile-menu {
            display: none !important;
          }
          .mobile-only-nav {
            display: none !important;
          }
        }
      `}</style>
      <header className="top-nav" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="header-container">
          {/* Nhóm bên trái: Logo & Navigation chính */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Link 
              to="/" 
              style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', textDecoration: 'none', letterSpacing: '-0.5px' }}
            >
              Multilingo
            </Link>
            
            {navItems && (
              <nav className="desktop-nav" style={{ gap: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {navItems}
              </nav>
            )}
          </div>
          
          {/* Nhóm bên phải: Utility Actions (PRO, Streak, Lang, Avatar) */}
          {rightActions && (
            <div className="desktop-nav" style={{ gap: '0.75rem', marginLeft: 'auto' }}>
              {rightActions}
            </div>
          )}

          {/* Hamburger Icon trên Mobile */}
          <button 
            className="mobile-toggle" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {/* Mobile Drawer (Full height viewport, có thể cuộn, không bị tràn màn hình) */}
        <div className={`mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
          {mobileContent ? (
            mobileContent
          ) : (
            <>
              {navItems && (
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {navItems}
                </nav>
              )}
              {rightActions && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light, #eee)' }}>
                  {rightActions}
                </div>
              )}
            </>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
