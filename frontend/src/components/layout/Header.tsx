import React from 'react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  navItems?: React.ReactNode;
  rightActions?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ navItems, rightActions }) => {
  return (
    <header className="top-nav">
      <div className="container flex-between" style={{ height: '70px' }}>
        <div className="flex-center" style={{ gap: '2rem' }}>
          <Link 
            to="/" 
            style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', textDecoration: 'none' }}
          >
            Multilingo
          </Link>
          
          {navItems && (
            <nav style={{ display: 'flex', gap: '1.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {navItems}
            </nav>
          )}
        </div>
        
        {rightActions && (
          <div className="flex-center" style={{ gap: '1.5rem' }}>
            {rightActions}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
