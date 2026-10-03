import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';

const PublicLayout = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setShowLangDropdown(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Top Navbar - Conventional Education Website */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e5e5e5', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="container flex-between" style={{ height: '60px' }}>
          <div className="flex-center" style={{ gap: '2rem' }}>
            <div className="flex-center" style={{ gap: '0.45rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
              <div style={{ width: 28, height: 28, borderRadius: 2, background: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', fontWeight: 800, fontSize: '0.9rem' }}>
                M
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.3px', margin: 0 }}>
                Multi<span style={{ color: '#d97706' }}>lingo</span>
              </h2>
            </div>
            
            <nav style={{ display: 'flex', gap: '1.25rem', fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Trang chủ</span>
              <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/library')}>Luyện thi IELTS</span>
              <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/library')}>Luyện thi TOEIC</span>
              <span style={{ cursor: 'pointer' }} onClick={() => navigate('/student/pricing')}>Bảng giá khóa học</span>
              <span style={{ cursor: 'pointer' }} onClick={() => navigate('/prototype-map')}>Sơ đồ màn hình</span>
            </nav>
          </div>
          
          <div className="flex-center" style={{ gap: '0.75rem' }}>
            {/* Language Switcher Dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <div 
                className="flex-center" 
                style={{ cursor: 'pointer', gap: '0.35rem', color: '#4b5563', padding: '0.35rem 0.5rem', borderRadius: 2, fontSize: '0.82rem', border: '1px solid #e5e5e5' }}
                onClick={() => setShowLangDropdown(!showLangDropdown)}
              >
                <Globe size={15} />
                <span style={{ fontWeight: 500 }}>{i18n.language === 'vi' ? 'Tiếng Việt' : 'English'}</span>
                <ChevronDown size={13} />
              </div>

              {showLangDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  minWidth: '130px',
                  zIndex: 1000,
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  padding: 4
                }}>
                  <div 
                    onClick={() => changeLanguage('vi')}
                    style={{ padding: '0.45rem 0.75rem', cursor: 'pointer', borderRadius: 2, fontSize: '0.82rem', background: i18n.language === 'vi' ? '#fef9c3' : 'transparent', color: '#111827', fontWeight: i18n.language === 'vi' ? 700 : 500 }}
                  >
                    Tiếng Việt (VI)
                  </div>
                  <div 
                    onClick={() => changeLanguage('en')}
                    style={{ padding: '0.45rem 0.75rem', cursor: 'pointer', borderRadius: 2, fontSize: '0.82rem', background: i18n.language === 'en' ? '#fef9c3' : 'transparent', color: '#111827', fontWeight: i18n.language === 'en' ? 700 : 500 }}
                  >
                    English (EN)
                  </div>
                </div>
              )}
            </div>

            <button 
              className="btn btn-outline" 
              onClick={() => navigate('/auth')}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', borderRadius: 2 }}
            >
              Đăng nhập
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('/auth')}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: 2, fontWeight: 700 }}
            >
              Vào học ngay
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* Footer - Conventional */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid #e5e5e5', padding: '2rem 0', marginTop: 'auto', fontSize: '0.85rem' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 2, background: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', fontWeight: 800, fontSize: '0.75rem' }}>M</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: 0 }}>Multilingo Platform</h3>
            </div>
            <p style={{ maxWidth: '320px', lineHeight: 1.45, margin: 0, color: '#6b7280' }}>
              Nền tảng luyện thi chứng chỉ TOEIC & IELTS trực tuyến với ngân hàng đề thi chuẩn hóa và trợ lý AI thông minh.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '3rem' }}>
            <div>
              <h4 style={{ color: '#111827', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.88rem' }}>Khóa học & Luyện thi</h4>
              <p style={{ marginBottom: '0.35rem', cursor: 'pointer' }} onClick={() => navigate('/student/library')}>Đề thi IELTS Academic</p>
              <p style={{ marginBottom: '0.35rem', cursor: 'pointer' }} onClick={() => navigate('/student/library')}>Đề thi TOEIC Listening & Reading</p>
              <p style={{ marginBottom: '0.35rem', cursor: 'pointer' }} onClick={() => navigate('/student/flashcards')}>Từ vựng Flashcard SRS</p>
            </div>
            <div>
              <h4 style={{ color: '#111827', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.88rem' }}>Hỗ trợ học viên</h4>
              <p style={{ marginBottom: '0.35rem', cursor: 'pointer' }}>Hướng dẫn làm bài</p>
              <p style={{ marginBottom: '0.35rem', cursor: 'pointer' }}>Chính sách bảo mật</p>
              <p style={{ marginBottom: '0.35rem', cursor: 'pointer' }}>Liên hệ tư vấn lộ trình</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
