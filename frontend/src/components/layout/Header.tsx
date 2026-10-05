import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

interface HeaderProps {
  navItems?: React.ReactNode;
  rightActions?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ navItems, rightActions }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <style>{`
        .desktop-nav {
          display: flex;
        }
        .mobile-toggle {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-primary);
        }
        .mobile-menu {
          display: none;
          flex-direction: column;
          background-color: var(--bg-primary, white);
          position: absolute;
          top: 70px;
          left: 0;
          right: 0;
          padding: 1rem 2rem;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          z-index: 1000;
          gap: 1rem;
          border-bottom: 1px solid var(--border-light, #eee);
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
      <header className="top-nav" style={{ position: 'relative' }}>
        <div className="container flex-between" style={{ height: '70px' }}>
          <div className="flex-center" style={{ gap: '2rem' }}>
            <Link 
              to="/" 
              style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', textDecoration: 'none' }}
            >
              Multilingo
            </Link>
            
            {navItems && (
              <nav className="desktop-nav" style={{ gap: '1.5rem', fontWeight: 600, color: 'var(--text-secondary)', alignItems: 'center' }}>
                {navItems}
              </nav>
            )}
          </div>
          
          {rightActions && (
            <div className="desktop-nav flex-center" style={{ gap: '1.5rem' }}>
              {rightActions}
            </div>
          )}

          {/* Hamburger Icon */}
          <button 
            className="mobile-toggle" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        <div className={`mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
          {navItems && (
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {navItems}
            </nav>
          )}
          {rightActions && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light, #eee)' }}>
              {rightActions}
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
